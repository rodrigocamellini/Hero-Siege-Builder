import 'server-only';
import type { Role, User } from '@prisma/client';

const roleRank: Record<Role, number> = {
  USER: 0,
  CONTRIBUTOR: 1,
  MODERATOR: 2,
  PARTNER: 3,
  DEVELOPER: 4,
};

export function hasRole(user: Pick<User, 'role'>, minimumRole: Role) {
  return roleRank[user.role] >= roleRank[minimumRole];
}
