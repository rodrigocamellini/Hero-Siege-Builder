import { NextResponse } from 'next/server';
import { prisma } from '../../../../../server/prisma';
import { requireUser } from '../../../../../server/auth';

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

export async function GET() {
  const auth = await requireUser('DEVELOPER');
  if (!auth.ok) return NextResponse.json({ ok: false }, { status: auth.status });

  try {
    await ensureSettings();
    const rows = await prisma.$queryRaw<Array<{ value: string }>>`
      SELECT value FROM AppSetting WHERE name = 'registration_enabled' LIMIT 1
    `;
    const enabled = rows[0]?.value !== 'false';
    return NextResponse.json({ ok: true, enabled });
  } catch {
    return NextResponse.json({ ok: true, enabled: true });
  }
}

export async function PUT(req: Request) {
  const auth = await requireUser('DEVELOPER');
  if (!auth.ok) return NextResponse.json({ ok: false }, { status: auth.status });

  const body = (await req.json().catch(() => null)) as { enabled?: unknown } | null;
  const enabled = body?.enabled === true;

  try {
    await ensureSettings();
    await prisma.$executeRaw`
      INSERT INTO AppSetting (name, value)
      VALUES ('registration_enabled', ${enabled ? 'true' : 'false'})
      ON DUPLICATE KEY UPDATE value = ${enabled ? 'true' : 'false'}
    `;
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to save setting' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, enabled });
}
