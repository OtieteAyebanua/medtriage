"""Shared Random Forest features used by training and local inference."""

from typing import Any, Dict, Iterable, Optional, Tuple

NUMERIC_FEATURES = [
    "age",
    "temperature",
    "systolic_bp",
    "diastolic_bp",
    "heart_rate",
    "oxygen_level",
    "respiratory_rate",
    "is_unconscious",
    "has_chest_pain",
    "has_nuchal_rigidity",
    "spo2_below_90",
    "spo2_below_94",
    "temperature_at_least_39_5",
    "temperature_at_least_38",
    "temperature_below_35_5",
    "heart_rate_abnormal",
    "respiratory_rate_above_28",
    "has_fever",
    "has_headache",
    "has_vomiting",
    "has_diarrhoea",
    "has_cough",
    "has_dyspnoea",
    "has_abdominal_pain",
]
CATEGORICAL_FEATURES = ["sex", "visit_type"]
TEXT_FEATURES = ["chief_complaint", "symptom_text", "medical_context"]
FEATURE_COLUMNS = NUMERIC_FEATURES + CATEGORICAL_FEATURES + TEXT_FEATURES


def split_blood_pressure(value: Any) -> Tuple[Optional[int], Optional[int]]:
    if not value:
        return None, None
    import re

    match = re.match(r"^\s*(\d{2,3})\s*/\s*(\d{2,3})\s*$", str(value))
    if not match:
        return None, None
    return int(match.group(1)), int(match.group(2))


def _has(texts: Iterable[str], *fragments: str) -> bool:
    return any(fragment in text for text in texts for fragment in fragments)


def rule_indicator_features(
    complaint: Optional[str], symptom_names: Iterable[str], temperature: Any,
    oxygen_level: Any, heart_rate: Any, respiratory_rate: Any,
) -> Dict[str, int]:
    """Expose rule-engine red flags as inputs; this does not calculate the target label."""
    names = [str(name or "").lower() for name in symptom_names]
    complaint_text = str(complaint or "").lower()
    texts = names + [complaint_text]

    def less_than(value: Any, threshold: float) -> bool:
        return value is not None and float(value) < threshold

    def at_least(value: Any, threshold: float) -> bool:
        return value is not None and float(value) >= threshold

    return {
        "is_unconscious": int(_has(names, "unconscious", "altered", "coma") or _has([complaint_text], "unconscious", "collapsed")),
        "has_chest_pain": int(_has(texts, "chest pain")),
        "has_nuchal_rigidity": int(_has(names, "neck stiffness", "nuchal rigidity")),
        "spo2_below_90": int(less_than(oxygen_level, 90)),
        "spo2_below_94": int(less_than(oxygen_level, 94)),
        "temperature_at_least_39_5": int(at_least(temperature, 39.5)),
        "temperature_at_least_38": int(at_least(temperature, 38.0)),
        "temperature_below_35_5": int(less_than(temperature, 35.5)),
        "heart_rate_abnormal": int(heart_rate is not None and (float(heart_rate) > 120 or float(heart_rate) < 45)),
        "respiratory_rate_above_28": int(respiratory_rate is not None and float(respiratory_rate) > 28),
        "has_fever": int(_has(names, "fever") or at_least(temperature, 38.0)),
        "has_headache": int(_has(names, "headache")),
        "has_vomiting": int(_has(names, "vomit")),
        "has_diarrhoea": int(_has(names, "diarrh")),
        "has_cough": int(_has(names, "cough")),
        "has_dyspnoea": int(_has(names, "shortness of breath", "dyspnea", "dyspnoea")),
        "has_abdominal_pain": int(_has(names, "abdominal")),
    }
