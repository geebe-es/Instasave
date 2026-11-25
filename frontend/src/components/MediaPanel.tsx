import type { MouseEvent } from 'react'
import { IconAlert, IconDownload, IconImage, IconRefresh, IconUser, IconVideo } from './Icons'
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
  title?: string
  emptyTitle?: string
  emptyText?: string
  onDownloadAll?: (items: Media[]) => void
  onConnectAccount?: () => void
  accountConnected?: boolean
}

function completedFile(downloads: Record<string, DownloadStatus>, media: Media) {
  if (!media.filename) return false
  return Object.values(downloads).some(download => download.state === 'completed' && (
    download.filename === media.filename ||
    (download.filename && media.filename && download.filename.replace(/\s\(\d+\)(?=\.[^.]+$)/, '') === media.filename)
  ))
}

export function MediaPanel({
  media,
  loading,
  status,
  downloads,
  activeMediaId,
  onDownload,
  onRetry,
  title = 'Imagens encontradas',
  emptyTitle = 'Tudo pronto para começar',
  emptyText = 'Cole o link de uma publicação do Instagram para encontrar as imagens disponíveis.',
  onDownloadAll,
  onConnectAccount,
  accountConnected = false,
}: MediaPanelProps) {
  const hasError = !loading && !media.length && status?.type === 'error'
  const needsAccount = Boolean(onConnectAccount) && !accountConnected && hasError && /(bloqueou|exige login|conta|limite|disponibilizou)/i.test(status?.message ?? '')
  const pending = media.filter(item => {
    const complete = Object.values(downloads).some(download => download.state === 'completed' && download.filename && item.filename && download.filename.replace(/\s\(\d+\)(?=\.[^.]+$)/, '') === item.filename)
    return !complete
  })
  return (
    <section className="media-panel" aria-label={title} aria-busy={loading || undefined}>
      <div className="panel-heading">
        <div className="panel-heading__title"><IconImage size={16} /><h2>{title}</h2></div>
        <div className="panel-heading__actions">
          <span aria-live="polite">{loading ? 'Buscando imagens…' : media.length ? `${media.length} disponível${media.length === 1 ? '' : 'is'}` : hasError ? 'Nenhuma imagem' : 'Aguardando um link…'}</span>
          {!loading && media.length > 1 && onDownloadAll ? (
            <button type="button" className="batch-download" onClick={() => onDownloadAll(pending.length ? pending : media)}>
              <IconDownload size={14} />
              Baixar todas ({pending.length || media.length})
            </button>
          ) : null}
        </div>
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
            <div className="media-error__actions">
              <GlowButton size="sm" icon={<IconRefresh size={15} />} onClick={onRetry}>Tentar novamente</GlowButton>
              {needsAccount ? (
                <GlowButton size="sm" variant="ghost" icon={<IconUser size={15} />} onClick={onConnectAccount}>Conectar conta</GlowButton>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-orbit" aria-hidden="true">
              <span className="empty-orbit__ring empty-orbit__ring--one" />
              <span className="empty-orbit__ring empty-orbit__ring--two" />
              <span className="empty-orbit__ring empty-orbit__ring--three" />
              <span className="empty-orbit__icon"><IconDownload size={28} /></span>
            </div>
            <strong>{emptyTitle}</strong>
            <p>{emptyText}</p>
          </div>
        )}
      </div>
    </section>
  )
}
