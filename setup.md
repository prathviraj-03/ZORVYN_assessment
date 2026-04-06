# Finance Dashboard API — Setup

You can set up this project in **two ways**:

1) **Docker (recommended)** — quickest, zero local Postgres setup
2) **Local setup (no Docker)** — run Node + Postgres directly on your machine

---

## Get the code

```bash
git clone <REPO_URL>
cd finance-dashboard-api
```

## Option 1 — Docker (recommended)

### Prerequisites

- Docker Desktop
- Docker Compose (included with Docker Desktop)

### 1) Create your `.env` file

Even when using Docker, keep a local `.env` file so you can run the app locally if needed and keep configuration consistent.

```bash
# Windows PowerShell
Copy-Item .env.example .env

# macOS / Linux
cp .env.example .env
```

### 2) Build the image (first time)

```bash
docker compose build api
```

### 3) Start the stack

```bash
docker compose up -d db api
```

Alternative (build + start in one command):

```bash
docker compose up -d --build db api
```

On startup, the API container automatically applies Prisma migrations (`npx prisma migrate deploy`).

### 4) Verify

- API: `http://localhost:3000/`
- Health: `http://localhost:3000/health`

### 5) Default admin (Docker)

Docker bootstraps an admin user automatically (only if no admin exists yet):

- Email: `admin@finance.com`
- Password: `password123`

### 6) Stop everything

```bash
docker compose down
```

### Rebuild after code changes

```bash
docker compose build api
docker compose up -d api
```

---

## Option 2 — Local setup (no Docker)

### Prerequisites

- Node.js **18+** (20+ recommended)
- npm
- PostgreSQL **16+** (or any compatible Postgres)

### 1) Install dependencies

```bash
npm ci
```

### 2) Configure environment

Create `.env` from the example and update values.

```bash
# Windows PowerShell
Copy-Item .env.example .env

# macOS/Linux
cp .env.example .env
```

Minimum required:

- `DATABASE_URL`
- `JWT_SECRET` (must be **≥ 16 characters**)

Optional (creates the first admin automatically on startup if no admin exists):

- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_PASSWORD` (min 8 chars)

### 3) Create databases

Create these two databases in Postgres:

- `finance_dashboard`
- `finance_dashboard_test`

SQL (run in `psql` or any SQL client):

```sql
CREATE DATABASE finance_dashboard;
CREATE DATABASE finance_dashboard_test;
```

One-liner alternative:

```bash
psql -U postgres -c "CREATE DATABASE finance_dashboard;"
psql -U postgres -c "CREATE DATABASE finance_dashboard_test;"
```

### 4) Apply migrations

```bash
npx prisma generate
npx prisma migrate deploy
```

### 5) Start the API

```bash
npm run dev
```

- API: `http://localhost:3000/`
- Health: `http://localhost:3000/health`

---

## Environment variables reference

`.env.example` is included in the repository root.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | Postgres connection string |
| `JWT_SECRET` | ✅ | Min 16 characters |
| `JWT_EXPIRES_IN` | No | Default: `7d` |
| `BOOTSTRAP_ADMIN_EMAIL` | No | Auto-creates first admin |
| `BOOTSTRAP_ADMIN_PASSWORD` | No | Min 8 chars |

## Postman

Import `ZORVYN.postman_collection.json` (included in the repository root).

- Run **Auth → Login** first.
- The collection saves the returned JWT into `{{token}}` automatically and sends it on subsequent requests.

---

## Troubleshooting

### API returns 500 / “table does not exist”

Migrations likely haven’t been applied to the database yet.

Docker:

```bash
docker compose exec -T api sh -lc "npx prisma migrate deploy"
```

Local:

```bash
npx prisma migrate deploy
```

### API not reachable / requests disconnect

Check container status and logs:

```bash
docker compose ps
docker compose logs --tail 150 api
```

### “Invalid environment variables” on startup

Double-check:

- `DATABASE_URL` is set
- `JWT_SECRET` is at least 16 characters

### Port already in use

If `3000` is busy, change `PORT` (local) or the compose port mapping (Docker), then restart.

### Reset Docker database (start fresh)

If you want a clean database volume:

⚠️ `-v` deletes all data in the database. Only use this when you want a clean slate.

```bash
docker compose down -v
docker compose up -d db api
```

---

## (Optional) Tests

```bash
docker compose run --rm test
```
