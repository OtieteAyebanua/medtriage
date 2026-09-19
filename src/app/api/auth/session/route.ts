import { NextRequest, NextResponse } from 'next/server';
import { validateSession, SESSION_COOKIE_NAME } from '@/lib/session';

/**
 * GET /api/auth/session
 * Validates the session cookie and returns the worker profile if valid.
 * Used on page load to auto-restore the session without re-entering credentials.
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.json(
        { authenticated: false, error: 'No session found' },
        { status: 401 }
      );
    }

    const worker = await validateSession(token);

    if (!worker) {
      // Cookie exists but session is expired or invalid — clear the cookie
      const response = NextResponse.json(
        { authenticated: false, error: 'Session expired' },
        { status: 401 }
      );
      response.cookies.delete(SESSION_COOKIE_NAME);
      return response;
    }

    return NextResponse.json({
      authenticated: true,
      worker: {
        userId: worker.user_id,
        employeeId: worker.employee_id,
        firstName: worker.first_name,
        middleName: worker.middle_name,
        lastName: worker.last_name,
        email: worker.email,
        position: worker.position,
        gender: worker.gender,
      },
    });
  } catch (error: any) {
    console.error('Session validation error:', error);
    return NextResponse.json(
      { authenticated: false, error: 'Session validation failed' },
      { status: 500 }
    );
  }
}
