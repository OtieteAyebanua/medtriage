import type { Practitioner, PractitionerPosition } from '@/api';

export const POSITIONS: Array<{ value: PractitionerPosition; label: string; idPrefix: string }> = [
  { value: 'doctor', label: 'Doctor', idPrefix: 'DOC' },
  { value: 'nurse', label: 'Nurse', idPrefix: 'NUR' },
  { value: 'lab_tech', label: 'Lab technician', idPrefix: 'LAB' },
  { value: 'pharmacist', label: 'Pharmacist', idPrefix: 'PHA' },
  { value: 'admin', label: 'Administrator', idPrefix: 'ADM' },
];

export function positionLabel(position: string) {
  return POSITIONS.find((p) => p.value === position)?.label ?? position;
}

/** Clinical roles must have a professional licence on file; administrators don't. */
export function requiresLicense(position: PractitionerPosition) {
  return position !== 'admin';
}

export function practitionerName(p: Pick<Practitioner, 'firstName' | 'middleName' | 'lastName' | 'position'>) {
  const name = [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ');
  return p.position === 'doctor' ? `Dr. ${name}` : name;
}

export function matchesPractitioner(p: Practitioner, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [p.firstName, p.middleName, p.lastName, p.employeeId, p.email, p.department, p.licenseNumber, positionLabel(p.position)]
    .filter(Boolean)
    .some((v) => v!.toLowerCase().includes(q));
}

/** Licences expiring within this many days are flagged. */
export const LICENSE_WARNING_DAYS = 60;

export type LicenseState = 'missing' | 'expired' | 'expiring' | 'valid' | 'no_expiry';

export function licenseState(p: Pick<Practitioner, 'licenseNumber' | 'licenseExpiry'>, today = todayIso()): LicenseState {
  if (!p.licenseNumber) return 'missing';
  if (!p.licenseExpiry) return 'no_expiry';
  if (p.licenseExpiry < today) return 'expired';
  return daysBetween(today, p.licenseExpiry) <= LICENSE_WARNING_DAYS ? 'expiring' : 'valid';
}

export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysBetween(fromIso: string, toIso: string) {
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000);
}

export function formatDay(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Next employee ID in the facility's scheme, e.g. HW-DOC-009. The number is shared across roles
 * (HW-DOC-001, HW-NUR-002, …), so it continues from the highest one in use.
 */
export function suggestEmployeeId(position: PractitionerPosition, existing: Practitioner[]) {
  const prefix = POSITIONS.find((p) => p.value === position)?.idPrefix ?? 'STF';
  const highest = existing.reduce((max, p) => {
    const n = Number(/-(\d+)$/.exec(p.employeeId)?.[1]);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return `HW-${prefix}-${String(highest + 1).padStart(3, '0')}`;
}

/** A readable temporary password (no 0/O or 1/l/I) for the admin to hand over. */
export function generatePassword(length = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

export const MIN_PASSWORD_LENGTH = 8;
