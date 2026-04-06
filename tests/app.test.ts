import { describe, expect, it } from '@jest/globals';
import { api } from './helpers/testClient';

describe('App', () => {
  describe('GET /', () => {
    it('returns 200 and confirms the API is running', async () => {
      const res = await api.get('/');

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        status: 'ok',
        message: 'Finance Dashboard API is running',
        health: '/health',
      });
    });
  });

  describe('GET /health', () => {
    it('returns 200 with { status: "ok", database: "connected" }', async () => {
      const res = await api.get('/health');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
      expect(res.body).toHaveProperty('database', 'connected');
    });
  });

  describe('GET /<missing>', () => {
    it('returns 404 (not 500)', async () => {
      const res = await api.get('/this-route-does-not-exist');

      expect(res.status).toBe(404);
      expect(res.status).not.toBe(500);
    });
  });
});
