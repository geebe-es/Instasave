import { AppError } from '../types/instagram.js'

const route = /^\/(?:p|reel|reels)\/([A-Za-z0-9_-]{5,80})\/?$/i
export function normalizeInstagramUrl(input: string): string {
  if (input.length > 2048) throw new AppError('LINK_INVALID', 'Insira um link válido do Instagram.')
  let url: URL
  try { url = new URL(input.trim()) } catch { throw new AppError('LINK_INVALID', 'Insira um link válido do Instagram.') }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port || !['instagram.com', 'www.instagram.com'].includes(url.hostname.toLowerCase()) || !route.test(url.pathname)) {
    throw new AppError('LINK_INVALID', 'Insira um link válido do Instagram.')
  }
  return `https://www.instagram.com${url.pathname.replace(/\/$/, '')}/`
}
export function shortcode(url: string) { return route.exec(new URL(url).pathname)?.[1] }
