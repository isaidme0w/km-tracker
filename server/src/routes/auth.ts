import { Router } from 'express'
import bcrypt from 'bcrypt'
import jwt, { type SignOptions } from 'jsonwebtoken'
import db from '../db'
import { env } from '../config/env'
import { requireAuth } from '../middleware/auth'

const SALT_ROUNDS = 10
const authRouter = Router()

// POST /api/auth/login — verifies credentials and issues a JWT.
authRouter.post('/login', async (req, res) => {
  const { username, password } = req.body ?? {}

  if (!username || !password) {
    res.status(400).json({ error: 'Nazwa użytkownika i hasło są wymagane' })
    return
  }

  const user = db
    .prepare('SELECT * FROM users WHERE username = ?')
    .get(username) as
    | { id: number; username: string; password_hash: string; role: 'admin' | 'user' }
    | undefined

  if (!user) {
    res.status(401).json({ error: 'Nieprawidłowy login lub hasło' })
    return
  }

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) {
    res.status(401).json({ error: 'Nieprawidłowy login lub hasło' })
    return
  }

  const payload = { id: user.id, username: user.username, role: user.role }
  const token = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  })

  res.json({
    token,
    user: { id: user.id, username: user.username, role: user.role },
  })
})

// GET /api/auth/me — returns the authenticated user's full profile.
authRouter.get('/me', requireAuth, (req, res) => {
  const user = db
    .prepare('SELECT id, username, role, is_protected, created_at FROM users WHERE id = ?')
    .get(req.user!.id)

  if (!user) {
    res.status(404).json({ error: 'Nie znaleziono użytkownika' })
    return
  }

  res.json({ user })
})

// POST /api/auth/change-password — verifies the current password and sets a new one.
authRouter.post('/change-password', requireAuth, async (req, res) => {
  const currentPassword = String(req.body?.currentPassword ?? '')
  const newPassword = String(req.body?.newPassword ?? '')

  if (!currentPassword) {
    res.status(400).json({ error: 'Podaj obecne hasło' })
    return
  }
  if (newPassword.length < 4) {
    res.status(400).json({ error: 'Nowe hasło musi mieć co najmniej 4 znaki' })
    return
  }

  const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user!.id) as
    | { password_hash: string }
    | undefined

  if (!user) {
    res.status(404).json({ error: 'Nie znaleziono użytkownika' })
    return
  }

  const valid = await bcrypt.compare(currentPassword, user.password_hash)
  if (!valid) {
    res.status(401).json({ error: 'Obecne hasło jest nieprawidłowe' })
    return
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS)
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, req.user!.id)

  res.json({ success: true })
})

export default authRouter