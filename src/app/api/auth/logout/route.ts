import { NextResponse } from 'next/server';
import { deleteSessionByToken, getSessionCookieName, getSessionCookieOptions, getSessionTokenFromCookies } from '../../../../server/session';

export const runtime = 'nodejs';

export async function POST() {
  const token = await getSessionTokenFromCookies();
  if (token) await deleteSessionByToken(token);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(getSessionCookieName(), '', { ...getSessionCookieOptions(), maxAge: 0 });
  return res;
}
