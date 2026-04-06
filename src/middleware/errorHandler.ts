import { Request, Response, NextFunction } from 'express';
import { AppError } from '@/lib/errors';
import { env } from '@/config/env';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  // Known operational error — safe to expose to client
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      code: err.code,
      message: err.message,
    });
    return;
  }

  // Prisma unique constraint violation
  if (isPrismaError(err, 'P2002')) {
    res.status(409).json({
      success: false,
      code: 'CONFLICT',
      message: 'A record with this value already exists',
    });
    return;
  }

  // Prisma record not found
  if (isPrismaError(err, 'P2025')) {
    res.status(404).json({
      success: false,
      code: 'NOT_FOUND',
      message: 'Record not found',
    });
    return;
  }

  // Unknown error — don't leak internals in production
  console.error('Unhandled error:', err);

  res.status(500).json({
    success: false,
    code: 'INTERNAL_SERVER_ERROR',
    message: env.NODE_ENV === 'production' ? 'Something went wrong' : err.message,
  });
};

const isPrismaError = (err: unknown, code: string): boolean => {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as Record<string, unknown>).code === code
  );
};
