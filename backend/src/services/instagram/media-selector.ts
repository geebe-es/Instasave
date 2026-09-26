import type { MediaVersion } from '../../types/instagram.js'

/** Selects a verified full-media candidate, never a preview or poster. */
export function selectBestMediaVersion(versions: MediaVersion[]): MediaVersion | undefined {
  return versions.filter(v => /^https:\/\//.test(v.url)).sort((a, b) => {
    const pixelsA = (a.width ?? 0) * (a.height ?? 0)
    const pixelsB = (b.width ?? 0) * (b.height ?? 0)
    return pixelsB - pixelsA || (b.fileSize ?? 0) - (a.fileSize ?? 0)
  })[0]
}
