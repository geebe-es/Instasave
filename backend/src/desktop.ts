import express from 'express'
import { app } from './app.js'

if (process.env.INSTASAVE_WEB_ROOT) app.use(express.static(process.env.INSTASAVE_WEB_ROOT))
const server = app.listen(0, '127.0.0.1', () => {
  const address = server.address()
  const parent = (process as any).parentPort
  if (address && typeof address !== 'string') parent?.postMessage({ port: address.port })
})
function stop() {
  server.close(() => process.exit(0))
  server.closeAllConnections()
  setTimeout(() => process.exit(0), 2000).unref()
}
;(process as any).parentPort?.on('message', (event: any) => {
  if (event.data === 'shutdown') return stop()
})
process.on('SIGTERM', stop)
