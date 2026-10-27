#!/usr/bin/env python3
"""Local HTTP inference service for the MedTriage diagnosis model (Models/newmodel.joblib).

Runs in its own Python 3.11+ environment (requirements-diagnosis.txt). The .NET API sends raw inputs;
the coding of text values and the class names come from diagnosis_model.json, next to this file.
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

    def row(self, payload: Dict[str, Any]) -> Dict[str, float]:
        flags = payload.get("symptom_flags") or {}
        if not isinstance(flags, dict):
            raise ValueError("symptom_flags must be an object")
        row: Dict[str, float] = {}
        for name in self.features:
            if name in NUMERIC:
                row[name] = as_number(payload.get(name))
            elif name in YES_NO:
                row[name] = as_flag(payload.get(name))
            elif name in CODED:
                row[name] = as_code(self.config[name], payload.get(name), name)
            else:
                row[name] = as_flag(flags.get(name))
        return row

    def diagnose(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        row = self.row(payload)
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


class DiagnosisHandler(BaseHTTPRequestHandler):
    diagnoser: Diagnoser

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
        self._send_json(200, {"status": "ready", "model": "MedTriage diagnosis model", "classes": len(self.diagnoser.classes)})

    def do_POST(self) -> None:
        if self.path != "/diagnose":
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

    DiagnosisHandler.diagnoser = Diagnoser(config)
    server = ThreadingHTTPServer(("127.0.0.1", PORT), DiagnosisHandler)
    print("MedTriage diagnosis model ready at http://127.0.0.1:{}/diagnose".format(PORT))
    print("Loaded model artifact: {}".format(HERE / config["model_path"]))
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
