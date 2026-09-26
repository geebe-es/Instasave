import { env } from '../../config/env.js'
import { AppError, type MediaResolver, type ResolvedInstagramMedia } from '../../types/instagram.js'

/**
 * Reads public page metadata only to determine availability. Open Graph imagery
 * is intentionally not returned as downloadable media because it can be a crop.
 */
export class PublicPageResolver implements MediaResolver {
  async resolve(url: string): Promise<ResolvedInstagramMedia> {
    try {
      const response = await fetch(url, { headers: { 'user-agent': 'InstaSave/1.0', accept: 'text/html' }, signal: AbortSignal.timeout(env.resolveTimeout), redirect: 'manual' })
      if (response.status === 404) throw new AppError('SOURCE_UNAVAILABLE', 'Essa publicação não está mais disponível.', 404)
      if (!response.ok) throw new AppError('PRIVATE_CONTENT', 'Não foi possível acessar essa publicação pública. Ela pode estar indisponível para este serviço.', 403)
      const html = await response.text()
      if (/property=["']og:image["']/i.test(html)) {
        throw new AppError('MEDIA_NOT_FOUND', 'A fonte publicou apenas uma prévia reduzida desta mídia. Para evitar um arquivo cortado, o download não foi disponibilizado.', 404)
      }
      throw new AppError('MEDIA_NOT_FOUND', 'Não encontramos uma mídia completa disponível para download.', 404)
    } catch (error) {
      if (error instanceof AppError) throw error
      if (error instanceof DOMException && error.name === 'TimeoutError') throw new AppError('TIMEOUT', 'O processamento demorou demais. Tente novamente.', 504)
      throw new AppError('SOURCE_UNAVAILABLE', 'A fonte da mídia não está disponível no momento.', 503)
    }
  }
}
