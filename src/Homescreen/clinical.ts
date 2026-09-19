import { PatientItem } from './types';

/**
 * Clinical reference data and formatting helpers shared across the UI.
 * Keeps thresholds and labels in one place so every screen says the same thing.
 */

export type LevelNumber = 1 | 2 | 3 | 4 | 5;

export interface LevelMeta {
  level: LevelNumber;
  key: string;
  label: string;
  /** Plain-language meaning shown next to the level */
  hint: string;
}

export const TRIAGE_LEVELS: Record<LevelNumber, LevelMeta> = {
  1: { level: 1, key: 'immediate', label: 'Immediate', hint: 'Life-threatening — see now' },
  2: { level: 2, key: 'emergent', label: 'Emergent', hint: 'Very urgent — within 10 min' },
  3: { level: 3, key: 'urgent', label: 'Urgent', hint: 'Within 30 min' },
  4: { level: 4, key: 'less_urgent', label: 'Less urgent', hint: 'Within 60 min' },
  5: { level: 5, key: 'non_urgent', label: 'Non-urgent', hint: 'Routine care' },
};

export const LEVEL_LIST: LevelMeta[] = [1, 2, 3, 4, 5].map((n) => TRIAGE_LEVELS[n as LevelNumber]);

export function clampLevel(n: unknown): LevelNumber {
  const v = Number(n);
  if (v >= 1 && v <= 5) return v as LevelNumber;
  return 3;
}

export function levelFromKey(key?: string | null): LevelNumber {
  const found = LEVEL_LIST.find((l) => l.key === key);
  return found ? found.level : 3;
}

export const VISIT_TYPES = [
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'referral', label: 'Referral' },
  { value: 'follow_up', label: 'Follow-up' },
];

export function visitTypeLabel(value: string) {
  return VISIT_TYPES.find((v) => v.value === value)?.label ?? value.replace(/_/g, ' ');
}

export const SEVERITY_OPTIONS = ['Mild', 'Moderate', 'Severe'];

export const DURATION_OPTIONS = [
  'Less than 24 hours',
  '1–2 days',
  '3–7 days',
  '1–2 weeks',
  'More than 2 weeks',
];

export const DISPOSITION_OPTIONS = [
  { value: 'in_progress', label: 'Admit for treatment', hint: 'Patient stays in the facility' },
  { value: 'treated', label: 'Treated — observe', hint: 'Care given, waiting on outcome' },
  { value: 'discharged', label: 'Discharge home', hint: 'No further care needed today' },
  { value: 'referred', label: 'Refer to specialist', hint: 'Transfer to another facility' },
];

export const RECORD_STATUS_LABEL: Record<string, string> = {
  waiting: 'Waiting',
  triaged: 'Awaiting review',
  in_progress: 'Admitted',
  treated: 'Treated',
  discharged: 'Discharged',
  referred: 'Referred',
};

/* ---------------- Vitals ---------------- */

export type VitalKey = 'temp' | 'bp' | 'heartRate' | 'spo2' | 'respRate';

export interface VitalDef {
  key: VitalKey;
  label: string;
  unit: string;
  placeholder: string;
  normal: string;
  inputMode: 'decimal' | 'numeric' | 'text';
  step?: string;
}

export const VITAL_DEFS: VitalDef[] = [
  { key: 'temp', label: 'Temperature', unit: '°C', placeholder: '37.0', normal: '36.1 – 37.2 °C', inputMode: 'decimal', step: '0.1' },
  { key: 'bp', label: 'Blood pressure', unit: 'mmHg', placeholder: '120/80', normal: '90/60 – 120/80', inputMode: 'text' },
  { key: 'heartRate', label: 'Heart rate', unit: 'bpm', placeholder: '75', normal: '60 – 100 bpm', inputMode: 'numeric' },
  { key: 'spo2', label: 'Oxygen (SpO₂)', unit: '%', placeholder: '98', normal: '95 – 100 %', inputMode: 'numeric' },
  { key: 'respRate', label: 'Resp. rate', unit: '/min', placeholder: '16', normal: '12 – 20 /min', inputMode: 'numeric' },
];

export type VitalStatusKind = 'empty' | 'normal' | 'warning' | 'danger' | 'invalid';

export interface VitalStatus {
  kind: VitalStatusKind;
  label: string;
}

export function getVitalStatus(key: VitalKey, raw: string): VitalStatus {
  const value = (raw ?? '').trim();
  if (!value) return { kind: 'empty', label: 'Not recorded' };

  if (key === 'bp') {
    const m = /^(\d{2,3})\s*\/\s*(\d{2,3})$/.exec(value);
    if (!m) return { kind: 'invalid', label: 'Use 120/80 format' };
    const sys = Number(m[1]);
    const dia = Number(m[2]);
    if (sys >= 180 || dia >= 120) return { kind: 'danger', label: 'Hypertensive crisis' };
    if (sys < 90 || dia < 60) return { kind: 'danger', label: 'Low' };
    if (sys >= 140 || dia >= 90) return { kind: 'warning', label: 'High' };
    return { kind: 'normal', label: 'Normal' };
  }

  const num = parseFloat(value);
  if (isNaN(num)) return { kind: 'invalid', label: 'Enter a number' };

  switch (key) {
    case 'temp':
      if (num >= 39.5) return { kind: 'danger', label: 'Very high' };
      if (num >= 38.0) return { kind: 'warning', label: 'Fever' };
      if (num < 35.5) return { kind: 'danger', label: 'Hypothermia' };
      if (num < 36.1) return { kind: 'warning', label: 'Low' };
      return { kind: 'normal', label: 'Normal' };
    case 'heartRate':
      if (num > 120 || num < 50) return { kind: 'danger', label: num > 120 ? 'Tachycardia' : 'Bradycardia' };
      if (num > 100 || num < 60) return { kind: 'warning', label: num > 100 ? 'Fast' : 'Slow' };
      return { kind: 'normal', label: 'Normal' };
    case 'spo2':
      if (num < 90) return { kind: 'danger', label: 'Critical' };
      if (num < 95) return { kind: 'warning', label: 'Low' };
      return { kind: 'normal', label: 'Normal' };
    case 'respRate':
      if (num > 30 || num < 10) return { kind: 'danger', label: num > 30 ? 'Very fast' : 'Very slow' };
      if (num > 22 || num < 12) return { kind: 'warning', label: num > 22 ? 'Fast' : 'Slow' };
      return { kind: 'normal', label: 'Normal' };
    default:
      return { kind: 'normal', label: 'OK' };
  }
}

/* ---------------- Dates ---------------- */

export function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function ageFrom(iso?: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const beforeBirthday =
    now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate());
  if (beforeBirthday) age -= 1;
  return age < 0 ? null : age;
}

/** "3 min ago", "2 h ago", "yesterday" — for queue wait times and activity feeds. */
export function relativeTime(iso?: string | null, now: number = Date.now()): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (isNaN(t)) return '—';
  const diffMin = Math.max(0, Math.round((now - t) / 60000));
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH} h ago`;
  const diffD = Math.round(diffH / 24);
  if (diffD === 1) return 'yesterday';
  return `${diffD} days ago`;
}

export function waitDuration(iso?: string | null, now: number = Date.now()): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (isNaN(t)) return '—';
  const diffMin = Math.max(0, Math.round((now - t) / 60000));
  if (diffMin < 60) return `${diffMin} min`;
  const h = Math.floor(diffMin / 60);
  const m = diffMin % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function fullName(p: { first_name: string; middle_name?: string | null; last_name: string }) {
  return [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' ');
}

export function percent(p: number | string | undefined): string {
  if (typeof p !== 'number') return `${p ?? '—'}%`;
  return `${Math.round(p <= 1 ? p * 100 : p)}%`;
}

/* ---------------- Patients ---------------- */

export function matchesPatient(p: PatientItem, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    fullName(p).toLowerCase().includes(q) ||
    p.blood_type.toLowerCase() === q ||
    String(p.patient_id) === q.replace(/^#/, '')
  );
}

export function hasAllergies(p: PatientItem) {
  return !!p.allergies && p.allergies.trim().toLowerCase() !== 'none';
}

/** One-line summary of the most recent visit, e.g. "Last seen 3 days ago · Level 3 · Malaria". */
export function lastVisitSummary(p: PatientItem): string | null {
  const v = p.records?.[0];
  if (!v) return null;
  const level = v.final_triage_level ? levelFromKey(v.final_triage_level) : clampLevel(v.ai_urgency_score);
  const parts = [`Last seen ${relativeTime(v.visit_date)}`, `Level ${level} · ${TRIAGE_LEVELS[level].label}`];
  if (v.diagnosis) parts.push(v.diagnosis);
  else if (v.status === 'triaged' || v.status === 'waiting') parts.push('awaiting review');
  return parts.join(' · ');
}

/** URL for a patient's photo, cache-busted by the stored path (which changes on every upload). */
export function photoUrl(patientId: number, photoPath?: string | null): string | null {
  if (!photoPath) return null;
  return `/api/patients/${patientId}/photo?v=${encodeURIComponent(photoPath)}`;
}

export function initials(first?: string | null, last?: string | null): string {
  return `${(first ?? '').charAt(0)}${(last ?? '').charAt(0)}`.toUpperCase() || '?';
}
