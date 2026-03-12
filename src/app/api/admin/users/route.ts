import { NextResponse } from 'next/server';
import { prisma } from '../../../../server/prisma';
import { requireUser } from '../../../../server/auth';

export const runtime = 'nodejs';

export async function GET() {
  const auth = await requireUser('DEVELOPER');
  if (!auth.ok) return NextResponse.json({ ok: false }, { status: auth.status });

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, email: true, nick: true, avatarUrl: true, displayName: true, role: true, createdAt: true },
  });

  return NextResponse.json({
    ok: true,
    users: users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() })),
  });
}
