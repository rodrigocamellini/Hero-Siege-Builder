import { NextResponse } from 'next/server';
import { prisma } from '../../../../server/prisma';
import { verifyPassword } from '../../../../server/password';
import { createSessionForUser, getSessionCookieName, getSessionCookieOptions } from '../../../../server/session';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
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
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const lower = message.toLowerCase();

    let friendly = 'Server error. Please try again.';
    if (lower.includes('environment variable') && lower.includes('database_url')) {
      friendly = 'Server database is not configured (DATABASE_URL missing).';
    } else if (lower.includes('p2021') || lower.includes('doesn\'t exist') || lower.includes('unknown table')) {
      friendly = 'Database is not initialized. Run Prisma migrations (prisma migrate deploy).';
    } else if (lower.includes('can\'t reach database server') || lower.includes('connect') || lower.includes('timeout')) {
      friendly = 'Cannot connect to the database.';
    }

    return NextResponse.json({ ok: false, error: friendly }, { status: 500 });
  }
}
