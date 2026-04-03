export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const Errors = {
  // 400
  BAD_REQUEST: (msg = 'Bad request') =>
    new AppError(msg, 400, 'BAD_REQUEST'),

  // 401
  UNAUTHORIZED: (msg = 'Unauthorized — please log in') =>
    new AppError(msg, 401, 'UNAUTHORIZED'),

  INVALID_CREDENTIALS: () =>
    new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS'),

  // 403
  FORBIDDEN: (msg = 'You do not have permission to perform this action') =>
    new AppError(msg, 403, 'FORBIDDEN'),

  // 404
  NOT_FOUND: (resource = 'Resource') =>
    new AppError(`${resource} not found`, 404, 'NOT_FOUND'),

  // 409
  CONFLICT: (msg = 'Resource already exists') =>
    new AppError(msg, 409, 'CONFLICT'),

  // 500
  INTERNAL: (msg = 'Internal server error') =>
    new AppError(msg, 500, 'INTERNAL_SERVER_ERROR'),
};