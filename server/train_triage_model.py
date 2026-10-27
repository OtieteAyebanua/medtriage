#!/usr/bin/env python3
"""Train the MedTriage triage-level model (Models/triage_model.joblib).

The model is a Random Forest that gives a probability for each triage level (1 = immediate ... 5 = non-urgent)
from the same 45 inputs as the diagnosis model. There is no real labelled data yet, so it is trained on
synthetic patients labelled with the South African Triage Scale (SATS, adult version):

  - TEWS score from mobility, respiratory rate, heart rate, systolic BP, temperature and AVPU
    (0-2 green, 3-4 yellow, 5-6 orange, 7+ red)
  - emergency and very-urgent signs, which can only make the colour more urgent
  - red -> 1, orange -> 2, yellow -> 3; green splits into 4 (has symptoms or TEWS 2) and 5 (otherwise),
    because SATS has one green level and the app has two
  - SpO2 is not part of SATS; the commonly used adaptation is applied (< 92% very urgent, < 85% emergency)

Labels come from each synthetic patient's full, true findings. The model then sees a copy with some values
missing (not measured) and with some labels moved one level (clinicians disagree), so its probabilities
reflect real uncertainty rather than restating a formula.

Synthetic data is for building and demonstrating the software. It is not clinical evidence.

    .venv-diagnosis/bin/python train_triage_model.py            # train and save
    .venv-diagnosis/bin/python train_triage_model.py --csv out.csv   # also write the generated data
"""

import argparse
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Tuple

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline

HERE = Path(__file__).resolve().parent
OUTPUT = HERE / "Models" / "triage_model.joblib"
SEED = 20261027

NUMERIC = ["age_years", "days_febrile", "temp_c", "heart_rate", "resp_rate", "systolic_bp", "spo2"]
FLAGS = [
    "chills", "headache", "vomiting", "nausea", "diarrhea", "constipation", "abdominal_pain", "cough", "sputum",
    "blood_in_sputum", "chest_pain", "difficulty_breathing", "sore_throat", "runny_nose", "loss_of_smell", "rash",
    "itching", "neck_stiffness", "convulsions", "bleeding", "joint_muscle_pain", "pain_behind_eyes", "red_eyes",
    "jaundice", "dark_urine", "dysuria", "urinary_frequency", "fatigue", "loss_of_appetite", "sweating",
    "weight_loss", "swollen_lymph_nodes", "dehydration",
]
# Same column order and coding as the diagnosis model, so the sidecar builds one row for both
FEATURES = (
    ["age_years", "sex", "pregnant", "rainy_season", "days_febrile", "temp_c", "heart_rate", "resp_rate",
     "systolic_bp", "spo2", "avpu", "mobility"] + FLAGS
)
CODES = {
    "sex": {"female": 0, "male": 1},
    "avpu": {"alert": 0, "voice": 1, "pain": 2, "unresponsive": 3},
    "mobility": {"walking": 0, "with_help": 1, "immobile": 2},
}
LEVELS = {1: "immediate", 2: "emergent", 3: "urgent", 4: "less_urgent", 5: "non_urgent"}

# ---- Synthetic patients ----
# Each presentation: (weight, fever, {symptom: probability}, vital shifts per severity step)
PRESENTATIONS: Dict[str, Tuple[float, bool, Dict[str, float], Dict[str, float]]] = {
    "malaria": (14, True, {"chills": .8, "headache": .75, "vomiting": .4, "nausea": .4, "joint_muscle_pain": .5,
                           "fatigue": .6, "sweating": .5, "loss_of_appetite": .4, "convulsions": .04, "dark_urine": .1},
                {"hr": 9, "rr": 2, "sbp": -6, "avpu": .12, "mob": .25}),
    "pneumonia": (10, True, {"cough": .95, "sputum": .7, "difficulty_breathing": .6, "chest_pain": .3, "chills": .4,
                             "fatigue": .5, "blood_in_sputum": .05},
                  {"hr": 10, "rr": 5, "spo2": -4, "sbp": -5, "avpu": .06, "mob": .3}),
    "urti": (12, False, {"runny_nose": .85, "sore_throat": .7, "cough": .6, "headache": .3, "fatigue": .3,
                         "loss_of_smell": .15},
             {"hr": 3, "rr": 1, "spo2": -.5}),
    "gastroenteritis": (10, False, {"diarrhea": .9, "vomiting": .7, "nausea": .6, "abdominal_pain": .6,
                                    "dehydration": .45, "loss_of_appetite": .4, "fatigue": .3},
                        {"hr": 11, "sbp": -10, "rr": 1, "avpu": .05, "mob": .25}),
    "typhoid": (7, True, {"abdominal_pain": .7, "headache": .7, "constipation": .35, "diarrhea": .3,
                          "loss_of_appetite": .6, "fatigue": .6, "nausea": .3},
                {"hr": 6, "sbp": -6, "avpu": .05, "mob": .2}),
    "dengue": (5, True, {"rash": .6, "pain_behind_eyes": .6, "joint_muscle_pain": .8, "headache": .7,
                         "red_eyes": .3, "bleeding": .1, "vomiting": .3},
               {"hr": 9, "sbp": -12, "avpu": .05, "mob": .2}),
    "meningitis": (2, True, {"neck_stiffness": .85, "headache": .9, "vomiting": .5, "convulsions": .2, "rash": .2},
                   {"hr": 12, "rr": 3, "sbp": -8, "avpu": .35, "mob": .45}),
    "uti": (8, False, {"dysuria": .9, "urinary_frequency": .8, "abdominal_pain": .35, "chills": .2, "dark_urine": .1},
            {"hr": 5, "sbp": -4, "mob": .1}),
    "hepatitis": (3, False, {"jaundice": .85, "dark_urine": .7, "fatigue": .7, "loss_of_appetite": .7,
                             "abdominal_pain": .5, "nausea": .4, "itching": .3},
                  {"hr": 4, "sbp": -4, "avpu": .06, "mob": .2}),
    "tuberculosis": (4, True, {"cough": .95, "weight_loss": .7, "sweating": .7, "sputum": .6, "blood_in_sputum": .3,
                               "fatigue": .6, "swollen_lymph_nodes": .3, "difficulty_breathing": .3},
                     {"hr": 6, "rr": 3, "spo2": -2, "mob": .2}),
    "asthma_copd": (5, False, {"difficulty_breathing": .95, "cough": .8, "chest_pain": .2, "sputum": .3, "fatigue": .3},
                    {"hr": 12, "rr": 6, "spo2": -4, "avpu": .05, "mob": .35}),
    "cardiac": (4, False, {"chest_pain": .9, "difficulty_breathing": .5, "sweating": .5, "nausea": .3, "fatigue": .4},
                {"hr": 14, "rr": 3, "spo2": -2, "sbp": -12, "avpu": .1, "mob": .4}),
    "sepsis": (3, True, {"chills": .6, "fatigue": .7, "vomiting": .3, "dehydration": .3, "difficulty_breathing": .3},
               {"hr": 18, "rr": 5, "spo2": -3, "sbp": -20, "avpu": .3, "mob": .5}),
    "minor": (13, False, {"headache": .3, "fatigue": .25, "itching": .15, "rash": .15, "joint_muscle_pain": .2,
                          "sore_throat": .1, "abdominal_pain": .08, "constipation": .1},
              {"hr": 1}),
}
SEVERITY_WEIGHTS = [0.52, 0.30, 0.13, 0.05]  # mild, moderate, severe, critical


def synthetic_patient(rng: np.random.Generator) -> Dict[str, float]:
    names = list(PRESENTATIONS)
    weights = np.array([PRESENTATIONS[n][0] for n in names], dtype=float)
    weight, fever, symptoms, shift = PRESENTATIONS[names[rng.choice(len(names), p=weights / weights.sum())]]
    sev = int(rng.choice(4, p=SEVERITY_WEIGHTS))

    age = float(np.clip(rng.gamma(4.0, 9.0) + 12, 12, 95))
    sex = int(rng.random() < 0.5)
    row: Dict[str, float] = {"age_years": round(age), "sex": sex}
    row["pregnant"] = float(sex == 0 and 15 <= age <= 45 and rng.random() < 0.12)
    row["rainy_season"] = float(rng.random() < 0.5)

    older = max(0.0, (age - 60) / 30)
    feverish = fever and rng.random() < 0.85
    temp = rng.normal(36.8, 0.35)
    if feverish:
        temp += rng.normal(1.4, 0.5) + 0.35 * sev
    if sev == 3 and rng.random() < 0.15:
        temp = rng.normal(34.6, 0.5)  # cold, septic
    row["temp_c"] = round(float(np.clip(temp, 33.0, 42.5)), 1)
    row["days_febrile"] = float(rng.integers(1, 6) + (rng.integers(0, 15) if rng.random() < 0.15 else 0)) if feverish else 0.0

    hr = rng.normal(80, 10) + shift.get("hr", 0) * sev + (12 if feverish else 0)
    rr = rng.normal(16, 2.5) + shift.get("rr", 0) * sev
    sbp = rng.normal(122 + 15 * older, 14) + shift.get("sbp", 0) * sev
    spo2 = rng.normal(97.5, 1.2) + shift.get("spo2", 0) * sev
    if sev == 3 and rng.random() < 0.1:
        hr = rng.normal(42, 6)  # bradycardic collapse
    row["heart_rate"] = round(float(np.clip(hr, 30, 200)))
    row["resp_rate"] = round(float(np.clip(rr, 6, 50)))
    row["systolic_bp"] = round(float(np.clip(sbp, 55, 230)))
    row["spo2"] = round(float(np.clip(spo2, 70, 100)))

    p_avpu = min(0.9, shift.get("avpu", 0.0) * sev)
    row["avpu"] = float(rng.choice(4, p=[1 - p_avpu, p_avpu * 0.55, p_avpu * 0.3, p_avpu * 0.15]) if p_avpu else 0)
    p_mob = min(0.95, shift.get("mob", 0.05) * sev + 0.15 * older)
    row["mobility"] = float(rng.choice(3, p=[1 - p_mob, p_mob * 0.65, p_mob * 0.35]) if p_mob else 0)

    boost = 1 + 0.15 * sev
    for flag in FLAGS:
        p = min(0.98, symptoms.get(flag, 0.0) * boost) + 0.015
        row[flag] = float(rng.random() < p)
    if sev >= 2 and symptoms.get("convulsions", 0) and rng.random() < 0.12 * sev:
        row["convulsions"] = 1.0
    return row


# ---- SATS (adult) ----

def band(value: float, cuts: List[Tuple[float, int]], above: int) -> int:
    for limit, score in cuts:
        if value < limit:
            return score
    return above


def tews(row: Dict[str, float]) -> int:
    return (
        int(row["mobility"])
        + band(row["resp_rate"], [(9, 2), (15, 0), (21, 1), (30, 2)], 3)
        + band(row["heart_rate"], [(41, 2), (51, 1), (101, 0), (111, 1), (130, 2)], 3)
        + band(row["systolic_bp"], [(71, 3), (81, 2), (101, 1), (200, 0)], 2)
        + band(row["temp_c"], [(35, 2), (38.5, 0)], 2)
        + int(row["avpu"])
    )


def sats_level(row: Dict[str, float]) -> int:
    score = tews(row)
    level = 1 if score >= 7 else 2 if score >= 5 else 3 if score >= 3 else 4
    on = lambda flag: row[flag] == 1.0  # noqa: E731

    # Emergency signs: seizure, breathing compromise
    if on("convulsions") or row["spo2"] < 85:
        level = 1
    # Very urgent: acute shortness of breath, chest pain, haemorrhage, reduced consciousness, pregnant with abdominal pain
    if (on("difficulty_breathing") or on("chest_pain") or on("bleeding") or row["avpu"] > 0 or row["spo2"] < 92
            or (on("pregnant") and on("abdominal_pain"))):
        level = min(level, 2)
    # Urgent: abdominal pain, dehydration / persistent vomiting
    if on("abdominal_pain") or on("dehydration") or (on("vomiting") and on("diarrhea")):
        level = min(level, 3)
    # Green: 4 with symptoms or a borderline score, 5 otherwise
    if level == 4 and score <= 1 and sum(row[f] for f in FLAGS) <= 1:
        level = 5
    return level


# ---- What the model sees ----

def as_recorded(row: Dict[str, float], rng: np.random.Generator) -> Dict[str, float]:
    """The same patient with some values not measured, as nurses record them."""
    seen = dict(row)
    for name, p_missing in [("temp_c", .08), ("heart_rate", .1), ("resp_rate", .22), ("systolic_bp", .15),
                            ("spo2", .2), ("avpu", .12), ("mobility", .12), ("days_febrile", .25),
                            ("rainy_season", .1), ("pregnant", .3)]:
        if rng.random() < p_missing:
            seen[name] = math.nan
    if row["sex"] == 1:
        seen["pregnant"] = 0.0
    return seen


def disagree(level: int, rng: np.random.Generator) -> int:
    """About 8% of labels move one level, as clinicians' judgements vary."""
    if rng.random() >= 0.08:
        return level
    return int(np.clip(level + rng.choice([-1, 1]), 1, 5))


def build(n: int, seed: int) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    rows = []
    for _ in range(n):
        true = synthetic_patient(rng)
        sats = sats_level(true)
        seen = as_recorded(true, rng)
        seen["sats_level"] = sats
        seen["label"] = disagree(sats, rng)
        rows.append(seen)
    return pd.DataFrame(rows, columns=FEATURES + ["sats_level", "label"])


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--records", type=int, default=30000)
    parser.add_argument("--csv", type=Path, help="also write the generated data here")
    args = parser.parse_args()

    data = build(args.records, SEED)
    if args.csv:
        data.to_csv(args.csv, index=False)

    train, test = train_test_split(data, test_size=0.2, random_state=SEED, stratify=data["label"])
    model = Pipeline([
        ("impute", SimpleImputer(strategy="median", add_indicator=True)),
        ("rf", RandomForestClassifier(n_estimators=300, min_samples_leaf=3, max_features="sqrt",
                                      class_weight="balanced", n_jobs=-1, random_state=SEED)),
    ])
    model.fit(train[FEATURES], train["label"])

    predicted = model.predict(test[FEATURES])
    truth = test["sats_level"].to_numpy()
    under = predicted > truth
    metrics = {
        "records": args.records,
        "test_records": len(test),
        "accuracy_vs_noisy_labels": round(accuracy_score(test["label"], predicted), 4),
        "accuracy_vs_sats": round(accuracy_score(truth, predicted), 4),
        "within_one_level": round(float(np.mean(np.abs(predicted - truth) <= 1)), 4),
        "under_triage_rate": round(float(np.mean(under)), 4),
        "level1_missed_as_3_or_lower": round(float(np.mean(predicted[truth == 1] >= 3)), 4),
        "label_distribution": {LEVELS[k]: int(v) for k, v in sorted(data["sats_level"].value_counts().items())},
    }

    print("Triage model, tested on {} held-out synthetic patients".format(len(test)))
    print(json.dumps({k: v for k, v in metrics.items() if k != "label_distribution"}, indent=2))
    print("\nAgainst the SATS level (rows: SATS 1-5, columns: predicted 1-5)")
    print(confusion_matrix(truth, predicted, labels=[1, 2, 3, 4, 5]))
    print(classification_report(truth, predicted, labels=[1, 2, 3, 4, 5],
                                target_names=[LEVELS[k] for k in range(1, 6)], digits=3))

    OUTPUT.parent.mkdir(exist_ok=True)
    joblib.dump({
        "pipeline": model,
        "features": FEATURES,
        "codes": CODES,
        "levels": LEVELS,
        "labelled_by": "SATS adult (TEWS + discriminators), synthetic patients",
        "metrics": metrics,
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sklearn_version": sklearn.__version__,
    }, OUTPUT, compress=3)
    print("Saved {} ({:.1f} MB)".format(OUTPUT, OUTPUT.stat().st_size / 1e6))


if __name__ == "__main__":
    main()
