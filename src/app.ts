import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from '@/config/swagger';
import { authRouter } from './modules/auth/auth.router';
import { usersRouter } from './modules/users/users.router';
import { recordsRouter } from './modules/records/records.router';
import { errorHandler } from '@/middleware/errorHandler';
import { dashboardRouter } from './modules/dashboard/dashboard.router';



const app: Application = express();

// ── Global middleware ──────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── API docs ───────────────────────────────────────────────────────────────────
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ── Health check ───────────────────────────────────────────────────────────────
app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    message: 'Finance Dashboard API is running',
    docs: '/api/docs',
  });
});

// ── Routes (mounted in later chunks) ──────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/records', recordsRouter);
app.use('/api/dashboard', dashboardRouter);

// ── Global error handler (must be last) ───────────────────────────────────────
app.use(errorHandler);

export { app };