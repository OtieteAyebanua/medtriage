export interface TriageInput {
  age?: number;
  gender?: string;
  chiefComplaint: string;
  symptoms: Array<{
    name: string;
    severity?: string; // 'mild' | 'moderate' | 'severe'
    duration?: string;
  }>;
  vitals: {
    temperature?: number | null;
    bloodPressure?: string | null; // e.g. "120/80"
    heartRate?: number | null;
    oxygenLevel?: number | null; // SpO2%
    respiratoryRate?: number | null;
  };
}

export interface DifferentialDiagnosis {
  condition: string;
  probability: number; // 0 to 1
  rationale: string;
}

export interface TriageOutput {
  urgencyScore: number; // 1 (highest/immediate) to 5 (non-urgent)
  triageLevel: 'immediate' | 'emergent' | 'urgent' | 'less_urgent' | 'non_urgent';
  reasoning: string;
  suggestedTests: string[];
  differentialDiagnosis: DifferentialDiagnosis[];
}

/**
 * MedTriage AI Decision Support & Inference Engine
 * Instantiation based on Chapter 3.2.3:
 * Synthesizes vital signs, chief complaint keywords, and binary symptom presence vector
 * into calibrated urgency scores (1-5), triage classification, and ranked differential diagnosis.
 */
export function evaluateTriage(input: TriageInput): TriageOutput {
  const { vitals, symptoms, chiefComplaint } = input;
  const symptomNames = symptoms.map((s) => s.name.toLowerCase());
  const complaint = (chiefComplaint || '').toLowerCase();

  const reasons: string[] = [];
  const tests: string[] = [];
  const diagnoses: DifferentialDiagnosis[] = [];

  let urgencyScore = 5; // Start at non-urgent

  // 1. Red Flags & Life-Threatening Vitals Check (Urgency Level 1: Immediate / Level 2: Emergent)
  const isUnconscious =
    symptomNames.some((s) => s.includes('unconscious') || s.includes('altered') || s.includes('coma')) ||
    complaint.includes('unconscious') ||
    complaint.includes('collapsed');

  const hasSevereChestPain =
    symptomNames.some((s) => s.includes('chest pain')) || complaint.includes('chest pain');

  const hasNuchalRigidity =
    symptomNames.some((s) => s.includes('neck stiffness') || s.includes('nuchal rigidity'));

  const spo2 = vitals.oxygenLevel;
  const hr = vitals.heartRate;
  const rr = vitals.respiratoryRate;
  const temp = vitals.temperature;

  // SpO2 triage thresholds
  if (spo2 !== null && spo2 !== undefined) {
    if (spo2 < 90) {
      urgencyScore = Math.min(urgencyScore, 1);
      reasons.push(`Critical hypoxia detected (SpO2 ${spo2}% < 90%). Immediate oxygenation therapy indicated.`);
      tests.push('Emergency Arterial Blood Gas (ABG)', 'Chest X-Ray');
    } else if (spo2 < 94) {
      urgencyScore = Math.min(urgencyScore, 2);
      reasons.push(`Mild to moderate hypoxemia (SpO2 ${spo2}%).`);
      tests.push('Pulse Oximetry Monitoring', 'Chest Radiography');
    }
  }

  // Coma / Altered consciousness
  if (isUnconscious) {
    urgencyScore = Math.min(urgencyScore, 1);
    reasons.push('Impaired consciousness / neurological depression requires immediate resuscitation pathway.');
    tests.push('Blood Glucose Test (Rule out hypoglycemia)', 'Emergency Neurological Assessment');
  }

  // Severe chest pain / acute cardiac risk
  if (hasSevereChestPain) {
    urgencyScore = Math.min(urgencyScore, 1);
    reasons.push('Acute chest pain presentation warrants immediate exclusion of Acute Coronary Syndrome.');
    tests.push('12-Lead Electrocardiogram (ECG)', 'Serum Troponin I/T', 'Creatine Kinase-MB');
  }

  // Meningism
  if (hasNuchalRigidity) {
    urgencyScore = Math.min(urgencyScore, 2);
    reasons.push('Nuchal rigidity / neck stiffness presentation strongly indicates acute meningeal irritation.');
    tests.push('Lumbar Puncture (CSF analysis)', 'Blood Cultures', 'Full Blood Count (FBC)');
  }

  // Temperature evaluation (Pyrexia vs Hyperpyrexia)
  if (temp !== null && temp !== undefined) {
    if (temp >= 39.5) {
      urgencyScore = Math.min(urgencyScore, 2);
      reasons.push(`Hyperpyrexia observed (Core Temp ${temp}°C >= 39.5°C). High risk of febrile convulsions or sepsis.`);
    } else if (temp >= 38.0) {
      urgencyScore = Math.min(urgencyScore, 3);
      reasons.push(`Significant pyrexia (Core Temp ${temp}°C).`);
    } else if (temp < 35.5) {
      urgencyScore = Math.min(urgencyScore, 2);
      reasons.push(`Hypothermia (Core Temp ${temp}°C < 35.5°C). Potential septic shock marker.`);
    }
  }

  // Tachycardia / Tachypnea
  if (hr !== null && hr !== undefined && (hr > 120 || hr < 45)) {
    urgencyScore = Math.min(urgencyScore, 2);
    reasons.push(`Hemodynamic compromise: Heart rate abnormal at ${hr} bpm.`);
  }

  if (rr !== null && rr !== undefined && rr > 28) {
    urgencyScore = Math.min(urgencyScore, 2);
    reasons.push(`Severe tachypnea (Respiratory rate ${rr} breaths/min).`);
  }

  // Check symptom severity weights
  const hasHighFever = symptomNames.some((s) => s.includes('fever')) || (temp && temp >= 38.0);
  const hasHeadache = symptomNames.some((s) => s.includes('headache'));
  const hasVomiting = symptomNames.some((s) => s.includes('vomit'));
  const hasDiarrhea = symptomNames.some((s) => s.includes('diarrhea'));
  const hasCough = symptomNames.some((s) => s.includes('cough'));
  const hasDyspnea = symptomNames.some((s) => s.includes('shortness of breath') || s.includes('dyspnea'));
  const hasAbdominalPain = symptomNames.some((s) => s.includes('abdominal'));

  if (urgencyScore > 3 && (hasHighFever || hasDyspnea || hasAbdominalPain)) {
    urgencyScore = 3; // Urgent
  }

  if (urgencyScore > 4 && (hasHeadache || hasVomiting || hasDiarrhea || hasCough)) {
    urgencyScore = 4; // Less Urgent
  }

  // 2. Differential Diagnosis Calculation (Matching Chapter 3.2.1.1 tropical healthcare focus)
  // Malaria evaluation
  if (hasHighFever || complaint.includes('malaria') || complaint.includes('fever')) {
    let prob = 0.55;
    if (hasHeadache) prob += 0.20;
    if (hasVomiting) prob += 0.10;
    if (temp && temp > 38.5) prob += 0.10;
    prob = Math.min(prob, 0.94);

    diagnoses.push({
      condition: 'Plasmodium Falciparum Malaria',
      probability: parseFloat(prob.toFixed(2)),
      rationale: 'Fever with characteristic chills, headache, and secondary gastrointestinal symptoms in endemic setting.',
    });
    tests.push('Malaria Rapid Diagnostic Test (mRDT)', 'Thick and Thin Blood Smear for Parasitemia');
  }

  // Bacterial Meningitis
  if (hasNuchalRigidity || (hasHighFever && hasHeadache && isUnconscious)) {
    let prob = 0.60;
    if (hasNuchalRigidity) prob += 0.25;
    if (hasHeadache) prob += 0.10;
    prob = Math.min(prob, 0.92);

    diagnoses.push({
      condition: 'Acute Bacterial / Viral Meningitis',
      probability: parseFloat(prob.toFixed(2)),
      rationale: 'Classic triad of fever, severe cephalalgia, and positive signs of meningeal irritation.',
    });
  }

  // Typhoid Fever (Enteric Fever)
  if ((hasHighFever && hasAbdominalPain) || (hasHighFever && hasDiarrhea)) {
    let prob = 0.45;
    if (hasAbdominalPain) prob += 0.25;
    if (hasHeadache) prob += 0.15;
    prob = Math.min(prob, 0.85);

    diagnoses.push({
      condition: 'Typhoid Fever (Salmonella Enterica)',
      probability: parseFloat(prob.toFixed(2)),
      rationale: 'Step-ladder pyrexia associated with gastrointestinal discomfort and tenderness.',
    });
    tests.push('Widal Test / Typhoid IgG/IgM Rapid Test', 'Stool & Blood Cultures');
  }

  // Acute Respiratory Infection / Pneumonia
  if (hasCough || hasDyspnea || (rr && rr > 22)) {
    let prob = 0.40;
    if (hasDyspnea) prob += 0.25;
    if (hasHighFever) prob += 0.20;
    prob = Math.min(prob, 0.88);

    diagnoses.push({
      condition: 'Lower Respiratory Tract Infection (Pneumonia)',
      probability: parseFloat(prob.toFixed(2)),
      rationale: 'Persistent productive cough with elevated respiratory effort and thermal elevation.',
    });
    tests.push('Sputum Microscopic Examination', 'Chest Radiograph');
  }

  // Acute Gastroenteritis
  if (hasVomiting && hasDiarrhea) {
    diagnoses.push({
      condition: 'Acute Infectious Gastroenteritis with Dehydration Risk',
      probability: 0.78,
      rationale: 'Concurrent emesis and frequent diarrheal output requiring fluid electrolyte replenishment.',
    });
    tests.push('Serum Electrolytes, Urea & Creatinine (E/U/Cr)', 'Stool Routine and Microscopy');
  }

  // Default fallback if no specific profile matched
  if (diagnoses.length === 0) {
    diagnoses.push({
      condition: 'Undifferentiated Acute Febrile / Clinical Illness',
      probability: 0.50,
      rationale: 'Non-specific presentation requiring full clinical baseline and doctor workup.',
    });
    tests.push('Full Blood Count (FBC)', 'Urinalysis');
  }

  // Sort diagnoses descending by probability
  diagnoses.sort((a, b) => b.probability - a.probability);

  // Deduplicate suggested tests
  const uniqueTests = Array.from(new Set(tests));

  // Map urgency score to triage level string
  let triageLevel: TriageOutput['triageLevel'];
  switch (urgencyScore) {
    case 1:
      triageLevel = 'immediate';
      break;
    case 2:
      triageLevel = 'emergent';
      break;
    case 3:
      triageLevel = 'urgent';
      break;
    case 4:
      triageLevel = 'less_urgent';
      break;
    default:
      triageLevel = 'non_urgent';
      break;
  }

  if (reasons.length === 0) {
    reasons.push('Patient presents with mild, stable clinical parameters and low-urgency indicators.');
  }

  return {
    urgencyScore,
    triageLevel,
    reasoning: reasons.join(' '),
    suggestedTests: uniqueTests,
    differentialDiagnosis: diagnoses,
  };
}
