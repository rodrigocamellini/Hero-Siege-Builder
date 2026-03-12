import { NextResponse } from 'next/server';
import { prisma } from '../../../server/prisma';
import { getCurrentUser } from '../../../server/auth';
import { hashPassword, verifyPassword } from '../../../server/password';

export const runtime = 'nodejs';

function normalizeNick(input: string) {
  const trimmed = input.trim();
  return trimmed.replace(/\s+/g, '');
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as
    | {
        nick?: unknown;
        avatarUrl?: unknown;
        email?: unknown;
        currentPassword?: unknown;
        newPassword?: unknown;
      }
    | null;

  const updates: { nick?: string | null; avatarUrl?: string | null; email?: string } = {};

  if (typeof body?.nick === 'string') {
    const nick = normalizeNick(body.nick);
    if (!nick || nick.length < 3 || nick.length > 24) {
      return NextResponse.json({ ok: false, error: 'Nick inválido' }, { status: 400 });
    }
    updates.nick = nick;
  }

  if (typeof body?.avatarUrl === 'string') {
    const avatarUrl = body.avatarUrl.trim();
    updates.avatarUrl = avatarUrl ? avatarUrl : null;
  }

  if (typeof body?.email === 'string') {
    const email = body.email.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return NextResponse.json({ ok: false, error: 'Email inválido' }, { status: 400 });
    }
    updates.email = email;
  }

  const wantsPasswordChange = typeof body?.newPassword === 'string' && body.newPassword.length > 0;
  const wantsEmailChange = typeof updates.email === 'string' && updates.email !== user.email;

  if (wantsPasswordChange || wantsEmailChange) {
    const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : '';
    if (!currentPassword) {
      return NextResponse.json({ ok: false, error: 'Senha atual obrigatória' }, { status: 400 });
    }

    const stored = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    if (!stored) return NextResponse.json({ ok: false, error: 'Usuário não encontrado' }, { status: 404 });

    const ok = await verifyPassword(currentPassword, stored.passwordHash);
    if (!ok) return NextResponse.json({ ok: false, error: 'Senha atual incorreta' }, { status: 401 });
  }

  if (wantsPasswordChange) {
    const newPassword = body?.newPassword as string;
    if (newPassword.length < 8) {
      return NextResponse.json({ ok: false, error: 'A nova senha deve ter pelo menos 8 caracteres' }, { status: 400 });
    }
    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  }

  if (typeof updates.email === 'string' && updates.email !== user.email) {
    const existing = await prisma.user.findUnique({ where: { email: updates.email }, select: { id: true } });
    if (existing && existing.id !== user.id) {
      return NextResponse.json({ ok: false, error: 'Email já existe' }, { status: 409 });
    }
  }

  if (typeof updates.nick === 'string' && updates.nick !== user.nick) {
    const existing = await prisma.user.findUnique({ where: { nick: updates.nick }, select: { id: true } });
    if (existing && existing.id !== user.id) {
      return NextResponse.json({ ok: false, error: 'Nick já existe' }, { status: 409 });
    }
  }

  const updated =
    Object.keys(updates).length > 0
      ? await prisma.user.update({
          where: { id: user.id },
          data: updates,
          select: { id: true, email: true, nick: true, avatarUrl: true, displayName: true, role: true },
        })
      : await prisma.user.findUnique({
          where: { id: user.id },
          select: { id: true, email: true, nick: true, avatarUrl: true, displayName: true, role: true },
        });

  if (!updated) return NextResponse.json({ ok: false, error: 'Usuário não encontrado' }, { status: 404 });
  return NextResponse.json({ ok: true, user: updated });
}
