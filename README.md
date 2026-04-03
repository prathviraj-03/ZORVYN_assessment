# Finance Dashboard API

A role-based finance dashboard backend built with Node.js, Express, Prisma, and PostgreSQL.

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Framework**: Express
- **ORM**: Prisma
- **Database**: PostgreSQL
- **Auth**: JWT (access token)
- **Validation**: Zod
- **Docs**: Swagger UI (`/api/docs`)
- **Tests**: Jest + Supertest

---

## Prerequisites

- Node.js 18+
- PostgreSQL running locally
- `createdb` available in PATH (or create DBs manually)

---

## Setup
```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL and JWT_SECRET

# 3. Run migrations and generate Prisma client
npx prisma generate
npx prisma migrate dev --name init

# 4. Seed the database
npx prisma db seed

# 5. Start the dev server
npm run dev
```

Server runs at `http://localhost:3000`
Swagger UI at `http://localhost:3000/api/docs`

---

## Environment Variables

| Variable        | Required | Description                          |
|-----------------|----------|--------------------------------------|
| `NODE_ENV`      | No       | `development` / `production` / `test`|
| `PORT`          | No       | Server port (default `3000`)         |
| `DATABASE_URL`  | Yes      | PostgreSQL connection string         |
| `JWT_SECRET`    | Yes      | Min 16 characters                    |
| `JWT_EXPIRES_IN`| No       | Token expiry (default `7d`)          |

---

## Seeded Users

| Email                   | Password      | Role     |
|-------------------------|---------------|----------|
| `admin@finance.com`     | `password123` | ADMIN    |
| `analyst@finance.com`   | `password123` | ANALYST  |
| `viewer@finance.com`    | `password123` | VIEWER   |

---

## API Overview

### Auth
| Method | Endpoint               | Auth | Description              |
|--------|------------------------|------|--------------------------|
| POST   | `/api/auth/register`   | No   | Register new account     |
| POST   | `/api/auth/login`      | No   | Login, returns JWT       |

### Users
| Method | Endpoint               | Role    | Description              |
|--------|------------------------|---------|--------------------------|
| GET    | `/api/users/me`        | Any     | Own profile              |
| GET    | `/api/users`           | Admin   | List all users           |
| POST   | `/api/users`           | Admin   | Create user              |
| PATCH  | `/api/users/:id`       | Admin   | Update role/status/name  |
| DELETE | `/api/users/:id`       | Admin   | Hard delete user         |

### Records
| Method | Endpoint               | Role    | Description              |
|--------|------------------------|---------|--------------------------|
| GET    | `/api/records`         | Any     | List + filter + paginate |
| GET    | `/api/records/:id`     | Any     | Single record            |
| POST   | `/api/records`         | Admin   | Create record            |
| PATCH  | `/api/records/:id`     | Admin   | Update record            |
| DELETE | `/api/records/:id`     | Admin   | Soft delete              |

### Dashboard
| Method | Endpoint                     | Role             | Description           |
|--------|------------------------------|------------------|-----------------------|
| GET    | `/api/dashboard/summary`     | Analyst, Admin   | Income/expense totals |
| GET    | `/api/dashboard/categories`  | Analyst, Admin   | Category breakdown    |
| GET    | `/api/dashboard/trends`      | Analyst, Admin   | Monthly/weekly trends |
| GET    | `/api/dashboard/recent`      | Analyst, Admin   | Activity feed         |

**Query params on `GET /api/records`:**
`?type=INCOME|EXPENSE` `?category=` `?from=YYYY-MM-DD` `?to=YYYY-MM-DD` `?page=` `?limit=`

---

## Running Tests
```bash
# Create and migrate test database
createdb finance_dashboard_test
DATABASE_URL="postgresql://postgres:password@localhost:5432/finance_dashboard_test" \
  npx prisma migrate deploy

# Run all tests
npm test
```

Each test file seeds its own isolated data in `beforeAll` and cleans up in `afterAll`. Tests run serially (`--runInBand`) to avoid DB race conditions.

---

## Design Decisions & Assumptions

**Records are shared, not per-user.** The spec describes one shared financial ledger that Admins manage and others observe. `user_id` on a record tracks who created it, not who owns it.

**Soft delete on records, hard delete on users.** Financial records should never be permanently destroyed — `is_deleted=true` keeps an audit trail. User accounts have no such requirement.

**Single role per user.** Role hierarchy is linear: Viewer < Analyst < Admin. A separate roles table would add complexity without benefit at this scope.

**Access token only, no refresh token.** Sufficient for an assessment. In production, a refresh token with rotation and a token blocklist would be added.

**Zod validates at the route layer, Prisma at the DB layer.** Zod errors return `400 VALIDATION_ERROR` with field-level detail. Prisma constraint errors (P2002, P2025) are caught in `errorHandler.ts` and mapped to readable `409`/`404` responses.

**Dashboard aggregations happen in the service layer, not raw SQL.** `groupBy` with `_sum` handles summary and category queries. Monthly/weekly trends are grouped in JS to avoid database-specific date functions and stay portable.

---

## Tradeoffs

| Decision | Tradeoff |
|---|---|
| No refresh token | Simpler auth flow, but tokens cannot be revoked before expiry |
| Soft delete records only | Records stay in DB forever; would need a purge job in production |
| JS-based trend grouping | Portable across DBs, but loads all records into memory — a raw SQL `DATE_TRUNC` would be more efficient at scale |
| Integration tests only | Faster to write and closer to real usage; unit tests on services would catch edge cases earlier |
| Passwords hashed with bcrypt cost 10 | Secure for development; production should use cost 12+ |