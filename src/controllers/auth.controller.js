import crypto from 'node:crypto';
import { config } from '../config/index.js';
import { User } from '../models/index.js';
import {
  issueAccessToken,
  createRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
} from '../services/token.service.js';
import { BadRequest, Unauthorized, Conflict } from '../utils/errors.js';

// ── In-memory authorization_code store (demo) ────────────────────────────────
// Maps code -> { userId, redirectUri, expiresAt }. A real implementation would
// issue these from a /oauth/authorize consent screen.
const authCodes = new Map();

export function issueAuthorizationCode(userId, redirectUri) {
  const code = crypto.randomBytes(24).toString('base64url');
  authCodes.set(code, { userId, redirectUri, expiresAt: Date.now() + 60_000 });
  return code;
}

function consumeAuthorizationCode(code, redirectUri) {
  const entry = authCodes.get(code);
  if (!entry) return null;
  authCodes.delete(code); // single-use
  if (entry.expiresAt < Date.now()) return null;
  if (entry.redirectUri !== redirectUri) return null;
  return entry;
}

function tokenResponse({ token, scope }, refreshToken) {
  const body = {
    access_token: token,
    token_type: 'Bearer',
    expires_in: config.jwt.accessTtl,
    scope,
  };
  if (refreshToken) body.refresh_token = refreshToken;
  return body;
}

// ── POST /auth/token ─────────────────────────────────────────────────────────
export async function createToken(req, res, next) {
  try {
    const { grant_type } = req.body;

    if (grant_type === 'password') {
      const { username, password } = req.body;
      const user = await User.findOne({ where: { email: username } });
      // Constant-ish failure: do not reveal whether the email exists.
      if (!user || !user.verifyPassword(password)) {
        throw Unauthorized('Invalid username or password.', {
          challenge: 'Bearer realm="habittrack", error="invalid_grant"',
        });
      }
      const access = issueAccessToken(user);
      const refresh = await createRefreshToken(user.id);
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Pragma', 'no-cache');
      return res.status(200).json(tokenResponse(access, refresh));
    }

    if (grant_type === 'authorization_code') {
      const { code, redirect_uri, client_id, client_secret } = req.body;
      // Confidential client check (optional but recommended).
      if (client_id && client_id !== config.oauth.clientId) {
        throw Unauthorized('Unknown client.', {
          challenge: 'Bearer error="invalid_client"',
        });
      }
      if (client_secret && client_secret !== config.oauth.clientSecret) {
        throw Unauthorized('Invalid client credentials.', {
          challenge: 'Bearer error="invalid_client"',
        });
      }
      if (config.oauth.redirectUris.length && !config.oauth.redirectUris.includes(redirect_uri)) {
        throw BadRequest('redirect_uri is not registered for this client.');
      }
      const entry = consumeAuthorizationCode(code, redirect_uri);
      if (!entry) {
        throw Unauthorized('Authorization code is invalid, expired, or already used.', {
          challenge: 'Bearer error="invalid_grant"',
        });
      }
      const user = await User.findByPk(entry.userId);
      if (!user) throw Unauthorized('User no longer exists.');
      const access = issueAccessToken(user);
      const refresh = await createRefreshToken(user.id);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(tokenResponse(access, refresh));
    }

    if (grant_type === 'client_credentials') {
      const { client_id, client_secret } = req.body;
      if (client_id !== config.oauth.clientId || client_secret !== config.oauth.clientSecret) {
        throw Unauthorized('Invalid client credentials.', {
          challenge: 'Bearer error="invalid_client"',
        });
      }
      // Machine token: no refresh token, restricted scope, subject = client id.
      const pseudoUser = { id: `client:${client_id}`, email: `${client_id}@clients` };
      const access = issueAccessToken(pseudoUser, 'analytics:read habits:read');
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(tokenResponse(access));
    }

    throw BadRequest('Unsupported grant_type.');
  } catch (err) {
    next(err);
  }
}

// ── POST /auth/token/refresh ─────────────────────────────────────────────────
export async function refreshToken(req, res, next) {
  try {
    const { refresh_token } = req.body;
    const result = await rotateRefreshToken(refresh_token);

    if (!result.ok) {
      throw Unauthorized('Refresh token is invalid, expired, or has been revoked.', {
        challenge: 'Bearer error="invalid_grant"',
      });
    }

    const user = await User.findByPk(result.userId);
    if (!user) throw Unauthorized('User no longer exists.');

    const access = issueAccessToken(user);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    return res.status(200).json(tokenResponse(access, result.value));
  } catch (err) {
    next(err);
  }
}

// ── POST /auth/token/revoke ──────────────────────────────────────────────────
export async function revokeToken(req, res, next) {
  try {
    await revokeRefreshToken(req.body.refresh_token);
    // Always 204 (idempotent), per RFC 7009 / spec.
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// ── POST /auth/register (helper, outside the OpenAPI doc) ────────────────────
export async function register(req, res, next) {
  try {
    const existing = await User.findOne({ where: { email: req.body.email } });
    if (existing) throw Conflict('A user with this email already exists.');

    const user = await User.registerWithPassword(req.body);
    const access = issueAccessToken(user);
    const refresh = await createRefreshToken(user.id);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(201).json({
      user: user.toPublic(),
      ...tokenResponse(access, refresh),
    });
  } catch (err) {
    next(err);
  }
}
