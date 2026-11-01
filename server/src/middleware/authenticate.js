import User from '../models/User.js';
import { verifyAccessToken } from '../services/tokenService.js';
import { SAFE_USER_FIELDS, toSafeUser } from '../utils/safeUser.js';
import { HttpError } from '../utils/httpError.js';

const INVALID_TOKEN = 'Authentication required.';

export async function authenticate(req, _res, next) {
  const authorization = req.get('authorization') ?? '';
  const match = /^Bearer\s+([^\s]+)$/i.exec(authorization);

  if (!match || match[1].length > 8192) return next(new HttpError(401, INVALID_TOKEN));

  let payload;
  try {
    payload = verifyAccessToken(match[1]);
  } catch (error) {
    if (error instanceof HttpError && error.statusCode === 500) return next(error);
    return next(new HttpError(401, INVALID_TOKEN));
  }

  if (!/^[a-f\d]{24}$/i.test(payload.sub)) return next(new HttpError(401, INVALID_TOKEN));

  try {
    const user = await User.findById(payload.sub).select(SAFE_USER_FIELDS);
    if (!user || !user.isActive) return next(new HttpError(401, INVALID_TOKEN));

    req.user = toSafeUser(user);
    return next();
  } catch {
    return next(new HttpError(500, 'Unable to authenticate this request.'));
  }
}
