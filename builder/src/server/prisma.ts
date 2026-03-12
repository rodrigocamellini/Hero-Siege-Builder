import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getEnv(name: string) {
  const v = process.env[name];
  return typeof v === 'string' ? v.trim() : undefined;
}

function buildDatabaseUrl() {
  const host = getEnv('HSB_MYSQL_HOST') ?? getEnv('MYSQL_HOST');
  const user = getEnv('HSB_MYSQL_USER') ?? getEnv('MYSQL_USER');
  const password = process.env.HSB_MYSQL_PASSWORD ?? process.env.MYSQL_PASSWORD;
  const database = getEnv('HSB_MYSQL_DATABASE') ?? getEnv('MYSQL_DATABASE');
  const port = getEnv('HSB_MYSQL_PORT') ?? getEnv('MYSQL_PORT') ?? '3306';

  if (!host || !user || !password || !database) return undefined;

  const encodedUser = encodeURIComponent(user);
  const encodedPassword = encodeURIComponent(password);

  return `mysql://${encodedUser}:${encodedPassword}@${host}:${port}/${database}`;
}

if (process.env.NODE_ENV !== 'production') {
  const envLocalPath = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(envLocalPath)) dotenv.config({ path: envLocalPath, override: true });
}

process.env.DATABASE_URL = process.env.DATABASE_URL ?? buildDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
