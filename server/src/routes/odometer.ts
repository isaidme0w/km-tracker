import { Router } from 'express'
import db from '../db'
import { requireAdmin, requireAuth } from '../middleware/auth'

const odometerRouter = Router()

odometerRouter.use(requireAuth)

// Recomputes the distance delta for every entry in a cycle (ordered by id),
// using the cycle's start odometer as the baseline for the first entry.
function recalculateCycleDistances(cycleId: number, startOdometer: number): void {
  const entries = db
    .prepare('SELECT id, odometer FROM odometer_entries WHERE cycle_id = ? ORDER BY id ASC')
    .all(cycleId) as { id: number; odometer: number }[]

  let previous = startOdometer
  for (const entry of entries) {
    const distance = Math.max(0, entry.odometer - previous)
    db.prepare('UPDATE odometer_entries SET distance = ? WHERE id = ?').run(distance, entry.id)
    previous = entry.odometer
  }
}

// GET /api/odometer/current — last recorded odometer state + active cycle.
odometerRouter.get('/current', (_req, res) => {
  const cycle = db
    .prepare("SELECT * FROM cycles WHERE status = 'OPEN' ORDER BY id DESC LIMIT 1")
    .get() as { id: number; start_odometer: number } | undefined

  const last = db
    .prepare('SELECT * FROM odometer_entries ORDER BY id DESC LIMIT 1')
    .get() as { odometer: number } | undefined

  const currentOdometer = last?.odometer ?? cycle?.start_odometer ?? 0
  res.json({ currentOdometer, cycle: cycle ?? null, lastEntry: last ?? null })
})

// POST /api/odometer — logs a reading, computing the distance delta and
// attaching it to the active cycle.
odometerRouter.post('/', (req, res) => {
  const odometer = Number(req.body?.odometer)
  if (!Number.isFinite(odometer) || odometer < 0) {
    res.status(400).json({ error: 'Nieprawidłowy stan licznika' })
    return
  }

  const cycle = db
    .prepare("SELECT * FROM cycles WHERE status = 'OPEN' ORDER BY id DESC LIMIT 1")
    .get() as { id: number; start_odometer: number } | undefined

  if (!cycle) {
    res.status(409).json({ error: 'Brak aktywnego cyklu' })
    return
  }

  const last = db
    .prepare('SELECT odometer FROM odometer_entries WHERE cycle_id = ? ORDER BY id DESC LIMIT 1')
    .get(cycle.id) as { odometer: number } | undefined

  const lastOdometer = last?.odometer ?? cycle.start_odometer

  if (odometer <= lastOdometer) {
    res.status(400).json({ error: 'Nowy stan licznika musi być większy niż poprzedni wpis' })
    return
  }

  const distance = odometer - lastOdometer
  const info = db
    .prepare(
      'INSERT INTO odometer_entries (cycle_id, user_id, odometer, distance) VALUES (?, ?, ?, ?)',
    )
    .run(cycle.id, req.user!.id, odometer, distance)

  res.status(201).json({
    id: Number(info.lastInsertRowid),
    cycle_id: cycle.id,
    user_id: req.user!.id,
    odometer,
    distance,
  })
})

// DELETE /api/odometer/:id — removes a reading, admin only, and only when it
// belongs to the currently open cycle. Distances are then recomputed.
odometerRouter.delete('/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'Nieprawidłowe id odczytu' })
    return
  }

  const entry = db.prepare('SELECT * FROM odometer_entries WHERE id = ?').get(id) as
    | { id: number; cycle_id: number }
    | undefined

  if (!entry) {
    res.status(404).json({ error: 'Nie znaleziono odczytu' })
    return
  }

  const cycle = db
    .prepare("SELECT * FROM cycles WHERE status = 'OPEN' ORDER BY id DESC LIMIT 1")
    .get() as { id: number; start_odometer: number } | undefined

  if (!cycle || entry.cycle_id !== cycle.id) {
    res.status(409).json({ error: 'Można usuwać tylko odczyty z aktywnego cyklu' })
    return
  }

  const result = db.transaction(() => {
    db.prepare('DELETE FROM odometer_entries WHERE id = ?').run(id)
    recalculateCycleDistances(cycle.id, cycle.start_odometer)
  })
  result()

  res.json({ deleted: true, id })
})

// PATCH /api/odometer/:id — updates a reading's odometer and/or driver, admin
// only, and only when it belongs to the currently open cycle.
odometerRouter.patch('/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'Nieprawidłowe id odczytu' })
    return
  }

  const entry = db.prepare('SELECT * FROM odometer_entries WHERE id = ?').get(id) as
    | { id: number; cycle_id: number; odometer: number }
    | undefined

  if (!entry) {
    res.status(404).json({ error: 'Nie znaleziono odczytu' })
    return
  }

  const cycle = db
    .prepare("SELECT * FROM cycles WHERE status = 'OPEN' ORDER BY id DESC LIMIT 1")
    .get() as { id: number; start_odometer: number } | undefined

  if (!cycle || entry.cycle_id !== cycle.id) {
    res.status(409).json({ error: 'Można edytować tylko odczyty z aktywnego cyklu' })
    return
  }

  const hasOdometer = req.body?.odometer !== undefined && req.body?.odometer !== null
  const hasUserId = req.body?.user_id !== undefined && req.body?.user_id !== null
  const newOdometer = Number(req.body?.odometer)
  const newUserId = Number(req.body?.user_id)

  if (!hasOdometer && !hasUserId) {
    res.status(400).json({ error: 'Podaj nowy stan licznika lub nowego kierowcę' })
    return
  }
  if (hasOdometer && !Number.isFinite(newOdometer)) {
    res.status(400).json({ error: 'Nieprawidłowy stan licznika' })
    return
  }
  if (hasUserId) {
    if (!Number.isInteger(newUserId)) {
      res.status(400).json({ error: 'Nieprawidłowy kierowca' })
      return
    }
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(newUserId)
    if (!user) {
      res.status(404).json({ error: 'Nie znaleziono kierowcy' })
      return
    }
  }

  const targetOdometer = hasOdometer ? newOdometer : entry.odometer

  if (hasOdometer) {
    const prev = db
      .prepare('SELECT odometer FROM odometer_entries WHERE cycle_id = ? AND id < ? ORDER BY id DESC LIMIT 1')
      .get(cycle.id, id) as { odometer: number } | undefined
    const prevOdometer = prev?.odometer ?? cycle.start_odometer
    const next = db
      .prepare('SELECT odometer FROM odometer_entries WHERE cycle_id = ? AND id > ? ORDER BY id ASC LIMIT 1')
      .get(cycle.id, id) as { odometer: number } | undefined

    if (targetOdometer <= prevOdometer) {
      res.status(400).json({ error: 'Stan licznika musi być większy niż poprzedni odczyt' })
      return
    }
    if (next && targetOdometer >= next.odometer) {
      res.status(400).json({ error: 'Stan licznika musi być mniejszy niż następny odczyt' })
      return
    }
  }

  const result = db.transaction(() => {
    if (hasOdometer) {
      db.prepare('UPDATE odometer_entries SET odometer = ? WHERE id = ?').run(targetOdometer, id)
    }
    if (hasUserId) {
      db.prepare('UPDATE odometer_entries SET user_id = ? WHERE id = ?').run(newUserId, id)
    }
    recalculateCycleDistances(cycle.id, cycle.start_odometer)
  })
  result()

  const updated = db.prepare('SELECT * FROM odometer_entries WHERE id = ?').get(id)
  res.json(updated)
})

export default odometerRouter