import { Router, Request, Response, NextFunction } from 'express';
import { recordsService } from './records.service';
import {
  createRecordSchema,
  updateRecordSchema,
  recordIdParamSchema,
  recordFilterSchema,
} from './records.schema';
import { authenticate }  from '@/middleware/authenticate';
import { requireRole }   from '@/middleware/authorize';
import { validate }      from '@/middleware/validate';
import { Role }          from '@prisma/client';

const router = Router();

// All records routes require a valid JWT
router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Records
 *   description: Financial records management
 */

/**
 * @swagger
 * /api/records:
 *   get:
 *     summary: Get all financial records with optional filters
 *     tags: [Records]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [INCOME, EXPENSE]
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date
 *           example: "2024-01-01"
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date
 *           example: "2024-12-31"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Paginated and filtered list of records
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/',
  validate(recordFilterSchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await recordsService.getAll(req.query as any);
      res.status(200).json({
        success: true,
        data:    result,
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * @swagger
 * /api/records/{id}:
 *   get:
 *     summary: Get a single financial record by ID
 *     tags: [Records]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Financial record found
 *       404:
 *         description: Record not found
 */
router.get(
  '/:id',
  validate(recordIdParamSchema, 'params'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await recordsService.getById(req.params.id);
      res.status(200).json({
        success: true,
        data:    { record },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * @swagger
 * /api/records:
 *   post:
 *     summary: Create a new financial record (admin only)
 *     tags: [Records]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount, type, category, date]
 *             properties:
 *               amount:
 *                 type: number
 *                 example: 5000.00
 *               type:
 *                 type: string
 *                 enum: [INCOME, EXPENSE]
 *               category:
 *                 type: string
 *                 example: Salary
 *               date:
 *                 type: string
 *                 format: date
 *                 example: "2024-04-01"
 *               notes:
 *                 type: string
 *                 example: Monthly salary payment
 *     responses:
 *       201:
 *         description: Record created successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Forbidden
 */
router.post(
  '/',
  requireRole(Role.ADMIN),
  validate(createRecordSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await recordsService.create(req.body, req.user!.id);
      res.status(201).json({
        success: true,
        message: 'Financial record created successfully',
        data:    { record },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * @swagger
 * /api/records/{id}:
 *   patch:
 *     summary: Update a financial record (admin only)
 *     tags: [Records]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               amount:
 *                 type: number
 *               type:
 *                 type: string
 *                 enum: [INCOME, EXPENSE]
 *               category:
 *                 type: string
 *               date:
 *                 type: string
 *                 format: date
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Record updated successfully
 *       404:
 *         description: Record not found
 */
router.patch(
  '/:id',
  requireRole(Role.ADMIN),
  validate(recordIdParamSchema, 'params'),
  validate(updateRecordSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await recordsService.update(req.params.id, req.body);
      res.status(200).json({
        success: true,
        message: 'Financial record updated successfully',
        data:    { record },
      });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * @swagger
 * /api/records/{id}:
 *   delete:
 *     summary: Soft delete a financial record (admin only)
 *     tags: [Records]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Record soft deleted — remains in DB with is_deleted=true
 *       404:
 *         description: Record not found
 */
router.delete(
  '/:id',
  requireRole(Role.ADMIN),
  validate(recordIdParamSchema, 'params'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await recordsService.softDelete(req.params.id);
      res.status(200).json({
        success: true,
        message: 'Financial record deleted successfully',
      });
    } catch (err) {
      next(err);
    }
  }
);

export { router as recordsRouter };