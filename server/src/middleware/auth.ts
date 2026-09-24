import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env'

export interface AuthUser {
  id: number
  username: string
  role: 'admin' | 'user'
}

// Augment Express.Request with the authenticated user.
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

// Verifies the `Authorization: Bearer <token>` header and sets `req.user`.
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Brak tokenu uwierzytelniającego' })
    return
  }

  const token = header.slice('Bearer '.length).trim()

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET)
    if (typeof decoded === 'string') {
      throw new Error('Invalid token payload')
    }
    req.user = decoded as AuthUser
    next()
  } catch {
    res.status(401).json({ error: 'Nieprawidłowy lub wygasły token' })
  }
}

// Ensures the authenticated user has the admin role.
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: 'Brak uprawnień do wykonania tej operacji' })
    return
  }
  next()
}