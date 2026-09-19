import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { TRIAGE_LEVELS } from '@/lib/inference';
import { DISPOSITIONS, oneOf, optionalString, ValidationError } from '@/lib/validation';

/**
 * PUT /api/records/[id]/review
 * Physician sign-off on an AI triage: accept or override the level, record a
 * diagnosis and disposition. Doctors only. The reviewing doctor is recorded as
 * both `assigned_to` and `treated_by`.
 *
 * Body: { overrideAction: 'accepted'|'overridden', overrideReason?, finalTriageLevel?,
 *         diagnosis?, dischargeAction: 'in_progress'|'treated'|'discharged'|'referred' }
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSession(request, ['doctor']);
  if ('response' in auth) return auth.response;
  const { worker } = auth;

  const { id } = await params;
  const recordId = parseInt(id, 10);
  if (!Number.isInteger(recordId) || recordId <= 0) {
    return NextResponse.json({ error: 'Invalid record ID' }, { status: 400 });
  }

  try {
    const body = await request.json().catch(() => ({}));

    const overrideAction = oneOf(body.overrideAction, ['accepted', 'overridden'] as const, 'overrideAction');
    const dischargeAction = oneOf(body.dischargeAction, DISPOSITIONS, 'dischargeAction');
    const diagnosis = optionalString(body.diagnosis, 'diagnosis', 1000);

    const record = await prisma.patientRecord.findUnique({ where: { record_id: recordId } });
    if (!record) return NextResponse.json({ error: 'Record not found' }, { status: 404 });

    let finalTriageLevel = record.ai_triage_level;
    let overrideReason: string | null = null;

    if (overrideAction === 'overridden') {
      finalTriageLevel = oneOf(body.finalTriageLevel, TRIAGE_LEVELS, 'finalTriageLevel');
      overrideReason = optionalString(body.overrideReason, 'overrideReason', 2000);
      if (!overrideReason) throw new ValidationError('A reason is required when overriding the AI triage level', 'overrideReason');
      if (finalTriageLevel === record.ai_triage_level) {
        throw new ValidationError('Override level is the same as the AI level — choose "accepted" instead', 'finalTriageLevel');
      }
    }

    const updatedRecord = await prisma.patientRecord.update({
      where: { record_id: recordId },
      data: {
        override_status: overrideAction,
        override_reason: overrideReason,
        final_triage_level: finalTriageLevel,
        diagnosis,
        status: dischargeAction,
        assigned_to: record.assigned_to ?? worker.user_id,
        treated_by: worker.user_id,
      },
    });

    return NextResponse.json({ success: true, record: updatedRecord });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message, field: error.field }, { status: 400 });
    }
    console.error('Failed to submit clinical review:', error);
    return NextResponse.json({ error: 'Failed to update patient record' }, { status: 500 });
  }
}
