import { NextResponse } from 'next/server';
import { prisma } from '../../../../server/prisma';
import { requireUser } from '../../../../server/auth';
import { classKeys, tierOrder, type Tier } from '../../../../data/tierlist';

export const runtime = 'nodejs';

function isTier(v: unknown): v is Tier {
  return typeof v === 'string' && (tierOrder as readonly string[]).includes(v);
}

function isClassKey(v: unknown): v is (typeof classKeys)[number] {
  return typeof v === 'string' && (classKeys as readonly string[]).includes(v);
}

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ ok: false }, { status: auth.status });

  const votes = await prisma.$queryRaw<Array<{ classKey: string; tier: string; updatedAt: Date }>>`
    SELECT classKey, tier, updatedAt
    FROM TierListVote
    WHERE userId = ${auth.user.id}
  `;

  return NextResponse.json({
    ok: true,
    votes: votes.map((v) => ({ classKey: v.classKey, tier: String(v.tier) as Tier, updatedAt: new Date(v.updatedAt).toISOString() })),
  });
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return NextResponse.json({ ok: false }, { status: auth.status });

  const body = (await req.json().catch(() => null)) as { votes?: unknown } | null;
  const rawVotes = Array.isArray(body?.votes) ? body?.votes : null;
  if (!rawVotes) return NextResponse.json({ ok: false, error: 'Formato inválido' }, { status: 400 });

  const parsed = rawVotes
    .map((v) => (typeof v === 'object' && v ? (v as { classKey?: unknown; tier?: unknown }) : null))
    .filter((v): v is { classKey: (typeof classKeys)[number]; tier: Tier } => !!v && isClassKey(v.classKey) && isTier(v.tier));

  if (parsed.length === 0) return NextResponse.json({ ok: false, error: 'Nenhum voto válido' }, { status: 400 });

  await prisma.$transaction(
    parsed.map((v) =>
      prisma.$executeRaw`
        INSERT INTO TierListVote (id, userId, classKey, tier, createdAt, updatedAt)
        VALUES (UUID(), ${auth.user.id}, ${v.classKey}, ${v.tier}, NOW(), NOW())
        ON DUPLICATE KEY UPDATE tier = ${v.tier}, updatedAt = NOW()
      `
    )
  );

  return NextResponse.json({ ok: true });
}
