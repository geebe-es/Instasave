import type { MediaItem } from '../types/instagram.js'
import { env } from '../config/env.js'
import { randomUUID } from 'node:crypto'
const records = new Map<string, { item: MediaItem; expiresAt: number }>()
export function storeDownload(item: MediaItem) { const id = randomUUID(); records.set(id, { item, expiresAt: Date.now() + env.temporaryTtl }); return id }
export function takeDownload(id: string) { const record = records.get(id); records.delete(id); return record && record.expiresAt > Date.now() ? record.item : undefined }
