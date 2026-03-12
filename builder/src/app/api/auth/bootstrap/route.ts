import { NextResponse } from 'next/server';
import { prisma } from '../../../../server/prisma';
import { hashPassword } from '../../../../server/password';
import { createSessionForUser, getSessionCookieName, getSessionCookieOptions } from '../../../../server/session';

export const runtime = 'nodejs';

function normalizeNick(input: string) {
  const trimmed = input.trim();
  return trimmed.replace(/\s+/g, '');
}

export async function POST(req: Request) {
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    return NextResponse.json({ ok: false, error: 'Bootstrap already completed' }, { status: 409 });
  }

  const body = (await req.json().catch(() => null)) as
    | { email?: unknown; password?: unknown; displayName?: unknown; nick?: unknown; avatarUrl?: unknown }
    | null;

  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const displayName = typeof body?.displayName === 'string' ? body.displayName.trim() : null;
  const nickRaw = typeof body?.nick === 'string' ? body.nick : '';
  const nick = normalizeNick(nickRaw);
  const avatarUrl = typeof body?.avatarUrl === 'string' ? body.avatarUrl.trim() : null;

  if (!email || !email.includes('@')) {
    return NextResponse.json({ ok: false, error: 'Invalid email' }, { status: 400 });
  }
  if (!nick || nick.length < 3 || nick.length > 24) {
    return NextResponse.json({ ok: false, error: 'Invalid nick' }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ ok: false, error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const existingEmail = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existingEmail) return NextResponse.json({ ok: false, error: 'Email already exists' }, { status: 409 });
  const existingNick = await prisma.user.findUnique({ where: { nick }, select: { id: true } });
  if (existingNick) return NextResponse.json({ ok: false, error: 'Nick already exists' }, { status: 409 });

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      email,
      nick,
      passwordHash,
      displayName,
      avatarUrl,
      role: 'DEVELOPER',
    },
    select: { id: true, email: true, nick: true, avatarUrl: true, displayName: true, role: true, createdAt: true },
  });

  const session = await createSessionForUser(user.id);
  const res = NextResponse.json({ ok: true, user });
  res.cookies.set(getSessionCookieName(), session.token, getSessionCookieOptions());
  return res;
}
