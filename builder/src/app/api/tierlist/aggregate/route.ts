import { NextResponse } from 'next/server';
import { prisma } from '../../../../server/prisma';
import { classKeys, tierOrder, type Tier } from '../../../../data/tierlist';

export const runtime = 'nodejs';

const tierRank: Record<Tier, number> = { S: 0, A: 1, B: 2, C: 3, D: 4, E: 5 };

export async function GET() {
  try {
    const rows = await prisma.$queryRaw<Array<{ classKey: string; tier: string; cnt: bigint | number | string }>>`
      SELECT classKey, tier, COUNT(*) AS cnt
      FROM TierListVote
      GROUP BY classKey, tier
    `;

    const countsByClass = new Map<string, Map<Tier, number>>();
    for (const r of rows) {
      const tier = String(r.tier) as Tier;
      const classKey = r.classKey;
      const count = Number(r.cnt);
      if (!countsByClass.has(classKey)) countsByClass.set(classKey, new Map());
      countsByClass.get(classKey)!.set(tier, Number.isFinite(count) ? count : 0);
    }

    const tiers: Record<Tier, string[]> = { S: [], A: [], B: [], C: [], D: [], E: [] };

    for (const cls of classKeys) {
      const counts = countsByClass.get(cls);
      if (!counts) {
        tiers.C.push(cls);
        continue;
      }

      let bestTier: Tier = 'C';
      let bestCount = -1;
      for (const t of tierOrder) {
        const c = counts.get(t) ?? 0;
        if (c > bestCount) {
          bestCount = c;
          bestTier = t;
        } else if (c === bestCount && tierRank[t] < tierRank[bestTier]) {
          bestTier = t;
        }
      }

      tiers[bestTier].push(cls);
    }

    const votersRow = await prisma.$queryRaw<Array<{ voters: bigint | number | string }>>`
      SELECT COUNT(DISTINCT userId) AS voters
      FROM TierListVote
    `;
    const voters = Number(votersRow[0]?.voters ?? 0);

    return NextResponse.json({
      ok: true,
      tiers,
      voters: Number.isFinite(voters) ? voters : 0,
      updatedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({
      ok: true,
      tiers: { S: [], A: [], B: [], C: [], D: [], E: [] } satisfies Record<Tier, string[]>,
      voters: 0,
      updatedAt: new Date().toISOString(),
    });
  }
}
