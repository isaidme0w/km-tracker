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

// Graceful shutdown: close the HTTP server and exit cleanly on Ctrl+C.
// server.close() waits for in-flight keep-alive connections to drain, which can
// hang forever, so we force-destroy sockets and fall back to a hard timeout.
let shuttingDown = false

function shutdown(signal: string) {
  if (shuttingDown) {
    // Second signal: exit immediately.
    process.exit(0)
  }
  shuttingDown = true

  console.log(`[server] Received ${signal}, shutting down...`)

  // Force-close any lingering keep-alive connections.
  server.close(() => {
    console.log('[server] Closed cleanly')
    process.exit(0)
  })

  // Destroy all open connections so server.close() can complete.
  server.closeAllConnections?.()

  // Safety net: if something keeps the event loop alive, force-exit.
  setTimeout(() => {
    console.log('[server] Forcing exit after timeout')
    process.exit(0)
  }, 2000).unref()
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))