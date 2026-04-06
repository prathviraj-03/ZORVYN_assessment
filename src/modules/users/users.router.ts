import { Router, Request, Response, NextFunction } from 'express';
import { usersService } from './users.service';
import { createUserSchema, updateUserSchema, userIdParamSchema } from './users.schema';
import { authenticate } from '@/middleware/authenticate';
import { requireRole } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { Role } from '@prisma/client';

const router = Router();

// All users routes require a valid JWT
router.use(authenticate);

router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await usersService.getMe(req.user!.id);
    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (err) {
    next(err);
  }
});

router.get(
  '/',
  requireRole(Role.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));

      const result = await usersService.getAll(page, limit);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  '/',
  requireRole(Role.ADMIN),
  validate(createUserSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await usersService.create(req.body);
      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: { user },
      });
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  '/:id',
  requireRole(Role.ADMIN),
  validate(userIdParamSchema, 'params'),
  validate(updateUserSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await usersService.update(req.params.id, req.body);
      res.status(200).json({
        success: true,
        message: 'User updated successfully',
        data: { user },
      });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  '/:id',
  requireRole(Role.ADMIN),
  validate(userIdParamSchema, 'params'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await usersService.remove(req.params.id, req.user!.id);
      res.status(200).json({
        success: true,
        message: 'User deleted successfully',
      });
    } catch (err) {
      next(err);
    }
  },
);

export { router as usersRouter };
