import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Patient photo storage. Files live on the facility server's disk under
 * UPLOAD_DIR (default ./uploads); the database only stores the relative path.
 */

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB

const UPLOAD_ROOT = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));

const IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/** Detect the real image type from magic bytes — never trust the client's MIME string. */
export function sniffImageType(buf: Buffer): keyof typeof IMAGE_TYPES | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

export function extensionFor(mime: string) {
  return IMAGE_TYPES[mime];
}

function resolveSafe(relative: string): string {
  const abs = path.resolve(UPLOAD_ROOT, relative);
  if (!abs.startsWith(UPLOAD_ROOT + path.sep)) throw new Error('Invalid upload path');
  return abs;
}

export async function savePatientPhoto(patientId: number, buf: Buffer, mime: string): Promise<string> {
  const relative = path.posix.join('patients', `${patientId}-${Date.now()}.${extensionFor(mime)}`);
  const abs = resolveSafe(relative);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, buf);
  return relative;
}

export async function readPatientPhoto(relative: string): Promise<{ buf: Buffer; mime: string; mtime: Date } | null> {
  try {
    const abs = resolveSafe(relative);
    const [buf, info] = await Promise.all([readFile(abs), stat(abs)]);
    const mime = sniffImageType(buf) ?? 'application/octet-stream';
    return { buf, mime, mtime: info.mtime };
  } catch {
    return null;
  }
}

export async function deletePatientPhoto(relative: string | null | undefined): Promise<void> {
  if (!relative) return;
  try {
    await unlink(resolveSafe(relative));
  } catch {
    // Already gone — nothing to do
  }
}
