import { Router } from 'express'
import db from '../db'
import { requireAuth } from '../middleware/auth'

const round2 = (value: number): number => Math.round(value * 100) / 100
const round4 = (value: number): number => Math.round(value * 10000) / 10000

const cyclesRouter = Router()

cyclesRouter.use(requireAuth)

interface DriverDistance {
  user_id: number
  username: string
  distance: number
}

// GET /api/cycles/active — active cycle with per-driver km breakdown and trips.
cyclesRouter.get('/active', (_req, res) => {
  const cycle = db
    .prepare("SELECT * FROM cycles WHERE status = 'OPEN' ORDER BY id DESC LIMIT 1")
    .get() as { id: number; fuel_cost: number | null } | undefined

  if (!cycle) {
    res.status(404).json({ error: 'Brak aktywnego cyklu' })
    return
  }

  const cycleId = cycle.id
  const trips = db
    .prepare(
      `SELECT oe.*, u.username
       FROM odometer_entries oe
       JOIN users u ON u.id = oe.user_id
       WHERE oe.cycle_id = ?
       ORDER BY oe.id ASC`,
    )
    .all(cycleId)

  const drivers = db
    .prepare(
      `SELECT oe.user_id, u.username, SUM(oe.distance) AS distance
       FROM odometer_entries oe
       JOIN users u ON u.id = oe.user_id
       WHERE oe.cycle_id = ?
       GROUP BY oe.user_id
       ORDER BY distance DESC`,
    )
    .all(cycleId) as DriverDistance[]

  const totalDistance = drivers.reduce((sum, driver) => sum + driver.distance, 0)
  const fuelCost = cycle.fuel_cost ?? 0

  // Project each driver's share using the fuel cost stored on the active cycle
  // (the cost of the last refuelling that this cycle will be settled against).
  const driverShares = drivers.map((driver) => {
    const sharePercentage = totalDistance > 0 ? round4(driver.distance / totalDistance) : 0
    return {
      ...driver,
      share_percentage: sharePercentage,
      amount_due: totalDistance > 0 ? round2(sharePercentage * fuelCost) : 0,
    }
  })

  res.json({ cycle, totalDistance, drivers: driverShares, trips })
})

// POST /api/cycles/setup — first-run onboarding: creates the initial OPEN cycle
// from the current odometer and the last refuelling price (fuel baseline).
cyclesRouter.post('/setup', (req, res) => {
  const odometer = Number(req.body?.odometer)
  const fuelCost = Number(req.body?.fuel_cost)

  if (!Number.isInteger(odometer) || odometer <= 0) {
    res.status(400).json({ error: 'Stan licznika musi być liczbą całkowitą większą od zera' })
    return
  }
  if (!Number.isFinite(fuelCost) || fuelCost < 0) {
    res.status(400).json({ error: 'Nieprawidłowa cena ostatniego tankowania' })
    return
  }

  const existing = db.prepare('SELECT id FROM cycles LIMIT 1').get()
  if (existing) {
    res.status(400).json({ error: 'Stan początkowy został już wcześniej skonfigurowany' })
    return
  }

  const info = db
    .prepare('INSERT INTO cycles (status, start_odometer, fuel_cost) VALUES (?, ?, ?)')
    .run('OPEN', odometer, fuelCost)
  const cycleId = Number(info.lastInsertRowid)

  const cycle = db.prepare('SELECT * FROM cycles WHERE id = ?').get(cycleId)
  res.status(201).json({ cycle })
})

// POST /api/cycles/refuel — settles the active cycle and logs a refuel in a
// single transaction:
//   1. Optionally logs the final trip if the odometer advanced.
//   2. Splits the fuel cost proportionally across drivers.
//   3. Closes the active cycle.
//   4. Records the refuel.
//   5. Opens the next cycle.
cyclesRouter.post('/refuel', (req, res) => {
  const fuelCost = Number(req.body?.fuel_cost)
  const odometer = Number(req.body?.odometer)

  if (!Number.isFinite(fuelCost) || fuelCost < 0) {
    res.status(400).json({ error: 'Nieprawidłowy koszt tankowania' })
    return
  }
  if (!Number.isFinite(odometer) || odometer < 0) {
    res.status(400).json({ error: 'Nieprawidłowy stan licznika' })
    return
  }

  const cycle = db
    .prepare("SELECT * FROM cycles WHERE status = 'OPEN' ORDER BY id DESC LIMIT 1")
    .get() as { id: number; start_odometer: number; fuel_cost: number | null } | undefined

  if (!cycle) {
    res.status(409).json({ error: 'Brak aktywnego cyklu' })
    return
  }

  const last = db
    .prepare('SELECT odometer FROM odometer_entries WHERE cycle_id = ? ORDER BY id DESC LIMIT 1')
    .get(cycle.id) as { odometer: number } | undefined

  const lastOdometer = last?.odometer ?? cycle.start_odometer

  if (odometer < lastOdometer) {
    res.status(400).json({ error: 'Stan licznika nie może być niższy niż ostatni zanotowany stan' })
    return
  }

  // Use a stored fuel baseline (first-run setup) when present; otherwise fall
  // back to the price entered for this refuel.
  const splitCost = cycle.fuel_cost ?? fuelCost

  const userId = req.user!.id

  const result = db.transaction(() => {
    let finalEntryId: number | null = null

    if (odometer > lastOdometer) {
      const distance = odometer - lastOdometer
      const info = db
        .prepare(
          'INSERT INTO odometer_entries (cycle_id, user_id, odometer, distance) VALUES (?, ?, ?, ?)',
        )
        .run(cycle.id, userId, odometer, distance)
      finalEntryId = Number(info.lastInsertRowid)
    }

    const drivers = db
      .prepare(
        `SELECT oe.user_id, u.username, SUM(oe.distance) AS distance
         FROM odometer_entries oe
         JOIN users u ON u.id = oe.user_id
         WHERE oe.cycle_id = ?
         GROUP BY oe.user_id
         ORDER BY distance DESC`,
      )
      .all(cycle.id) as DriverDistance[]

    const totalDistance = drivers.reduce((sum, driver) => sum + driver.distance, 0)

    const shares: {
      user_id: number
      username: string
      distance: number
      share_percentage: number
      amount_due: number
    }[] = []

    if (totalDistance > 0) {
      for (const driver of drivers) {
        const sharePercentage = round4(driver.distance / totalDistance)
        const amountDue = round2(sharePercentage * splitCost)
        db.prepare(
          `INSERT INTO cycle_shares (cycle_id, user_id, distance, share_percentage, amount_due)
           VALUES (?, ?, ?, ?, ?)`,
        ).run(cycle.id, driver.user_id, driver.distance, sharePercentage, amountDue)
        shares.push({
          user_id: driver.user_id,
          username: driver.username,
          distance: driver.distance,
          share_percentage: sharePercentage,
          amount_due: amountDue,
        })
      }
    }

    db.prepare(
      `UPDATE cycles
       SET status = 'CLOSED', end_odometer = ?, fuel_cost = ?, closed_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    ).run(odometer, splitCost, cycle.id)

    const refuelInfo = db
      .prepare(
        'INSERT INTO refuels (cycle_id, user_id, fuel_cost, odometer_at_refuel) VALUES (?, ?, ?, ?)',
      )
      .run(cycle.id, userId, fuelCost, odometer)
    const refuelId = Number(refuelInfo.lastInsertRowid)

    const nextCycleInfo = db
      .prepare("INSERT INTO cycles (status, start_odometer, fuel_cost) VALUES ('OPEN', ?, ?)")
      .run(odometer, fuelCost)
    const nextCycleId = Number(nextCycleInfo.lastInsertRowid)

    return {
      refuel_id: refuelId,
      closed_cycle_id: cycle.id,
      next_cycle_id: nextCycleId,
      total_distance: totalDistance,
      final_entry_id: finalEntryId,
      shares,
    }
  })()

  res.status(201).json(result)
})

// GET /api/cycles/history — closed cycles with their cost shares.
cyclesRouter.get('/history', (_req, res) => {
  const cycles = db
    .prepare("SELECT * FROM cycles WHERE status = 'CLOSED' ORDER BY id DESC")
    .all() as { id: number }[]

  const history = cycles.map((cycle) => ({
    ...cycle,
    shares: db
      .prepare(
        `SELECT cs.*, u.username
         FROM cycle_shares cs
         JOIN users u ON u.id = cs.user_id
         WHERE cs.cycle_id = ?
         ORDER BY cs.id ASC`,
      )
      .all(cycle.id),
    trips: db
      .prepare(
        `SELECT oe.*, u.username
         FROM odometer_entries oe
         JOIN users u ON u.id = oe.user_id
         WHERE oe.cycle_id = ?
         ORDER BY oe.id ASC`,
      )
      .all(cycle.id),
  }))

  res.json(history)
})

export default cyclesRouter