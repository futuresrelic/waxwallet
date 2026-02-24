// ─── Admin Authentication ─────────────────────────────────────────────────────

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'changeme';
const SESSION_COOKIE = 'wax_admin_session';

export function checkAdminPassword(password: string): boolean {
  return password === ADMIN_PASSWORD;
}

export function getSessionCookieName(): string {
  return SESSION_COOKIE;
}

export function makeSessionToken(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2);
  return `${ts}.${rand}`;
}

// Very simple in-memory session store (single-process; Railway restarts will invalidate)
const validSessions = new Set<string>();

export function createSession(token: string): void {
  validSessions.add(token);
}

export function isValidSession(token: string | undefined): boolean {
  if (!token) return false;
  return validSessions.has(token);
}

export function invalidateSession(token: string): void {
  validSessions.delete(token);
}
