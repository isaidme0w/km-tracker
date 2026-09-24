import express, { type NextFunction, type Request, type Response } from 'express'
import helmet from 'helmet'
import cors from 'cors'
import { env } from './config/env'
import authRouter from './routes/auth'
import usersRouter from './routes/users'
import odometerRouter from './routes/odometer'
import cyclesRouter from './routes/cycles'

// Assembles the Express application and mounts all routers under /api.
export function createApp(): express.Express {
  const app = express()

  app.use(helmet())
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }))
  app.use(express.json())

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  app.use('/api/auth', authRouter)
  app.use('/api/users', usersRouter)
  app.use('/api/odometer', odometerRouter)
  app.use('/api/cycles', cyclesRouter)

  // JSON 404 fallback for unmatched routes.
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'Nie znaleziono zasobu' })
  })

  // Centralized JSON error handler for unexpected errors.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[error]', err)
    res.status(500).json({ error: 'Wewnętrzny błąd serwera' })
  })

  return app
}