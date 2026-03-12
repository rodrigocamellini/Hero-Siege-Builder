import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../server/auth';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      nick: user.nick,
      avatarUrl: user.avatarUrl,
      displayName: user.displayName,
      role: user.role,
    },
  });
}
