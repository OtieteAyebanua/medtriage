import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { ageFromDob } from '@/lib/validation';

/**
 * GET /api/patients/[id]
 * Patient profile plus full visit history ("View Patient History" use case).
 * Each visit includes the AI assessment, the doctor's review, symptoms, and who saw the patient.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(request);
  if ('response' in auth) return auth.response;

  const { id } = await params;
  const patientId = parseInt(id, 10);
  if (!Number.isInteger(patientId) || patientId <= 0) {
    return NextResponse.json({ error: 'Invalid patient ID' }, { status: 400 });
  }

  try {
    const patient = await prisma.patient.findUnique({
      where: { patient_id: patientId },
      include: {
        records: {
          orderBy: { visit_date: 'desc' },
          include: {
            recorder: { select: { user_id: true, first_name: true, last_name: true, position: true } },
            treater: { select: { user_id: true, first_name: true, last_name: true, position: true } },
            record_symptoms: {
              include: { symptom: { select: { symptom_id: true, symptom_name: true, category: true } } },
            },
          },
        },
      },
    });

    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 });

    const { records, ...profile } = patient;

    return NextResponse.json({
      patient: { ...profile, age: ageFromDob(patient.date_of_birth) },
      visits: records.map((r) => ({
        record_id: r.record_id,
        visit_date: r.visit_date,
        visit_type: r.visit_type,
        chief_complaint: r.chief_complaint,
        status: r.status,
        is_current: r.is_current,
        vitals: {
          temperature: r.vitals_temperature,
          blood_pressure: r.vitals_blood_pressure,
          heart_rate: r.vitals_heart_rate,
          oxygen_level: r.vitals_oxygen_level,
          respiratory_rate: r.vitals_respiratory_rate,
        },
        symptoms: r.record_symptoms.map((rs) => ({
          symptom_id: rs.symptom.symptom_id,
          name: rs.symptom.symptom_name,
          category: rs.symptom.category,
          severity: rs.severity,
          duration: rs.duration,
          notes: rs.notes,
        })),
        ai: {
          urgency_score: r.ai_urgency_score,
          triage_level: r.ai_triage_level,
          confidence: r.ai_confidence,
          reasoning: r.ai_reasoning,
          suggested_tests: safeJson(r.ai_suggested_tests, []),
          differential_diagnosis: safeJson(r.ai_differential_diagnosis, []),
        },
        review: {
          override_status: r.override_status,
          override_reason: r.override_reason,
          final_triage_level: r.final_triage_level,
          diagnosis: r.diagnosis,
        },
        recorded_by: r.recorder,
        treated_by: r.treater,
      })),
    });
  } catch (error) {
    console.error('Fetch patient history error:', error);
    return NextResponse.json({ error: 'Failed to retrieve patient history' }, { status: 500 });
  }
}

function safeJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
