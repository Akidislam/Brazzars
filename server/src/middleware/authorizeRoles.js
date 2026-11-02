import { HttpError } from '../utils/httpError.js';

const ALLOWED_ROLES = new Set(['customer', 'vendor', 'admin']);

export function authorizeRoles(...roles) {
  const allowedRoles = roles.map((role) => String(role).toLowerCase());
  if (allowedRoles.length === 0 || allowedRoles.some((role) => !ALLOWED_ROLES.has(role))) {
    throw new TypeError('authorizeRoles requires one or more valid roles.');
  }

  return function roleAuthorization(req, _res, next) {
    if (!req.user) return next(new HttpError(401, 'Authentication required.'));
    if (!allowedRoles.includes(req.user.role)) return next(new HttpError(403, 'You are not allowed to access this resource.'));
    if (req.user.role === 'admin' && req.user.mustChangePassword) {
      return next(new HttpError(403, 'Change your initial password before using the Admin Panel.'));
    }
    return next();
  };
}
