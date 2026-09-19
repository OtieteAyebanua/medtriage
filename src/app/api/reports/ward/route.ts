import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { TRIAGE_LEVELS } from '@/lib/inference';

/**
 * GET /api/reports/ward?days=
 * Ward-level triage summary for clinical governance: acuity distribution,
 * review/override statistics, current queue size and recent activity.
 * `days` limits the window (default: all time).
 */
export async function GET(request: NextRequest) {
  const auth = await requireSession(request);
  if ('response' in auth) return auth.response;

  try {
    const daysParam = parseInt(request.nextUrl.searchParams.get('days') ?? '', 10);
    const since = Number.isInteger(daysParam) && daysParam > 0 ? new Date(Date.now() - daysParam * 86400000) : null;
    const window = since ? { visit_date: { gte: since } } : {};

    const [totalVisits, byAiLevel, byFinalLevel, byOverride, byStatus, awaitingReview, recentAssessments] =
      await Promise.all([
        prisma.patientRecord.count({ where: window }),
        prisma.patientRecord.groupBy({ by: ['ai_triage_level'], where: window, _count: { _all: true } }),
        prisma.patientRecord.groupBy({ by: ['final_triage_level'], where: window, _count: { _all: true } }),
        prisma.patientRecord.groupBy({ by: ['override_status'], where: window, _count: { _all: true } }),
        prisma.patientRecord.groupBy({ by: ['status'], where: window, _count: { _all: true } }),
        prisma.patientRecord.count({ where: { ...window, is_current: true, override_status: 'pending' } }),
        prisma.patientRecord.findMany({
          where: window,
          orderBy: { visit_date: 'desc' },
          take: 10,
          include: {
            patient: { select: { patient_id: true, first_name: true, last_name: true, gender: true, date_of_birth: true } },
            recorder: { select: { employee_id: true, first_name: true, last_name: true, position: true } },
          },
        }),
      ]);

    const countOf = (rows: Array<{ _count: { _all: number } } & Record<string, unknown>>, key: string, value: string) =>
      rows.find((r) => r[key] === value)?._count._all ?? 0;

    const acuity_distribution: Record<number, number> = {};
    const final_distribution: Record<number, number> = {};
    TRIAGE_LEVELS.forEach((level, i) => {
      acuity_distribution[i + 1] = countOf(byAiLevel, 'ai_triage_level', level);
      final_distribution[i + 1] = countOf(byFinalLevel, 'final_triage_level', level);
    });

    const accepted = countOf(byOverride, 'override_status', 'accepted');
    const overridden = countOf(byOverride, 'override_status', 'overridden');
    const pending = countOf(byOverride, 'override_status', 'pending');
    const reviewed = accepted + overridden;

    return NextResponse.json({
      status: 'success',
      window_days: since ? daysParam : null,
      total_records: totalVisits,
      awaiting_review: awaitingReview,
      acuity_distribution, // AI-assigned levels
      final_distribution, // after doctor review
      review_stats: {
        reviewed,
        accepted,
        overridden,
        pending,
        // How often doctors agree with the AI — the key governance metric for the model
        agreement_rate: reviewed > 0 ? Math.round((accepted / reviewed) * 100) : null,
      },
      status_distribution: Object.fromEntries(byStatus.map((r) => [r.status, r._count._all])),
      recent_records: recentAssessments,
    });
  } catch (error) {
    console.error('Ward report error:', error);
    return NextResponse.json({ error: 'Failed to generate ward triage report' }, { status: 500 });
  }
}
