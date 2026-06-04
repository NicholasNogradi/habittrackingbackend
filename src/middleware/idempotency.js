// In-memory idempotency store. Keyed by (userId + method + path + Idempotency-Key).
// Replaying the same key within the TTL returns the cached response.
// For production, back this with a shared store (Redis) + persisted bodies.

const STORE = new Map();
const TTL_MS = 24 * 60 * 60 * 1000; // 24h per spec

function cleanup() {
  const now = Date.now();
  for (const [k, v] of STORE) {
    if (now > v.expiresAt) STORE.delete(k);
  }
}

export function idempotency(req, res, next) {
  const key = req.get('idempotency-key');
  if (!key) return next();

  cleanup();
  const cacheKey = `${req.user?.id || 'anon'}:${req.method}:${req.path}:${key}`;
  const cached = STORE.get(cacheKey);

  if (cached) {
    res.setHeader('Idempotency-Replayed', 'true');
    if (cached.location) res.setHeader('Location', cached.location);
    return res.status(cached.status).json(cached.body);
  }

  // Intercept res.json to capture the response for replay.
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      STORE.set(cacheKey, {
        status: res.statusCode,
        body,
        location: res.getHeader('Location'),
        expiresAt: Date.now() + TTL_MS,
      });
    }
    return originalJson(body);
  };

  next();
}
