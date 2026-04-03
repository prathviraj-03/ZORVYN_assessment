import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/errors';
import { CreateRecordDto, UpdateRecordDto, RecordFilterDto } from './records.schema';

const safeRecordSelect = {
  id:        true,
  amount:    true,
  type:      true,
  category:  true,
  date:      true,
  notes:     true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id:    true,
      name:  true,
      email: true,
    },
  },
} as const;

export const recordsService = {
  async getAll(filters: RecordFilterDto) {
    const { type, category, from, to, page, limit } = filters;
    const skip = (page - 1) * limit;

    // Build where clause dynamically
    const where: Prisma.FinancialRecordWhereInput = {
      isDeleted: false,
      ...(type     && { type }),
      ...(category && {
        category: { contains: category, mode: 'insensitive' },
      }),
      ...(from || to
        ? {
            date: {
              ...(from && { gte: new Date(from) }),
              ...(to   && { lte: new Date(to)   }),
            },
          }
        : {}),
    };

    const [records, total] = await prisma.$transaction([
      prisma.financialRecord.findMany({
        where,
        skip,
        take:    limit,
        select:  safeRecordSelect,
        orderBy: { date: 'desc' },
      }),
      prisma.financialRecord.count({ where }),
    ]);

    return {
      records,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getById(id: string) {
    const record = await prisma.financialRecord.findFirst({
      where:  { id, isDeleted: false },
      select: safeRecordSelect,
    });

    if (!record) throw Errors.NOT_FOUND('Financial record');

    return record;
  },

  async create(dto: CreateRecordDto, userId: string) {
    const record = await prisma.financialRecord.create({
      data: {
        userId,
        amount:   dto.amount,
        type:     dto.type,
        category: dto.category,
        date:     new Date(dto.date),
        notes:    dto.notes,
      },
      select: safeRecordSelect,
    });

    return record;
  },

  async update(id: string, dto: UpdateRecordDto) {
    const existing = await prisma.financialRecord.findFirst({
      where: { id, isDeleted: false },
    });

    if (!existing) throw Errors.NOT_FOUND('Financial record');

    const record = await prisma.financialRecord.update({
      where: { id },
      data:  {
        ...dto,
        ...(dto.date && { date: new Date(dto.date) }),
      },
      select: safeRecordSelect,
    });

    return record;
  },

  async softDelete(id: string) {
    const existing = await prisma.financialRecord.findFirst({
      where: { id, isDeleted: false },
    });

    if (!existing) throw Errors.NOT_FOUND('Financial record');

    await prisma.financialRecord.update({
      where: { id },
      data:  { isDeleted: true },
    });
  },
};