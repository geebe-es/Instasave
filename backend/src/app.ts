import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import { z } from 'zod'
import { env } from './config/env.js'
import { AppError } from './types/instagram.js'
import { Readable } from 'node:stream'

const validInput = z.object({ url: z.string().min(1).max(2048) })
export const app = express()
app.use(helmet({ crossOriginResourcePolicy: false }))
app.use(cors({ origin: ['http://127.0.0.1:5173', 'http://localhost:5173'], methods: ['POST', 'GET'] }))
app.use(express.json({ limit: '8kb' }))
app.use('/api', rateLimit({ windowMs: env.rateWindow, limit: env.rateMax, standardHeaders: true, legacyHeaders: false, message: { success: false, error: { code: 'RATE_LIMIT', message: 'Você atingiu o limite temporário. Tente novamente mais tarde.' } } }))
app.post('/api/instagram/resolve', async (req, res, next) => {
  try {
    const { url } = validInput.parse(req.body)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), env.resolveTimeout)
    const upstream = await fetch(`${env.pythonServiceUrl}/resolve`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }), signal: controller.signal })
    clearTimeout(timeout)
    const payload = await upstream.json() as { success: boolean; type?: string; media?: Array<Record<string, unknown>>; error?: { code?: string; message?: string } }
    if (!upstream.ok || !payload.success) throw new AppError(payload.error?.code ?? 'SOURCE_UNAVAILABLE', payload.error?.message ?? 'Não foi possível processar a mídia agora.', upstream.status || 502)
    const media = (payload.media ?? []).map(item => ({ ...item, downloadUrl: `/api/instagram/download/${String(item.id)}`, previewUrl: `/api/instagram/preview/${String(item.id)}` }))
    res.json({ success: true, data: { type: payload.type, media } })
  }
  catch (error) { next(error) }
})
app.get('/api/instagram/download/:id', async (req, res, next) => {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), env.downloadTimeout)
    const upstream = await fetch(`${env.pythonServiceUrl}/download/${encodeURIComponent(req.params.id)}`, { signal: controller.signal })
    clearTimeout(timeout)
    if (!upstream.ok || !upstream.body) {
      const body = await upstream.json().catch(() => undefined) as { error?: { code?: string; message?: string } } | undefined
      throw new AppError(body?.error?.code ?? 'DOWNLOAD_FAILED', body?.error?.message ?? 'Não foi possível obter o arquivo temporário.', upstream.status || 502)
    }
    const contentType = upstream.headers.get('content-type') ?? 'application/octet-stream'
    const contentLength = upstream.headers.get('content-length')
    const disposition = upstream.headers.get('content-disposition')
    res.status(200).setHeader('Content-Type', contentType).setHeader('Cache-Control', 'no-store')
    if (contentLength) res.setHeader('Content-Length', contentLength)
    if (disposition) res.setHeader('Content-Disposition', disposition)
    Readable.fromWeb(upstream.body as never).on('error', next).pipe(res)
  } catch (error) { next(error) }
})
app.get('/api/instagram/preview/:id', async (req, res, next) => {
  try {
    const upstream = await fetch(`${env.pythonServiceUrl}/preview/${encodeURIComponent(req.params.id)}`)
    if (!upstream.ok || !upstream.body) throw new AppError('PREVIEW_FAILED', 'Não foi possível carregar a prévia.', upstream.status || 502)
    res.status(200).setHeader('Content-Type', upstream.headers.get('content-type') ?? 'application/octet-stream').setHeader('Cache-Control', 'private, max-age=60')
    const length = upstream.headers.get('content-length')
    if (length) res.setHeader('Content-Length', length)
    Readable.fromWeb(upstream.body as never).on('error', next).pipe(res)
  } catch (error) { next(error) }
})
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof z.ZodError) return res.status(422).json({ success: false, error: { code: 'LINK_INVALID', message: 'Insira um link válido do Instagram.' } })
  const safe = error instanceof AppError ? error : new AppError('SOURCE_UNAVAILABLE', 'Não foi possível processar a mídia agora. Tente novamente.', 500)
  return res.status(safe.status).json({ success: false, error: { code: safe.code, message: safe.message } })
})
