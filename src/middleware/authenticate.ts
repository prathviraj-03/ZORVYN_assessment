import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '@/lib/jwt';
import { Errors } from '@/lib/errors';

export const authenticate = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(Errors.UNAUTHORIZED('Missing or malformed Authorization header'));
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return next(Errors.UNAUTHORIZED('Token not provided'));
    }

    const payload = verifyToken(token);

    req.user = {
      id:    payload.sub,
      email: payload.email,
      role:  payload.role,
    };

    next();
  } catch {
    next(Errors.UNAUTHORIZED('Invalid or expired token'));
  }
};