import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

let pool: mysql.Pool | null = null;

function getMysqlSslOption() {
  const enabled = process.env.MYSQL_SSL === 'true';
  if (!enabled) return undefined;
  return { rejectUnauthorized: process.env.MYSQL_SSL_REJECT_UNAUTHORIZED === 'true' };
}

export function getMysqlPool() {
  if (pool) return pool;

  if (process.env.NODE_ENV !== 'production') {
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) dotenv.config({ path: envPath, override: true });
  }

  const host = (process.env.HSB_MYSQL_HOST ?? process.env.MYSQL_HOST)?.trim();
  const user = (process.env.HSB_MYSQL_USER ?? process.env.MYSQL_USER ?? 'u814151968_builder').trim();
  const password = process.env.HSB_MYSQL_PASSWORD ?? process.env.MYSQL_PASSWORD;
  const database = (process.env.HSB_MYSQL_DATABASE ?? process.env.MYSQL_DATABASE ?? 'u814151968_hsbuilder').trim();
  const port = Number(process.env.HSB_MYSQL_PORT ?? process.env.MYSQL_PORT ?? '3306');

  if (!host) throw new Error('MYSQL_HOST is required');
  if (!password) throw new Error('MYSQL_PASSWORD is required');

  pool = mysql.createPool({
    host,
    user,
    password,
    database,
    port,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: getMysqlSslOption(),
  });

  return pool;
}
