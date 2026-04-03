import { Router, Request, Response, NextFunction } from 'express';
import { dashboardService } from './dashboard.service';
import { authenticate } from '@/middleware/authenticate';
import { requireRole }  from '@/middleware/authorize';
import { Role }         from '@prisma/client';

const router = Router();

// All dashboard routes require a valid JWT
router.use(authenticate);

// All dashboard routes require at minimum ANALYST role
router.use(requireRole(Role.ANALYST, Role.ADMIN));

/**
 * @swagger
 * tags:
 *   name: Dashboard
 *   description: Analytics and summary endpoints (analyst + admin only)
 */

/**
 * @swagger
 * /api/dashboard/summary:
 *   get:
 *     summary: Get total income, expenses and net balance
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Summary totals
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalIncome:
 *                   type: number
 *                   example: 358500
 *                 totalExpenses:
 *                   type: number
 *                   example: 14050
 *                 netBalance:
 *                   type: number
 *                   example: 344450
 *                 incomeCount:
 *                   type: integer
 *                 expenseCount:
 *                   type: integer
 *                 totalRecords:
 *                   type: integer
 *       403:
 *         description: Viewer role is not permitted
 */
router.get(
  '/summary',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const summary = await dashboardService.getSummary();
      res.status(200).json({
        success: true,
        data:    summary,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * @swagger
 * /api/dashboard/categories:
 *   get:
 *     summary: Get income and expense totals grouped by category
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Category breakdown sorted by total value
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   category:
 *                     type: string
 *                   income:
 *                     type: number
 *                   expense:
 *                     type: number
 *                   net:
 *                     type: number
 *                   count:
 *                     type: integer
 *       403:
 *         description: Viewer role is not permitted
 */
router.get(
  '/categories',
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const breakdown = await dashboardService.getCategoryBreakdown();
      res.status(200).json({
        success: true,
        data:    breakdown,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * @swagger
 * /api/dashboard/trends:
 *   get:
 *     summary: Get income and expense totals grouped by month or week
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [monthly, weekly]
 *           default: monthly
 *     responses:
 *       200:
 *         description: Trend data for the selected period
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   period:
 *                     type: string
 *                     example: "2024-01"
 *                   income:
 *                     type: number
 *                   expense:
 *                     type: number
 *                   net:
 *                     type: number
 *       403:
 *         description: Viewer role is not permitted
 */
router.get(
  '/trends',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const period = req.query.period === 'weekly' ? 'weekly' : 'monthly';
      const trends = await dashboardService.getTrends(period);
      res.status(200).json({
        success: true,
        data:    { period, trends },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * @swagger
 * /api/dashboard/recent:
 *   get:
 *     summary: Get the most recent financial records as an activity feed
 *     tags: [Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 50
 *     responses:
 *       200:
 *         description: Recent activity feed
 *       403:
 *         description: Viewer role is not permitted
 */
router.get(
  '/recent',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit   = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
      const records = await dashboardService.getRecent(limit);
      res.status(200).json({
        success: true,
        data:    { records },
      });
    } catch (err) {
      next(err);
    }
  }
);

export { router as dashboardRouter };