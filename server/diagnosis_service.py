#!/usr/bin/env python3
"""Local HTTP inference service for the MedTriage models.

  POST /diagnose  possible conditions, from the diagnosis model (Models/newmodel.joblib)
  POST /triage    a probability for each triage level, from the triage model (Models/triage_model.joblib,
                  built by train_triage_model.py)

Runs in its own Python 3.11+ environment (requirements-diagnosis.txt). The .NET API sends the same raw inputs
to both. The diagnosis model's coding and class names come from diagnosis_model.json, next to this file; the
triage model carries its own.
"""

import json
import math
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, List, Optional

import joblib
import pandas as pd


HERE = Path(__file__).resolve().parent
CONFIG_PATH = Path(os.environ.get("MEDTRIAGE_DIAGNOSIS_CONFIG", str(HERE / "diagnosis_model.json")))
TRIAGE_MODEL_PATH = HERE / "Models" / "triage_model.joblib"
PORT = 8002
# Inputs taken directly from the request; everything else in the model's feature list is a yes/no symptom flag.
NUMERIC = ["age_years", "days_febrile", "temp_c", "heart_rate", "resp_rate", "systolic_bp", "spo2"]
YES_NO = ["pregnant", "rainy_season"]
CODED = ["sex", "avpu", "mobility"]


def as_number(value: Any) -> float:
    if value is None or isinstance(value, bool):
        return math.nan
    try:
        return float(value)
    except (TypeError, ValueError):
        return math.nan


def as_flag(value: Any) -> float:
    if value is None:
        return math.nan
    if not isinstance(value, bool):
        raise ValueError("yes/no inputs must be true, false or null")
    return 1.0 if value else 0.0


def as_code(table: Dict[str, int], value: Any, field: str) -> float:
    if value is None or str(value).strip() == "":
        return math.nan
    key = str(value).strip().lower()
    if field == "sex":
        # Patients store gender as free text ("Female", "M", ...); go by its first letter
        key = {"f": "female", "m": "male"}.get(key[:1], key)
    return float(table[key]) if key in table else math.nan


def encode(payload: Dict[str, Any], features: List[str], codes: Dict[str, Dict[str, int]]) -> Dict[str, float]:
    """One model input row; anything not measured or not asked is NaN."""
    flags = payload.get("symptom_flags") or {}
    if not isinstance(flags, dict):
        raise ValueError("symptom_flags must be an object")
    row: Dict[str, float] = {}
    for name in features:
        if name in NUMERIC:
            row[name] = as_number(payload.get(name))
        elif name in YES_NO:
            row[name] = as_flag(payload.get(name))
        elif name in CODED:
            row[name] = as_code(codes[name], payload.get(name), name)
        else:
            row[name] = as_flag(flags.get(name))
    return row


class Diagnoser:
    def __init__(self, config: Dict[str, Any]) -> None:
        self.config = config
        self.model = joblib.load(HERE / config["model_path"])
        self.features: List[str] = list(self.model.feature_names_in_)
        self.classes: List[int] = [int(c) for c in self.model.classes_]
        labels = config.get("labels") or []
        if len(labels) != len(self.classes):
            raise SystemExit("diagnosis_model.json has {} labels but the model has {} classes".format(len(labels), len(self.classes)))
        self.labels: List[Optional[str]] = labels

    def diagnose(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        row = encode(payload, self.features, self.config)
        provided = sum(1 for v in row.values() if not math.isnan(v))
        if provided < int(self.config.get("min_inputs", 10)):
            # Too little to go on: the imputer would fill most inputs with training medians
            return {"diagnoses": [], "inputs_used": provided, "inputs_total": len(self.features)}

        frame = pd.DataFrame([row], columns=self.features)
        probabilities = self.model.predict_proba(frame)[0]
        ranked = sorted(zip(self.classes, probabilities), key=lambda pair: pair[1], reverse=True)

        diagnoses = []
        for index, (cls, probability) in enumerate(ranked[: int(self.config.get("top_n", 3))]):
            if probability < float(self.config.get("min_probability", 0.05)):
                break
            label = self.labels[self.classes.index(cls)]
            diagnoses.append(
                {
                    "condition": label or "Diagnosis class {} (unlabelled)".format(cls),
                    "probability": round(float(probability), 4),
                    "rationale": "Diagnosis model, from {} of {} inputs.".format(provided, len(self.features))
                    + ("" if self.config.get("codes_confirmed") else " Input coding not yet confirmed against the training data."),
                }
            )
        return {"diagnoses": diagnoses, "inputs_used": provided, "inputs_total": len(self.features)}


# Findings named in the triage explanation: (input, test, wording)
VITAL_FINDINGS = [
    ("spo2", lambda v: v < 92, "SpO2 {:g}%"),
    ("resp_rate", lambda v: v > 20 or v < 9, "respiratory rate {:g}/min"),
    ("heart_rate", lambda v: v > 110 or v < 51, "heart rate {:g} bpm"),
    ("systolic_bp", lambda v: v < 101 or v > 199, "systolic BP {:g} mmHg"),
    ("temp_c", lambda v: v > 38.4 or v < 35, "temperature {:g} \u00b0C"),
]
FLAG_FINDINGS = ["convulsions", "chest_pain", "difficulty_breathing", "bleeding", "neck_stiffness",
                 "abdominal_pain", "dehydration", "blood_in_sputum"]


class TriageModel:
    def __init__(self, path: Path) -> None:
        artifact = joblib.load(path)
        self.pipeline = artifact["pipeline"]
        self.features: List[str] = artifact["features"]
        self.codes: Dict[str, Dict[str, int]] = artifact["codes"]
        self.levels: Dict[int, str] = artifact["levels"]
        self.trained_on: str = artifact.get("labelled_by", "")

    def triage(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        row = encode(payload, self.features, self.codes)
        frame = pd.DataFrame([row], columns=self.features)
        probabilities = self.pipeline.predict_proba(frame)[0]
        by_level = {int(cls): round(float(p), 4) for cls, p in zip(self.pipeline.classes_, probabilities)}
        level = max(by_level, key=lambda k: (by_level[k], -k))  # ties go to the more urgent level

        findings = [text.format(row[name]) for name, test, text in VITAL_FINDINGS
                    if not math.isnan(row[name]) and test(row[name])]
        if row.get("avpu", 0) > 0:
            findings.append("responds only to " + str(payload.get("avpu")) if row["avpu"] < 3 else "unresponsive")
        if row.get("mobility", 0) > 0:
            findings.append("walks with help" if row["mobility"] == 1 else "immobile")
        findings += [f.replace("_", " ") for f in FLAG_FINDINGS if row.get(f) == 1.0]

        age = row.get("age_years", math.nan)
        return {
            "level": level,
            "triage_level": self.levels[level],
            "probabilities": {str(k): v for k, v in sorted(by_level.items())},
            "findings": findings,
            "inputs_used": sum(1 for v in row.values() if not math.isnan(v)),
            "inputs_total": len(self.features),
            "note": "Trained on patients aged 12 and over." if not math.isnan(age) and age < 12 else None,
        }


class DiagnosisHandler(BaseHTTPRequestHandler):
    diagnoser: Diagnoser
    triage_model: TriageModel

    def _send_json(self, status: int, body: Dict[str, Any]) -> None:
        encoded = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self) -> None:
        if self.path != "/health":
            self._send_json(404, {"error": "not_found"})
            return
        self._send_json(200, {"status": "ready", "models": ["triage", "diagnosis"], "diagnosis_classes": len(self.diagnoser.classes)})

    def do_POST(self) -> None:
        if self.path not in ("/diagnose", "/triage"):
            self._send_json(404, {"error": "not_found"})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length < 1 or length > 1_000_000:
                self._send_json(413, {"error": "request_size_invalid"})
                return
            payload = json.loads(self.rfile.read(length))
            if not isinstance(payload, dict):
                raise ValueError("request body must be a JSON object")
            if self.path == "/triage":
                self._send_json(200, self.triage_model.triage(payload))
            else:
                self._send_json(200, self.diagnoser.diagnose(payload))
        except (json.JSONDecodeError, ValueError, TypeError, KeyError) as exc:
            self._send_json(400, {"error": "invalid_request", "detail": str(exc)})
        except Exception as exc:
            self._send_json(503, {"error": "model_inference_failed", "detail": str(exc)})

    def log_message(self, format: str, *args: Any) -> None:
        # Avoid logging request bodies or patient details.
        print("[diagnosis-service] " + format % args)


def main() -> None:
    config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))
    if not (HERE / config["model_path"]).is_file():
        raise SystemExit("Diagnosis model not found at {}".format(HERE / config["model_path"]))
    if not TRIAGE_MODEL_PATH.is_file():
        raise SystemExit("Triage model not found at {}. Build it with train_triage_model.py".format(TRIAGE_MODEL_PATH))

    DiagnosisHandler.diagnoser = Diagnoser(config)
    DiagnosisHandler.triage_model = TriageModel(TRIAGE_MODEL_PATH)
    server = ThreadingHTTPServer(("127.0.0.1", PORT), DiagnosisHandler)
    print("MedTriage diagnosis model ready at http://127.0.0.1:{}/diagnose".format(PORT))
    print("Loaded model artifact: {}".format(HERE / config["model_path"]))
    print("MedTriage triage model ready at http://127.0.0.1:{}/triage ({})".format(PORT, TRIAGE_MODEL_PATH.name))
    if not any(DiagnosisHandler.diagnoser.labels):
        print("Warning: no class labels in {}; diagnoses show as 'Diagnosis class N'".format(CONFIG_PATH))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping diagnosis service")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
