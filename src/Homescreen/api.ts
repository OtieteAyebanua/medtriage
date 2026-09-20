/**
 * fetch() wrapper for the client. On a 401 (session expired / signed out
 * elsewhere) it broadcasts an event so the shell can return to the login screen.
 * The dispatch is debounced so concurrent 401s (e.g. several parallel requests
 * all failing because the session expired) only trigger one logout.
 */
export const UNAUTHENTICATED_EVENT = 'medtriage:unauthenticated';

let unauthTimer: ReturnType<typeof setTimeout> | null = null;

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, init);
  if (res.status === 401 && typeof window !== 'undefined' && !unauthTimer) {
    unauthTimer = setTimeout(() => {
      window.dispatchEvent(new Event(UNAUTHENTICATED_EVENT));
      unauthTimer = null;
    }, 50);
  }
  return res;
}

export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp';

/** Upload (replace) a patient's photo. Resolves with the updated patient or throws with a user-facing message. */
export async function uploadPatientPhoto(patientId: number, file: File) {
  if (file.size > PHOTO_MAX_BYTES) throw new Error('Photo must be 5 MB or smaller.');
  const fd = new FormData();
  fd.append('photo', file);
  const res = await apiFetch(`/api/patients/${patientId}/photo`, { method: 'POST', body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not save the photo.');
  return data.patient as { patient_id: number; photo_path: string | null };
}

export async function removePatientPhoto(patientId: number) {
  const res = await apiFetch(`/api/patients/${patientId}/photo`, { method: 'DELETE' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Could not remove the photo.');
  return data.patient as { patient_id: number; photo_path: string | null };
}
