import { Router, Request, Response, NextFunction } from 'express';
import { dashboardService } from './dashboard.service';
import { authenticate } from '@/middleware/authenticate';
import { requireRole } from '@/middleware/authorize';
import { Role } from '@prisma/client';

const router = Router();

// All dashboard routes require a valid JWT
router.use(authenticate);

// All dashboard routes require at minimum ANALYST role
router.use(requireRole(Role.ANALYST, Role.ADMIN));

router.get('/summary', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const summary = await dashboardService.getSummary();
    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/categories', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const breakdown = await dashboardService.getCategoryBreakdown();
    res.status(200).json({
      success: true,
      data: breakdown,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/trends', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const period = req.query.period === 'weekly' ? 'weekly' : 'monthly';
    const trends = await dashboardService.getTrends(period);
    res.status(200).json({
      success: true,
      data: { period, trends },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/recent', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
    const records = await dashboardService.getRecent(limit);
    res.status(200).json({
      success: true,
      data: { records },
    });
  } catch (err) {
    next(err);
  }
});

export { router as dashboardRouter };
