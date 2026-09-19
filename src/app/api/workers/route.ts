import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Valid positions as defined in Table 3.3.3.1
const VALID_POSITIONS = ['doctor', 'nurse', 'lab_tech', 'pharmacist', 'admin'] as const;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const position = searchParams.get('position');

    const workers = await prisma.healthcareWorker.findMany({
      where: position ? { position } : undefined,
      select: {
        user_id: true,
        first_name: true,
        middle_name: true,
        last_name: true,
        employee_id: true,
        gender: true,
        email: true,
        position: true,
        created_at: true,
        _count: {
          select: {
            recorded_records: true,
            assigned_records: true,
            treated_records: true,
          },
        },
      },
      orderBy: { user_id: 'asc' },
    });

    return NextResponse.json({ workers });
  } catch (error: any) {
    console.error('Fetch healthcare workers error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve healthcare workers from database' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      firstName,
      middleName,
      lastName,
      employeeId,
      gender,
      email,
      password,
      position,
    } = body;

    // Field constraints validation according to Table 3.3.3.1
    if (!firstName || firstName.length > 50) {
      return NextResponse.json(
        { error: 'First name is required and must not exceed 50 characters.' },
        { status: 400 }
      );
    }

    if (middleName && middleName.length > 50) {
      return NextResponse.json(
        { error: 'Middle name must not exceed 50 characters.' },
        { status: 400 }
      );
    }

    if (!lastName || lastName.length > 50) {
      return NextResponse.json(
        { error: 'Last name is required and must not exceed 50 characters.' },
        { status: 400 }
      );
    }

    if (!employeeId || employeeId.length > 30) {
      return NextResponse.json(
        { error: 'Employee ID is required and must not exceed 30 characters.' },
        { status: 400 }
      );
    }

    if (!gender || gender.length > 10) {
      return NextResponse.json(
        { error: 'Gender is required and must not exceed 10 characters.' },
        { status: 400 }
      );
    }

    if (!email || email.length > 100) {
      return NextResponse.json(
        { error: 'Email is required and must not exceed 100 characters.' },
        { status: 400 }
      );
    }

    if (!password) {
      return NextResponse.json(
        { error: 'Password is required to generate password_hash.' },
        { status: 400 }
      );
    }

    if (!VALID_POSITIONS.includes(position)) {
      return NextResponse.json(
        { error: `Position must be one of: ${VALID_POSITIONS.join(', ')}` },
        { status: 400 }
      );
    }

    // Check uniqueness of employee_id and email
    const existing = await prisma.healthcareWorker.findFirst({
      where: {
        OR: [
          { employee_id: employeeId.trim() },
          { email: email.trim().toLowerCase() },
        ],
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A healthcare worker with this Employee ID or Email already exists.' },
        { status: 409 }
      );
    }

    // Hash password for SQLite storage (simulated standard hash)
    const passwordHash = `hash_${Buffer.from(password).toString('base64')}`;

    const newWorker = await prisma.healthcareWorker.create({
      data: {
        first_name: firstName.trim(),
        middle_name: middleName ? middleName.trim() : null,
        last_name: lastName.trim(),
        employee_id: employeeId.trim(),
        gender: gender.trim(),
        email: email.trim().toLowerCase(),
        password_hash: passwordHash,
        position,
      },
      select: {
        user_id: true,
        first_name: true,
        middle_name: true,
        last_name: true,
        employee_id: true,
        gender: true,
        email: true,
        position: true,
        created_at: true,
      },
    });

    return NextResponse.json({ success: true, worker: newWorker }, { status: 201 });
  } catch (error: any) {
    console.error('Create healthcare worker error:', error);
    return NextResponse.json(
      { error: 'Failed to create healthcare worker in database' },
      { status: 500 }
    );
  }
}
