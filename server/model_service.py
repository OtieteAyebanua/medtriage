#!/usr/bin/env python3
"""Local HTTP inference service for the trained MedTriage Random Forest."""

import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import joblib
import pandas as pd
from model_features import rule_indicator_features, split_blood_pressure


LEVELS = {
    1: "immediate",
    2: "emergent",
    3: "urgent",
    4: "less_urgent",
    5: "non_urgent",
}
MODEL_PATH = Path(
    os.environ.get(
        "MEDTRIAGE_MODEL_PATH",
        str(Path(__file__).resolve().parent / "artifacts" / "triage_random_forest.joblib"),
    )
)


def make_features(payload: Dict[str, Any]) -> pd.DataFrame:
    patient = payload.get("patient") or {}
    vitals = payload.get("vitals") or {}
    systolic, diastolic = split_blood_pressure(vitals.get("blood_pressure"))

    symptom_parts = []
    for symptom in payload.get("symptoms") or []:
        parts = [str(symptom.get("name") or "")]
        if symptom.get("severity"):
            parts.append("severity " + str(symptom["severity"]))
        if symptom.get("duration"):
            parts.append("duration " + str(symptom["duration"]))
        if symptom.get("notes"):
            parts.append("notes " + str(symptom["notes"]))
        symptom_parts.append("; ".join(parts))

    context_parts = [patient.get("chronic_conditions"), patient.get("allergies")]
    context = " ".join(str(part) for part in context_parts if part) or "no relevant history recorded"
    row = {
        "age": patient.get("age"),
        "temperature": vitals.get("temperature"),
        "systolic_bp": systolic,
        "diastolic_bp": diastolic,
        "heart_rate": vitals.get("heart_rate"),
        "oxygen_level": vitals.get("oxygen_level"),
        "respiratory_rate": vitals.get("respiratory_rate"),
        "sex": patient.get("sex") or "unknown",
        "visit_type": payload.get("visit_type") or "unknown",
        "chief_complaint": payload.get("chief_complaint") or "",
        "symptom_text": " ".join(symptom_parts) or "no symptoms recorded",
        "medical_context": context,
    }
    row.update(
        rule_indicator_features(
            payload.get("chief_complaint"),
            [symptom.get("name", "") for symptom in payload.get("symptoms") or []],
            vitals.get("temperature"),
            vitals.get("oxygen_level"),
            vitals.get("heart_rate"),
            vitals.get("respiratory_rate"),
        )
    )
    return pd.DataFrame([row])


class ModelHandler(BaseHTTPRequestHandler):
    bundle: Dict[str, Any] = {}

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
        self._send_json(200, {"status": "ready", "model": "MedTriage Random Forest"})

    def do_POST(self) -> None:
        if self.path != "/triage":
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

            model = self.bundle["model"]
            features = make_features(payload)
            score = int(model.predict(features)[0])
            classes = [int(value) for value in model.named_steps["classifier"].classes_]
            probabilities = model.predict_proba(features)[0]
            confidence = float(probabilities[classes.index(score)])
            level = LEVELS.get(score)
            if level is None:
                raise ValueError("model returned an unsupported triage level")

            self._send_json(
                200,
                {
                    "urgency_score": score,
                    "triage_level": level,
                    "confidence": round(confidence, 4),
                    "reasoning": "The MedTriage Random Forest predicts Level {} ({}) from the recorded triage inputs.".format(
                        score, level
                    ),
                    "suggested_tests": [],
                    "differential_diagnosis": [],
                },
            )
        except (json.JSONDecodeError, ValueError, TypeError, KeyError) as exc:
            self._send_json(400, {"error": "invalid_request", "detail": str(exc)})
        except Exception as exc:
            self._send_json(503, {"error": "model_inference_failed", "detail": str(exc)})

    def log_message(self, format: str, *args: Any) -> None:
        # Avoid logging request bodies or patient details.
        print("[model-service] " + format % args)


def main() -> None:
    if not MODEL_PATH.is_file():
        raise SystemExit(
            "Model artifact not found at {}. Train it first with: python train_random_forest.py --min-rows 20".format(
                MODEL_PATH
            )
        )

    ModelHandler.bundle = joblib.load(MODEL_PATH)
    host = "127.0.0.1"
    port = 8001
    server = ThreadingHTTPServer((host, port), ModelHandler)
    print("MedTriage Random Forest ready at http://{}:{}/triage".format(host, port))
    print("Loaded model artifact: {}".format(MODEL_PATH))
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping model service")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
