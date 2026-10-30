import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { z } from 'zod'
import { env } from './config/env.js'
import { AppError } from './types/instagram.js'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

function upstreamRequest(res: express.Response, milliseconds: number) {
  const controller = new AbortController()
  let timedOut = false
  const timeout = setTimeout(() => { timedOut = true; controller.abort() }, milliseconds)
  const disconnect = () => controller.abort()
  res.once('close', disconnect)
  return {
    signal: controller.signal,
    error: (error: unknown) => timedOut ? new AppError('TIMEOUT', 'A transferência demorou demais. Tente novamente.', 504) : error,
    dispose() { clearTimeout(timeout); res.off('close', disconnect); controller.abort() },
  }
}

type ResolvedMediaPayload = {
  success?: boolean
  type?: string
  media?: Array<Record<string, unknown>>
  totalMedia?: number
  error?: { code?: string; message?: string }
}

const validInput = z.object({ url: z.string().min(1).max(2048) })
export const app = express()
app.use((req, res, next) => {
  const token = process.env.INSTASAVE_SERVICE_TOKEN
  if (token && req.headers['x-instasave-token'] !== token) return res.sendStatus(403)
  next()
})
app.use(helmet({ crossOriginResourcePolicy: false }))
app.get('/health', (_req, res) => res.json({ status: 'ok' }))
app.use(cors({ origin: ['http://127.0.0.1:5173', 'http://localhost:5173'], methods: ['POST', 'GET'] }))
app.use(express.json({ limit: '8kb' }))
app.post('/api/instagram/resolve', async (req, res, next) => {
  const request = upstreamRequest(res, env.resolveTimeout)
  try {
    const { url } = validInput.parse(req.body)
    const upstream = await fetch(`${env.pythonServiceUrl}/resolve`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-instasave-token': process.env.INSTASAVE_SERVICE_TOKEN ?? '' }, body: JSON.stringify({ url }), signal: request.signal })
    const payload = await upstream.json() as { success: boolean; type?: string; media?: Array<Record<string, unknown>>; error?: { code?: string; message?: string } }
    if (!upstream.ok || !payload.success) throw new AppError(payload.error?.code ?? 'SOURCE_UNAVAILABLE', payload.error?.message ?? 'Não foi possível processar a mídia agora.', upstream.ok ? 502 : upstream.status)
    const media = (payload.media ?? []).map(item => ({ ...item, downloadUrl: `/api/instagram/download/${String(item.id)}`, previewUrl: `/api/instagram/preview/${String(item.id)}` }))
    res.json({ success: true, data: { type: payload.type, media } })
  }
  catch (error) { next(request.error(error)) }
  finally { request.dispose() }
})
app.post('/api/instagram/video/resolve', async (req, res, next) => {
  const request = upstreamRequest(res, env.resolveTimeout)
  try {
    const { url } = validInput.parse(req.body)
    const upstream = await fetch(`${env.pythonServiceUrl}/resolve`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-instasave-token': process.env.INSTASAVE_SERVICE_TOKEN ?? '' }, body: JSON.stringify({ url, mode: 'video' }), signal: request.signal })
    const payload = await upstream.json() as ResolvedMediaPayload
    if (!upstream.ok || !payload.success) throw new AppError(payload.error?.code ?? 'VIDEO_UNAVAILABLE', payload.error?.message ?? 'Não foi possível processar o vídeo agora.', upstream.ok ? 502 : upstream.status)
    const videos = (payload.media ?? []).filter(item => item.type === 'video').map(item => {
      const id = String(item.id)
      // Videos point previewUrl at the downloaded poster image when available;
      // the inline file stays reserved for the download itself.
      const thumbnailId = typeof item.thumbnailId === 'string' && /^[0-9a-f-]{36}$/i.test(item.thumbnailId) ? item.thumbnailId : ''
      const previewId = thumbnailId || id
      return { ...item, downloadUrl: `/api/instagram/download/${id}`, previewUrl: `/api/instagram/preview/${previewId}`, videoPreviewUrl: `/api/instagram/preview/${id}` }
    })
    if (!videos.length) throw new AppError('NO_VIDEO', 'Este link não contém vídeos. Ele também pode estar disponível no menu de imagens.', 404)
    const totalMedia = Number.isFinite(payload.totalMedia) ? Number(payload.totalMedia) : videos.length
    res.json({ success: true, data: { type: payload.type ?? 'video', total: videos.length, totalMedia, media: videos } })
  }
  catch (error) { next(request.error(error)) }
  finally { request.dispose() }
})
app.get('/api/instagram/download/:id', async (req, res, next) => {
  const request = upstreamRequest(res, env.downloadTimeout)
  try {
    const upstream = await fetch(`${env.pythonServiceUrl}/download/${encodeURIComponent(req.params.id)}`, { headers: { 'x-instasave-token': process.env.INSTASAVE_SERVICE_TOKEN ?? '' }, signal: request.signal })
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
    await pipeline(Readable.fromWeb(upstream.body as never), res, { signal: request.signal })
  } catch (error) { next(request.error(error)) }
  finally { request.dispose() }
})
app.get('/api/instagram/preview/:id', async (req, res, next) => {
  const request = upstreamRequest(res, env.downloadTimeout)
  try {
    const upstream = await fetch(`${env.pythonServiceUrl}/preview/${encodeURIComponent(req.params.id)}`, { headers: { 'x-instasave-token': process.env.INSTASAVE_SERVICE_TOKEN ?? '' }, signal: request.signal })
    if (!upstream.ok || !upstream.body) throw new AppError('PREVIEW_FAILED', 'Não foi possível carregar a prévia.', upstream.status || 502)
    res.status(200).setHeader('Content-Type', upstream.headers.get('content-type') ?? 'application/octet-stream').setHeader('Cache-Control', 'private, max-age=60')
    const length = upstream.headers.get('content-length')
    if (length) res.setHeader('Content-Length', length)
    await pipeline(Readable.fromWeb(upstream.body as never), res, { signal: request.signal })
  } catch (error) { next(request.error(error)) }
  finally { request.dispose() }
})
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (res.destroyed) return
  if (res.headersSent) { res.destroy(error instanceof Error ? error : undefined); return }
  if (error instanceof z.ZodError) return res.status(422).json({ success: false, error: { code: 'LINK_INVALID', message: 'Insira um link válido do Instagram.' } })
  const safe = error instanceof AppError ? error : new AppError('SOURCE_UNAVAILABLE', 'Não foi possível processar a mídia agora. Tente novamente.', 500)
  return res.status(safe.status).json({ success: false, error: { code: safe.code, message: safe.message } })
})
