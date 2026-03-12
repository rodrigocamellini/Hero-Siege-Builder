import { NextResponse } from 'next/server';
import type { Role } from '@prisma/client';
import { prisma } from '../../../../../server/prisma';
import { requireUser } from '../../../../../server/auth';
import { verifyPassword } from '../../../../../server/password';

export const runtime = 'nodejs';

function isRole(input: unknown): input is Role {
  return input === 'USER' || input === 'CONTRIBUTOR' || input === 'MODERATOR' || input === 'PARTNER' || input === 'DEVELOPER';
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser('DEVELOPER');
  if (!auth.ok) return NextResponse.json({ ok: false }, { status: auth.status });

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as {
    role?: unknown;
    email?: unknown;
    nick?: unknown;
    displayName?: unknown;
    avatarUrl?: unknown;
  } | null;

  const data: {
    role?: Role;
    email?: string;
    nick?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
  } = {};

  if (body?.role !== undefined) {
    if (!isRole(body.role)) return NextResponse.json({ ok: false, error: 'Role inválida' }, { status: 400 });
    data.role = body.role;
  }

  if (typeof body?.email === 'string') {
    const email = body.email.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return NextResponse.json({ ok: false, error: 'Email inválido' }, { status: 400 });
    }
    data.email = email;
  }

  if (typeof body?.nick === 'string') {
    data.nick = body.nick.trim() || null;
  }

  if (typeof body?.displayName === 'string') {
    data.displayName = body.displayName.trim() || null;
  }

  if (typeof body?.avatarUrl === 'string') {
    data.avatarUrl = body.avatarUrl.trim() || null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: false, error: 'Nenhuma alteração enviada' }, { status: 400 });
  }

  if (id === auth.user.id && data.role && data.role !== 'DEVELOPER') {
    return NextResponse.json({ ok: false, error: 'Você não pode remover seu próprio acesso DEVELOPER' }, { status: 400 });
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, nick: true, avatarUrl: true, displayName: true, role: true, createdAt: true },
    });

    return NextResponse.json({ ok: true, user: { ...user, createdAt: user.createdAt.toISOString() } });
  } catch (e) {
    const code = (e as { code?: string })?.code;
    const target = (e as { meta?: { target?: unknown } })?.meta?.target;
    if (code === 'P2002') {
      const fields = Array.isArray(target) ? target : [];
      if (fields.includes('email')) return NextResponse.json({ ok: false, error: 'Email já está em uso' }, { status: 400 });
      if (fields.includes('nick')) return NextResponse.json({ ok: false, error: 'Nick já está em uso' }, { status: 400 });
      return NextResponse.json({ ok: false, error: 'Valor já está em uso' }, { status: 400 });
    }
    if (code === 'P2025') return NextResponse.json({ ok: false, error: 'Usuário não encontrado' }, { status: 404 });
    return NextResponse.json({ ok: false, error: 'Falha ao salvar' }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser('DEVELOPER');
  if (!auth.ok) return NextResponse.json({ ok: false }, { status: auth.status });

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { password?: unknown } | null;
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!password) return NextResponse.json({ ok: false, error: 'Senha obrigatória' }, { status: 400 });

  const me = await prisma.user.findUnique({ where: { id: auth.user.id }, select: { passwordHash: true } });
  if (!me) return NextResponse.json({ ok: false, error: 'Usuário DEVELOPER não encontrado' }, { status: 500 });

  const ok = await verifyPassword(password, me.passwordHash);
  if (!ok) return NextResponse.json({ ok: false, error: 'Senha inválida' }, { status: 401 });

  if (id === auth.user.id) {
    return NextResponse.json({ ok: false, error: 'Você não pode deletar a si mesmo' }, { status: 400 });
  }

  try {
    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === 'P2025') return NextResponse.json({ ok: false, error: 'Usuário não encontrado' }, { status: 404 });
    return NextResponse.json({ ok: false, error: 'Falha ao deletar' }, { status: 500 });
  }
}
