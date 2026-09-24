import express, { type NextFunction, type Request, type Response } from 'express'
import path from 'node:path'
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

  // Helmet's defaults assume HTTPS. When serving directly over plain HTTP (a
  // non-trustworthy host such as 192.168.x.x), its HSTS header forces the
  // browser to upgrade every request to https:// and its CSP
  // "upgrade-insecure-requests" rewrites asset URLs to https://, which then
  // fail with ERR_SSL_PROTOCOL_ERROR. Disable both so HTTP fronts work like
  // they do on localhost (where browsers exempt the loopback address).
  app.use(
    helmet({
      hsts: false,
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          // Allow the inline dark-mode-prevention script in index.html.
          'script-src': ["'self'", "'sha256-tvs92BQjfDU4ZLifk+hpwzAUpKxF6ps2ndzMALGYgxM='"],
          // Do not force browser to rewrite http:// subresources to https://.
          'upgrade-insecure-requests': null,
        },
      },
    }),
  )
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }))
  app.use(express.json())

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  app.use('/api/auth', authRouter)
  app.use('/api/users', usersRouter)
  app.use('/api/odometer', odometerRouter)
  app.use('/api/cycles', cyclesRouter)

  // In production only, serve the built client (client/dist) and fall back to
  // index.html for SPA routes. In development the Vite dev server handles this.
  if (env.NODE_ENV === 'production') {
    const clientDist = path.resolve(__dirname, '../../client/dist')
    app.use(express.static(clientDist))
    // SPA fallback: serve index.html for any non-API route not matched above
    // (Express 5 removed the bare '*' wildcard, so use plain middleware).
    app.use((req, res, next) => {
      if (req.path.startsWith('/api') || req.method !== 'GET') {
        next()
        return
      }
      res.sendFile(path.join(clientDist, 'index.html'))
    })
  }

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