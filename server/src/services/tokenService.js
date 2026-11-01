import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

const TOKEN_ISSUER = 'brazzars-api';
const TOKEN_AUDIENCE = 'brazzars-client';

function getJwtSecret() {
  if (
    typeof env.jwtSecret !== 'string' ||
    env.jwtSecret.length < 32 ||
    /replace-with|your[_ -]?secret|<.*>/i.test(env.jwtSecret)
  ) {
    throw new HttpError(500, 'Authentication is not configured.');
  }

  return env.jwtSecret;
}

export function assertJwtConfigured() {
  getJwtSecret();
}

export function createAccessToken(userId) {
  const secret = getJwtSecret();
  return jwt.sign({}, secret, {
    subject: String(userId),
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE,
    expiresIn: '1h',
    algorithm: 'HS256',
  });
}

export function verifyAccessToken(token) {
  const secret = getJwtSecret();
  const payload = jwt.verify(token, secret, {
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE,
    algorithms: ['HS256'],
  });

  if (
    typeof payload !== 'object' ||
    typeof payload.sub !== 'string' ||
    !Number.isInteger(payload.exp) ||
    payload.exp <= Math.floor(Date.now() / 1000)
  ) {
    throw new Error('Invalid access token.');
  }

  return payload;
}
