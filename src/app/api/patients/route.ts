import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import {
  BLOOD_TYPES,
  optionalString,
  requiredDate,
  requiredString,
  ValidationError,
} from '@/lib/validation';

function bloodType(raw: unknown): string {
  const s = String(raw ?? '').trim().toUpperCase();
  if (!(BLOOD_TYPES as readonly string[]).includes(s)) {
    throw new ValidationError(`bloodType must be one of: ${BLOOD_TYPES.join(', ')}`, 'bloodType');
  }
  return s;
}

/**
 * GET /api/patients?q=
 * Registry listing (Table 3.3.3.2) with each patient's three most recent visits.
 */
export async function GET(request: NextRequest) {
  const auth = await requireSession(request);
  if ('response' in auth) return auth.response;

  try {
    const query = request.nextUrl.searchParams.get('q')?.trim();

    const patients = await prisma.patient.findMany({
      where: query
        ? { OR: [{ first_name: { contains: query } }, { last_name: { contains: query } }] }
        : undefined,
      orderBy: { created_at: 'desc' },
      include: {
        records: {
          orderBy: { visit_date: 'desc' },
          take: 3,
          select: {
            record_id: true,
            visit_date: true,
            visit_type: true,
            chief_complaint: true,
            ai_urgency_score: true,
            final_triage_level: true,
            diagnosis: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json({ patients });
  } catch (error) {
    console.error('Fetch patients error:', error);
    return NextResponse.json({ error: 'Failed to retrieve patients from database' }, { status: 500 });
  }
}

/**
 * POST /api/patients
 * Register a new patient. Body uses camelCase: firstName, middleName, lastName,
 * dateOfBirth, gender, email, bloodType, allergies, chronicConditions.
 */
export async function POST(request: NextRequest) {
  const auth = await requireSession(request);
  if ('response' in auth) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));

    const data = {
      first_name: requiredString(body.firstName ?? body.first_name, 'firstName', 50),
      middle_name: optionalString(body.middleName ?? body.middle_name, 'middleName', 50),
      last_name: requiredString(body.lastName ?? body.last_name, 'lastName', 50),
      date_of_birth: requiredDate(body.dateOfBirth ?? body.date_of_birth, 'dateOfBirth', { notFuture: true }),
      gender: requiredString(body.gender, 'gender', 10),
      email: optionalString(body.email, 'email', 100)?.toLowerCase() ?? null,
      blood_type: bloodType(body.bloodType ?? body.blood_type),
      allergies: optionalString(body.allergies, 'allergies'),
      chronic_conditions: optionalString(body.chronicConditions ?? body.chronic_conditions, 'chronicConditions'),
    };

    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      throw new ValidationError('Email address is not valid', 'email');
    }

    const patient = await prisma.patient.create({ data });
    return NextResponse.json({ success: true, patient }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message, field: error.field }, { status: 400 });
    }
    console.error('Register patient error:', error);
    return NextResponse.json({ error: 'Failed to register patient in hospital database' }, { status: 500 });
  }
}
