import { NextResponse } from 'next/server';
import { prisma } from '../../../../server/prisma';
import { verifyPassword } from '../../../../server/password';
import { createSessionForUser, getSessionCookieName, getSessionCookieOptions } from '../../../../server/session';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { email?: unknown; password?: unknown; remember?: unknown } | null;
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const remember = body?.remember === true;

  if (!email || !email.includes('@')) {
    return NextResponse.json({ ok: false, error: 'Invalid email' }, { status: 400 });
  }
  if (!password) {
    return NextResponse.json({ ok: false, error: 'Password is required' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, nick: true, avatarUrl: true, passwordHash: true, displayName: true, role: true },
  });
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Invalid credentials' }, { status: 401 });
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ ok: false, error: 'Invalid credentials' }, { status: 401 });
  }

  const session = await createSessionForUser(user.id);
  const res = NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      nick: user.nick,
      avatarUrl: user.avatarUrl,
      displayName: user.displayName,
      role: user.role,
    },
  });
  res.cookies.set(getSessionCookieName(), session.token, getSessionCookieOptions({ persistent: remember }));
  return res;
}
