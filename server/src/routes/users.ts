import { Router } from 'express'
import bcrypt from 'bcrypt'
import db from '../db'
import { requireAdmin, requireAuth } from '../middleware/auth'

const SALT_ROUNDS = 10
const usersRouter = Router()

// The entire users module is admin-only.
usersRouter.use(requireAuth, requireAdmin)

// GET /api/users — lists all drivers (without password hashes).
usersRouter.get('/', (_req, res) => {
  const users = db
    .prepare('SELECT id, username, role, is_protected, created_at FROM users ORDER BY id')
    .all()
  res.json(users)
})

// POST /api/users — creates a new driver (role defaults to 'user').
usersRouter.post('/', (req, res) => {
  const username = String(req.body?.username ?? '').trim()
  const password = String(req.body?.password ?? '')
  const role = req.body?.role === 'admin' ? 'admin' : 'user'

  if (username.length < 3) {
    res.status(400).json({ error: 'Nazwa użytkownika musi mieć co najmniej 3 znaki' })
    return
  }
  if (password.length < 4) {
    res.status(400).json({ error: 'Hasło musi mieć co najmniej 4 znaki' })
    return
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
  if (existing) {
    res.status(409).json({ error: 'Użytkownik o takiej nazwie już istnieje' })
    return
  }

  const passwordHash = bcrypt.hashSync(password, SALT_ROUNDS)
  const info = db
    .prepare(
      'INSERT INTO users (username, password_hash, role, is_protected) VALUES (?, ?, ?, 0)',
    )
    .run(username, passwordHash, role)

  res.status(201).json({ id: Number(info.lastInsertRowid), username, role })
})

// PATCH /api/users/:id — updates a user's role and/or resets their password.
usersRouter.patch('/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'Nieprawidłowe id użytkownika' })
    return
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as
    | { id: number; is_protected: number }
    | undefined

  if (!user) {
    res.status(404).json({ error: 'Nie znaleziono użytkownika' })
    return
  }

  if (user.is_protected === 1) {
    res.status(400).json({ error: 'Nie można edytować domyślnego konta administratora' })
    return
  }

  const role = req.body?.role
  const password = req.body?.password
  const hasRole = role !== undefined && role !== null && role !== ''
  const hasPassword = typeof password === 'string' && password !== ''

  if (!hasRole && !hasPassword) {
    res.status(400).json({ error: 'Podaj nową rolę lub nowe hasło' })
    return
  }
  if (hasRole && role !== 'admin' && role !== 'user') {
    res.status(400).json({ error: 'Nieprawidłowa rola' })
    return
  }
  if (hasPassword && password.length < 4) {
    res.status(400).json({ error: 'Hasło musi mieć co najmniej 4 znaki' })
    return
  }

  if (hasPassword) {
    const passwordHash = bcrypt.hashSync(password, SALT_ROUNDS)
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, id)
  }
  if (hasRole) {
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id)
  }

  const updated = db
    .prepare('SELECT id, username, role, is_protected, created_at FROM users WHERE id = ?')
    .get(id)

  res.json(updated)
})

// DELETE /api/users/:id — removes a driver unless it is a protected account.
usersRouter.delete('/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'Nieprawidłowe id użytkownika' })
    return
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as
    | { id: number; is_protected: number }
    | undefined

  if (!user) {
    res.status(404).json({ error: 'Nie znaleziono użytkownika' })
    return
  }

  if (user.is_protected === 1 || user.id === req.user!.id) {
    res.status(400).json({ error: 'Nie można usunąć domyślnego konta administratora' })
    return
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(id)
  res.json({ deleted: true, id })
})

export default usersRouter