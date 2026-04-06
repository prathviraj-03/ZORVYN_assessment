import { Router, Request, Response, NextFunction } from 'express';
import { recordsService } from './records.service';
import {
  createRecordSchema,
  updateRecordSchema,
  recordIdParamSchema,
  recordFilterSchema,
} from './records.schema';
import { authenticate } from '@/middleware/authenticate';
import { requireRole } from '@/middleware/authorize';
import { validate } from '@/middleware/validate';
import { Role } from '@prisma/client';
import { importUpload } from '@/middleware/upoad';
import { Errors } from '@/lib/errors';

const router = Router();

router.use(authenticate);

// Import
// ADMIN-only. importUpload enforces the multer file-size limit you set in
// the middleware — make sure it's ≤ a few MB so a huge file never reaches
// importRecords, which would try to parse all rows into memory at once.
router.post(
  '/import',
  requireRole(Role.ADMIN),
  importUpload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return next(
          Errors.BAD_REQUEST('No file uploaded. Send a .csv or .json file under the key "file"'),
        );
      }
      const result = await recordsService.importRecords(req.file, req.user!.id);
      res.status(200).json({
        success: true,
        message: `Import complete. ${result.imported} of ${result.total} records inserted.`,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  },
);

// Export
// FIX 1: was missing requireRole — any authenticated user could dump the full
//         table. Restricted to ADMIN.
// FIX 2: was accepting raw req.query with no validation. Now runs through
//         recordFilterSchema (page/limit fields are stripped in the service
//         layer before the query reaches Prisma).
// FIX 3: exportRecords itself is now streaming (see service) so this handler
//         no longer waits for the entire CSV string to be built in memory.
router.get(
  '/export',
  requireRole(Role.ADMIN),
  validate(recordFilterSchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filters = {
        type: req.query.type as string | undefined,
        category: req.query.category as string | undefined,
        from: req.query.from as string | undefined,
        to: req.query.to as string | undefined,
      };

      const date = new Date().toISOString().split('T')[0];
      const typePart = filters.type ? `_${filters.type.toLowerCase()}` : '';
      const filename = `records${typePart}_${date}.csv`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200);

      // exportRecords now returns a Node.js Readable stream — pipe it directly
      // to the response so rows are flushed as they come off the DB cursor
      // instead of being buffered into one giant string.
      const stream = await recordsService.exportRecords(filters as any);
      stream.pipe(res);
      stream.on('error', next);
    } catch (err) {
      next(err);
    }
  },
);

// List
router.get(
  '/',
  validate(recordFilterSchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await recordsService.getAll(req.query as any);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
);

// Get by ID
router.get(
  '/:id',
  validate(recordIdParamSchema, 'params'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const record = await recordsService.getById(req.params.id);
      res.status(200).json({ success: true, data: { record } });
    } catch (err) {
      next(err);
    }
  },
);

// Create
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
        data: { record },
      });
    } catch (err) {
      next(err);
    }
  },
);

// Update
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
        data: { record },
      });
    } catch (err) {
      next(err);
    }
  },
);

// Delete
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
  },
);

export { router as recordsRouter };
