import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { api, seedTestDb, cleanTestDb } from './helpers/testClient';
import { PrismaClient, Status } from '@prisma/client';
import { randomUUID } from 'crypto';
import { signToken } from '../src/lib/jwt';

const prisma = new PrismaClient();

function uniqueEmail(prefix: string): string {
  return `${prefix}-${randomUUID()}@test.com`;
}

async function tokenForEmail(email: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error(`User not found for token: ${email}`);

  return signToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    tokenVersion: user.tokenVersion,
  });
}

let adminToken: string;
let viewerToken: string;

describe('Auth', () => {
  beforeAll(async () => {
    await seedTestDb();

    // Reuse these across tests (do not logout/change-password on these users)
    adminToken = await tokenForEmail('admin@test.com');
    viewerToken = await tokenForEmail('viewer@test.com');
  });
  afterAll(async () => {
    await cleanTestDb();
    await prisma.$disconnect();
  });

  // Register
  describe('POST /api/auth/register', () => {
    it('returns 201 and creates a user with default VIEWER role', async () => {
      const res = await api.post('/api/auth/register').send({
        name: 'New User',
        email: 'newuser@test.com',
        password: 'Password@123',
      });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.role).toBe('VIEWER');
      expect(res.body.data.user).not.toHaveProperty('passwordHash');
    });

    it('returns 409 for duplicate email', async () => {
      const res = await api.post('/api/auth/register').send({
        name: 'Dup',
        email: 'admin@test.com',
        password: 'StrongPass1!',
      });
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('CONFLICT');
    });

    it('returns 400 with VALIDATION_ERROR for bad input', async () => {
      const res = await api.post('/api/auth/register').send({
        name: 'A', // too short
        email: 'not-an-email',
        password: '123', // too short
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

  // Login
  describe('POST /api/auth/login', () => {
    it('returns 200 and a JWT token on valid credentials', async () => {
      const res = await api.post('/api/auth/login').send({
        email: 'admin@test.com',
        password: 'password123',
      });
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data.user.role).toBe('ADMIN');
      expect(res.body.data.user).not.toHaveProperty('passwordHash');
    });
  });

  // Logout
  describe('POST /api/auth/logout', () => {
    it('returns 200 for valid token', async () => {
      const email = uniqueEmail('logout');

      await api.post('/api/auth/register').send({
        name: 'Logout User',
        email,
        password: 'StrongPass1!',
      });

      const token = await tokenForEmail(email);

      const res = await api.post('/api/auth/logout').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        message: expect.any(String),
      });
    });

    it('returns 401 on subsequent request with the same token', async () => {
      const email = uniqueEmail('logout2');

      await api.post('/api/auth/register').send({
        name: 'Logout User 2',
        email,
        password: 'StrongPass1!',
      });

      const token = await tokenForEmail(email);

      await api.post('/api/auth/logout').set('Authorization', `Bearer ${token}`);

      const check = await api.get('/api/users/me').set('Authorization', `Bearer ${token}`);
      expect(check.status).toBe(401);
      expect(check.body).toMatchObject({
        success: false,
        code: 'UNAUTHORIZED',
      });
    });

    it('returns 401 with no Authorization header', async () => {
      const res = await api.post('/api/auth/logout');

      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({
        success: false,
        code: 'UNAUTHORIZED',
      });
    });
  });

  // Change password
  describe('POST /api/auth/change-password', () => {
    it('returns 200 and a new JWT when oldPassword is correct and newPassword is strong', async () => {
      const email = uniqueEmail('changepw');

      await api.post('/api/auth/register').send({
        name: 'Change PW User',
        email,
        password: 'StrongPass1!',
      });

      const oldToken = await tokenForEmail(email);

      const res = await api
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${oldToken}`)
        .send({ oldPassword: 'StrongPass1!', newPassword: 'NewStrong1!' });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        success: true,
        message: 'Password changed successfully',
      });
      expect(res.body.data).toHaveProperty('token');
      expect(typeof res.body.data.token).toBe('string');
    });

    it('rejects the old token after password change (tokenVersion increment)', async () => {
      const email = uniqueEmail('changepw2');

      await api.post('/api/auth/register').send({
        name: 'Change PW User 2',
        email,
        password: 'StrongPass1!',
      });

      const oldToken = await tokenForEmail(email);

      await api
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${oldToken}`)
        .send({ oldPassword: 'StrongPass1!', newPassword: 'NewStrong1!' });

      const check = await api.get('/api/users/me').set('Authorization', `Bearer ${oldToken}`);
      expect(check.status).toBe(401);
      expect(check.body).toMatchObject({
        success: false,
        code: 'UNAUTHORIZED',
      });
    });

    it('returns 400 BAD_REQUEST when oldPassword is wrong', async () => {
      const email = uniqueEmail('changepw3');

      await api.post('/api/auth/register').send({
        name: 'Change PW User 3',
        email,
        password: 'StrongPass1!',
      });

      const token = await tokenForEmail(email);

      const res = await api
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ oldPassword: 'WrongPass1!', newPassword: 'NewStrong1!' });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        success: false,
        code: 'BAD_REQUEST',
      });
    });

    it('returns 400 VALIDATION_ERROR when oldPassword === newPassword', async () => {
      const email = uniqueEmail('changepw4');

      await api.post('/api/auth/register').send({
        name: 'Change PW User 4',
        email,
        password: 'StrongPass1!',
      });

      const token = await tokenForEmail(email);

      const res = await api
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ oldPassword: 'StrongPass1!', newPassword: 'StrongPass1!' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.errors).toHaveProperty('newPassword');
    });

    it('returns 400 VALIDATION_ERROR for weak newPassword', async () => {
      const email = uniqueEmail('changepw5');

      await api.post('/api/auth/register').send({
        name: 'Change PW User 5',
        email,
        password: 'StrongPass1!',
      });

      const token = await tokenForEmail(email);

      const res = await api
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({ oldPassword: 'StrongPass1!', newPassword: 'short' });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.errors).toHaveProperty('newPassword');
    });

    it('returns 401 with no token', async () => {
      const res = await api
        .post('/api/auth/change-password')
        .send({ oldPassword: 'StrongPass1!', newPassword: 'NewStrong1!' });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });
  });

  // Forgot password
  describe('POST /api/auth/forgot-password', () => {
    it('returns 200 with a safe generic message for unknown email (no token leak)', async () => {
      const res = await api.post('/api/auth/forgot-password').send({
        email: uniqueEmail('unknown'),
      });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true });
      expect(res.body.data).toHaveProperty('message');
      expect(res.body.data).not.toHaveProperty('devOnly_resetToken');
    });

    it('returns 200 with devOnly_resetToken + expiresAt for known ACTIVE email', async () => {
      const email = uniqueEmail('forgot');

      await api.post('/api/auth/register').send({
        name: 'Forgot PW User',
        email,
        password: 'StrongPass1!',
      });

      const res = await api.post('/api/auth/forgot-password').send({ email });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true });
      expect(res.body.data).toHaveProperty('devOnly_resetToken');
      expect(typeof res.body.data.devOnly_resetToken).toBe('string');
      expect(res.body.data).toHaveProperty('expiresAt');
    });

    it('returns 200 with safe message and no token for known INACTIVE user', async () => {
      const email = uniqueEmail('forgot-inactive');

      await api.post('/api/auth/register').send({
        name: 'Inactive User',
        email,
        password: 'StrongPass1!',
      });

      await prisma.user.update({
        where: { email },
        data: { status: Status.INACTIVE },
      });

      const res = await api.post('/api/auth/forgot-password').send({ email });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true });
      expect(res.body.data).toHaveProperty('message');
      expect(res.body.data).not.toHaveProperty('devOnly_resetToken');
    });

    it('returns 400 VALIDATION_ERROR for malformed email', async () => {
      const res = await api.post('/api/auth/forgot-password').send({
        email: 'not-an-email',
      });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(res.body.errors).toHaveProperty('email');
    });
  });

  // Reset password
  describe('POST /api/auth/reset-password', () => {
    it('returns 200 for valid token and updates password successfully', async () => {
      const email = uniqueEmail('reset');

      await api.post('/api/auth/register').send({
        name: 'Reset PW User',
        email,
        password: 'StrongPass1!',
      });

      const oldToken = await tokenForEmail(email);

      const forgot = await api.post('/api/auth/forgot-password').send({ email });
      const resetToken = forgot.body.data.devOnly_resetToken as string;
      expect(typeof resetToken).toBe('string');

      const res = await api.post('/api/auth/reset-password').send({
        token: resetToken,
        newPassword: 'NewStrong1!',
      });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true });
      expect(res.body.data).toHaveProperty('message');

      // Old JWT should now be invalid
      const checkOldJwt = await api.get('/api/users/me').set('Authorization', `Bearer ${oldToken}`);
      expect(checkOldJwt.status).toBe(401);
      expect(checkOldJwt.body.code).toBe('UNAUTHORIZED');
    });

    it('after reset: login with OLD password returns 401 and login with NEW password returns 200 + JWT', async () => {
      const email = uniqueEmail('reset2');

      await api.post('/api/auth/register').send({
        name: 'Reset PW User 2',
        email,
        password: 'StrongPass1!',
      });

      const forgot = await api.post('/api/auth/forgot-password').send({ email });
      const resetToken = forgot.body.data.devOnly_resetToken as string;

      await api.post('/api/auth/reset-password').send({
        token: resetToken,
        newPassword: 'NewStrong1!',
      });

      const oldPwLogin = await api.post('/api/auth/login').send({
        email,
        password: 'StrongPass1!',
      });
      expect(oldPwLogin.status).toBe(401);
      expect(oldPwLogin.body.code).toBe('INVALID_CREDENTIALS');

      const newPwLogin = await api.post('/api/auth/login').send({
        email,
        password: 'NewStrong1!',
      });
      expect(newPwLogin.status).toBe(200);
      expect(newPwLogin.body.data).toHaveProperty('token');
    });

    it('returns 400 for an invalid/random token', async () => {
      const res = await api.post('/api/auth/reset-password').send({
        token: randomUUID(),
        newPassword: 'NewStrong1!',
      });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        success: false,
        code: 'BAD_REQUEST',
      });
    });

    it('returns 400 when reusing the same token a second time', async () => {
      const email = uniqueEmail('reset3');

      await api.post('/api/auth/register').send({
        name: 'Reset PW User 3',
        email,
        password: 'StrongPass1!',
      });

      const forgot = await api.post('/api/auth/forgot-password').send({ email });
      const resetToken = forgot.body.data.devOnly_resetToken as string;

      const first = await api.post('/api/auth/reset-password').send({
        token: resetToken,
        newPassword: 'NewStrong1!',
      });
      expect(first.status).toBe(200);

      const second = await api.post('/api/auth/reset-password').send({
        token: resetToken,
        newPassword: 'NewStrong1!',
      });
      expect(second.status).toBe(400);
      expect(second.body.code).toBe('BAD_REQUEST');
    });

    it('returns 400 for an expired token (expiry forced via Prisma)', async () => {
      const email = uniqueEmail('reset-expired');

      await api.post('/api/auth/register').send({
        name: 'Reset Expired User',
        email,
        password: 'StrongPass1!',
      });

      const forgot = await api.post('/api/auth/forgot-password').send({ email });
      expect(forgot.status).toBe(200); // Ensure user exists and token was generated
      const resetToken = forgot.body.data.devOnly_resetToken as string;

      await prisma.user.update({
        where: { email },
        data: { resetTokenExpiry: new Date(Date.now() - 60_000) },
      });

      const res = await api.post('/api/auth/reset-password').send({
        token: resetToken,
        newPassword: 'NewStrong1!',
      });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('BAD_REQUEST');
    });
  });

  // Invite (ADMIN)
  describe('POST /api/auth/invite', () => {
    it('returns 201 and an invite token for ADMIN', async () => {
      const email = uniqueEmail('invite');

      const res = await api
        .post('/api/auth/invite')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email, role: 'ANALYST' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ success: true });
      expect(res.body.data).toHaveProperty('inviteToken');
      expect(res.body.data).toMatchObject({
        email,
        role: 'ANALYST',
      });
    });

    it('returns 403 for non-admin user', async () => {
      const res = await api
        .post('/api/auth/invite')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ email: uniqueEmail('invite-nonadmin'), role: 'ANALYST' });

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('returns 401 with no token', async () => {
      const res = await api.post('/api/auth/invite').send({
        email: uniqueEmail('invite-notoken'),
        role: 'ANALYST',
      });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('returns 409 when email is already registered as a user', async () => {
      const res = await api
        .post('/api/auth/invite')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email: 'viewer@test.com', role: 'ANALYST' });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('CONFLICT');
    });

    it('returns 409 when an unused invite for that email already exists', async () => {
      const email = uniqueEmail('invite-dup');

      const first = await api
        .post('/api/auth/invite')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email, role: 'ANALYST' });
      expect(first.status).toBe(201);

      const second = await api
        .post('/api/auth/invite')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email, role: 'ANALYST' });

      expect(second.status).toBe(409);
      expect(second.body.code).toBe('CONFLICT');
    });
  });

  // Register via Invite
  describe('POST /api/auth/register-invite', () => {
    it('returns 201 and creates a user with the role specified in the invite', async () => {
      const email = uniqueEmail('invite-register');

      const invite = await api
        .post('/api/auth/invite')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email, role: 'ANALYST' });

      const token = invite.body.data.inviteToken as string;

      const res = await api.post('/api/auth/register-invite').send({
        token,
        name: 'Invited User',
        password: 'StrongPass1!',
      });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ success: true });
      expect(res.body.data.user).toMatchObject({
        email,
        role: 'ANALYST',
        status: 'ACTIVE',
      });
    });

    it('returns 404 for unknown token', async () => {
      const res = await api.post('/api/auth/register-invite').send({
        token: randomUUID(),
        name: 'Unknown Token',
        password: 'StrongPass1!',
      });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('NOT_FOUND');
    });

    it('returns 400 for token already used (forced via Prisma)', async () => {
      const email = uniqueEmail('invite-used');

      const invite = await api
        .post('/api/auth/invite')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email, role: 'VIEWER' });

      const token = invite.body.data.inviteToken as string;

      await prisma.invite.update({
        where: { token },
        data: { used: true },
      });

      const res = await api.post('/api/auth/register-invite').send({
        token,
        name: 'Used Invite',
        password: 'StrongPass1!',
      });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('BAD_REQUEST');
    });

    it('returns 400 for expired token (forced via Prisma)', async () => {
      const email = uniqueEmail('invite-expired');

      const invite = await api
        .post('/api/auth/invite')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ email, role: 'VIEWER' });

      const token = invite.body.data.inviteToken as string;

      await prisma.invite.update({
        where: { token },
        data: { expiresAt: new Date(Date.now() - 60_000) },
      });

      const res = await api.post('/api/auth/register-invite').send({
        token,
        name: 'Expired Invite',
        password: 'StrongPass1!',
      });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('BAD_REQUEST');
    });
  });

  // Login (mustChangePassword branch)
  describe('POST /api/auth/login (mustChangePassword branch)', () => {
    it('returns mustChangePassword: true and no token when user must change password', async () => {
      const email = uniqueEmail('must-change');

      await api.post('/api/auth/register').send({
        name: 'Must Change User',
        email,
        password: 'StrongPass1!',
      });

      await prisma.user.update({
        where: { email },
        data: { mustChangePassword: true },
      });

      const res = await api.post('/api/auth/login').send({
        email,
        password: 'StrongPass1!',
      });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ success: true });
      expect(res.body.data).toMatchObject({ mustChangePassword: true });
      expect(res.body.data).not.toHaveProperty('token');
    });
  });
});
