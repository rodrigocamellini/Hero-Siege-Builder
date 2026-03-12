import { prisma } from '../../../../server/prisma';

export const runtime = 'nodejs';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ ok: true });
  } catch (error) {
    const err = error as { message?: string };
    return Response.json({ ok: false, error: err?.message ?? 'Unknown error' }, { status: 500 });
  }
}
