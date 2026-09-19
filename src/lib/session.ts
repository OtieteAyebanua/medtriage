import prisma from '@/lib/prisma';

const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 1 day

/**
 * Create a new session for a healthcare worker.
 * Returns the session token.
 */
export async function createSession(userId: number): Promise<string> {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  // Clean up any expired sessions for this user
  await prisma.session.deleteMany({
    where: {
      user_id: userId,
      expires_at: { lt: new Date() },
    },
  });

  await prisma.session.create({
    data: {
      token,
      user_id: userId,
      expires_at: expiresAt,
    },
  });

  return token;
}

/**
 * Validate a session token and return the associated worker, or null if invalid/expired.
 */
export async function validateSession(token: string) {
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      worker: true,
    },
  });

  if (!session) return null;

  // Check expiry
  if (session.expires_at < new Date()) {
    // Expired — clean it up
    await prisma.session.delete({ where: { id: session.id } });
    return null;
  }

  return session.worker;
}

/**
 * Delete a session (logout).
 */
export async function deleteSession(token: string): Promise<void> {
  if (!token) return;
  try {
    await prisma.session.delete({ where: { token } });
  } catch {
    // Token may not exist, that's OK
  }
}

/**
 * Cookie name used for session token.
 */
export const SESSION_COOKIE_NAME = 'medtriage_session';

/**
 * Max age in seconds for the session cookie.
 */
export const SESSION_MAX_AGE = 24 * 60 * 60; // 1 day in seconds
