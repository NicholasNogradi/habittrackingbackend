import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { RefreshToken } from '../models/index.js';

// ── Refresh token helpers ────────────────────────────────────────────────────
function generateRefreshTokenValue() {
  // 256 bits of entropy, URL-safe.
  return crypto.randomBytes(32).toString('base64url');
}

function hashToken(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

// ── Access token (JWT) ───────────────────────────────────────────────────────
export function issueAccessToken(user, scope) {
  const payload = {
    sub: user.id,
    email: user.email,
    scope: scope || 'profile:read profile:write habits:read habits:write checkins:write reminders:write analytics:read',
  };
  const token = jwt.sign(payload, config.jwt.accessSecret, {
    algorithm: 'HS256',
    expiresIn: config.jwt.accessTtl,
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
  });
  return { token, scope: payload.scope };
}

export function verifyAccessToken(token) {
  // Throws on invalid/expired token.
  return jwt.verify(token, config.jwt.accessSecret, {
    algorithms: ['HS256'],
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
  });
}

// ── Refresh token lifecycle ──────────────────────────────────────────────────
export async function createRefreshToken(userId) {
  const value = generateRefreshTokenValue();
  const expiresAt = new Date(Date.now() + config.refresh.ttl * 1000);
  await RefreshToken.create({
    userId,
    tokenHash: hashToken(value),
    expiresAt,
  });
  return value; // Plaintext returned to client only once.
}

export async function findActiveRefreshToken(value) {
  if (!value) return null;
  const record = await RefreshToken.findOne({ where: { tokenHash: hashToken(value) } });
  if (!record || !record.isActive()) return null;
  return record;
}

/**
 * Rotate a refresh token: revoke the old one, issue a new one atomically-ish.
 * Detects reuse of an already-rotated token (possible theft) and revokes the chain.
 */
export async function rotateRefreshToken(value) {
  const existing = await RefreshToken.findOne({ where: { tokenHash: hashToken(value) } });

  if (!existing) return { ok: false, reason: 'unknown' };

  // Reuse detection: a token that was already replaced is being presented again.
  if (existing.revokedAt && existing.replacedByTokenHash) {
    // Revoke the entire descendant chain as a precaution.
    await revokeDescendants(existing.replacedByTokenHash);
    return { ok: false, reason: 'reuse_detected' };
  }

  if (!existing.isActive()) return { ok: false, reason: 'expired_or_revoked' };

  const newValue = generateRefreshTokenValue();
  const newHash = hashToken(newValue);
  const expiresAt = new Date(Date.now() + config.refresh.ttl * 1000);

  await RefreshToken.create({
    userId: existing.userId,
    tokenHash: newHash,
    expiresAt,
  });

  existing.revokedAt = new Date();
  existing.replacedByTokenHash = newHash;
  await existing.save();

  return { ok: true, userId: existing.userId, value: newValue };
}

async function revokeDescendants(tokenHash) {
  let current = await RefreshToken.findOne({ where: { tokenHash } });
  while (current) {
    if (!current.revokedAt) {
      current.revokedAt = new Date();
      await current.save();
    }
    if (!current.replacedByTokenHash) break;
    current = await RefreshToken.findOne({ where: { tokenHash: current.replacedByTokenHash } });
  }
}

export async function revokeRefreshToken(value) {
  const record = await RefreshToken.findOne({ where: { tokenHash: hashToken(value) } });
  if (record && !record.revokedAt) {
    record.revokedAt = new Date();
    await record.save();
  }
  // Idempotent: revoking an unknown/already-revoked token still returns success.
  return true;
}
