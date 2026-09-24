-- 001_init.sql
-- Initial schema: migration tracking, users, cycles, odometer entries, refuels, cycle cost shares.

-- Tracks which migration files have already been applied.
CREATE TABLE IF NOT EXISTS _migrations (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Application users (drivers/admins) sharing the single tracked vehicle.
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
  is_protected INTEGER NOT NULL DEFAULT 0, -- protects the default admin from deletion
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- A cycle spans from one refuel (or vehicle start) to the next refuel.
CREATE TABLE IF NOT EXISTS cycles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'CLOSED')),
  start_odometer INTEGER NOT NULL,
  end_odometer INTEGER,
  fuel_cost REAL,
  closed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Odometer readings logged by users during an open cycle.
CREATE TABLE IF NOT EXISTS odometer_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cycle_id INTEGER NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  odometer INTEGER NOT NULL,
  distance INTEGER NOT NULL, -- delta in km vs the previous entry in the cycle
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Refuel events; each refuel closes the current cycle and opens a new one.
CREATE TABLE IF NOT EXISTS refuels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cycle_id INTEGER NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  fuel_cost REAL NOT NULL,
  odometer_at_refuel INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Computed, per-user proportional cost split for a closed cycle.
CREATE TABLE IF NOT EXISTS cycle_shares (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cycle_id INTEGER NOT NULL REFERENCES cycles(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  distance INTEGER NOT NULL,
  share_percentage REAL NOT NULL,
  amount_due REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_odometer_entries_cycle ON odometer_entries(cycle_id);
CREATE INDEX IF NOT EXISTS idx_refuels_cycle ON refuels(cycle_id);
CREATE INDEX IF NOT EXISTS idx_cycle_shares_cycle ON cycle_shares(cycle_id);
