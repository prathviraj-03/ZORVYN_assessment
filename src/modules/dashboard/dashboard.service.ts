import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export const dashboardService = {
  async getSummary() {
    // Single query — aggregate income and expense totals together
    const totals = await prisma.financialRecord.groupBy({
      by: ['type'],
      where: { isDeleted: false },
      _sum: { amount: true },
      _count: { id: true },
    });

    const income = totals.find((t) => t.type === 'INCOME');
    const expense = totals.find((t) => t.type === 'EXPENSE');

    const totalIncome = Number(income?._sum.amount ?? 0);
    const totalExpenses = Number(expense?._sum.amount ?? 0);

    return {
      totalIncome,
      totalExpenses,
      netBalance: totalIncome - totalExpenses,
      incomeCount: income?._count.id ?? 0,
      expenseCount: expense?._count.id ?? 0,
      totalRecords: (income?._count.id ?? 0) + (expense?._count.id ?? 0),
    };
  },

  async getCategoryBreakdown() {
    const rows = await prisma.financialRecord.groupBy({
      by: ['category', 'type'],
      where: { isDeleted: false },
      _sum: { amount: true },
      _count: { id: true },
      orderBy: { _sum: { amount: 'desc' } },
    });

    // Shape into { category, income, expense, net, count }
    const map = new Map<
      string,
      { category: string; income: number; expense: number; net: number; count: number }
    >();

    for (const row of rows) {
      const existing = map.get(row.category) ?? {
        category: row.category,
        income: 0,
        expense: 0,
        net: 0,
        count: 0,
      };

      const amount = Number(row._sum.amount ?? 0);

      if (row.type === 'INCOME') {
        existing.income += amount;
      } else {
        existing.expense += amount;
      }

      existing.net = existing.income - existing.expense;
      existing.count += row._count.id;

      map.set(row.category, existing);
    }

    // Sort by absolute total descending
    return Array.from(map.values()).sort(
      (a, b) => Math.abs(b.income + b.expense) - Math.abs(a.income + a.expense),
    );
  },

  async getTrends(period: 'monthly' | 'weekly') {
    // Pull all non-deleted records with just the fields we need
    const records = await prisma.financialRecord.findMany({
      where: { isDeleted: false },
      select: { amount: true, type: true, date: true },
      orderBy: { date: 'asc' },
    });

    // Group in JS — avoids raw SQL while keeping Prisma type safety
    const map = new Map<string, { period: string; income: number; expense: number; net: number }>();

    for (const record of records) {
      const key = period === 'monthly' ? formatMonthKey(record.date) : formatWeekKey(record.date);

      const existing = map.get(key) ?? {
        period: key,
        income: 0,
        expense: 0,
        net: 0,
      };

      const amount = Number(record.amount);

      if (record.type === 'INCOME') {
        existing.income += amount;
      } else {
        existing.expense += amount;
      }

      existing.net = existing.income - existing.expense;

      map.set(key, existing);
    }

    return Array.from(map.values());
  },

  async getRecent(limit: number) {
    const records = await prisma.financialRecord.findMany({
      where: { isDeleted: false },
      take: limit,
      orderBy: { date: 'desc' },
      select: {
        id: true,
        amount: true,
        type: true,
        category: true,
        date: true,
        notes: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return records.map((r) => ({
      ...r,
      amount: Number(r.amount),
    }));
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatMonthKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function formatWeekKey(date: Date): string {
  // ISO week — Monday-based
  const d = new Date(date);
  const day = d.getDay() === 0 ? 7 : d.getDay(); // Sun = 7
  d.setDate(d.getDate() - day + 1); // rewind to Monday
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-W${m}-${dd}`;
}
