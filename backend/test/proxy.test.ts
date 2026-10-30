import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer, type Server } from 'node:http'
import { once } from 'node:events'

async function listen(server: Server) {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  return `http://127.0.0.1:${address.port}`
}

async function close(server: Server) {
  const stopped = new Promise<void>(resolve => server.close(() => resolve()))
  server.closeAllConnections()
  await stopped
}

test('proxy deadlines cover response bodies and client disconnect cancels upstream', { timeout: 15000 }, async t => {
  let mode = 'resolve-stall'
  let upstreamClosed = Promise.resolve()
  const upstream = createServer((_req, res) => {
    upstreamClosed = new Promise<void>(resolve => res.once('close', resolve))
    if (mode === 'resolve-stall') {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.write('{"success":')
    } else if (mode === 'download-stall') {
      res.writeHead(200, { 'content-type': 'video/mp4', 'content-length': '100' })
      res.write('partial')
    } else {
      res.writeHead(200, { 'content-type': 'image/jpeg', 'content-length': '5' })
      res.end('image')
    }
  })
  process.env.PYTHON_SERVICE_URL = await listen(upstream)
  process.env.RESOLVE_TIMEOUT_MS = '300'
  process.env.DOWNLOAD_TIMEOUT_MS = '300'
  delete process.env.INSTASAVE_SERVICE_TOKEN
  const { app } = await import('../src/app.js')
  const proxy = createServer(app)
  const base = await listen(proxy)
  try {
    await t.test('JSON body that stalls after headers returns 504', async () => {
      const response = await fetch(`${base}/api/instagram/resolve`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: 'https://instagram.com/p/Abcde12/' }),
        signal: AbortSignal.timeout(3000),
      })
      assert.equal(response.status, 504)
      assert.equal((await response.json()).error.code, 'TIMEOUT')
      await upstreamClosed
    })
    await t.test('stalled media body terminates without appending JSON', async () => {
      mode = 'download-stall'
      const response = await fetch(`${base}/api/instagram/download/test`, { signal: AbortSignal.timeout(3000) })
      assert.equal(response.status, 200)
      await assert.rejects(response.arrayBuffer())
      await upstreamClosed
    })
    await t.test('client disconnect closes upstream', async () => {
      const controller = new AbortController()
      const response = await fetch(`${base}/api/instagram/preview/test`, { signal: controller.signal })
      assert.equal(response.status, 200)
      controller.abort()
      await Promise.race([
        upstreamClosed,
        new Promise((_, reject) => { const timer = setTimeout(() => reject(new Error('upstream left open')), 2000); timer.unref() }),
      ])
    })
    await t.test('complete media still streams intact', async () => {
      mode = 'complete'
      const response = await fetch(`${base}/api/instagram/download/test`)
      assert.equal(response.status, 200)
      assert.equal(await response.text(), 'image')
    })
  } finally {
    await close(proxy)
    await close(upstream)
  }
})
