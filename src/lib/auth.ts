import { NextRequest, NextResponse } from 'next/server';
import { validateSession, SESSION_COOKIE_NAME } from '@/lib/session';

export type Role = 'doctor' | 'nurse' | 'lab_tech' | 'pharmacist' | 'admin';

export type SessionWorker = NonNullable<Awaited<ReturnType<typeof validateSession>>>;

/** Public shape of a worker returned to the client — never includes password_hash. */
export function publicWorker(worker: SessionWorker) {
  return {
    userId: worker.user_id,
    employeeId: worker.employee_id,
    firstName: worker.first_name,
    middleName: worker.middle_name,
    lastName: worker.last_name,
    email: worker.email,
    position: worker.position,
    gender: worker.gender,
  };
}

/**
 * Resolve the logged-in worker from the session cookie.
 * Returns either `{ worker }` or a ready-to-return 401/403 response.
 *
 * Usage:
 *   const auth = await requireSession(request, ['doctor']);
 *   if ('response' in auth) return auth.response;
 *   const { worker } = auth;
 */
export async function requireSession(
  request: NextRequest | Request,
  roles?: Role[],
): Promise<{ worker: SessionWorker } | { response: NextResponse }> {
  const token = readSessionToken(request);
  const worker = token ? await validateSession(token) : null;

  if (!worker) {
    const response = NextResponse.json({ error: 'Not signed in', code: 'UNAUTHENTICATED' }, { status: 401 });
    response.cookies.delete(SESSION_COOKIE_NAME);
    return { response };
  }

  if (roles && !roles.includes(worker.position as Role)) {
    return {
      response: NextResponse.json(
        { error: `This action requires role: ${roles.join(' or ')}`, code: 'FORBIDDEN' },
        { status: 403 },
      ),
    };
  }

  return { worker };
}

function readSessionToken(request: NextRequest | Request): string | undefined {
  if ('cookies' in request && typeof (request as NextRequest).cookies?.get === 'function') {
    return (request as NextRequest).cookies.get(SESSION_COOKIE_NAME)?.value;
  }
  const cookie = request.headers.get('cookie') ?? '';
  const match = cookie.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
  return match ? decodeURIComponent(match.slice(SESSION_COOKIE_NAME.length + 1)) : undefined;
}
