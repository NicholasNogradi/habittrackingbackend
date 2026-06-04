import { verifyAccessToken } from '../services/token.service.js';
import { User } from '../models/index.js';
import { Unauthorized, Forbidden } from '../utils/errors.js';

/**
 * Requires a valid `Authorization: Bearer <jwt>` header.
 * Attaches `req.user` (the User instance) and `req.auth` (decoded claims).
 */
export async function requireAuth(req, res, next) {
  try {
    const header = req.get('authorization') || '';
    const [scheme, token] = header.split(' ');

    if (scheme !== 'Bearer' || !token) {
      throw Unauthorized('Missing or malformed Authorization header.', {
        challenge: 'Bearer realm="habittrack", error="invalid_request"',
      });
    }

    let claims;
    try {
      claims = verifyAccessToken(token);
    } catch (err) {
      const reason = err.name === 'TokenExpiredError' ? 'token expired' : 'invalid token';
      throw Unauthorized(`Access ${reason}.`, {
        challenge: `Bearer realm="habittrack", error="invalid_token", error_description="${reason}"`,
      });
    }

    const user = await User.findByPk(claims.sub);
    if (!user) {
      throw Unauthorized('The user associated with this token no longer exists.', {
        challenge: 'Bearer realm="habittrack", error="invalid_token"',
      });
    }

    req.user = user;
    req.auth = claims;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Optional scope enforcement. Usage: requireScope('habits:write')
 */
export function requireScope(...required) {
  return (req, _res, next) => {
    const granted = (req.auth?.scope || '').split(' ');
    const ok = required.every((s) => granted.includes(s));
    if (!ok) {
      return next(Forbidden(`Missing required scope(s): ${required.join(', ')}.`));
    }
    next();
  };
}
