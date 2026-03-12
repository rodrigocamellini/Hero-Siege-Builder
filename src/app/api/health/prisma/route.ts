import { prisma } from '../../../../server/prisma';

export const runtime = 'nodejs';

export async function GET() {
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise<void>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000)),
    ]);
    return Response.json({ ok: true });
  } catch (error) {
    const err = error as { message?: string };
    const message = err?.message ?? 'Unknown error';
    const status = message.toLowerCase().includes('timeout') ? 504 : 500;
    return Response.json({ ok: false, error: message }, { status });
  }
}
