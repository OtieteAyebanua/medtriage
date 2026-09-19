/**
 * Server-side validation for clinical inputs. Mirrors the checks the UI does,
 * because API clients other than our own front end may call these routes.
 */

export const VISIT_TYPES = ['emergency', 'walk_in', 'referral', 'follow_up'] as const;
export const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
export const SEVERITIES = ['mild', 'moderate', 'severe'] as const;
export const DISPOSITIONS = ['in_progress', 'treated', 'discharged', 'referred'] as const;

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/** Parse an optional numeric vital. Blank/undefined → null; anything else must be a number in [min, max]. */
export function optionalNumber(raw: unknown, field: string, min: number, max: number): number | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw));
  if (!Number.isFinite(n)) throw new ValidationError(`${field} must be a number`, field);
  if (n < min || n > max) throw new ValidationError(`${field} must be between ${min} and ${max}`, field);
  return n;
}

export function optionalBloodPressure(raw: unknown): string | null {
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  const m = /^(\d{2,3})\s*\/\s*(\d{2,3})$/.exec(String(raw).trim());
  if (!m) throw new ValidationError('Blood pressure must look like 120/80', 'bp');
  const sys = Number(m[1]);
  const dia = Number(m[2]);
  if (sys < 40 || sys > 300 || dia < 20 || dia > 200 || dia >= sys) {
    throw new ValidationError('Blood pressure values are out of range', 'bp');
  }
  return `${sys}/${dia}`;
}

export function requiredString(raw: unknown, field: string, max = 2000): string {
  const s = typeof raw === 'string' ? raw.trim() : '';
  if (!s) throw new ValidationError(`${field} is required`, field);
  if (s.length > max) throw new ValidationError(`${field} is too long (max ${max} characters)`, field);
  return s;
}

export function optionalString(raw: unknown, field: string, max = 2000): string | null {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (s.length > max) throw new ValidationError(`${field} is too long (max ${max} characters)`, field);
  return s;
}

export function oneOf<T extends readonly string[]>(raw: unknown, allowed: T, field: string, fallback?: T[number]): T[number] {
  if ((raw === undefined || raw === null || raw === '') && fallback !== undefined) return fallback;
  const s = String(raw ?? '').toLowerCase();
  if (!(allowed as readonly string[]).includes(s)) {
    throw new ValidationError(`${field} must be one of: ${allowed.join(', ')}`, field);
  }
  return s as T[number];
}

export function requiredId(raw: unknown, field: string): number {
  const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10);
  if (!Number.isInteger(n) || n <= 0) throw new ValidationError(`${field} must be a positive integer`, field);
  return n;
}

export function requiredDate(raw: unknown, field: string, { notFuture = false } = {}): Date {
  const d = new Date(String(raw ?? ''));
  if (!raw || isNaN(d.getTime())) throw new ValidationError(`${field} must be a valid date`, field);
  if (notFuture && d.getTime() > Date.now()) throw new ValidationError(`${field} cannot be in the future`, field);
  return d;
}

export function ageFromDob(dob: Date, now = new Date()): number {
  let age = now.getFullYear() - dob.getFullYear();
  const beforeBirthday =
    now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate());
  if (beforeBirthday) age -= 1;
  return Math.max(0, age);
}
