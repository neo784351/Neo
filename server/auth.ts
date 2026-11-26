import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { db, sanitizeUser, type UserRow } from './db.ts';

const SESSION_TTL_SHORT_MS = 1000 * 60 * 60 * 24; // 1 day
const SESSION_TTL_REMEMBER_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
export const SESSION_COOKIE_NAME = 'neo_session';

export interface AuthenticatedRequest extends Request {
  user?: ReturnType<typeof sanitizeUser>;
  userRow?: UserRow;
  tokenHash?: string;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = crypto.scryptSync(password, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createSession(
  userId: string,
  rememberMe = false
): { token: string; expiresAt: string; ttlMs: number } {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashSessionToken(token);
  const now = new Date();
  const ttlMs = rememberMe ? SESSION_TTL_REMEMBER_MS : SESSION_TTL_SHORT_MS;
  const expiresAt = new Date(now.getTime() + ttlMs).toISOString();

  db.prepare(
    'INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)'
  ).run(tokenHash, userId, expiresAt, now.toISOString());

  return { token, expiresAt, ttlMs };
}

export function deleteSession(tokenHash: string): void {
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const map: Record<string, string> = {};
  if (!cookieHeader) return map;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      try {
        map[k] = decodeURIComponent(v);
      } catch {
        map[k] = v;
      }
    }
  }
  return map;
}

export function setSessionCookie(res: Response, token: string, rememberMe: boolean): void {
  const maxAgeSec = rememberMe ? 60 * 60 * 24 * 30 : undefined;
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=None',
    'Secure',
    'Partitioned',
  ];
  if (maxAgeSec) {
    parts.push(`Max-Age=${maxAgeSec}`);
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(res: Response): void {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=None; Secure; Partitioned; Max-Age=0`
  );
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  let token = '';
  let fromCookie = false;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else {
    const cookies = parseCookies(req.headers.cookie);
    if (cookies[SESSION_COOKIE_NAME]) {
      token = cookies[SESSION_COOKIE_NAME];
      fromCookie = true;
    }
  }

  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }

  // CSRF check when authenticating state-changing routes via cookie
  if (fromCookie && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase())) {
    const customHeader = req.headers['x-requested-with'];
    if (customHeader !== 'NeoAI') {
      res.status(403).json({ error: 'Missing required request verification header.' });
      return;
    }
  }

  const tokenHash = hashSessionToken(token);
  const session = db
    .prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash = ?')
    .get(tokenHash) as { user_id: string; expires_at: string } | undefined;

  if (!session) {
    res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
    return;
  }

  if (new Date(session.expires_at).getTime() < Date.now()) {
    deleteSession(tokenHash);
    res.status(401).json({ error: 'Session expired. Please sign in again.' });
    return;
  }

  const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(session.user_id) as
    | UserRow
    | undefined;

  if (!userRow) {
    deleteSession(tokenHash);
    res.status(401).json({ error: 'Account not found.' });
    return;
  }

  req.user = sanitizeUser(userRow);
  req.userRow = userRow;
  req.tokenHash = tokenHash;
  next();
}
