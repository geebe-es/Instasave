import type { MouseEvent } from 'react'
import { IconAlert, IconDownload, IconImage, IconRefresh, IconVideo } from './Icons'
import { MotionCard } from './motion/MotionCard'
import { GlowButton } from './ui/GlowButton'
import { LoadingSpinner } from './ui/LoadingSpinner'
import type { Media, Status } from '../types'

type MediaPanelProps = {
  media: Media[]
  loading: boolean
  status: Status
  downloads: Record<string, DownloadStatus>
  activeMediaId: string | null
  onDownload: (media: Media) => void
  onRetry: () => void
}

function completedFile(downloads: Record<string, DownloadStatus>, media: Media) {
  if (!media.filename) return false
  return Object.values(downloads).some(download => download.state === 'completed' && (
    download.filename === media.filename ||
    (download.filename && media.filename && download.filename.replace(/\s\(\d+\)(?=\.[^.]+$)/, '') === media.filename)
  ))
}

export function MediaPanel({ media, loading, status, downloads, activeMediaId, onDownload, onRetry }: MediaPanelProps) {
  const hasError = !loading && !media.length && status?.type === 'error'
  return (
    <section className="media-panel" aria-label="Imagens encontradas" aria-busy={loading || undefined}>
      <div className="panel-heading">
        <div className="panel-heading__title"><IconImage size={16} /><h2>Imagens encontradas</h2></div>
        <span aria-live="polite">{loading ? 'Buscando imagens…' : media.length ? `${media.length} disponível${media.length === 1 ? '' : 'is'}` : hasError ? 'Nenhuma imagem' : 'Aguardando um link…'}</span>
      </div>
      <div className="media-scroll" tabIndex={0} aria-label="Lista de imagens">
        {loading ? (
          <div className="skeleton-grid" aria-label="Carregando imagens">
            {Array.from({ length: 4 }, (_, index) => (
              <div className="skeleton-card" key={index} style={{ animationDelay: `${index * 90}ms` }}>
                <span className="skeleton-card__preview" />
                <span className="skeleton-card__line skeleton-card__line--short" />
                <span className="skeleton-card__line" />
                <span className="skeleton-card__button" />
              </div>
            ))}
          </div>
        ) : media.length ? (
          <div className="results">
            {media.map((item, index) => {
              const complete = completedFile(downloads, item)
              const active = activeMediaId === item.id
              return (
                <MotionCard
                  key={item.id}
                  index={index}
                  className={`media-card media-card--${item.type} ${complete ? 'is-complete' : ''}`.trim()}
                >
                  <div className="media-preview">
                    {item.type === 'video'
                      ? <video src={item.previewUrl} muted preload="metadata" />
                      : <img src={item.previewUrl} alt="Prévia da imagem encontrada" loading="lazy" />}
                    <span className={`media-type media-type--${item.type}`}>
                      {item.type === 'video' ? <IconVideo size={13} /> : <IconImage size={13} />}
                      {item.type === 'video' ? 'Vídeo' : 'Imagem'}
                    </span>
                    {item.type === 'video' ? <span className="media-play" aria-hidden="true"><span /></span> : null}
                    {complete ? <span className="media-complete" aria-label="Download concluído"><IconDownload size={15} /></span> : null}
                  </div>
                  <div className="media-card__body">
                    <strong>{item.type === 'video' ? 'Vídeo do Instagram' : 'Imagem do Instagram'}</strong>
                    <small>
                      {item.width && item.height ? `${item.width} × ${item.height}` : 'Resolução não informada'}
                      <span aria-hidden="true"> · </span>
                      {(item.format ?? 'arquivo').toUpperCase()}
                    </small>
                  </div>
                  <a
                    className={`media-download ${active ? 'is-active' : ''}`.trim()}
                    href={item.downloadUrl}
                    onClick={(event: MouseEvent<HTMLAnchorElement>) => {
                      if (!window.desktop) return
                      event.preventDefault()
                      onDownload(item)
                    }}
                    aria-busy={active || undefined}
                  >
                    {active ? <LoadingSpinner size="sm" label="Preparando download" /> : <IconDownload size={15} />}
                    <span>{active ? 'Preparando…' : 'Baixar arquivo'}</span>
                  </a>
                </MotionCard>
              )
            })}
          </div>
        ) : hasError ? (
          <div className="media-error">
            <span className="media-error__icon" aria-hidden="true"><IconAlert size={28} /></span>
            <strong>Não foi possível encontrar as imagens</strong>
            <p>{status?.message}</p>
            <GlowButton size="sm" icon={<IconRefresh size={15} />} onClick={onRetry}>Tentar novamente</GlowButton>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-orbit" aria-hidden="true">
              <span className="empty-orbit__ring empty-orbit__ring--one" />
              <span className="empty-orbit__ring empty-orbit__ring--two" />
              <span className="empty-orbit__ring empty-orbit__ring--three" />
              <span className="empty-orbit__icon"><IconDownload size={28} /></span>
            </div>
            <strong>Tudo pronto para começar</strong>
            <p>Cole o link de uma publicação do Instagram para encontrar as imagens disponíveis.</p>
          </div>
        )}
      </div>
    </section>
  )
}
