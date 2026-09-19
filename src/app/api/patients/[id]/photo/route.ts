import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { deletePatientPhoto, MAX_PHOTO_BYTES, readPatientPhoto, savePatientPhoto, sniffImageType } from '@/lib/uploads';

type Ctx = { params: Promise<{ id: string }> };

async function parseId(ctx: Ctx): Promise<number | null> {
  const { id } = await ctx.params;
  const n = parseInt(id, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * GET /api/patients/[id]/photo
 * Serves the patient's photo. 404 when none has been uploaded.
 */
export async function GET(request: NextRequest, ctx: Ctx) {
  const auth = await requireSession(request);
  if ('response' in auth) return auth.response;

  const patientId = await parseId(ctx);
  if (!patientId) return NextResponse.json({ error: 'Invalid patient ID' }, { status: 400 });

  const patient = await prisma.patient.findUnique({ where: { patient_id: patientId }, select: { photo_path: true } });
  if (!patient?.photo_path) return NextResponse.json({ error: 'No photo' }, { status: 404 });

  const file = await readPatientPhoto(patient.photo_path);
  if (!file) return NextResponse.json({ error: 'Photo file missing' }, { status: 404 });

  return new NextResponse(new Uint8Array(file.buf), {
    headers: {
      'Content-Type': file.mime,
      'Content-Length': String(file.buf.length),
      // Path changes on every upload, so the URL (which includes it) can be cached hard.
      'Cache-Control': 'private, max-age=31536000, immutable',
      'Last-Modified': file.mtime.toUTCString(),
    },
  });
}

/**
 * POST /api/patients/[id]/photo   (multipart/form-data, field "photo")
 * Replaces the patient's photo. JPEG, PNG or WebP up to 5 MB.
 */
export async function POST(request: NextRequest, ctx: Ctx) {
  const auth = await requireSession(request);
  if ('response' in auth) return auth.response;

  const patientId = await parseId(ctx);
  if (!patientId) return NextResponse.json({ error: 'Invalid patient ID' }, { status: 400 });

  try {
    const form = await request.formData().catch(() => null);
    const file = form?.get('photo');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Attach an image in the "photo" field' }, { status: 400 });
    if (file.size > MAX_PHOTO_BYTES) return NextResponse.json({ error: 'Photo must be 5 MB or smaller' }, { status: 413 });

    const buf = Buffer.from(await file.arrayBuffer());
    const mime = sniffImageType(buf);
    if (!mime) return NextResponse.json({ error: 'Photo must be a JPEG, PNG or WebP image' }, { status: 415 });

    const patient = await prisma.patient.findUnique({ where: { patient_id: patientId }, select: { photo_path: true } });
    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 });

    const photo_path = await savePatientPhoto(patientId, buf, mime);
    const updated = await prisma.patient.update({ where: { patient_id: patientId }, data: { photo_path } });
    await deletePatientPhoto(patient.photo_path);

    return NextResponse.json({ success: true, patient: updated });
  } catch (error) {
    console.error('Photo upload error:', error);
    return NextResponse.json({ error: 'Failed to save photo' }, { status: 500 });
  }
}

/**
 * DELETE /api/patients/[id]/photo
 */
export async function DELETE(request: NextRequest, ctx: Ctx) {
  const auth = await requireSession(request);
  if ('response' in auth) return auth.response;

  const patientId = await parseId(ctx);
  if (!patientId) return NextResponse.json({ error: 'Invalid patient ID' }, { status: 400 });

  try {
    const patient = await prisma.patient.findUnique({ where: { patient_id: patientId }, select: { photo_path: true } });
    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 });

    const updated = await prisma.patient.update({ where: { patient_id: patientId }, data: { photo_path: null } });
    await deletePatientPhoto(patient.photo_path);
    return NextResponse.json({ success: true, patient: updated });
  } catch (error) {
    console.error('Photo delete error:', error);
    return NextResponse.json({ error: 'Failed to remove photo' }, { status: 500 });
  }
}
