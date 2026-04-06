import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { Errors } from '@/lib/errors';

export const requireRole = (...roles: Role[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(Errors.UNAUTHORIZED());
    }

    if (!roles.includes(req.user.role)) {
      return next(
        Errors.FORBIDDEN(`This action requires one of the following roles: ${roles.join(', ')}`),
      );
    }

    next();
  };
};
