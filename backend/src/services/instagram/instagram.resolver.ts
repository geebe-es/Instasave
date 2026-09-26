import type { MediaResolver, ResolvedInstagramMedia } from '../../types/instagram.js'

/** Provider boundary. Providers must return original public media, never thumbnails. */
export class InstagramResolver implements MediaResolver {
  constructor(private readonly providers: MediaResolver[]) {}
  async resolve(url: string): Promise<ResolvedInstagramMedia> {
    let lastError: unknown
    for (const provider of this.providers) {
      try { return await provider.resolve(url) } catch (error) { lastError = error }
    }
    throw lastError
  }
}
