import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireSession } from '@/lib/auth';

/**
 * GET /api/symptoms?category=
 * Master symptom catalogue (Table 3.3.3.4).
 */
export async function GET(request: NextRequest) {
  const auth = await requireSession(request);
  if ('response' in auth) return auth.response;

  try {
    const category = request.nextUrl.searchParams.get('category')?.trim();

    const symptoms = await prisma.symptom.findMany({
      where: category ? { category } : undefined,
      orderBy: [{ category: 'asc' }, { severity_scale: 'desc' }, { symptom_name: 'asc' }],
    });

    return NextResponse.json({ symptoms });
  } catch (error) {
    console.error('Fetch symptoms error:', error);
    return NextResponse.json({ error: 'Failed to retrieve master symptoms catalogue' }, { status: 500 });
  }
}
