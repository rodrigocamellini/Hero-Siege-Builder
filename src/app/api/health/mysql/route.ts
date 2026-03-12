import { getMysqlPool } from '../../../../server/mysql';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const pool = getMysqlPool();
    await pool.query('SELECT 1');
    return Response.json({ ok: true });
  } catch (error) {
    const err = error as {
      message?: string;
      code?: string;
      errno?: number;
      sqlState?: string;
    };

    const resolvedHost = (process.env.HSB_MYSQL_HOST ?? process.env.MYSQL_HOST ?? '').trim() || null;
    const resolvedPort = process.env.HSB_MYSQL_PORT ?? process.env.MYSQL_PORT ?? '3306';
    const resolvedUser = (process.env.HSB_MYSQL_USER ?? process.env.MYSQL_USER ?? 'u814151968_builder').trim();
    const resolvedDatabase = (process.env.HSB_MYSQL_DATABASE ?? process.env.MYSQL_DATABASE ?? 'u814151968_hsbuilder').trim();
    const resolvedPassword = process.env.HSB_MYSQL_PASSWORD ?? process.env.MYSQL_PASSWORD;

    const devDebug =
      process.env.NODE_ENV !== 'production'
        ? {
            mysql: {
              host: resolvedHost,
              port: resolvedPort,
              user: resolvedUser,
              database: resolvedDatabase,
              passwordDefined: Boolean(resolvedPassword),
              passwordLength: resolvedPassword?.length ?? 0,
              ssl: process.env.MYSQL_SSL === 'true',
              sslRejectUnauthorized: process.env.MYSQL_SSL_REJECT_UNAUTHORIZED === 'true',
              usingHsbEnv: {
                host: Boolean(process.env.HSB_MYSQL_HOST),
                port: Boolean(process.env.HSB_MYSQL_PORT),
                user: Boolean(process.env.HSB_MYSQL_USER),
                database: Boolean(process.env.HSB_MYSQL_DATABASE),
                password: Boolean(process.env.HSB_MYSQL_PASSWORD),
              },
            },
          }
        : undefined;

    return Response.json(
      {
        ok: false,
        error: err?.message ?? 'Unknown error',
        code: err?.code ?? null,
        errno: err?.errno ?? null,
        sqlState: err?.sqlState ?? null,
        ...devDebug,
      },
      { status: 500 },
    );
  }
}
