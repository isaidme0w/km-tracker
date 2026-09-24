import './config/env'
import { env } from './config/env'
import { runMigrations, runSeed } from './db'
import { createApp } from './app'

// Prepare the database before serving requests.
runMigrations()
runSeed()

const app = createApp()

const server = app.listen(env.PORT, () => {
  console.log(`[server] Listening on http://localhost:${env.PORT}`)
})

// Graceful shutdown: close the HTTP server before exiting so tsx watch
// does not have to force-kill the process on Ctrl+C.
function shutdown(signal: string) {
  console.log(`[server] Received ${signal}, shutting down...`)
  server.close(() => {
    console.log('[server] Closed')
    process.exit(0)
  })
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))