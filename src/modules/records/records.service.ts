import { Prisma, FinancialRecord, User } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/errors';
import { CreateRecordDto, UpdateRecordDto, RecordFilterDto } from './records.schema';
import { auditLog } from '@/lib/audit';
import csv from 'csv-parser';
import { Readable, PassThrough } from 'stream';
import { importRecordRowSchema, ImportRecordRowDto } from './records.schema';

// Constants

// Hard cap on how many rows importRecords will accept in a single call.
// This is your last line of defence if the multer file-size limit is
// misconfigured. Tune to whatever fits comfortably in one createMany call.
const IMPORT_ROW_LIMIT = 5_000;

// How many rows to pull per DB round-trip during streaming export.
const EXPORT_CURSOR_BATCH = 500;

// Safe select

const safeRecordSelect = {
  id: true,
  amount: true,
  type: true,
  category: true,
  date: true,
  notes: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} as const;

// Helpers

/**
 * Escape a single CSV field value.
 * Wraps in double-quotes and escapes inner double-quotes.
 * Also handles values that contain commas or newlines.
 */
function csvField(value: string | null | undefined): string {
  const str = (value ?? '').replace(/"/g, '""');
  // Always quote — simpler and safe for all edge cases (commas, newlines, etc.)
  return `"${str}"`;
}

/**
 * Build the shared Prisma where-clause for list and export queries.
 * FIX: use `isDeleted: false` instead of `{ not: true }`.
 *      `{ not: true }` generates `WHERE is_deleted != true`, which Postgres
 *      evaluates differently from `WHERE is_deleted = false` when NULLs are
 *      involved, and it also prevents the planner from using a partial index
 *      on `is_deleted = false`.
 */
function buildWhere(filters: {
  type?: string;
  category?: string;
  from?: string;
  to?: string;
}): Prisma.FinancialRecordWhereInput {
  const { type, category, from, to } = filters;
  return {
    isDeleted: false,
    ...(type && { type: type as any }),
    ...(category && { category: { contains: category, mode: 'insensitive' } }),
    ...((from || to) && {
      date: {
        ...(from && { gte: new Date(from) }),
        ...(to && { lte: new Date(to) }),
      },
    }),
  };
}

// Service

export const recordsService = {
  // getAll
  // Pagination is enforced by recordFilterSchema (page ≥ 1, 1 ≤ limit ≤ 100),
  // so this query is always bounded.
  async getAll(filters: RecordFilterDto) {
    const { type, category, from, to, page, limit } = filters;
    const skip = (page - 1) * limit;
    const where = buildWhere({ type: type as any, category, from, to });

    const [records, total] = await prisma.$transaction([
      prisma.financialRecord.findMany({
        where,
        skip,
        take: limit,
        select: safeRecordSelect,
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

  // getById
  async getById(id: string) {
    const record = await prisma.financialRecord.findFirst({
      where: { id, isDeleted: false },
      select: safeRecordSelect,
    });
    if (!record) throw Errors.NOT_FOUND('Financial record');
    return record;
  },

  // create
  async create(dto: CreateRecordDto, userId: string) {
    const record = await prisma.financialRecord.create({
      data: {
        userId,
        amount: dto.amount,
        type: dto.type,
        category: dto.category,
        date: new Date(dto.date),
        notes: dto.notes,
      },
      select: safeRecordSelect,
    });
    await auditLog(userId, 'CREATE_RECORD', 'FinancialRecord', record.id);
    return record;
  },

  // update
  async update(id: string, dto: UpdateRecordDto) {
    const existing = await prisma.financialRecord.findFirst({
      where: { id, isDeleted: false },
    });
    if (!existing) throw Errors.NOT_FOUND('Financial record');

    const record = await prisma.financialRecord.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.date && { date: new Date(dto.date) }),
      },
      select: safeRecordSelect,
    });
    await auditLog(existing.userId, 'UPDATE_RECORD', 'FinancialRecord', id, { changes: dto });
    return record;
  },

  // softDelete
  async softDelete(id: string) {
    const existing = await prisma.financialRecord.findFirst({
      where: { id, isDeleted: false },
    });
    if (!existing) throw Errors.NOT_FOUND('Financial record');

    await prisma.financialRecord.update({
      where: { id },
      data: { isDeleted: true },
    });
    await auditLog(existing.userId, 'DELETE_RECORD', 'FinancialRecord', id);
  },

  // exportRecords
  // FIX — was a single unbounded findMany that loaded the entire result set
  // into memory before building the CSV string. At scale this OOMs the process.
  //
  // Rewritten to use cursor-based pagination. Rows are fetched in batches of
  // EXPORT_CURSOR_BATCH and streamed into a PassThrough as they arrive, so the
  // router can pipe directly to the HTTP response with no intermediate buffer.
  //
  // The manual CSV escaping was also fragile — category/notes values that
  // contained commas produced broken columns. csvField() now always wraps in
  // double-quotes and escapes inner double-quotes correctly.
  async exportRecords(filters: Omit<RecordFilterDto, 'page' | 'limit'>): Promise<PassThrough> {
    const where = buildWhere(filters);

    const exportSelect = {
      id: true,
      amount: true,
      type: true,
      category: true,
      date: true,
      notes: true,
      createdAt: true,
      user: { select: { name: true, email: true } },
    } as const;

    const header = [
      'id',
      'amount',
      'type',
      'category',
      'date',
      'notes',
      'created_by',
      'created_at',
    ];

    const stream = new PassThrough();

    // Write the header immediately so the client sees a valid CSV right away.
    stream.write(header.join(',') + '\n');

    type ExportRow = Pick<
      FinancialRecord,
      'id' | 'amount' | 'type' | 'category' | 'date' | 'notes' | 'createdAt'
    > & {
      user: Pick<User, 'name' | 'email'>;
    };

    // Cursor-based fetch loop — never holds more than one batch in memory.
    (async () => {
      let cursor: string | undefined = undefined;
      try {
        while (true) {
          const batch: ExportRow[] = await prisma.financialRecord.findMany({
            where,
            select: exportSelect,
            orderBy: { id: 'asc' }, // stable cursor order
            take: EXPORT_CURSOR_BATCH,
            ...(cursor && {
              skip: 1, // skip the cursor row itself
              cursor: { id: cursor },
            }),
          });

          if (batch.length === 0) break;

          for (const r of batch) {
            const row = [
              csvField(r.id),
              csvField(Number(r.amount).toFixed(2)),
              csvField(r.type),
              csvField(r.category),
              csvField(r.date.toISOString().split('T')[0]),
              csvField(r.notes),
              csvField(`${r.user.name} <${r.user.email}>`),
              csvField(r.createdAt.toISOString()),
            ];
            stream.write(row.join(',') + '\n');
          }

          if (batch.length < EXPORT_CURSOR_BATCH) break; // last batch
          cursor = batch[batch.length - 1].id;
        }
        stream.end();
      } catch (err) {
        stream.destroy(err as Error);
      }
    })();

    return stream;
  },

  // importRecords
  // FIX: added IMPORT_ROW_LIMIT guard before any parsing or DB work.
  // Without this, a 500 k-row file would pass multer's byte-size check
  // (lots of short rows), then explode createMany into a single enormous
  // INSERT that either times out or exceeds Postgres's parameter limit.
  async importRecords(file: Express.Multer.File, userId: string) {
    const ext = file.originalname.split('.').pop()?.toLowerCase();

    // ── 1. Parse ─────────────────────────────────────────────────────────────
    let rawRows: unknown[];

    if (ext === 'json') {
      try {
        const parsed = JSON.parse(file.buffer.toString('utf-8'));
        if (!Array.isArray(parsed)) {
          throw Errors.BAD_REQUEST('JSON file must contain an array of records');
        }
        rawRows = parsed;
      } catch (e: any) {
        if (e.status) throw e;
        throw Errors.BAD_REQUEST('Invalid JSON file');
      }
    } else {
      rawRows = await new Promise<unknown[]>((resolve, reject) => {
        const rows: unknown[] = [];
        Readable.from(file.buffer.toString('utf-8'))
          .pipe(csv())
          .on('data', (row) => rows.push(row))
          .on('end', () => resolve(rows))
          .on('error', () => reject(Errors.BAD_REQUEST('Invalid or malformed CSV file')));
      });
    }

    if (rawRows.length === 0) {
      throw Errors.BAD_REQUEST('File contains no records');
    }

    // ── 2. Row-count guard ────────────────────────────────────────────────────
    if (rawRows.length > IMPORT_ROW_LIMIT) {
      throw Errors.BAD_REQUEST(
        `File contains ${rawRows.length} rows. The maximum allowed per import is ${IMPORT_ROW_LIMIT}. ` +
          'Split the file into smaller batches and re-upload.',
      );
    }

    // ── 3. Validate ───────────────────────────────────────────────────────────
    const validRows: (ImportRecordRowDto & { rowIndex: number })[] = [];
    const failed: { row: number; errors: string[] }[] = [];

    rawRows.forEach((raw, index) => {
      const rowNumber = index + 1;
      const result = importRecordRowSchema.safeParse(raw);
      if (result.success) {
        validRows.push({ ...result.data, rowIndex: rowNumber });
      } else {
        failed.push({
          row: rowNumber,
          errors: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
        });
      }
    });

    // ── 4. Insert ─────────────────────────────────────────────────────────────
    let imported = 0;

    if (validRows.length > 0) {
      const data = validRows.map(({ rowIndex: _rowIndex, ...row }) => ({
        userId,
        amount: row.amount,
        type: row.type,
        category: row.category,
        date: new Date(row.date),
        notes: row.notes,
      }));

      const result = await prisma.financialRecord.createMany({ data });
      imported = result.count;
    }

    // ── 5. Audit ──────────────────────────────────────────────────────────────
    await auditLog(userId, 'BULK_IMPORT_RECORDS', 'FinancialRecord', 'bulk', {
      changes: { total: rawRows.length, imported, failed: failed.length },
    });

    return { total: rawRows.length, imported, failed };
  },
};
