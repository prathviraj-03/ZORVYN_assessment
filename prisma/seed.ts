import { PrismaClient, Role, Status, RecordType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // ── Clean existing data ──────────────────────────────────────────────────────
  await prisma.financialRecord.deleteMany();
  await prisma.user.deleteMany();

  // ── Hash password ────────────────────────────────────────────────────────────
  const password = await bcrypt.hash('password123', 10);

  // ── Create users ─────────────────────────────────────────────────────────────
  const admin = await prisma.user.create({
    data: {
      email: 'admin@finance.com',
      passwordHash: password,
      name: 'Admin User',
      role: Role.ADMIN,
      status: Status.ACTIVE,
    },
  });

  const analyst = await prisma.user.create({
    data: {
      email: 'analyst@finance.com',
      passwordHash: password,
      name: 'Analyst User',
      role: Role.ANALYST,
      status: Status.ACTIVE,
    },
  });

  await prisma.user.create({
    data: {
      email: 'viewer@finance.com',
      passwordHash: password,
      name: 'Viewer User',
      role: Role.VIEWER,
      status: Status.ACTIVE,
    },
  });

  console.log('✅ Created 3 users');

  // ── Create financial records ─────────────────────────────────────────────────
  const records = [
    // January
    {
      amount: 85000,
      type: RecordType.INCOME,
      category: 'Salary',
      date: new Date('2024-01-01'),
      notes: 'Monthly salary',
    },
    {
      amount: 1200,
      type: RecordType.EXPENSE,
      category: 'Rent',
      date: new Date('2024-01-05'),
      notes: 'Office rent',
    },
    {
      amount: 450,
      type: RecordType.EXPENSE,
      category: 'Utilities',
      date: new Date('2024-01-10'),
      notes: 'Electricity & internet',
    },
    {
      amount: 3200,
      type: RecordType.INCOME,
      category: 'Freelance',
      date: new Date('2024-01-15'),
      notes: 'Design contract',
    },
    {
      amount: 800,
      type: RecordType.EXPENSE,
      category: 'Software',
      date: new Date('2024-01-20'),
      notes: 'SaaS subscriptions',
    },

    // February
    {
      amount: 85000,
      type: RecordType.INCOME,
      category: 'Salary',
      date: new Date('2024-02-01'),
      notes: 'Monthly salary',
    },
    {
      amount: 1200,
      type: RecordType.EXPENSE,
      category: 'Rent',
      date: new Date('2024-02-05'),
      notes: 'Office rent',
    },
    {
      amount: 5500,
      type: RecordType.INCOME,
      category: 'Consulting',
      date: new Date('2024-02-12'),
      notes: 'Strategy consulting',
    },
    {
      amount: 320,
      type: RecordType.EXPENSE,
      category: 'Utilities',
      date: new Date('2024-02-14'),
      notes: 'Electricity',
    },
    {
      amount: 1500,
      type: RecordType.EXPENSE,
      category: 'Marketing',
      date: new Date('2024-02-20'),
      notes: 'Ad campaigns',
    },

    // March
    {
      amount: 85000,
      type: RecordType.INCOME,
      category: 'Salary',
      date: new Date('2024-03-01'),
      notes: 'Monthly salary',
    },
    {
      amount: 1200,
      type: RecordType.EXPENSE,
      category: 'Rent',
      date: new Date('2024-03-05'),
      notes: 'Office rent',
    },
    {
      amount: 2100,
      type: RecordType.EXPENSE,
      category: 'Equipment',
      date: new Date('2024-03-08'),
      notes: 'Laptop accessories',
    },
    {
      amount: 4800,
      type: RecordType.INCOME,
      category: 'Freelance',
      date: new Date('2024-03-18'),
      notes: 'Dev contract',
    },
    {
      amount: 600,
      type: RecordType.EXPENSE,
      category: 'Software',
      date: new Date('2024-03-25'),
      notes: 'Annual license',
    },

    // April
    {
      amount: 85000,
      type: RecordType.INCOME,
      category: 'Salary',
      date: new Date('2024-04-01'),
      notes: 'Monthly salary',
    },
    {
      amount: 1200,
      type: RecordType.EXPENSE,
      category: 'Rent',
      date: new Date('2024-04-05'),
      notes: 'Office rent',
    },
    {
      amount: 9500,
      type: RecordType.INCOME,
      category: 'Consulting',
      date: new Date('2024-04-10'),
      notes: 'Product consulting',
    },
    {
      amount: 480,
      type: RecordType.EXPENSE,
      category: 'Utilities',
      date: new Date('2024-04-15'),
      notes: 'Internet & phone',
    },
    {
      amount: 2200,
      type: RecordType.EXPENSE,
      category: 'Marketing',
      date: new Date('2024-04-22'),
      notes: 'SEO services',
    },
  ];

  await prisma.financialRecord.createMany({
    data: records.map((r) => ({
      userId: admin.id,
      amount: r.amount,
      type: r.type,
      category: r.category,
      date: r.date,
      notes: r.notes,
    })),
  });

  console.log(`✅ Created ${records.length} financial records`);

  console.log('\n📋 Seed credentials:');
  console.log('  admin@finance.com   / password123  (ADMIN)');
  console.log('  analyst@finance.com / password123  (ANALYST)');
  console.log('  viewer@finance.com  / password123  (VIEWER)');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
