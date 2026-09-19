import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireSession } from '@/lib/auth';

/**
 * GET /api/records/queue
 * Active assessments awaiting physician sign-off, most urgent and longest-waiting first.
 */
export async function GET(request: NextRequest) {
  const auth = await requireSession(request);
  if ('response' in auth) return auth.response;

  try {
    // Fetch all active patient records that are awaiting doctor review
    // We fetch records where override_status is 'pending' OR status is 'triaged'/'waiting'
    const queue = await prisma.patientRecord.findMany({
      where: {
        is_current: true,
        OR: [
          { status: 'waiting' },
          { status: 'triaged' },
          { override_status: 'pending' }
        ]
      },
      include: {
        assignee: {
          select: {
            user_id: true,
            first_name: true,
            last_name: true,
          }
        },
        patient: {
          select: {
            first_name: true,
            last_name: true,
            date_of_birth: true,
            gender: true,
            blood_type: true,
            photo_path: true,
          }
        },
        recorder: {
          select: {
            first_name: true,
            last_name: true,
            position: true,
          }
        },
        record_symptoms: {
          include: {
            symptom: {
              select: {
                symptom_name: true,
              }
            }
          }
        }
      },
      orderBy: [
        { ai_urgency_score: 'asc' }, // Score 1 is immediate, prioritize lower numbers
        { visit_date: 'asc' } // Then by oldest wait time
      ]
    });

    // Transform for the frontend
    const formattedQueue = queue.map((record: any) => ({
      recordId: record.record_id,
      patientId: record.patient_id,
      patientName: `${record.patient.first_name} ${record.patient.last_name}`,
      patientPhoto: record.patient.photo_path ?? null,
      age: Math.floor((Date.now() - new Date(record.patient.date_of_birth).getTime()) / 31557600000),
      gender: record.patient.gender,
      visitType: record.visit_type,
      chiefComplaint: record.chief_complaint,
      vitals: {
        temperature: record.vitals_temperature,
        bloodPressure: record.vitals_blood_pressure,
        heartRate: record.vitals_heart_rate,
        oxygenLevel: record.vitals_oxygen_level,
        respiratoryRate: record.vitals_respiratory_rate,
      },
      symptoms: record.record_symptoms.map((rs: any) => rs.symptom.symptom_name),
      aiTriage: {
        score: record.ai_urgency_score,
        level: record.ai_triage_level,
        reasoning: record.ai_reasoning,
        confidence: record.ai_confidence,
        suggestedTests: safeJson(record.ai_suggested_tests, []),
        differentialDiagnosis: safeJson(record.ai_differential_diagnosis, []),
      },
      assignedTo: record.assignee
        ? { userId: record.assignee.user_id, name: `${record.assignee.first_name} ${record.assignee.last_name}` }
        : null,
      visitDate: record.visit_date,
      status: record.status,
      overrideStatus: record.override_status,
      recordedBy: `${record.recorder.position === 'doctor' ? 'Dr. ' : ''}${record.recorder.first_name} ${record.recorder.last_name}`,
    }));

    return NextResponse.json({ success: true, queue: formattedQueue });
  } catch (error: any) {
    console.error('Failed to fetch clinical review queue:', error);
    return NextResponse.json(
      { error: 'Failed to fetch clinical review queue' },
      { status: 500 }
    );
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
