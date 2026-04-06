# Finance Dashboard API

A RESTful API for personal finance tracking — income, expenses, categories, and trends — built with Node.js, Express, TypeScript, and PostgreSQL.

→ **Getting started?** See [setup.md](./setup.md).

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Runtime | Node.js 20 |
| Framework | Express 4 |
| Language | TypeScript |
| ORM | Prisma 5 |
| Database | PostgreSQL 16 |
| Auth | JWT (token versioning) |
| Validation | Zod |
| Testing | Jest + Supertest |
| Containerisation | Docker + Docker Compose |

---

## Features & Edge Cases Handled

### Authentication & Sessions
| | |
|---|---|
| Registration | Strong password enforced via Zod — weak passwords rejected at schema level |
| Login | Flags `mustChangePassword: true` and withholds token when the field is set on the account |
| Logout | Increments `tokenVersion` — all previously issued tokens become immediately invalid |
| Change Password | Requires correct old password; issues a new token; invalidates all old ones |
| Forgot Password | Returns identical response for known and unknown emails — no user existence leak; silent no-op for `INACTIVE` accounts |
| Reset Password | One-time token; increments `tokenVersion`; invalidates all active JWTs on use |
| Invite Flow | Admin issues a time-limited token scoped to an email + role; invitee self-registers via that token |

**Edge cases:** expired reset tokens rejected · used reset tokens rejected · duplicate invite rejected if unused invite already exists for that email · expired/used invite tokens rejected

---

### Token Security
| | |
|---|---|
| Token versioning | JWT payload carries `tokenVersion`; every authenticated request validates it against the DB |
| Credential changes | Logout, change-password, and reset-password all bump `tokenVersion` — in-flight tokens become stale immediately |
| Inactive users | Blocked at the authentication middleware — a valid token is not enough |
| Deleted users | Hard-deleted users' tokens are rejected on the next request |

---

### Role-Based Access Control
| Role | Access |
|------|--------|
| `USER` | Own records, own profile |
| `ANALYST` | Everything USER can + all dashboard endpoints |
| `ADMIN` | Full access — user management, import, export, invite |

**Edge cases:** `401` returned when unauthenticated · `403` returned when authenticated but role insufficient · admin self-delete blocked with `400`

---

### Financial Records
| | |
|---|---|
| Soft delete | `isDeleted` flag — records excluded from all list, filter, and export queries; never permanently removed |
| Filtering | `type`, `category`, `from`, `to` with full pagination via `page` and `limit` |
| Date range | `from` must be ≤ `to` — rejected at schema level with a field-level error |
| Param validation | Non-UUID `:id` returns `400` with a field-level error on `id` — not a generic 500 |

---

### Bulk Import
| | |
|---|---|
| Accepted formats | CSV and JSON via multipart upload (key: `file`) |
| Row limit | Hard cap of 5 000 rows per import |
| Per-row validation | Invalid rows do not abort the import — response includes `failed[]` with 1-based row numbers and per-row error reasons |
| Amount coercion | String amounts coerced to numbers for CSV compatibility |

**Edge cases:** wrong MIME type (e.g. `.pdf`) rejected before the route handler · files over 5 MB rejected with `413` · empty file (0 bytes) rejected · JSON must be an array — plain objects rejected · arrays exceeding 5 000 rows rejected

---

### CSV Export
| | |
|---|---|
| Filters | `type`, `category`, `from`, `to` — validated through the same Zod schema as the list endpoint |
| Inclusive `to` date | Stored as `T23:59:59.999Z` — records on the boundary date are never silently dropped |
| Dynamic filename | Reflects applied filters and export date — e.g. `records_income_2024-05-31.csv` |
| CSV injection safe | Values starting with `=` `+` `-` `@` prefixed with a single quote |
| Quote escaping | Internal `"` in `category`, `notes`, and `created_by` escaped as `""` per RFC 4180 |
| Access scoping | Export scoped to admin only; `userId` filter prevents cross-user data exposure |

---

### Dashboard Analytics
| Endpoint | Returns |
|----------|---------|
| `/summary` | `totalIncome`, `totalExpense`, `netBalance` (`income − expense`) |
| `/categories` | Totals grouped by `category` + `type` |
| `/trends` | Income/expense grouped by month |
| `/recent` | Most-recent transactions, ordered descending, capped at feed limit |

**Edge cases:** all four endpoints return `403` for plain `USER` role · `401` for unauthenticated requests

---

### Validation & Error Handling
| | |
|---|---|
| Request validation | Body, query, and params all validated via Zod before the service layer is reached |
| Validation errors | `400` with a `fields` map — `{ fieldName: string[] }` — never a generic message |
| Prisma P2002 | Unique constraint violation → `409 CONFLICT` |
| Prisma P2025 | Record not found → `404 NOT FOUND` |
| Unhandled errors | All other errors → `500`; raw Prisma/Node errors never leak to the client |
| Response envelope | All responses follow `{ success, error: { code, message } }` — consistent across every error path |

---

### Rate Limiting
| | |
|---|---|
| General limiter | Applied to all `/api/*` routes |
| Auth limiter | Stricter limit applied specifically to auth endpoints |
| Breach response | Rapid repeated requests eventually receive `429 Too Many Requests` |

---

### Infrastructure & Reliability
| | |
|---|---|
| Env validation | Zod schema on startup — missing or malformed config hard-fails with a descriptive message before the server binds |
| Audit logging | Best-effort — a failed audit write never breaks the request or triggers a 500 |
| PrismaClient | Singleton with global caching in non-production environments — prevents connection pool exhaustion during hot reload |
| Test isolation | Dedicated `finance_dashboard_test` database; uses `tmpfs` in Docker — wiped automatically on container stop, no stale state between runs |

---

## Project Structure

```
finance-dashboard-api/
├── docker/
│   └── initdb/
│       └── 01-create-test-db.sql   # Creates finance_dashboard_test on first boot
├── prisma/
│   ├── migrations/                 # Prisma migration history
│   └── schema.prisma               # DB schema + model definitions
├── src/
│   ├── config/
│   │   └── env.ts                  # Zod env validation; hard-fails on bad config
│   ├── lib/
│   │   ├── audit.ts                # Best-effort audit log writer
│   │   ├── bootstrap.ts            # First-admin seeding from env vars
│   │   ├── errors.ts               # AppError + typed error factories (400–500)
│   │   ├── jwt.ts                  # Sign / verify; payload: sub, email, role, tokenVersion
│   │   └── prisma.ts               # PrismaClient singleton
│   ├── middleware/
│   │   ├── authenticate.ts         # Bearer parsing → DB lookup → req.user
│   │   ├── authorize.ts            # requireRole(...) RBAC guard
│   │   ├── errorHandler.ts         # AppError / Prisma codes → HTTP responses
│   │   ├── rateLimiter.ts          # General API limiter + stricter auth limiter
│   │   ├── upoad.ts                # Multer memory upload (5 MB cap, csv/json only)
│   │   └── validate.ts             # Zod validation for body | query | params
│   ├── modules/
│   │   ├── auth/                   # register, login, logout, passwords, invite flow
│   │   ├── dashboard/              # Summary, categories, trends, recent feed
│   │   ├── records/                # CRUD, soft delete, import, export
│   │   └── users/                  # Admin CRUD + /me
│   ├── types/
│   │   └── express.d.ts            # req.user type declaration
│   ├── app.ts                      # Express setup: middleware, routers, error handler
│   └── server.ts                   # HTTP server entry point + bootstrapAdmin()
├── tests/
│   ├── helpers/
│   │   ├── globalSetup.ts          # Runs once: migrates test DB
│   │   └── testClient.ts           # Supertest agent bound to the app
│   ├── app.test.ts
│   ├── auth.test.ts
│   ├── dashboard.test.ts
│   ├── records.test.ts
│   └── users.test.ts
├── docker-compose.yml
├── Dockerfile
├── setup.md
└── Finance-Dashboard-API.postman_collection.json
```

---

## API Overview

### Auth — `/api/auth`

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| POST | `/register` | Public | Register with email + strong password |
| POST | `/login` | Public | Returns JWT; flags `mustChangePassword` if set |
| POST | `/logout` | Authenticated | Increments tokenVersion; invalidates all tokens |
| POST | `/change-password` | Authenticated | Requires old password; returns new token |
| POST | `/forgot-password` | Public | Sends reset token (safe response for unknown emails) |
| POST | `/reset-password` | Public | Consumes reset token; invalidates all active JWTs |
| POST | `/invite` | Admin | Issues a time-limited invite token |
| POST | `/register-invite` | Public | Completes registration via invite token |

### Users — `/api/users`

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | `/` | Admin | List all users (paginated) |
| GET | `/me` | Authenticated | Current user profile |
| GET | `/:id` | Admin | Get user by ID |
| PATCH | `/:id` | Admin | Update user (role, status) |
| DELETE | `/:id` | Admin | Hard delete (self-delete blocked) |

### Records — `/api/records`

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| POST | `/` | Authenticated | Create a record |
| GET | `/` | Authenticated | List with filters + pagination |
| GET | `/:id` | Authenticated | Get single record |
| PATCH | `/:id` | Authenticated | Update record |
| DELETE | `/:id` | Authenticated | Soft delete |
| POST | `/import` | Admin | Bulk import CSV or JSON (max 5 000 rows) |
| GET | `/export` | Admin | Export filtered records as CSV |

**Record filters:** `type`, `category`, `from`, `to`, `page`, `limit`  
**Export filters:** `type`, `category`, `from`, `to`

### Dashboard — `/api/dashboard`

| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | `/summary` | Analyst, Admin | Total income, expense, net balance |
| GET | `/categories` | Analyst, Admin | Totals grouped by category + type |
| GET | `/trends` | Analyst, Admin | Income/expense grouped by month |
| GET | `/recent` | Analyst, Admin | Most recent transactions feed |

---

## Roles

| Role | Permissions |
|------|-------------|
| `USER` | Manage own records, view own profile |
| `ANALYST` | Everything USER can + read all dashboard analytics |
| `ADMIN` | Full access — user management, import/export, invite flow |

---

## Response Shape

All endpoints return a consistent envelope:

```jsonc
// Success
{ "success": true, "message": "...", "data": {} }

// Error
{ "success": false, "error": { "code": "ERROR_CODE", "message": "...", "fields": {} } }

// Paginated list
{ "success": true, "data": [], "meta": { "total": 0, "page": 1, "limit": 10, "totalPages": 0 } }
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | Postgres connection string |
| `JWT_SECRET` | ✅ | Minimum 16 characters |
| `JWT_EXPIRES_IN` | No | Default: `7d` |
| `BOOTSTRAP_ADMIN_EMAIL` | No | Auto-creates first admin on startup |
| `BOOTSTRAP_ADMIN_PASSWORD` | No | Minimum 8 characters |

---

## Running Tests

```bash
# Docker — isolated test DB, migrations applied automatically
docker compose run --rm test

# Local — requires finance_dashboard_test DB and a .env.test file
npm test
```

The test suite covers: auth flows, token invalidation, RBAC, record CRUD, import/export, dashboard endpoints, pagination, soft deletes, rate limiting, and middleware validation.

---

## Postman

→ **[Open Collection in Postman](https://www.postman.com/prathviraj-5675609/workspace/finance-dashboard-api/collection/43991728-1988a897-619d-4814-b40f-c3873abfe256)**

Or import manually: `Finance-Dashboard-API.postman_collection.json` from the repository root.

Run **Auth → Login** first. The collection saves the returned JWT into `{{token}}` and attaches it automatically on all subsequent requests.

---

## License

MIT