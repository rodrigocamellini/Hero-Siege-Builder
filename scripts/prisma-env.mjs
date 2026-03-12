import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import dotenv from 'dotenv';

function loadEnvFile(fileName) {
  const filePath = path.join(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) return false;
  dotenv.config({ path: filePath, override: true });
  return true;
}

loadEnvFile('.env');
loadEnvFile('.env.local');

function getEnv(name) {
  const value = process.env[name];
  return typeof value === 'string' ? value.trim() : undefined;
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

function buildShadowDatabaseUrl(baseUrl) {
  const u = new URL(baseUrl);
  const dbName = u.pathname.replace(/^\//, '');
  u.pathname = `/${dbName}_shadow`;
  return u.toString();
}

const composedDatabaseUrl = buildDatabaseUrl();
if (composedDatabaseUrl) {
  process.env.DATABASE_URL = composedDatabaseUrl;
  const customShadowDb =
    getEnv('HSB_MYSQL_SHADOW_DATABASE') ??
    getEnv('MYSQL_SHADOW_DATABASE') ??
    getEnv('HSB_SHADOW_DATABASE') ??
    getEnv('SHADOW_DATABASE');

  if (!process.env.SHADOW_DATABASE_URL) {
    const shadowUser =
      getEnv('HSB_MYSQL_SHADOW_USER') ??
      getEnv('MYSQL_SHADOW_USER') ??
      getEnv('HSB_SHADOW_USER') ??
      getEnv('SHADOW_USER');
    const shadowPassword =
      process.env.HSB_MYSQL_SHADOW_PASSWORD ??
      process.env.MYSQL_SHADOW_PASSWORD ??
      process.env.HSB_SHADOW_PASSWORD ??
      process.env.SHADOW_PASSWORD;

    const u = new URL(composedDatabaseUrl);
    u.pathname = `/${customShadowDb ?? u.pathname.replace(/^\//, '') + '_shadow'}`;
    if (shadowUser) u.username = shadowUser;
    if (typeof shadowPassword === 'string') u.password = shadowPassword;
    process.env.SHADOW_DATABASE_URL = u.toString();
  }
} else {
  process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'mysql://user:password@localhost:3306/database';
  process.env.SHADOW_DATABASE_URL = process.env.SHADOW_DATABASE_URL ?? 'mysql://user:password@localhost:3306/database_shadow';
}

const prismaCliPath = path.join(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js');
const args = [prismaCliPath, ...process.argv.slice(2)];

const child = spawn(process.execPath, args, { stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 1));
