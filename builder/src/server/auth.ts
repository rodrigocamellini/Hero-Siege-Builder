import 'server-only';
import type { Role } from '@prisma/client';
import { getSessionTokenFromCookies, getUserFromSessionToken } from './session';
import { hasRole } from './rbac';

export async function getCurrentUser() {
  const token = await getSessionTokenFromCookies();
  if (!token) return null;
  return getUserFromSessionToken(token);
}

export async function requireUser(minimumRole?: Role) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, status: 401 as const };
  if (minimumRole && !hasRole(user, minimumRole)) return { ok: false as const, status: 403 as const };
  return { ok: true as const, user };
}
