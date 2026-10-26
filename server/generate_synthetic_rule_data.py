#!/usr/bin/env python3
"""Generate varied fictional encounters covering the project's five rule levels.

The generated labels are scenario hints; relabel the output with the actual
RuleTriageEngine before using it to train or evaluate a model.
"""

import argparse
import json
import random
from pathlib import Path
from typing import Any, Dict, List


LEVELS = ["immediate", "emergent", "urgent", "less_urgent", "non_urgent"]


def build_record(level: str, rng: random.Random) -> Dict[str, Any]:
    temperature = round(rng.uniform(36.1, 37.4), 1)
    heart_rate = rng.randint(58, 100)
    respiratory_rate = rng.randint(12, 20)
    oxygen = rng.randint(95, 100)
    systolic, diastolic = rng.randint(105, 139), rng.randint(65, 89)

    if level == "immediate":
        trigger = rng.choice(["chest_pain", "consciousness", "hypoxia"])
        if trigger == "chest_pain":
            name, complaint = "Chest Pain", rng.choice(["Crushing chest pain", "Heavy chest pressure", "Sudden chest pain"])
            oxygen = rng.randint(94, 100)
        elif trigger == "consciousness":
            name, complaint = "Altered Consciousness / Confusion", rng.choice(["Confusion and reduced responsiveness", "Sudden altered awareness", "Patient is not responding normally"])
            oxygen = rng.randint(94, 100)
        else:
            name, complaint = "Shortness of Breath (Dyspnea)", rng.choice(["Severe breathing difficulty", "Unable to breathe comfortably", "Sudden severe breathlessness"])
            oxygen = rng.randint(82, 89)
        severity = "severe"
        duration = rng.choice(["20 minutes", "1 hour", "2 hours"])
        notes = rng.choice(["sudden onset", "worsening quickly", "requires immediate assessment"])

    elif level == "emergent":
        trigger = rng.choice(["nuchal", "low_oxygen", "high_temperature", "heart_rate", "respiratory_rate"])
        if trigger == "nuchal":
            name, complaint = "Neck Stiffness (Nuchal Rigidity)", rng.choice(["Neck stiffness", "Pain when bending the neck", "Fever with a stiff neck"])
        elif trigger == "low_oxygen":
            name, complaint, oxygen = "Generalised Weakness / Fatigue", "Low oxygen reading", rng.randint(90, 93)
        elif trigger == "high_temperature":
            name, complaint, temperature = "High Fever", "Very high fever", round(rng.uniform(39.5, 40.8), 1)
        elif trigger == "heart_rate":
            name, complaint = "Palpitations", "Very fast or unusually slow heartbeat"
            heart_rate = rng.choice([rng.randint(121, 145), rng.randint(35, 44)])
        else:
            name, complaint, respiratory_rate = "Shortness of Breath (Dyspnea)", "Rapid breathing", rng.randint(29, 38)
        severity = "severe"
        duration = rng.choice(["1 hour", "8 hours", "1 day"])
        notes = rng.choice(["abnormal vital sign recorded", "symptoms worsening", "requires prompt assessment"])

    elif level == "urgent":
        trigger = rng.choice(["fever", "dyspnoea", "abdominal"])
        if trigger == "fever":
            name, complaint, temperature = "High Fever", "Fever and chills", round(rng.uniform(38.0, 39.4), 1)
        elif trigger == "dyspnoea":
            name, complaint = "Shortness of Breath (Dyspnea)", "Breathlessness while walking"
        else:
            name, complaint = "Abdominal Pain", "Abdominal pain and discomfort"
        severity = rng.choice(["moderate", "severe"])
        duration = rng.choice(["6 hours", "2 days", "4 days"])
        notes = rng.choice(["symptoms continue", "patient feels unwell", "no additional details"])

    elif level == "less_urgent":
        name, complaint = rng.choice([
            ("Persistent Cough", "Persistent cough"),
            ("Headache", "Mild headache"),
            ("Vomiting", "Vomiting twice today"),
            ("Diarrhoea", "Loose stools"),
        ])
        severity = rng.choice(["mild", "moderate"])
        duration = rng.choice(["1 day", "3 days", "1 week"])
        notes = rng.choice(["stable at assessment", "no red flags reported", "symptoms unchanged"])

    else:
        name, complaint = rng.choice([
            ("Sore Throat", "Mild sore throat"),
            ("Generalised Weakness / Fatigue", "General weakness"),
            ("Loss of Appetite", "Reduced appetite"),
            ("Skin Rash", "New skin rash"),
            ("Back Pain", "Mild back pain"),
        ])
        severity = "mild"
        duration = rng.choice(["1 day", "3 days", "1 week"])
        notes = "comfortable and stable at assessment"

    complaint = rng.choice(["", "Patient reports ", "New complaint: ", "Symptoms include "]) + complaint
    symptom = {"name": name, "severity": severity, "duration": duration, "notes": notes}
    return {
        "patient": {
            "age": rng.randint(1, 90),
            "sex": rng.choice(["Female", "Male"]),
            "chronic_conditions": rng.choice(["", "", "asthma", "hypertension", "diabetes"]),
            "allergies": rng.choice(["", "", "penicillin", "pollen"]),
        },
        "visit_type": rng.choice(["walk_in", "emergency", "referral", "follow_up"]),
        "chief_complaint": complaint,
        "symptoms": [symptom],
        "vitals": {
            "temperature": temperature,
            "blood_pressure": "{}/{}".format(systolic, diastolic),
            "heart_rate": heart_rate,
            "oxygen_level": oxygen,
            "respiratory_rate": respiratory_rate,
        },
        "final_triage_level": level,
        "override_status": "accepted",
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--per-level", type=int, default=1000, help="Cases to generate for each level (default: 1000)")
    parser.add_argument("--seed", type=int, default=20261028, help="Random seed")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parent / "medtriage_rule_synthetic_5000.json",
        help="Output JSON path",
    )
    args = parser.parse_args()
    if args.per_level < 1:
        parser.error("--per-level must be at least 1")

    rng = random.Random(args.seed)
    records: List[Dict[str, Any]] = []
    for level in LEVELS:
        records.extend(build_record(level, rng) for _ in range(args.per_level))
    rng.shuffle(records)

    dataset = {
        "dataset_name": "MedTriage varied synthetic rule coverage",
        "version": "1.0",
        "generated_date": "2026-10-28",
        "record_count": len(records),
        "synthetic_data_notice": "Fictional records generated to cover the project rule engine's input patterns. The scenario labels are hints and must be recomputed by RuleTriageEngine. This dataset is not clinical evidence.",
        "records": records,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(dataset, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("Wrote {} fictional records to {}".format(len(records), args.output.resolve()))
    print("Relabel with RuleTriageEngine before training.")


if __name__ == "__main__":
    main()
