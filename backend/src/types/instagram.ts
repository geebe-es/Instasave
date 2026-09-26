export type MediaType = 'image' | 'video'

export interface MediaVersion { url: string; width?: number; height?: number; fileSize?: number; mimeType?: string }
export interface MediaItem {
  id: string; type: MediaType; url: string; thumbnailUrl?: string; width?: number; height?: number
  format?: string; mimeType?: string; fileSize?: number
}
export interface ResolvedInstagramMedia {
  sourceUrl: string; type: MediaType | 'carousel'; title?: string; thumbnailUrl?: string; media: MediaItem[]
}
export interface MediaResolver { resolve(url: string): Promise<ResolvedInstagramMedia> }
export class AppError extends Error { constructor(public code: string, message: string, public status = 422) { super(message) } }
