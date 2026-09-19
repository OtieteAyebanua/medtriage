import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { runInference, InferenceRequest } from '@/lib/inference';
import {
  ageFromDob,
  oneOf,
  optionalBloodPressure,
  optionalNumber,
  optionalString,
  requiredId,
  requiredString,
  SEVERITIES,
  ValidationError,
  VISIT_TYPES,
} from '@/lib/validation';

/**
 * POST /api/triage
 * Runs a triage assessment for a patient and persists it (Tables 3.3.3.3 and 3.3.3.5).
 * Accepts both snake_case and camelCase field names for compatibility.
 */
export async function POST(request: NextRequest) {
  const auth = await requireSession(request);
  if ('response' in auth) return auth.response;
  const { worker } = auth;

  try {
    const body = await request.json().catch(() => ({}));

    // ---- Validate input ----
    const patientId = requiredId(body.patientId ?? body.patient_id, 'patient_id');
    const visitType = oneOf(body.visitType ?? body.visit_type, VISIT_TYPES, 'visit_type', 'walk_in');
    const chiefComplaint = requiredString(body.chiefComplaint ?? body.chief_complaint, 'chief_complaint', 1000);

    const v = body.vitals ?? {};
    const vitals = {
      temperature: optionalNumber(v.temperature ?? body.temp ?? body.temperature, 'temperature', 25, 45),
      bloodPressure: optionalBloodPressure(v.bloodPressure ?? body.bp ?? body.bloodPressure),
      heartRate: optionalNumber(v.heartRate ?? body.heart_rate ?? body.heartRate, 'heart_rate', 20, 250),
      oxygenLevel: optionalNumber(v.oxygenLevel ?? body.spo2 ?? body.oxygenLevel ?? body.oxygen_level, 'spo2', 50, 100),
      respiratoryRate: optionalNumber(
        v.respiratoryRate ?? body.resp_rate ?? body.respiratoryRate ?? body.respiratory_rate,
        'resp_rate',
        4,
        80,
      ),
    };

    const rawSymptoms: unknown[] = Array.isArray(body.symptoms) ? body.symptoms : [];
    const symptomInputs = rawSymptoms.map((raw, i) => {
      const s = (raw ?? {}) as Record<string, unknown>;
      return {
        symptomId: requiredId(s.symptomId ?? s.symptom_id, `symptoms[${i}].symptom_id`),
        severity: oneOf(s.severity, SEVERITIES, `symptoms[${i}].severity`, 'moderate'),
        duration: optionalString(s.duration, `symptoms[${i}].duration`, 100) ?? 'unknown',
        notes: optionalString(s.notes, `symptoms[${i}].notes`, 1000),
      };
    });

    // ---- Resolve references (patient must exist, symptom IDs must be in the catalogue) ----
    const patient = await prisma.patient.findUnique({ where: { patient_id: patientId } });
    if (!patient) return NextResponse.json({ error: 'Patient not found' }, { status: 404 });

    const symptomIds = [...new Set(symptomInputs.map((s) => s.symptomId))];
    const catalogue = symptomIds.length
      ? await prisma.symptom.findMany({ where: { symptom_id: { in: symptomIds } } })
      : [];
    const missing = symptomIds.filter((id) => !catalogue.some((c) => c.symptom_id === id));
    if (missing.length) {
      return NextResponse.json({ error: `Unknown symptom IDs: ${missing.join(', ')}` }, { status: 400 });
    }
    const byId = new Map(catalogue.map((c) => [c.symptom_id, c]));

    // ---- 1. Inference (external model if configured, otherwise built-in rules) ----
    const inferenceInput: InferenceRequest = {
      patient: {
        age: ageFromDob(patient.date_of_birth),
        sex: patient.gender,
        blood_type: patient.blood_type,
        chronic_conditions: patient.chronic_conditions,
        allergies: patient.allergies,
      },
      visit_type: visitType,
      chief_complaint: chiefComplaint,
      symptoms: symptomInputs.map((s) => ({
        symptom_id: s.symptomId,
        name: byId.get(s.symptomId)!.symptom_name,
        category: byId.get(s.symptomId)!.category,
        severity: s.severity,
        duration: s.duration,
        notes: s.notes,
      })),
      vitals: {
        temperature: vitals.temperature,
        blood_pressure: vitals.bloodPressure,
        heart_rate: vitals.heartRate,
        oxygen_level: vitals.oxygenLevel,
        respiratory_rate: vitals.respiratoryRate,
      },
    };
    const result = await runInference(inferenceInput);

    // ---- 2. Persist atomically: close previous active assessment, create record + symptoms ----
    const newRecord = await prisma.$transaction(async (tx) => {
      await tx.patientRecord.updateMany({
        where: { patient_id: patientId, is_current: true },
        data: { is_current: false },
      });

      const record = await tx.patientRecord.create({
        data: {
          patient_id: patientId,
          recorded_by: worker.user_id,
          visit_type: visitType,
          chief_complaint: chiefComplaint,
          vitals_temperature: vitals.temperature,
          vitals_blood_pressure: vitals.bloodPressure,
          vitals_heart_rate: vitals.heartRate === null ? null : Math.round(vitals.heartRate),
          vitals_oxygen_level: vitals.oxygenLevel,
          vitals_respiratory_rate: vitals.respiratoryRate === null ? null : Math.round(vitals.respiratoryRate),
          ai_urgency_score: result.urgencyScore,
          ai_triage_level: result.triageLevel,
          ai_confidence: result.confidence,
          ai_reasoning: result.reasoning,
          ai_suggested_tests: JSON.stringify(result.suggestedTests),
          ai_differential_diagnosis: JSON.stringify(result.differentialDiagnosis),
          override_status: 'pending',
          final_triage_level: result.triageLevel,
          status: 'triaged',
          is_current: true,
        },
      });

      if (symptomInputs.length) {
        await tx.recordSymptom.createMany({
          data: symptomInputs.map((s) => ({
            record_id: record.record_id,
            symptom_id: s.symptomId,
            severity: s.severity,
            duration: s.duration,
            notes: s.notes,
          })),
        });
      }

      return record;
    });

    return NextResponse.json({
      status: 'success',
      success: true,
      record_id: newRecord.record_id,
      recordId: newRecord.record_id,
      engine: result.engine,
      triage: {
        urgency_level: result.urgencyScore,
        urgency_category: result.triageLevel.replace('_', ' ').toUpperCase(),
        triage_level: result.triageLevel,
        confidence: result.confidence,
        reasoning: result.reasoning,
        suggested_tests: result.suggestedTests,
        recommended_tests: result.suggestedTests,
        differential_diagnoses: result.differentialDiagnosis,
      },
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message, field: error.field }, { status: 400 });
    }
    console.error('Triage assessment error:', error);
    return NextResponse.json({ error: 'Failed to process triage assessment on server' }, { status: 500 });
  }
}
