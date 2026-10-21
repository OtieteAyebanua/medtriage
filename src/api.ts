/**
 * Client for the MedTriage server. One function per endpoint in API_README.md.
 *
 * Every request sends the session cookie. When a request fails, the function throws an ApiError whose
 * message is the server's { error } text, ready to show to the user. If the session has expired, a
 * UNAUTHENTICATED_EVENT is broadcast so the app can return to the login screen.
 */
import type { HealthcareWorker } from './auth/authService';
import type {
  DifferentialDiagnosis,
  PatientHistory,
  PatientItem,
  QueueRecord,
  SymptomItem,
  TriageResult,
  WardReport,
} from './Homescreen/types';

export const UNAUTHENTICATED_EVENT = 'medtriage:unauthenticated';

export const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp';
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024; // 5MB

const NETWORK_ERROR = 'Could not reach the facility server. Check the network connection and try again.';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly field?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Message to show for any error thrown by these functions. */
export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

// Debounced so several requests failing together (session expired) only trigger one logout
let unauthTimer: ReturnType<typeof setTimeout> | null = null;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { credentials: 'same-origin', ...init });
  } catch {
    throw new ApiError(NETWORK_ERROR, 0);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Auth endpoints answer 401 for "wrong password" / "no session"; only other routes mean the session ended
    if (res.status === 401 && !path.startsWith('/api/auth/') && !unauthTimer) {
      unauthTimer = setTimeout(() => {
        window.dispatchEvent(new Event(UNAUTHENTICATED_EVENT));
        unauthTimer = null;
      }, 50);
    }
    throw new ApiError(data.error || `Request failed (${res.status})`, res.status, data.field);
  }
  return data as T;
}

function sendJson<T>(path: string, method: 'POST' | 'PUT', body: unknown): Promise<T> {
  return request<T>(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/* ---------------- Auth ---------------- */

export async function login(employeeId: string, password: string): Promise<HealthcareWorker> {
  const data = await sendJson<{ worker: HealthcareWorker }>('/api/auth/login', 'POST', { employeeId, password });
  return data.worker;
}

/** The signed-in worker, or null when there's no valid session. */
export async function getSession(): Promise<HealthcareWorker | null> {
  try {
    const data = await request<{ authenticated: boolean; worker?: HealthcareWorker }>('/api/auth/session');
    return data.authenticated && data.worker ? data.worker : null;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
}

export async function logout(): Promise<void> {
  await request('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
}

/* ---------------- Patients ---------------- */

export async function listPatients(): Promise<PatientItem[]> {
  return (await request<{ patients: PatientItem[] }>('/api/patients')).patients;
}

export interface RegisterPatientInput {
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  email?: string;
  bloodType: string;
  allergies?: string;
  chronicConditions?: string;
}

export async function registerPatient(input: RegisterPatientInput): Promise<PatientItem> {
  return (await sendJson<{ patient: PatientItem }>('/api/patients', 'POST', input)).patient;
}

export function getPatientHistory(patientId: number): Promise<PatientHistory> {
  return request<PatientHistory>(`/api/patients/${patientId}`);
}

/** Upload or replace a patient's photo. Resolves with the updated patient. */
export async function uploadPatientPhoto(patientId: number, file: File): Promise<PatientItem> {
  if (file.size > PHOTO_MAX_BYTES) throw new ApiError('Photo must be 5 MB or smaller.', 413);
  const form = new FormData();
  form.append('photo', file);
  return (await request<{ patient: PatientItem }>(`/api/patients/${patientId}/photo`, { method: 'POST', body: form })).patient;
}

export async function removePatientPhoto(patientId: number): Promise<PatientItem> {
  return (await request<{ patient: PatientItem }>(`/api/patients/${patientId}/photo`, { method: 'DELETE' })).patient;
}

/* ---------------- Symptoms and triage ---------------- */

export async function listSymptoms(): Promise<SymptomItem[]> {
  return (await request<{ symptoms: SymptomItem[] }>('/api/symptoms')).symptoms;
}

export interface RunTriageInput {
  patientId: number;
  visitType: string;
  chiefComplaint: string;
  vitals: {
    temperature: number | null;
    bloodPressure: string | null;
    heartRate: number | null;
    oxygenLevel: number | null;
    respiratoryRate: number | null;
  };
  symptoms: Array<{ symptomId: number; severity: string; duration: string; notes: string | null }>;
}

export interface RunTriageResult {
  record_id: number;
  engine: 'external' | 'rules';
  triage: TriageResult & { recommended_tests: string[]; differential_diagnoses: DifferentialDiagnosis[] };
}

export function runTriage(input: RunTriageInput): Promise<RunTriageResult> {
  return sendJson<RunTriageResult>('/api/triage', 'POST', input);
}

/* ---------------- Review queue ---------------- */

export async function getReviewQueue(): Promise<QueueRecord[]> {
  return (await request<{ queue: QueueRecord[] }>('/api/records/queue')).queue;
}

export interface ReviewInput {
  overrideAction: 'accepted' | 'overridden';
  finalTriageLevel?: string;
  overrideReason?: string;
  diagnosis?: string;
  dischargeAction: string;
}

export async function submitReview(recordId: number, input: ReviewInput): Promise<void> {
  await sendJson(`/api/records/${recordId}/review`, 'PUT', input);
}

/* ---------------- Reports ---------------- */

export function getWardReport(days?: number): Promise<WardReport> {
  return request<WardReport>(days ? `/api/reports/ward?days=${days}` : '/api/reports/ward');
}
