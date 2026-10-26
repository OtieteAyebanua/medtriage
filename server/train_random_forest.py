#!/usr/bin/env python3
"""Train a triage-level Random Forest from reviewed MedTriage SQLite encounters.

Only clinician-reviewed records are used. Patient identifiers are used to keep
one patient's visits on the same side of the evaluation split, and are never
passed to the model or written into the model artifact.
"""

import argparse
import json
import re
import sqlite3
import sys
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple

import joblib
import pandas as pd
import sklearn
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import GroupShuffleSplit
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from model_features import (
    CATEGORICAL_FEATURES,
    FEATURE_COLUMNS,
    NUMERIC_FEATURES,
    TEXT_FEATURES,
    rule_indicator_features,
    split_blood_pressure,
)


LEVEL_TO_SCORE = {
    "immediate": 1,
    "emergent": 2,
    "urgent": 3,
    "less_urgent": 4,
    "non_urgent": 5,
}
SCORE_TO_LEVEL = {score: level for level, score in LEVEL_TO_SCORE.items()}

def age_at_visit(date_of_birth: str, visit_date: str) -> int:
    """Compute age at encounter date, without including patient identity."""
    born = date.fromisoformat(date_of_birth[:10])
    visited = datetime.fromisoformat(visit_date.replace("Z", "+00:00")).date()
    return max(0, visited.year - born.year - ((visited.month, visited.day) < (born.month, born.day)))


def load_encounters(database: Path) -> Tuple[pd.DataFrame, List[str]]:
    """Load reviewed records and symptoms from the app's EF Core SQLite schema."""
    if not database.is_file():
        raise FileNotFoundError("Database not found: {}".format(database))

    connection = sqlite3.connect(str(database))
    connection.row_factory = sqlite3.Row
    try:
        records = connection.execute(
            """
            SELECT r.record_id, r.patient_id, p.date_of_birth, p.gender,
                   p.chronic_conditions, p.allergies, r.visit_type,
                   r.chief_complaint, r.vitals_temperature,
                   r.vitals_blood_pressure, r.vitals_heart_rate,
                   r.vitals_oxygen_level, r.vitals_respiratory_rate,
                   r.final_triage_level, r.override_status, r.visit_date
            FROM patient_records AS r
            JOIN patients AS p ON p.patient_id = r.patient_id
            WHERE r.override_status IN ('accepted', 'overridden')
              AND r.final_triage_level IN
                  ('immediate', 'emergent', 'urgent', 'less_urgent', 'non_urgent')
            ORDER BY r.record_id
            """
        ).fetchall()

        symptom_rows = connection.execute(
            """
            SELECT rs.record_id, s.symptom_name, rs.severity, rs.duration, rs.notes
            FROM record_symptoms AS rs
            JOIN symptoms AS s ON s.symptom_id = rs.symptom_id
            ORDER BY rs.record_id, s.symptom_name
            """
        ).fetchall()
    finally:
        connection.close()

    symptoms_by_record: Dict[int, List[str]] = {}
    symptom_names_by_record: Dict[int, List[str]] = {}
    for row in symptom_rows:
        symptom_names_by_record.setdefault(row["record_id"], []).append(str(row["symptom_name"] or ""))
        pieces = [str(row["symptom_name"] or "")]
        if row["severity"]:
            pieces.append("severity " + str(row["severity"]))
        if row["duration"]:
            pieces.append("duration " + str(row["duration"]))
        if row["notes"]:
            pieces.append("notes " + str(row["notes"]))
        symptoms_by_record.setdefault(row["record_id"], []).append("; ".join(pieces))

    samples: List[Dict[str, Any]] = []
    groups: List[str] = []
    for row in records:
        systolic, diastolic = split_blood_pressure(row["vitals_blood_pressure"])
        sample = {
                "age": age_at_visit(row["date_of_birth"], row["visit_date"]),
                "temperature": row["vitals_temperature"],
                "systolic_bp": systolic,
                "diastolic_bp": diastolic,
                "heart_rate": row["vitals_heart_rate"],
                "oxygen_level": row["vitals_oxygen_level"],
                "respiratory_rate": row["vitals_respiratory_rate"],
                "sex": row["gender"] or "unknown",
                "visit_type": row["visit_type"] or "unknown",
                "chief_complaint": row["chief_complaint"] or "",
                "symptom_text": " ".join(symptoms_by_record.get(row["record_id"], [])) or "no symptoms recorded",
                "medical_context": " ".join(
                    value for value in [row["chronic_conditions"], row["allergies"]] if value
                ) or "no relevant history recorded",
                "target_score": LEVEL_TO_SCORE[row["final_triage_level"]],
            }
        sample.update(
            rule_indicator_features(
                row["chief_complaint"],
                symptom_names_by_record.get(row["record_id"], []),
                row["vitals_temperature"],
                row["vitals_oxygen_level"],
                row["vitals_heart_rate"],
                row["vitals_respiratory_rate"],
            )
        )
        samples.append(sample)
        # Only used to prevent patient-level leakage in evaluation.
        groups.append(str(row["patient_id"]))

    return pd.DataFrame(samples), groups


def load_json_encounters(data_file: Path) -> Tuple[pd.DataFrame, List[str]]:
    """Load encounter objects from a JSON array or JSONL file."""
    if not data_file.is_file():
        raise FileNotFoundError("JSON training file not found: {}".format(data_file))

    raw = data_file.read_text(encoding="utf-8")
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            records = parsed
        elif isinstance(parsed, dict) and isinstance(parsed.get("records"), list):
            records = parsed["records"]
            declared_count = parsed.get("record_count")
            if declared_count is not None and declared_count != len(records):
                raise ValueError(
                    "JSON declares {} records but contains {}".format(declared_count, len(records))
                )
        else:
            records = [parsed]
    except json.JSONDecodeError:
        records = []
        for line_number, line in enumerate(raw.splitlines(), start=1):
            if not line.strip():
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError as exc:
                raise ValueError("invalid JSON on line {}: {}".format(line_number, exc))

    samples: List[Dict[str, Any]] = []
    groups: List[str] = []
    for index, record in enumerate(records, start=1):
        if not isinstance(record, dict):
            raise ValueError("record {} must be a JSON object".format(index))

        review_status = str(record.get("override_status") or "accepted").lower()
        if review_status == "pending":
            continue
        if review_status not in ("accepted", "overridden"):
            raise ValueError(
                "record {} has invalid override_status {!r}".format(index, review_status)
            )

        patient = record.get("patient") or {}
        vitals = record.get("vitals") or {}
        label = record.get("label") or {}
        if not isinstance(patient, dict) or not isinstance(vitals, dict) or not isinstance(label, dict):
            raise ValueError("record {} patient, vitals, and label must be JSON objects".format(index))
        target_level = record.get("final_triage_level") or label.get("final_triage_level")
        if not isinstance(target_level, str) or target_level not in LEVEL_TO_SCORE:
            raise ValueError(
                "record {} needs final_triage_level with one of: {}".format(
                    index, ", ".join(LEVEL_TO_SCORE)
                )
            )

        systolic, diastolic = split_blood_pressure(vitals.get("blood_pressure"))
        symptoms = record.get("symptoms") or []
        if not isinstance(symptoms, list):
            raise ValueError("record {} symptoms must be an array".format(index))
        symptom_parts = []
        for symptom in symptoms:
            if not isinstance(symptom, dict):
                raise ValueError("record {} symptoms must contain objects".format(index))
            parts = [str(symptom.get("name") or "")]
            if symptom.get("severity"):
                parts.append("severity " + str(symptom["severity"]))
            if symptom.get("duration"):
                parts.append("duration " + str(symptom["duration"]))
            if symptom.get("notes"):
                parts.append("notes " + str(symptom["notes"]))
            symptom_parts.append("; ".join(parts))

        context = " ".join(
            str(value)
            for value in [patient.get("chronic_conditions"), patient.get("allergies")]
            if value
        ) or "no relevant history recorded"
        sample = {
                "age": patient.get("age"),
                "temperature": vitals.get("temperature"),
                "systolic_bp": systolic,
                "diastolic_bp": diastolic,
                "heart_rate": vitals.get("heart_rate"),
                "oxygen_level": vitals.get("oxygen_level"),
                "respiratory_rate": vitals.get("respiratory_rate"),
                "sex": patient.get("sex") or "unknown",
                "visit_type": record.get("visit_type") or "unknown",
                "chief_complaint": record.get("chief_complaint") or "",
                "symptom_text": " ".join(symptom_parts) or "no symptoms recorded",
                "medical_context": context,
                "target_score": LEVEL_TO_SCORE[target_level],
            }
        sample.update(
            rule_indicator_features(
                record.get("chief_complaint"),
                [symptom.get("name", "") for symptom in symptoms],
                vitals.get("temperature"),
                vitals.get("oxygen_level"),
                vitals.get("heart_rate"),
                vitals.get("respiratory_rate"),
            )
        )
        samples.append(sample)
        # A supplied patient_id keeps repeat visits together in evaluation. Otherwise,
        # each JSON row is treated as a distinct synthetic patient and is never a feature.
        patient_id = record.get("patient_id")
        groups.append("patient-{}".format(patient_id) if patient_id is not None else "json-row-{}".format(index))

    return pd.DataFrame(samples), groups


def make_pipeline() -> Pipeline:
    preprocessor = ColumnTransformer(
        transformers=[
            (
                "numeric",
                SimpleImputer(strategy="constant", fill_value=0, add_indicator=True),
                NUMERIC_FEATURES,
            ),
            (
                "categorical",
                Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="constant", fill_value="unknown")),
                        ("one_hot", OneHotEncoder(handle_unknown="ignore")),
                    ]
                ),
                CATEGORICAL_FEATURES,
            ),
            ("complaint_text", TfidfVectorizer(ngram_range=(1, 2), max_features=5000), "chief_complaint"),
            ("symptom_text", TfidfVectorizer(ngram_range=(1, 2), max_features=5000), "symptom_text"),
            ("medical_context", TfidfVectorizer(ngram_range=(1, 2), max_features=2000), "medical_context"),
        ],
        remainder="drop",
    )

    return Pipeline(
        steps=[
            ("features", preprocessor),
            (
                "classifier",
                RandomForestClassifier(
                    n_estimators=400,
                    class_weight="balanced_subsample",
                    min_samples_leaf=2,
                    random_state=42,
                    n_jobs=-1,
                ),
            ),
        ]
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--data",
        type=Path,
        help="JSON array or JSONL encounters file (when set, this replaces --database)",
    )
    parser.add_argument(
        "--database",
        type=Path,
        default=Path(__file__).resolve().parent / "medtriage.db",
        help="MedTriage SQLite database (default: server/medtriage.db)",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parent / "artifacts" / "triage_random_forest.joblib",
        help="Path for the trained model artifact",
    )
    parser.add_argument("--test-size", type=float, default=0.2, help="Patient-group holdout fraction (default: 0.2)")
    parser.add_argument(
        "--min-rows",
        type=int,
        default=50,
        help="Refuse to train with fewer reviewed encounters (default: 50; demo seed is smaller)",
    )
    args = parser.parse_args()

    if not 0.1 <= args.test_size <= 0.5:
        parser.error("--test-size must be between 0.1 and 0.5")

    try:
        if args.data:
            data, patient_groups = load_json_encounters(args.data)
        else:
            data, patient_groups = load_encounters(args.database)
    except (FileNotFoundError, sqlite3.Error, KeyError, ValueError, json.JSONDecodeError) as exc:
        print("Could not load training data: {}".format(exc), file=sys.stderr)
        return 2

    if len(data) < args.min_rows:
        print(
            "Only {} reviewed encounters found; need at least {}. "
            "Collect more clinician-reviewed data before training.".format(len(data), args.min_rows),
            file=sys.stderr,
        )
        return 2

    if data["target_score"].nunique() < 2:
        print("Training requires at least two different final triage levels.", file=sys.stderr)
        return 2

    print("Reviewed encounter counts by level:")
    for score in range(1, 6):
        level = SCORE_TO_LEVEL[score]
        count = int((data["target_score"] == score).sum())
        print("  {} ({}): {}".format(score, level, count))
    print(
        "\nSynthetic demo records can exercise the training workflow, but metrics from them "
        "are not evidence of clinical performance."
    )

    groups = pd.Series(patient_groups)
    splitter = GroupShuffleSplit(n_splits=1, test_size=args.test_size, random_state=42)
    train_idx, test_idx = next(splitter.split(data, data["target_score"], groups))
    x_train = data.iloc[train_idx][FEATURE_COLUMNS]
    x_test = data.iloc[test_idx][FEATURE_COLUMNS]
    y_train = data.iloc[train_idx]["target_score"]
    y_test = data.iloc[test_idx]["target_score"]

    if y_train.nunique() < 2:
        print(
            "The patient-level training split contains only one triage level. "
            "Collect a more representative dataset or adjust --test-size.",
            file=sys.stderr,
        )
        return 2

    evaluation_model = make_pipeline()
    evaluation_model.fit(x_train, y_train)
    predictions = evaluation_model.predict(x_test)
    labels = list(range(1, 6))
    target_names = ["{} ({})".format(score, SCORE_TO_LEVEL[score]) for score in labels]

    report = classification_report(
        y_test,
        predictions,
        labels=labels,
        target_names=target_names,
        zero_division=0,
        output_dict=True,
    )
    print("\nPatient-held-out evaluation ({} train, {} test):".format(len(train_idx), len(test_idx)))
    print("Accuracy: {:.3f}".format(accuracy_score(y_test, predictions)))
    print(
        classification_report(
            y_test,
            predictions,
            labels=labels,
            target_names=target_names,
            zero_division=0,
        )
    )
    print("Confusion matrix (rows=true, columns=predicted; levels 1–5):")
    print(confusion_matrix(y_test, predictions, labels=labels))

    # Refit on all reviewed encounters only after producing the held-out evaluation.
    final_model = make_pipeline()
    final_model.fit(data[FEATURE_COLUMNS], data["target_score"])

    output_path = args.output.resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    bundle = {
        "model": final_model,
        "target_levels": SCORE_TO_LEVEL,
        "feature_columns": FEATURE_COLUMNS,
        "training_rows": len(data),
        "training_class_counts": {
            SCORE_TO_LEVEL[int(score)]: int(count)
            for score, count in data["target_score"].value_counts().items()
        },
        "holdout_patient_count": int(groups.iloc[test_idx].nunique()),
        "holdout_metrics": {
            "accuracy": float(accuracy_score(y_test, predictions)),
            "classification_report": report,
        },
        "trained_at_utc": datetime.now(timezone.utc).isoformat(),
        "scikit_learn_version": sklearn.__version__,
    }
    joblib.dump(bundle, output_path)
    print("Saved model artifact: {}".format(output_path))
    print("The artifact contains no patient names, emails, or patient IDs.")
    print("Restart `python model_service.py` to load this artifact for triage inference.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
