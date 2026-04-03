import { api, seedTestDb, cleanTestDb } from './helpers/testClient';

describe('Auth', () => {
  beforeAll(async () => { await seedTestDb(); });
  afterAll(async ()  => { await cleanTestDb(); });

  // ── Register ───────────────────────────────────────────────────────────────
  describe('POST /api/auth/register', () => {
    it('returns 201 and creates a user with default VIEWER role', async () => {
      const res = await api.post('/api/auth/register').send({
        name:     'New User',
        email:    'newuser@test.com',
        password: 'password123',
      });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.role).toBe('VIEWER');
      expect(res.body.data.user).not.toHaveProperty('passwordHash');
    });

    it('returns 409 for duplicate email', async () => {
      const res = await api.post('/api/auth/register').send({
        name:     'Dup',
        email:    'admin@test.com',
        password: 'password123',
      });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('CONFLICT');
    });

    it('returns 400 with VALIDATION_ERROR for bad input', async () => {
      const res = await api.post('/api/auth/register').send({
        name:     'A',           // too short
        email:    'not-an-email',
        password: '123',         // too short
      });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.errors).toHaveProperty('email');
      expect(res.body.errors).toHaveProperty('password');
    });

    it('returns 400 when required fields are missing', async () => {
      const res = await api.post('/api/auth/register').send({});
      expect(res.status).toBe(400);
    });
  });

  // ── Login ──────────────────────────────────────────────────────────────────
  describe('POST /api/auth/login', () => {
    it('returns 200 and a JWT token on valid credentials', async () => {
      const res = await api.post('/api/auth/login').send({
        email:    'admin@test.com',
        password: 'password123',
      });
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data.user.role).toBe('ADMIN');
      expect(res.body.data.user).not.toHaveProperty('passwordHash');
    });

    it('returns 401 for wrong password', async () => {
      const res = await api.post('/api/auth/login').send({
        email:    'admin@test.com',
        password: 'wrongpassword',
      });
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('returns 401 for non-existent email', async () => {
      const res = await api.post('/api/auth/login').send({
        email:    'ghost@test.com',
        password: 'password123',
      });
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
    });
  });
});