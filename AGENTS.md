# Implementation Plan: To Do List API with JWT Authentication

This file is the implementation guide for this repository. Preserve the API, security, and database decisions below unless the project owner changes them. Do not read `.env` or run database queries without the owner's explicit direction. Planning and local code changes do not require database access.

## Goal and scope

Build a task-management backend using Express.js, JavaScript (CommonJS), and MySQL with direct SQL. Use a Controller / Routes / Service structure. Do not add an ORM.

Users register with email and password, log in to receive a JWT Bearer access token, and manage **only their own** tasks: create, list, read, edit, complete/reopen, and delete. Security controls follow the OWASP Top 10:2025, applied in proportion to a small single-process API (see *Security*).

## Current repository context

- Express 5, `mysql2`, `dotenv`, `jsonwebtoken`, `helmet`, and `express-rate-limit` are installed. The package uses CommonJS (`"type": "commonjs"`).
- Phases 1–7 of the original no-auth plan were completed in commit `545a788`. Authentication, ownership, and OWASP hardening were added afterwards.
- Never inspect or print `.env`. Keep it out of version control. Use the placeholder-only `.env.example` instead.
- Ask the owner before accessing an existing database or running queries against it.

## Target structure

```text
tasks-express/
├── app.js                     # Express app: helmet, trust proxy, JSON parsing, routes, 404, errors
├── server.js                  # config validation, DB check, listen, graceful shutdown
├── config/
│   ├── auth.js                # JWT settings (validated, secret never printed)
│   └── database.js            # mysql2/promise pool
├── controllers/
│   ├── authController.js      # register, login, me, logout
│   └── taskController.js      # task HTTP handling and validation
├── middleware/
│   ├── authenticate.js        # Bearer token verification, sets req.user
│   ├── errorHandler.js
│   ├── notFound.js
│   └── rateLimiter.js
├── routes/
│   ├── authRoutes.js
│   └── taskRoutes.js
├── services/
│   ├── serializers.js         # row -> API JSON (ISO 8601 UTC dates)
│   ├── taskService.js         # parameterized SQL, always scoped by user_id
│   └── userService.js         # parameterized SQL for users
├── utils/
│   ├── httpError.js
│   ├── logger.js              # structured logs; never log secrets, passwords, or tokens
│   ├── password.js            # scrypt hashing
│   ├── token.js               # JWT sign/verify with pinned options
│   └── validators.js
├── database/
│   ├── schema.sql             # fresh-install schema; never auto-run at boot
│   └── migrations/            # manual migrations for existing databases
├── test/                      # node:test, no database required
├── .env.example
└── package.json
```

Keep controllers focused on HTTP concerns and validation. Keep SQL in services. Routes map URLs to middleware and controller methods. Centralize 404 and error responses.

## Data model

InnoDB, `utf8mb4`.

**`users`**

| Column | Type | Rules |
| --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | Primary key, auto increment |
| `email` | `VARCHAR(254)` | Required, unique, stored trimmed and lowercase |
| `password_hash` | `VARCHAR(255)` | Required; `scrypt$N$r$p$salt$hash` |
| `token_version` | `INT UNSIGNED` | Default `0`; incremented on logout to revoke all tokens |
| `created_at`, `updated_at` | `DATETIME` | UTC |

**`tasks`**

| Column | Type | Rules |
| --- | --- | --- |
| `id` | `BIGINT UNSIGNED` | Primary key, auto increment |
| `user_id` | `BIGINT UNSIGNED` | Required; FK `users(id)` `ON DELETE CASCADE` |
| `title` | `VARCHAR(200)` | Required |
| `description` | `TEXT` | Nullable |
| `status` | `ENUM('pending','in_progress','completed')` | Default `pending` |
| `priority` | `ENUM('low','medium','high')` | Default `medium` |
| `due_at` | `DATETIME` | Nullable, UTC |
| `completed_at` | `DATETIME` | Set when completed, cleared when reopened |
| `created_at`, `updated_at` | `DATETIME` | UTC |

Indexes: `(user_id, created_at, id)`, `status`, `due_at`. Permanent deletion. Schema changes live in `database/schema.sql` (fresh installs) and `database/migrations/` (existing databases). They are applied manually and never at startup.

## API contract

Prefix `/api/v1`. Every `/tasks` endpoint requires `Authorization: Bearer <token>`.

| Method | Path | Auth | Behavior |
| --- | --- | --- | --- |
| `POST` | `/api/v1/auth/register` | — | Create account; `201` with token |
| `POST` | `/api/v1/auth/login` | — | `200` with token |
| `GET` | `/api/v1/auth/me` | Bearer | Current user |
| `POST` | `/api/v1/auth/logout` | Bearer | Revoke all of the user's tokens; `204` |
| `GET` | `/api/v1/tasks` | Bearer | List own tasks with filters and pagination |
| `GET` | `/api/v1/tasks/:id` | Bearer | Get one own task |
| `POST` | `/api/v1/tasks` | Bearer | Create a task owned by the caller |
| `PATCH` | `/api/v1/tasks/:id` | Bearer | Partially update `title`, `description`, `priority`, `due_at` |
| `PATCH` | `/api/v1/tasks/:id/status` | Bearer | Change status and completion timestamp |
| `DELETE` | `/api/v1/tasks/:id` | Bearer | Permanently delete |

A task that does not exist **or belongs to another user** returns `404`, never `403`. List query parameters: `status`, `priority`, `q` (title/description, ≤100 chars, LIKE wildcards escaped), `due_after`, `due_before` (a date-only value means the end of that day), `page`, `limit` (default 20, max 100). Sort: `created_at DESC, id DESC`. `PATCH` distinguishes omitted fields from explicit `null`.

## Validation and response conventions

- `title`: trimmed, 1–200 characters. `description`: string or `null`. `status`/`priority`: allowed values only.
- Dates: ISO 8601, either `YYYY-MM-DD` (UTC) or a date-time with `Z` or `±HH:MM`. Impossible dates are rejected. Stored as UTC and returned as `YYYY-MM-DDTHH:MM:SSZ`.
- IDs, `page`, and `limit` are positive integers.
- `email`: trimmed, lowercased, ≤254 characters. `password`: 12–128 characters, not trimmed, no composition rules.
- Bind all user values with `mysql2` placeholders. Build optional clauses only from fixed SQL fragments. Use explicit column lists, never `SELECT *`.
- Success: `{ "data": ... }` (lists add `meta`). Error: `{ "error": { "code", "message" } }` with no SQL, stack traces, or library error text.
- Statuses: `201` create/register, `200` reads/updates/login, `204` delete/logout, `400` invalid input or JSON, `401` missing/invalid/revoked token or bad credentials, `404` missing task/route, `409` email taken, `413` body too large, `429` rate limited, `500` unexpected.

## Security (OWASP Top 10:2025)

| Category | Controls |
| --- | --- |
| A01 Broken Access Control | `user_id = ?` in every task query; 404 for other users' tasks; auth on all task routes |
| A02 Security Misconfiguration | helmet, no `x-powered-by`, 100 kb body limit, validated env config, no stack traces to clients, no CORS by default |
| A03 Software Supply Chain | minimal dependencies, committed lockfile, `npm run audit` |
| A04 Cryptographic Failures | scrypt (N=2^17, r=8, p=1), `JWT_SECRET` ≥32 chars, HTTPS terminated at a reverse proxy |
| A05 Injection | placeholders, fixed SQL fragments, escaped LIKE wildcards |
| A06 Insecure Design | rate limits (login 10/15 min, register 5/hour, API 300/15 min per IP), password policy |
| A07 Authentication Failures | generic login errors, dummy-hash timing equalization, short token lifetime, `token_version` revocation |
| A08 Integrity Failures | JWT algorithm pinned to HS256, `iss`/`aud`/`exp` verified |
| A09 Logging & Alerting | structured security events (register, login success/failure, logout, rejected token, rate limit) with user id and IP only |
| A10 Exceptional Conditions | centralized error handler, auth fails closed, server/process error handlers |

Out of scope for now (revisit if the system grows): refresh tokens, MFA, email verification, DB-backed account lockout, shared rate-limit store. Register returns `409` for a taken email. This accepted trade-off of open registration without email verification is mitigated by rate limiting.

## Configuration

Environment variables: `PORT`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET` (required, ≥32 chars), `JWT_EXPIRES_IN` (default `1h`, 1 minute to 1 day), `TRUST_PROXY` (`false`, a hop count, or an Express preset). Startup validates configuration and exits with a short message, without secret values, when it is invalid or the database is unreachable.

## Verification

- `npm test` runs the unit and HTTP tests that need no database.
- `npm run audit`.
- An end-to-end check against a local/test MySQL only, with owner approval: register/login/logout, cross-user isolation (404), CRUD, filters, pagination, validation, and rate limits.

## Decisions to revisit only if requirements change

- Status values: `pending`, `in_progress`, `completed`. Priority values: `low`, `medium`, `high`.
- Deletion: permanent.
- Authentication: JWT Bearer access tokens (HS256), no refresh tokens. Registration is open to anyone. Tasks are owned per user.
- Database access: no inspection or queries without explicit owner approval.

If the owner changes one of these decisions, update this document and keep schema, validation, API behavior, and documentation aligned.
