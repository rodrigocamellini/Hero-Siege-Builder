import { NextResponse } from 'next/server';
import { prisma } from '../../../../server/prisma';

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
