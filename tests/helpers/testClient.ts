import request from 'supertest';
import { PrismaClient, Role, Status, RecordType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { app } from '@/app';

export const api = request(app);
const prisma = new PrismaClient();

// ── Seed ──────────────────────────────────────────────────────────────────────

export async function seedTestDb() {
  // Always start from clean slate
  await prisma.auditLog.deleteMany();
  await prisma.invite.deleteMany();
  await prisma.financialRecord.deleteMany();
  await prisma.user.deleteMany();

  const hash = await bcrypt.hash('password123', 10);

  const admin = await prisma.user.create({
    data: {
      name: 'Admin User',
      email: 'admin@test.com',
      passwordHash: hash,
      role: Role.ADMIN,
      status: Status.ACTIVE,
    },
  });

  const analyst = await prisma.user.create({
    data: {
      name: 'Analyst User',
      email: 'analyst@test.com',
      passwordHash: hash,
      role: Role.ANALYST,
      status: Status.ACTIVE,
    },
  });

  const viewer = await prisma.user.create({
    data: {
      name: 'Viewer User',
      email: 'viewer@test.com',
      passwordHash: hash,
      role: Role.VIEWER,
      status: Status.ACTIVE,
    },
  });

  const record = await prisma.financialRecord.create({
    data: {
      userId: admin.id,
      amount: 5000,
      type: RecordType.INCOME,
      category: 'Salary',
      date: new Date('2024-01-01'),
      notes: 'Test income record',
    },
  });

  await prisma.financialRecord.create({
    data: {
      userId: admin.id,
      amount: 1200,
      type: RecordType.EXPENSE,
      category: 'Rent',
      date: new Date('2024-01-05'),
      notes: 'Test expense record',
    },
  });

  return { admin, analyst, viewer, record };
}

// ── Teardown ──────────────────────────────────────────────────────────────────

export async function cleanTestDb() {
  await prisma.auditLog.deleteMany();
  await prisma.invite.deleteMany();
  await prisma.financialRecord.deleteMany();
  await prisma.user.deleteMany();
  await prisma.$disconnect();
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

export async function getToken(email: string, password = 'password123'): Promise<string> {
  const res = await api.post('/api/auth/login').send({ email, password });
  return res.body.data.token as string;
}
