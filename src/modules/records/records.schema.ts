import { z } from 'zod';
import { RecordType } from '@prisma/client';

export const createRecordSchema = z.object({
  amount: z
    .number({ required_error: 'Amount is required' })
    .positive('Amount must be a positive number')
    .multipleOf(0.01, 'Amount must have at most 2 decimal places'),

  type: z.nativeEnum(RecordType, {
    required_error: 'Type is required',
    invalid_type_error: 'Type must be INCOME or EXPENSE',
  }),

  category: z
    .string({ required_error: 'Category is required' })
    .min(1, 'Category cannot be empty')
    .max(100, 'Category must not exceed 100 characters')
    .trim(),

  date: z
    .string({ required_error: 'Date is required' })
    .date('Date must be a valid date in YYYY-MM-DD format'),

  notes: z.string().max(500, 'Notes must not exceed 500 characters').trim().optional(),
});

export const updateRecordSchema = z
  .object({
    amount: z
      .number()
      .positive('Amount must be a positive number')
      .multipleOf(0.01, 'Amount must have at most 2 decimal places')
      .optional(),

    type: z.nativeEnum(RecordType).optional(),

    category: z
      .string()
      .min(1, 'Category cannot be empty')
      .max(100, 'Category must not exceed 100 characters')
      .trim()
      .optional(),

    date: z.string().date('Date must be a valid date in YYYY-MM-DD format').optional(),

    notes: z.string().max(500, 'Notes must not exceed 500 characters').trim().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided for update',
  });

export const recordIdParamSchema = z.object({
  id: z.string().uuid('Invalid record ID format'),
});

export const recordFilterSchema = z.object({
  type: z.nativeEnum(RecordType).optional(),

  category: z.string().trim().optional(),

  from: z.string().date('from must be a valid date in YYYY-MM-DD format').optional(),

  to: z.string().date('to must be a valid date in YYYY-MM-DD format').optional(),

  page: z
    .string()
    .optional()
    .transform((val) => Math.max(1, parseInt(val ?? '1') || 1)),

  limit: z
    .string()
    .optional()
    .transform((val) => Math.min(100, Math.max(1, parseInt(val ?? '10') || 10))),
});

export const importRecordRowSchema = z.object({
  amount: z
    .union([z.number(), z.string()])
    .transform((val) => {
      const n = typeof val === 'string' ? parseFloat(val) : val;
      if (isNaN(n)) throw new Error('Amount must be a valid number');
      return n;
    })
    .pipe(
      z
        .number()
        .positive('Amount must be a positive number')
        .multipleOf(0.01, 'Amount must have at most 2 decimal places'),
    ),

  type: z.nativeEnum(RecordType, {
    required_error: 'Type is required',
    invalid_type_error: 'Type must be INCOME or EXPENSE',
  }),

  category: z
    .string({ required_error: 'Category is required' })
    .min(1, 'Category cannot be empty')
    .max(100, 'Category must not exceed 100 characters')
    .trim(),

  date: z
    .string({ required_error: 'Date is required' })
    .date('Date must be a valid date in YYYY-MM-DD format'),

  notes: z.string().max(500, 'Notes must not exceed 500 characters').trim().optional(),
});

export type CreateRecordDto = z.infer<typeof createRecordSchema>;
export type UpdateRecordDto = z.infer<typeof updateRecordSchema>;
export type RecordFilterDto = z.infer<typeof recordFilterSchema>;
export type ImportRecordRowDto = z.infer<typeof importRecordRowSchema>;
