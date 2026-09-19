import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/prisma';
import { createSession, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from '@/lib/session';
import { publicWorker } from '@/lib/auth';

// One generic message for every failure so the response doesn't reveal which IDs exist.
const INVALID = 'Invalid employee ID or password';

// A dummy hash we compare against when the user doesn't exist, so timing is the same either way.
const DUMMY_HASH = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8Z2Y5Q5zXx0Q7JmH1qk9pJ7YqQ0Qxe';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const employeeId = typeof body.employeeId === 'string' ? body.employeeId.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!employeeId || !password) {
      return NextResponse.json({ error: 'Employee ID and password are required' }, { status: 400 });
    }

    // Table 3.3.3.1: look up by badge ID or email
    const worker = await prisma.healthcareWorker.findFirst({
      where: {
        OR: [{ employee_id: employeeId }, { email: employeeId.toLowerCase() }],
      },
    });

    const ok = await bcrypt.compare(password, worker?.password_hash ?? DUMMY_HASH);
    if (!worker || !ok) {
      return NextResponse.json({ error: INVALID }, { status: 401 });
    }

    const sessionToken = await createSession(worker.user_id);

    const response = NextResponse.json({ success: true, worker: publicWorker(worker) });
    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    });
    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Facility server internal authentication error' }, { status: 500 });
  }
}
