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

const VIDEO_UUID = '11111111-2222-3333-4444-555555555555'
const IMAGE_UUID = '66666666-2222-3333-4444-777777777777'
const THUMB_UUID = '88888888-2222-3333-4444-999999999999'

function readBody(request: import('node:http').IncomingMessage): Promise<string> {
  return new Promise(resolve => {
    let body = ''
    request.on('data', chunk => { body += chunk })
    request.on('end', () => resolve(body))
  })
}

test('video resolve route filters videos and maps preview endpoints', { timeout: 15000 }, async t => {
  const upstream = createServer(async (request, response) => {
    const payload = JSON.parse(await readBody(request))
    if (!request.url?.startsWith('/resolve')) { response.writeHead(404).end(); return }
    if (payload.mode !== 'video') { response.writeHead(500, { 'content-type': 'application/json' }).end(JSON.stringify({ success: false, error: { code: 'MODE', message: 'mode ausente' } })); return }
    if (payload.url === 'https://www.instagram.com/p/PreviewCaso/') {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({
        success: true,
        type: 'carousel',
        totalMedia: 5,
        media: [
          { id: VIDEO_UUID, type: 'video', width: 1080, height: 1920, format: 'mp4', filename: 'instagram_abc_02.mp4', downloadEndpoint: `/download/${VIDEO_UUID}`, duration: 46.2, thumbnailId: THUMB_UUID },
          { id: IMAGE_UUID, type: 'image', width: 1080, height: 1350, format: 'png', filename: 'instagram_abc_01.png', downloadEndpoint: `/download/${IMAGE_UUID}`, thumbnailId: null },
        ],
      }))
      return
    }
    if (payload.url === 'https://www.instagram.com/p/SoImagens1/') {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ success: true, type: 'image', media: [] }))
      return
    }
    response.writeHead(403, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ success: false, error: { code: 'STORY_ACCESS_RESTRICTED', message: 'O Instagram só disponibiliza stories para contas conectadas e autorizadas.' } }))
  })

  process.env.PYTHON_SERVICE_URL = await listen(upstream)
  delete process.env.INSTASAVE_SERVICE_TOKEN
  const { app } = await import('../src/app.js')
  const proxy = createServer(app)
  const base = await listen(proxy)
  try {
    await t.test('only videos survive; preview points at the poster', async () => {
      const response = await fetch(`${base}/api/instagram/video/resolve`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: 'https://www.instagram.com/p/PreviewCaso/' }),
        signal: AbortSignal.timeout(5000),
      })
      assert.equal(response.status, 200)
      const result = await response.json() as {
        success: boolean
        data: { type: string; total: number; totalMedia: number; media: Array<{ id: string; downloadUrl: string; previewUrl: string; videoPreviewUrl: string; duration: number }> }
      }
      assert.equal(result.success, true)
      assert.equal(result.data.type, 'carousel')
      assert.equal(result.data.total, 1)
      assert.equal(result.data.totalMedia, 5)
      assert.equal(result.data.media.length, 1)
      const video = result.data.media[0]
      assert.equal(video.id, VIDEO_UUID)
      assert.equal(video.duration, 46.2)
      assert.equal(video.downloadUrl, `/api/instagram/download/${VIDEO_UUID}`)
      assert.equal(video.previewUrl, `/api/instagram/preview/${THUMB_UUID}`)
      assert.equal(video.videoPreviewUrl, `/api/instagram/preview/${VIDEO_UUID}`)
    })

    await t.test('a link without videos is reported as NO_VIDEO', async () => {
      const response = await fetch(`${base}/api/instagram/video/resolve`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: 'https://www.instagram.com/p/SoImagens1/' }),
        signal: AbortSignal.timeout(5000),
      })
      assert.equal(response.status, 404)
      const result = await response.json() as { success: boolean; error: { code: string } }
      assert.equal(result.success, false)
      assert.equal(result.error.code, 'NO_VIDEO')
    })

    await t.test('python errors pass through with their code and message', async () => {
      const response = await fetch(`${base}/api/instagram/video/resolve`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: 'https://www.instagram.com/stories/u/3345123456789012345/' }),
        signal: AbortSignal.timeout(5000),
      })
      assert.equal(response.status, 403)
      const result = await response.json() as { success: boolean; error: { code: string; message: string } }
      assert.equal(result.success, false)
      assert.equal(result.error.code, 'STORY_ACCESS_RESTRICTED')
      assert.match(result.error.message, /contas conectadas e autorizadas/)
    })
  } finally {
    await close(proxy)
    await close(upstream)
    delete process.env.PYTHON_SERVICE_URL
  }
})
