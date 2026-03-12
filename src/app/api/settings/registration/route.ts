import { NextResponse } from 'next/server';
import { prisma } from '../../../../server/prisma';

export const runtime = 'nodejs';

const DB_TIMEOUT_MS = 5000;

function withTimeout<T>(promise: Promise<T>, ms: number) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), ms);
    }),
  ]);
}

async function ensureSettings() {
  await withTimeout(
    prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS AppSetting (
      name VARCHAR(191) NOT NULL PRIMARY KEY,
      value VARCHAR(191) NOT NULL,
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `,
    DB_TIMEOUT_MS,
  );
  await withTimeout(
    prisma.$executeRaw`
    INSERT INTO AppSetting (name, value)
    VALUES ('registration_enabled', 'true')
    ON DUPLICATE KEY UPDATE value = value
  `,
    DB_TIMEOUT_MS,
  );
}

export async function GET() {
  try {
    await ensureSettings();
    const rows = await withTimeout(
      prisma.$queryRaw<Array<{ value: string }>>`
      SELECT value FROM AppSetting WHERE name = 'registration_enabled' LIMIT 1
    `,
      DB_TIMEOUT_MS,
    );
    const enabled = rows[0]?.value !== 'false';
    return NextResponse.json({ ok: true, enabled });
  } catch {
    return NextResponse.json({ ok: true, enabled: true });
  }
}
