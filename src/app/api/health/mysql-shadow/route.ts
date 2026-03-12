import mysql from 'mysql2/promise';

export const runtime = 'nodejs';

function getMysqlSslOption() {
  const enabled = process.env.MYSQL_SSL === 'true';
  if (!enabled) return undefined;
  return { rejectUnauthorized: process.env.MYSQL_SSL_REJECT_UNAUTHORIZED === 'true' };
}

function getEnv(name: string) {
  const v = process.env[name];
  return typeof v === 'string' ? v.trim() : undefined;
}

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return Response.json({ ok: false }, { status: 404 });
  }

  const host = getEnv('HSB_MYSQL_HOST') ?? getEnv('MYSQL_HOST');
  const user = getEnv('HSB_MYSQL_USER') ?? getEnv('MYSQL_USER') ?? 'u814151968_builder';
  const password = process.env.HSB_MYSQL_PASSWORD ?? process.env.MYSQL_PASSWORD;
  const port = Number(getEnv('HSB_MYSQL_PORT') ?? getEnv('MYSQL_PORT') ?? '3306');
  const baseDb = getEnv('HSB_MYSQL_DATABASE') ?? getEnv('MYSQL_DATABASE') ?? 'u814151968_hsbuilder';
  const shadowDb =
    getEnv('HSB_MYSQL_SHADOW_DATABASE') ??
    getEnv('MYSQL_SHADOW_DATABASE') ??
    `${baseDb}_shadow`;

  try {
    if (!host) throw new Error('MYSQL_HOST is required');
    const shadowUser = getEnv('HSB_MYSQL_SHADOW_USER') ?? getEnv('MYSQL_SHADOW_USER') ?? user;
    const shadowPassword = process.env.HSB_MYSQL_SHADOW_PASSWORD ?? process.env.MYSQL_SHADOW_PASSWORD ?? password;
    if (!shadowPassword) throw new Error('MYSQL_PASSWORD is required');

    const conn = await mysql.createConnection({
      host,
      user: shadowUser,
      password: shadowPassword,
      port,
      database: shadowDb,
      ssl: getMysqlSslOption(),
    });
    await conn.query('SELECT 1');
    await conn.end();
    return Response.json({ ok: true, shadowDb });
  } catch (error) {
    const err = error as { message?: string; code?: string; errno?: number; sqlState?: string };
    return Response.json(
      {
        ok: false,
        shadowDb,
        error: err?.message ?? 'Unknown error',
        code: err?.code ?? null,
        errno: err?.errno ?? null,
        sqlState: err?.sqlState ?? null,
      },
      { status: 500 },
    );
  }
}
