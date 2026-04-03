import { api, seedTestDb, cleanTestDb, getToken } from './helpers/testClient';

let adminToken:  string;
let viewerToken: string;
let recordId:    string;

describe('Records', () => {
  beforeAll(async () => {
    const { record } = await seedTestDb();
    recordId    = record.id;
    adminToken  = await getToken('admin@test.com');
    viewerToken = await getToken('viewer@test.com');
  });

  afterAll(async () => { await cleanTestDb(); });

  // ── GET / ──────────────────────────────────────────────────────────────────
  describe('GET /api/records', () => {
    it('returns 401 with no token', async () => {
      const res = await api.get('/api/records');
      expect(res.status).toBe(401);
    });

    it('viewer can list records', async () => {
      const res = await api
        .get('/api/records')
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.records).toBeInstanceOf(Array);
      expect(res.body.data.pagination).toHaveProperty('total');
    });

    it('filters by type=INCOME', async () => {
      const res = await api
        .get('/api/records?type=INCOME')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      res.body.data.records.forEach((r: any) => expect(r.type).toBe('INCOME'));
    });

    it('filters by type=EXPENSE', async () => {
      const res = await api
        .get('/api/records?type=EXPENSE')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      res.body.data.records.forEach((r: any) => expect(r.type).toBe('EXPENSE'));
    });

    it('filters by date range', async () => {
      const res = await api
        .get('/api/records?from=2024-01-01&to=2024-01-31')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
    });

    it('paginates correctly', async () => {
      const res = await api
        .get('/api/records?page=1&limit=1')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.records.length).toBeLessThanOrEqual(1);
      expect(res.body.data.pagination.limit).toBe(1);
    });

    it('returns 400 for invalid type filter', async () => {
      const res = await api
        .get('/api/records?type=INVALID')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });
  });

  // ── GET /:id ───────────────────────────────────────────────────────────────
  describe('GET /api/records/:id', () => {
    it('returns a single record by id', async () => {
      const res = await api
        .get(`/api/records/${recordId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.record.id).toBe(recordId);
    });

    it('returns 404 for non-existent record', async () => {
      const res = await api
        .get('/api/records/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });

    it('returns 400 for invalid UUID', async () => {
      const res = await api
        .get('/api/records/not-a-uuid')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });
  });

  // ── POST / ─────────────────────────────────────────────────────────────────
  describe('POST /api/records', () => {
    it('returns 403 for viewer', async () => {
      const res = await api
        .post('/api/records')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ amount: 1000, type: 'INCOME', category: 'Test', date: '2024-03-01' });
      expect(res.status).toBe(403);
    });

    it('admin creates a record and returns 201', async () => {
      const res = await api
        .post('/api/records')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amount: 2500.50, type: 'EXPENSE', category: 'Equipment', date: '2024-03-15', notes: 'Laptop' });
      expect(res.status).toBe(201);
      expect(res.body.data.record.category).toBe('Equipment');
      expect(res.body.data.record.type).toBe('EXPENSE');
    });

    it('returns 400 for negative amount', async () => {
      const res = await api
        .post('/api/records')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amount: -500, type: 'INCOME', category: 'Test', date: '2024-03-01' });
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid date format', async () => {
      const res = await api
        .post('/api/records')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amount: 100, type: 'INCOME', category: 'Test', date: '01-03-2024' });
      expect(res.status).toBe(400);
    });

    it('returns 400 when required fields are missing', async () => {
      const res = await api
        .post('/api/records')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ amount: 100 });
      expect(res.status).toBe(400);
    });
  });

  // ── PATCH /:id ─────────────────────────────────────────────────────────────
  describe('PATCH /api/records/:id', () => {
    it('admin updates a record', async () => {
      const res = await api
        .patch(`/api/records/${recordId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notes: 'Updated notes', category: 'Bonus' });
      expect(res.status).toBe(200);
      expect(res.body.data.record.notes).toBe('Updated notes');
      expect(res.body.data.record.category).toBe('Bonus');
    });

    it('viewer cannot update a record', async () => {
      const res = await api
        .patch(`/api/records/${recordId}`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ notes: 'hack' });
      expect(res.status).toBe(403);
    });

    it('returns 400 for empty update body', async () => {
      const res = await api
        .patch(`/api/records/${recordId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect(res.status).toBe(400);
    });
  });

  // ── DELETE /:id ────────────────────────────────────────────────────────────
  describe('DELETE /api/records/:id (soft delete)', () => {
    it('soft deletes a record — removed from listing but stays in DB', async () => {
      const res = await api
        .delete(`/api/records/${recordId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);

      // Should now 404 on direct fetch
      const check = await api
        .get(`/api/records/${recordId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(check.status).toBe(404);

      // Should not appear in list
      const list = await api
        .get(`/api/records`)
        .set('Authorization', `Bearer ${adminToken}`);
      const ids = list.body.data.records.map((r: any) => r.id);
      expect(ids).not.toContain(recordId);
    });

    it('viewer cannot delete a record', async () => {
      const res = await api
        .delete(`/api/records/${recordId}`)
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(res.status).toBe(403);
    });
  });
});