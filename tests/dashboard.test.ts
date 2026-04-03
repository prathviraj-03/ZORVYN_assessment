import { api, seedTestDb, cleanTestDb, getToken } from './helpers/testClient';

let adminToken:   string;
let analystToken: string;
let viewerToken:  string;

describe('Dashboard', () => {
  beforeAll(async () => {
    await seedTestDb(); // seeds 1 INCOME (5000) + 1 EXPENSE (1200)
    adminToken   = await getToken('admin@test.com');
    analystToken = await getToken('analyst@test.com');
    viewerToken  = await getToken('viewer@test.com');
  });

  afterAll(async () => { await cleanTestDb(); });

  // ── Summary ────────────────────────────────────────────────────────────────
  describe('GET /api/dashboard/summary', () => {
    it('returns 403 for viewer', async () => {
      const res = await api
        .get('/api/dashboard/summary')
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(res.status).toBe(403);
    });

    it('returns 200 for analyst', async () => {
      const res = await api
        .get('/api/dashboard/summary')
        .set('Authorization', `Bearer ${analystToken}`);
      expect(res.status).toBe(200);
    });

    it('returns correct aggregated totals matching seeded data', async () => {
      const res = await api
        .get('/api/dashboard/summary')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.totalIncome).toBe(5000);
      expect(res.body.data.totalExpenses).toBe(1200);
      expect(res.body.data.netBalance).toBe(3800);
      expect(res.body.data.netBalance).toBe(
        res.body.data.totalIncome - res.body.data.totalExpenses
      );
    });

    it('returns 401 with no token', async () => {
      const res = await api.get('/api/dashboard/summary');
      expect(res.status).toBe(401);
    });
  });

  // ── Categories ─────────────────────────────────────────────────────────────
  describe('GET /api/dashboard/categories', () => {
    it('returns category breakdown array', async () => {
      const res = await api
        .get('/api/dashboard/categories')
        .set('Authorization', `Bearer ${analystToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data.length).toBeGreaterThan(0);
    });

    it('each item has the expected shape', async () => {
      const res = await api
        .get('/api/dashboard/categories')
        .set('Authorization', `Bearer ${adminToken}`);
      const item = res.body.data[0];
      expect(item).toHaveProperty('category');
      expect(item).toHaveProperty('income');
      expect(item).toHaveProperty('expense');
      expect(item).toHaveProperty('net');
      expect(item).toHaveProperty('count');
    });

    it('returns 403 for viewer', async () => {
      const res = await api
        .get('/api/dashboard/categories')
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(res.status).toBe(403);
    });
  });

  // ── Trends ─────────────────────────────────────────────────────────────────
  describe('GET /api/dashboard/trends', () => {
    it('returns monthly trends', async () => {
      const res = await api
        .get('/api/dashboard/trends?period=monthly')
        .set('Authorization', `Bearer ${analystToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.period).toBe('monthly');
      expect(res.body.data.trends).toBeInstanceOf(Array);
    });

    it('returns weekly trends', async () => {
      const res = await api
        .get('/api/dashboard/trends?period=weekly')
        .set('Authorization', `Bearer ${analystToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.period).toBe('weekly');
    });

    it('defaults to monthly for unknown period value', async () => {
      const res = await api
        .get('/api/dashboard/trends?period=yearly')
        .set('Authorization', `Bearer ${analystToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.period).toBe('monthly');
    });

    it('each trend item has income, expense, net fields', async () => {
      const res = await api
        .get('/api/dashboard/trends')
        .set('Authorization', `Bearer ${adminToken}`);
      const item = res.body.data.trends[0];
      expect(item).toHaveProperty('period');
      expect(item).toHaveProperty('income');
      expect(item).toHaveProperty('expense');
      expect(item).toHaveProperty('net');
    });
  });

  // ── Recent ─────────────────────────────────────────────────────────────────
  describe('GET /api/dashboard/recent', () => {
    it('returns recent activity feed', async () => {
      const res = await api
        .get('/api/dashboard/recent')
        .set('Authorization', `Bearer ${analystToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.records).toBeInstanceOf(Array);
    });

    it('respects limit query param', async () => {
      const res = await api
        .get('/api/dashboard/recent?limit=1')
        .set('Authorization', `Bearer ${analystToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.records.length).toBeLessThanOrEqual(1);
    });

    it('each record includes user info', async () => {
      const res = await api
        .get('/api/dashboard/recent')
        .set('Authorization', `Bearer ${adminToken}`);
      const item = res.body.data.records[0];
      expect(item).toHaveProperty('user');
      expect(item.user).toHaveProperty('name');
      expect(item.user).not.toHaveProperty('passwordHash');
    });

    it('returns 403 for viewer', async () => {
      const res = await api
        .get('/api/dashboard/recent')
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(res.status).toBe(403);
    });
  });
});