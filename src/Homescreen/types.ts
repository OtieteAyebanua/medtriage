export interface HealthcareWorker {
  userId?: number;
  user_id?: number;
  firstName?: string;
  first_name?: string;
  middleName?: string | null;
  middle_name?: string | null;
  lastName?: string;
  last_name?: string;
  employeeId?: string;
  employee_id?: string;
  gender?: string;
  email?: string;
  position?: string;
}

export interface PatientItem {
  patient_id: number;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  date_of_birth: string;
  gender: string;
  email?: string | null;
  blood_type: string;
  allergies?: string | null;
  chronic_conditions?: string | null;
  /** Relative storage path; the UI builds the URL with photoUrl() */
  photo_path?: string | null;
  /** Three most recent visits, included by GET /api/patients */
  records?: RecentVisit[];
}

export interface RecentVisit {
  record_id: number;
  visit_date: string;
  visit_type: string;
  chief_complaint: string;
  ai_urgency_score: number;
  final_triage_level?: string | null;
  diagnosis?: string | null;
  status: string;
}

/** Shape returned by GET /api/patients/[id] */
export interface PatientHistory {
  patient: PatientItem & { age: number };
  visits: PatientVisit[];
}

export interface PatientVisit {
  record_id: number;
  visit_date: string;
  visit_type: string;
  chief_complaint: string;
  status: string;
  is_current: boolean;
  vitals: {
    temperature: number | null;
    blood_pressure: string | null;
    heart_rate: number | null;
    oxygen_level: number | null;
    respiratory_rate: number | null;
  };
  symptoms: Array<{ symptom_id: number; name: string; category: string; severity: string; duration: string; notes: string | null }>;
  ai: {
    urgency_score: number;
    triage_level: string;
    confidence: number | null;
    reasoning: string;
    suggested_tests: string[];
    differential_diagnosis: DifferentialDiagnosis[];
  };
  review: {
    override_status: string;
    override_reason: string | null;
    final_triage_level: string | null;
    diagnosis: string | null;
  };
  recorded_by: { user_id: number; first_name: string; last_name: string; position: string } | null;
  treated_by: { user_id: number; first_name: string; last_name: string; position: string } | null;
}

export interface SymptomItem {
  symptom_id: number;
  symptom_name: string;
  category: string;
  description: string;
  severity_scale: number;
  related_conditions?: string | null;
  synonyms?: string | null;
  follow_up_questions?: string | null;
}

export interface SelectedSymptom {
  symptomId: number;
  name: string;
  severity: string;
  duration: string;
  notes: string;
}

export interface Vitals {
  temp: string;
  bp: string;
  heartRate: string;
  spo2: string;
  respRate: string;
}

/** Extra triage questions for the diagnosis model. null = not asked. */
export interface Screening {
  pregnant: boolean | null;
  rainySeason: boolean | null;
  daysFebrile: string;
  avpu: string | null;
  mobility: string | null;
}

export interface DifferentialDiagnosis {
  condition: string;
  probability: number;
  rationale: string;
}

export interface TriageResult {
  urgency_level: number;
  urgency_category: string;
  triage_level?: string;
  confidence?: number | null;
  reasoning: string;
  recommended_tests?: string[];
  differential_diagnoses?: DifferentialDiagnosis[];
}

/** Shape returned by GET /api/records/queue */
export interface QueueRecord {
  recordId: number;
  patientId: number;
  patientName: string;
  patientPhoto?: string | null;
  age: number;
  gender: string;
  visitType: string;
  chiefComplaint: string;
  vitals: {
    temperature: number | null;
    bloodPressure: string | null;
    heartRate: number | null;
    oxygenLevel: number | null;
    respiratoryRate: number | null;
  };
  symptoms: string[];
  aiTriage: {
    score: number;
    level: string;
    reasoning: string;
    suggestedTests: string[];
    differentialDiagnosis: DifferentialDiagnosis[];
  };
  visitDate: string;
  status: string;
  overrideStatus: string;
  recordedBy: string;
}

/** Shape returned by GET /api/reports/ward */
export interface WardReport {
  total_records: number;
  awaiting_review: number;
  acuity_distribution: Record<number, number>;
  final_distribution: Record<number, number>;
  review_stats: {
    reviewed: number;
    accepted: number;
    overridden: number;
    pending: number;
    agreement_rate: number | null;
  };
  status_distribution: Record<string, number>;
  recent_records: WardRecord[];
}

export interface WardRecord {
  record_id: number;
  patient_id: number;
  chief_complaint: string;
  ai_urgency_score: number;
  ai_triage_level: string;
  final_triage_level?: string | null;
  override_status: string;
  status: string;
  visit_date: string;
  patient?: { first_name: string; last_name: string } | null;
  recorder?: { first_name: string; last_name: string; position?: string } | null;
}

export type Tab = 'triage' | 'patients' | 'reports' | 'queue';

export interface ToastMessage {
  id: number;
  kind: 'success' | 'error' | 'info';
  text: string;
}
