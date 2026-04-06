import { Router, Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import {
  registerSchema,
  loginSchema,
  inviteSchema,
  registerInviteSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth.schema';
import { validate } from '@/middleware/validate';
import { authenticate } from '@/middleware/authenticate';
import { requireRole } from '@/middleware/authorize';
import { Role } from '@prisma/client';

const router = Router();

// ── Register ───────────────────────────────────────────────────────────────────

router.post(
  '/register',
  validate(registerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await authService.register(req.body);
      res.status(201).json({
        success: true,
        message: 'Account created successfully. You have been assigned the VIEWER role.',
        data: { user },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ── Login ──────────────────────────────────────────────────────────────────────

router.post(
  '/login',
  validate(loginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.login(req.body);
      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  },
);

// Logout
router.post('/logout', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await authService.logout(req.user!.id);
    res.status(200).json({
      success: true,
      message: 'Logged out successfully. Your token has been invalidated.',
    });
  } catch (err) {
    next(err);
  }
});

// ── Change password (logged in user) ──────────────────────────────────────────

router.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.changePassword(req.user!.id, req.body);
      res.status(200).json({
        success: true,
        message: 'Password changed successfully',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ── Forgot password ────────────────────────────────────────────────────────────

router.post(
  '/forgot-password',
  validate(forgotPasswordSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.forgotPassword(req.body);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ── Reset password ─────────────────────────────────────────────────────────────

router.post(
  '/reset-password',
  validate(resetPasswordSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.resetPassword(req.body);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ── Send Invite (admin only) ───────────────────────────────────────────────────

router.post(
  '/invite',
  authenticate,
  requireRole(Role.ADMIN),
  validate(inviteSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await authService.sendInvite(req.body, req.user!.id);
      res.status(201).json({
        success: true,
        message: `Invite created for ${req.body.email} with role ${req.body.role}`,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  },
);

// ── Register via Invite ────────────────────────────────────────────────────────

router.post(
  '/register-invite',
  validate(registerInviteSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await authService.registerViaInvite(req.body);
      res.status(201).json({
        success: true,
        message: `Account created successfully. You have been assigned the ${user.role} role.`,
        data: { user },
      });
    } catch (err) {
      next(err);
    }
  },
);

export { router as authRouter };
