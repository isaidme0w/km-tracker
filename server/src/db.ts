import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import bcrypt from 'bcrypt'
import { env } from './config/env'

// Resolve the SQLite file path relative to this file's location (server/data).
const DB_PATH = path.isAbsolute(env.DB_PATH)
  ? env.DB_PATH
  : path.resolve(__dirname, '../', env.DB_PATH)

// Ensure the data directory exists before opening the database file.
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

const db = new Database(DB_PATH)

// WAL mode improves concurrent read/write performance.
db.pragma('journal_mode = WAL')
// Enforce foreign key constraints (off by default in SQLite).
db.pragma('foreign_keys = ON')

// ---------------------------------------------------------------------------
// Migrations
// ---------------------------------------------------------------------------
const MIGRATIONS_DIR = path.resolve(__dirname, '../migrations')

function migrationsTableExists(): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = '_migrations'")
    .get()
  return Boolean(row)
}

function getAppliedMigrations(): Set<string> {
  if (!migrationsTableExists()) {
    return new Set()
  }
  const rows = db.prepare('SELECT name FROM _migrations').all() as { name: string }[]
  return new Set(rows.map((r) => r.name))
}

// Applies any pending .sql migration files in alphabetical order.
export function runMigrations(): string[] {
  const applied = getAppliedMigrations()

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b))

  const newlyApplied: string[] = []

  for (const file of files) {
    if (applied.has(file)) {
      continue
    }
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8')
    const applyMigration = db.transaction(() => {
      db.exec(sql)
      db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file)
    })
    applyMigration()
    newlyApplied.push(file)
  }

  return newlyApplied
}

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------
const SALT_ROUNDS = 10
const DEFAULT_ADMIN_USERNAME = 'admin'
const DEFAULT_ADMIN_PASSWORD = 'admin'

// Idempotently seeds the protected default admin. The initial vehicle cycle is
// created later through the first-run onboarding endpoint (POST /api/cycles/setup).
export function runSeed(): void {
  const existingAdmin = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get()
  if (!existingAdmin) {
    const passwordHash = bcrypt.hashSync(DEFAULT_ADMIN_PASSWORD, SALT_ROUNDS)
    db.prepare(
      "INSERT INTO users (username, password_hash, role, is_protected) VALUES (?, ?, 'admin', 1)",
    ).run(DEFAULT_ADMIN_USERNAME, passwordHash)
    console.log(`[seed] Created default protected admin user "${DEFAULT_ADMIN_USERNAME}".`)
  }
}

// Allow running directly: `tsx src/db.ts` (migrations only), or with `seed` /
// `setup` to also create the default admin.
if (require.main === module) {
  runMigrations()
  if (process.argv[2] === 'seed' || process.argv[2] === 'setup') {
    runSeed()
  }
}

export default db
export { DB_PATH }