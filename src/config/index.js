import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Minimal .env loader (no external dependency). Lines like KEY=VALUE.
function loadDotEnv() {
  const envPath = path.resolve(__dirname, '../../.env');
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // Strip inline comments and surrounding quotes
    value = value.replace(/\s+#.*$/, '').replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnv();

function int(name, fallback) {
  const v = process.env[name];
  if (v === undefined) return fallback;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? fallback : n;
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: int('PORT', 8080),

  db: {
    storage: process.env.DB_STORAGE || './data/habit-tracker.sqlite',
  },

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev-only-insecure-secret',
    accessTtl: int('JWT_ACCESS_TTL_SECONDS', 3600),
    issuer: process.env.JWT_ISSUER || 'https://api.habittrack.io',
    audience: process.env.JWT_AUDIENCE || 'habittrack-clients',
  },

  refresh: {
    ttl: int('REFRESH_TTL_SECONDS', 2592000),
  },

  oauth: {
    clientId: process.env.OAUTH_CLIENT_ID || 'habittrack-web',
    clientSecret: process.env.OAUTH_CLIENT_SECRET || 'demo-client-secret',
    redirectUris: (process.env.OAUTH_REDIRECT_URIS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  },

  rateLimit: {
    max: int('RATE_LIMIT_MAX', 1000),
    windowSeconds: int('RATE_LIMIT_WINDOW_SECONDS', 3600),
  },
};
