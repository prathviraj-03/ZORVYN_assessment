import { api, seedTestDb, cleanTestDb, getToken } from './helpers/testClient';

let adminToken:  string;
let viewerToken: string;
let viewerUserId: string;

describe('Users', () => {
  beforeAll(async () => {
    const { viewer } = await seedTestDb();
    viewerUserId  = viewer.id;
    adminToken    = await getToken('admin@test.com');
    viewerToken   = await getToken('viewer@test.com');
  });

  afterAll(async () => { await cleanTestDb(); });

  // ── GET /me ────────────────────────────────────────────────────────────────
  describe('GET /api/users/me', () => {
    it('returns own profile without passwordHash', async () => {
      const res = await api
        .get('/api/users/me')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.user.email).toBe('admin@test.com');
      expect(res.body.data.user).not.toHaveProperty('passwordHash');
    });

    it('returns 401 with no token', async () => {
      const res = await api.get('/api/users/me');
      expect(res.status).toBe(401);
    });

    it('returns 401 with a malformed token', async () => {
      const res = await api
        .get('/api/users/me')
        .set('Authorization', 'Bearer this.is.fake');
      expect(res.status).toBe(401);
    });
  });

  // ── GET / ──────────────────────────────────────────────────────────────────
  describe('GET /api/users', () => {
    it('returns 403 for viewer role', async () => {
      const res = await api
        .get('/api/users')
        .set('Authorization', `Bearer ${viewerToken}`);
      expect(res.status).toBe(403);
    });

    it('returns paginated user list for admin', async () => {
      const res = await api
        .get('/api/users?page=1&limit=5')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.users).toBeInstanceOf(Array);
      expect(res.body.data.pagination).toMatchObject({
        page:  1,
        limit: 5,
      });
    });
  });

  // ── POST / ─────────────────────────────────────────────────────────────────
  describe('POST /api/users', () => {
    it('admin creates a user with specified role', async () => {
      const res = await api
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'New Analyst', email: 'newanalyst@test.com', password: 'password123', role: 'ANALYST' });
      expect(res.status).toBe(201);
      expect(res.body.data.user.role).toBe('ANALYST');
    });

    it('returns 403 for viewer', async () => {
      const res = await api
        .post('/api/users')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ name: 'X', email: 'x@test.com', password: 'password123' });
      expect(res.status).toBe(403);
    });

    it('returns 409 for duplicate email', async () => {
      const res = await api
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Dup', email: 'admin@test.com', password: 'password123' });
      expect(res.status).toBe(409);
    });
  });

  // ── PATCH /:id ─────────────────────────────────────────────────────────────
  describe('PATCH /api/users/:id', () => {
    it('admin updates a user role', async () => {
      const res = await api
        .patch(`/api/users/${viewerUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'ANALYST' });
      expect(res.status).toBe(200);
      expect(res.body.data.user.role).toBe('ANALYST');
    });

    it('returns 400 for empty body', async () => {
      const res = await api
        .patch(`/api/users/${viewerUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid UUID param', async () => {
      const res = await api
        .patch('/api/users/not-a-uuid')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'VIEWER' });
      expect(res.status).toBe(400);
    });

    it('returns 404 for non-existent user', async () => {
      const res = await api
        .patch('/api/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'VIEWER' });
      expect(res.status).toBe(404);
    });
  });

  // ── DELETE /:id ────────────────────────────────────────────────────────────
  describe('DELETE /api/users/:id', () => {
    it('returns 400 when admin tries to delete own account', async () => {
      const me  = await api.get('/api/users/me').set('Authorization', `Bearer ${adminToken}`);
      const res = await api
        .delete(`/api/users/${me.body.data.user.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });

    it('admin hard deletes another user', async () => {
      // Create a throwaway user to delete
      const created = await api
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Temp', email: 'temp@test.com', password: 'password123' });
      const userId = created.body.data.user.id;

      const res = await api
        .delete(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);

      // Should 404 on subsequent update attempt
      const check = await api
        .patch(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: 'VIEWER' });
      expect(check.status).toBe(404);
    });
  });
});