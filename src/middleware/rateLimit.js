import { config } from '../config/index.js';
import { TooManyRequests } from '../utils/errors.js';

// Simple in-memory fixed-window limiter keyed by user id or IP.
// For production use a shared store (Redis). This satisfies the spec's headers.
const buckets = new Map();

export function rateLimit(req, res, next) {
  const now = Date.now();
  const windowMs = config.rateLimit.windowSeconds * 1000;
  const key = req.user?.id || req.ip || 'anonymous';

  let bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  bucket.count += 1;
  const remaining = Math.max(0, config.rateLimit.max - bucket.count);
  const resetSeconds = Math.ceil(bucket.resetAt / 1000);

  res.setHeader('X-RateLimit-Limit', String(config.rateLimit.max));
  res.setHeader('X-RateLimit-Remaining', String(remaining));
  res.setHeader('X-RateLimit-Reset', String(resetSeconds));

  if (bucket.count > config.rateLimit.max) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    return next(TooManyRequests('Rate limit exceeded.', retryAfter));
  }

  next();
}
