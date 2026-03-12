import { NextResponse } from 'next/server';
import { prisma } from '../../../../server/prisma';
import { hashPassword } from '../../../../server/password';
import { createSessionForUser, getSessionCookieName, getSessionCookieOptions } from '../../../../server/session';

export const runtime = 'nodejs';

async function ensureSettings() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS AppSetting (
      name VARCHAR(191) NOT NULL PRIMARY KEY,
      value VARCHAR(191) NOT NULL,
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `;
  await prisma.$executeRaw`
    INSERT INTO AppSetting (name, value)
    VALUES ('registration_enabled', 'true')
    ON DUPLICATE KEY UPDATE value = value
  `;
}

async function isRegistrationEnabled() {
  try {
    await ensureSettings();
    const rows = await prisma.$queryRaw<Array<{ value: string }>>`
      SELECT value FROM AppSetting WHERE name = 'registration_enabled' LIMIT 1
    `;
    const v = rows[0]?.value;
    return v !== 'false';
  } catch {
    return true;
  }
}

function normalizeNick(input: string) {
  const trimmed = input.trim();
  return trimmed.replace(/\s+/g, '');
}

export async function POST(req: Request) {
  const enabled = await isRegistrationEnabled();
  if (!enabled) return NextResponse.json({ ok: false, error: 'Registration is currently disabled' }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { email?: unknown; password?: unknown; nick?: unknown; remember?: unknown } | null;
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const nickRaw = typeof body?.nick === 'string' ? body.nick : '';
  const remember = body?.remember === true;

  if (!email || !email.includes('@')) return NextResponse.json({ ok: false, error: 'Invalid email' }, { status: 400 });
  if (!password || password.length < 8) {
    return NextResponse.json({ ok: false, error: 'Password must be at least 8 characters' }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return NextResponse.json({ ok: false, error: 'Email already exists' }, { status: 409 });

  const nick = normalizeNick(nickRaw);
  if (nick) {
    if (nick.length < 3 || nick.length > 24) {
      return NextResponse.json({ ok: false, error: 'Invalid nickname' }, { status: 400 });
    }
    const nickExists = await prisma.user.findUnique({ where: { nick }, select: { id: true } });
    if (nickExists) return NextResponse.json({ ok: false, error: 'Nickname already exists' }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, passwordHash, nick: nick ? nick : null },
    select: { id: true, email: true, nick: true, avatarUrl: true, displayName: true, role: true },
  });

  const session = await createSessionForUser(user.id);
  const res = NextResponse.json({ ok: true, user });
  res.cookies.set(getSessionCookieName(), session.token, getSessionCookieOptions({ persistent: remember }));
  return res;
}
