import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import { errorHandler } from '@/middleware/errorHandler';
import { authLimiter, generalLimiter } from '@/middleware/rateLimiter';
import { authRouter } from '@/modules/auth/auth.router';
import { usersRouter } from '@/modules/users/users.router';
import { recordsRouter } from '@/modules/records/records.router';
import { dashboardRouter } from '@/modules/dashboard/dashboard.router';
import { env } from '@/config/env';
import { prisma } from './lib/prisma';

const app: Application = express();

// ── Security headers ───────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ───────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: env.NODE_ENV === 'production' ? (env.ALLOWED_ORIGIN ?? 'http://localhost:3000') : '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
);

// ── Request logging ────────────────────────────────────────────────────────────
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Body parsing ───────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Rate limiting ──────────────────────────────────────────────────────────────
app.use('/api', generalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);

// ── Health check ───────────────────────────────────────────────────────────────
app.get('/health', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      database: 'connected',
      env: env.NODE_ENV,
    });
  } catch {
    res.status(503).json({
      status: 'error',
      database: 'disconnected',
    });
  }
});

// ── Root ───────────────────────────────────────────────────────────────────────
app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    message: 'Finance Dashboard API is running',
    health: '/health',
  });
});

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/records', recordsRouter);
app.use('/api/dashboard', dashboardRouter);

// ── Global error handler ───────────────────────────────────────────────────────
app.use(errorHandler);

export { app };
