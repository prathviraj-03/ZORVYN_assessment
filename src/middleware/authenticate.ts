import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '@/lib/jwt';
import { prisma } from '@/lib/prisma';
import { Errors } from '@/lib/errors';

export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> => {
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

    // Verify tokenVersion matches DB — catches logged-out or deactivated tokens
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, status: true, tokenVersion: true },
    });

    if (!user) {
      return next(Errors.UNAUTHORIZED('User no longer exists'));
    }

    if (user.status === 'INACTIVE') {
      return next(Errors.FORBIDDEN('Your account has been deactivated'));
    }

    if (user.tokenVersion !== payload.tokenVersion) {
      return next(Errors.UNAUTHORIZED('Token has been invalidated. Please log in again'));
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    next();
  } catch {
    next(Errors.UNAUTHORIZED('Invalid or expired token'));
  }
};
