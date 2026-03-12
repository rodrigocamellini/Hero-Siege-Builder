import { NextResponse } from 'next/server';
import type { Role } from '@prisma/client';
import { prisma } from '../../../../../server/prisma';
import { requireUser } from '../../../../../server/auth';

export const runtime = 'nodejs';

function isRole(input: unknown): input is Role {
  return input === 'USER' || input === 'CONTRIBUTOR' || input === 'MODERATOR' || input === 'PARTNER' || input === 'DEVELOPER';
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser('DEVELOPER');
  if (!auth.ok) return NextResponse.json({ ok: false }, { status: auth.status });

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { role?: unknown } | null;
  if (!isRole(body?.role)) return NextResponse.json({ ok: false, error: 'Role inválida' }, { status: 400 });

  if (id === auth.user.id && body.role !== 'DEVELOPER') {
    return NextResponse.json({ ok: false, error: 'Você não pode remover seu próprio acesso DEVELOPER' }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id },
    data: { role: body.role },
    select: { id: true, email: true, nick: true, avatarUrl: true, displayName: true, role: true, createdAt: true },
  });

  return NextResponse.json({ ok: true, user: { ...user, createdAt: user.createdAt.toISOString() } });
}
