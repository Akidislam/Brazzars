export const SAFE_USER_FIELDS = 'name email phone role isActive mustChangePassword createdAt updatedAt';

export function toSafeUser(user) {
  if (!user) return null;

  const safeUser = {
    id: String(user._id ?? user.id),
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword === true,
  };

  for (const field of ['phone', 'createdAt', 'updatedAt']) {
    if (user[field] !== undefined) safeUser[field] = user[field];
  }

  return safeUser;
}
