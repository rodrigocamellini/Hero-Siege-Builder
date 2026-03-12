import 'server-only';
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { prisma } from './prisma';

const SESSION_COOKIE_NAME = 'hsb_session';
const SESSION_TTL_DAYS = 30;

function sha256Base64Url(input: string) {
  const hash = crypto.createHash('sha256').update(input).digest('base64');
  return hash.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function randomToken() {
  const buf = crypto.randomBytes(32);
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function getSessionCookieName() {
  return SESSION_COOKIE_NAME;
}

export async function getSessionTokenFromCookies() {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE_NAME)?.value ?? null;
}

export function getSessionCookieOptions(options?: { persistent?: boolean }) {
  const persistent = options?.persistent ?? true;
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    ...(persistent ? { maxAge: SESSION_TTL_DAYS * 24 * 60 * 60 } : {}),
  } as const;
}

export async function createSessionForUser(userId: string) {
  const token = randomToken();
  const tokenHash = sha256Base64Url(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: { tokenHash, userId, expiresAt },
  });

  return { token, expiresAt };
}

export async function deleteSessionByToken(token: string) {
  const tokenHash = sha256Base64Url(token);
  await prisma.session.deleteMany({ where: { tokenHash } });
}

export async function getUserFromSessionToken(token: string) {
  const tokenHash = sha256Base64Url(token);
  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.deleteMany({ where: { tokenHash } });
    return null;
  }
  return session.user;
}
