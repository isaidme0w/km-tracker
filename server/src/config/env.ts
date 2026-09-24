import dotenv from 'dotenv'
import { z } from 'zod'

// Load .env into process.env before validation runs.
dotenv.config()

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  JWT_SECRET: z.string().min(1).default('change-me-in-production'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  DB_PATH: z.string().default('./data/km-tracker.sqlite'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('[env] Invalid environment configuration:')
  for (const issue of parsed.error.issues) {
    console.error(`  ${issue.path.join('.')}: ${issue.message}`)
  }
  throw new Error('Invalid environment configuration')
}

export const env = parsed.data
export default env