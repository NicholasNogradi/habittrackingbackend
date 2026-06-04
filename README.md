# Habit Tracking API — Node.js Implementation

An Express + Sequelize (SQLite) implementation of the Habit Tracking OpenAPI 3.1
specification. Authentication uses JWT access tokens with rotating, hashed
refresh tokens. Request validation is handled by Zod.

## Stack

- **Express** — HTTP server & routing
- **Sequelize** + **sqlite3** — ORM & storage
- **jsonwebtoken** — JWT access tokens (HS256)
- **zod** — request validation (body / query / params)
- **node:crypto** — password hashing (scrypt) & refresh-token generation (no bcrypt dependency)

## Quick start

```bash
# 1. Install dependencies (requires network access)
npm install

# 2. Create your env file
cp .env.example .env
#    → then edit JWT_ACCESS_SECRET to a long random value

# 3. Seed a demo user + habit (optional)
npm run seed

# 4. Run the server
npm run dev      # auto-restart on change
# or
npm start
```

The API listens on `http://localhost:8080` with all routes under `/v1`.
A health check is available at `GET /health`.

## Authentication flows

All flows return the standard OAuth token envelope:

```json
{
  "access_token": "<jwt>",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "<opaque>",
  "scope": "habits:read habits:write ..."
}
```

### 1. Register (helper, not in the OpenAPI doc)
```bash
curl -X POST http://localhost:8080/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"me@example.com","password":"password123","displayName":"Me"}'
```

### 2. Password grant
```bash
curl -X POST http://localhost:8080/v1/auth/token \
  -H 'Content-Type: application/json' \
  -d '{"grant_type":"password","username":"me@example.com","password":"password123"}'
```
The endpoint also accepts `application/x-www-form-urlencoded` bodies.

### 3. Refresh grant (with rotation)
```bash
curl -X POST http://localhost:8080/v1/auth/token/refresh \
  -H 'Content-Type: application/json' \
  -d '{"refresh_token":"<refresh_token>"}'
```
Each refresh **rotates** the token: the old refresh token is revoked and a new
one is returned. Presenting an already-rotated token triggers **reuse detection**
and revokes the entire token chain (defends against stolen refresh tokens).

### 4. Revoke
```bash
curl -X POST http://localhost:8080/v1/auth/token/revoke \
  -H 'Content-Type: application/json' \
  -d '{"refresh_token":"<refresh_token>"}'    # → 204, idempotent
```

### 5. authorization_code & client_credentials
Both grants are implemented on `POST /auth/token`. The `authorization_code` flow
uses a single-use, 60-second in-memory code store (a real deployment would issue
codes from a `/oauth/authorize` consent screen). `client_credentials` issues a
scoped machine token with no refresh token.

### Calling protected endpoints
```bash
curl http://localhost:8080/v1/habits \
  -H 'Authorization: Bearer <access_token>'
```
Missing/invalid/expired tokens return **401** with a `WWW-Authenticate` challenge.

## HTTP semantics implemented

| Concern | Implementation |
|---|---|
| **Errors** | RFC 7807 Problem Details (`type/title/status/detail/instance/traceId`) with field-level `errors` for validation failures |
| **Optimistic concurrency** | `ETag` on reads; `If-Match` enforced on `PATCH`/`PUT`/`DELETE` → **412** on mismatch |
| **Idempotency** | `Idempotency-Key` header on `POST` replays the original response within 24h |
| **Rate limiting** | `X-RateLimit-Limit/Remaining/Reset` headers; **429** + `Retry-After` when exceeded |
| **Pagination** | Cursor-based; responses include `pagination.{totalCount,hasMore,nextCursor,prevCursor}` |
| **Resource creation** | **201** + `Location` header |
| **Deletes** | **204 No Content** |
| **Caching** | `Cache-Control: no-store` on auth responses; `Last-Modified` on resources |

## Project structure

```
src/
├── server.js              # entry point (DB sync + listen)
├── app.js                 # express assembly & middleware order
├── seed.js                # demo data
├── config/                # env config + sequelize instance
├── models/                # Sequelize models + associations
├── middleware/            # auth, validate, errorHandler, rateLimit, etag, idempotency
├── schemas/               # zod validation schemas
├── services/              # token (JWT/refresh), streak math, pagination
├── controllers/           # request handlers per resource
└── routes/                # route wiring (auth.routes + index)
```

## Security notes for production

- Passwords are hashed with `scrypt` (16-byte salt, 64-byte key) and compared
  with `crypto.timingSafeEqual`.
- Refresh tokens are stored only as **SHA-256 hashes** — never in plaintext.
- Replace the in-memory rate-limit and idempotency stores with Redis (or similar)
  for multi-instance deployments.
- Switch `sequelize.sync()` to proper migrations before going to production.
- Set a strong `JWT_ACCESS_SECRET` (or move to RS256 with a key pair).
- SQLite foreign keys are enabled via `PRAGMA foreign_keys = ON`.

## Endpoint coverage

All 16 paths / 30+ operations from the OpenAPI spec are implemented: auth
(token/refresh/revoke), users (`/users/me`), categories, habits (GET/POST/PUT/
PATCH/DELETE), check-ins, streaks (history + current), reminders, and analytics
(summary + per-habit trends).
