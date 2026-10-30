import { useEffect, useState, type FormEvent, type MouseEvent } from 'react'
import { DownloadActivity } from '../components/Downloads'
import { FolderBar } from '../components/FolderBar'
import { StatusBanner } from '../components/StatusBanner'
import { VideoComposer } from '../components/VideoComposer'
import { VideoHero } from '../components/VideoHero'
import {
  IconAlert, IconCheck, IconClock, IconDownload, IconExpand, IconFilm, IconImage,
  IconPlay, IconRefresh, IconVideo,
} from '../components/Icons'
import { MotionCard } from '../components/motion/MotionCard'
import { GlowButton } from '../components/ui/GlowButton'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import type { Media, Status } from '../types'

type VideosPageProps = {
  url: string
  onUrlChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onPaste: () => void
  loading: boolean
  status: Status
  videos: Media[]
  videoTotal: number
  linkKind: 'reel' | 'post' | 'stories' | null
  downloads: Record<string, DownloadStatus>
  activeMediaId: string | null
  onDownload: (media: Media) => void
  onDownloadMany: (items: Media[]) => void
  onRetry: () => void
  onOpenFile: (id: string) => void
  folder: string
  folderError: string
  onSelectFolder: () => void
  onOpenFolder: (id?: string) => void
  desktopAvailable: boolean
}

function formatDuration(seconds: number) {
  const total = Math.max(0, Math.round(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function completedFile(downloads: Record<string, DownloadStatus>, media: Media) {
  if (!media.filename) return false
  return Object.values(downloads).some(download => download.state === 'completed' && (
    download.filename === media.filename ||
    (download.filename && media.filename && download.filename.replace(/\s\(\d+\)(?=\.[^.]+$)/, '') === media.filename)
  ))
}

type VideoCardProps = {
  item: Media
  index: number
  kind: string
  selected: boolean
  downloading: boolean
  complete: boolean
  onToggle: () => void
  onDownload: () => void
}

function VideoCard({ item, index, kind, selected, downloading, complete, onToggle, onDownload }: VideoCardProps) {
  const [posterFailed, setPosterFailed] = useState(false)
  const posterReady = Boolean(item.videoPreviewUrl) && item.previewUrl !== item.videoPreviewUrl
  return (
    <MotionCard index={index} className={`video-card ${selected ? 'is-selected' : ''} ${complete ? 'is-complete' : ''}`.trim()}>
      <div className="video-card__thumb">
        {posterReady && !posterFailed ? (
          <img src={item.previewUrl} alt={`Miniatura do ${kind.toLowerCase()} encontrado`} loading="lazy" onError={() => setPosterFailed(true)} />
        ) : (
          <video src={item.videoPreviewUrl ?? item.previewUrl} muted preload="metadata" tabIndex={-1} aria-hidden="true" />
        )}
        <span className="video-card__kind"><IconVideo size={12} />{kind}</span>
        <span className="video-card__play" aria-hidden="true">
          <span>{downloading ? <LoadingSpinner size="sm" label="Preparando" /> : <IconPlay size={16} />}</span>
        </span>
        {item.duration && item.duration > 0 ? <span className="video-card__duration">{formatDuration(item.duration)}</span> : null}
        {complete ? <span className="media-complete" aria-label="Download concluído"><IconCheck size={15} /></span> : null}
        <button
          type="button"
          className="video-card__select"
          aria-pressed={selected}
          aria-label={`Selecionar vídeo ${index + 1}`}
          onClick={onToggle}
        >
          <IconCheck size={13} />
        </button>
      </div>
      <div className="video-card__body">
        <strong>{complete ? `${kind} salvo em MP4` : `Vídeo do ${kind.toLowerCase()}`}</strong>
        <ul className="video-card__meta">
          <li><IconClock size={13} /><span>Duração</span><b>{item.duration && item.duration > 0 ? formatDuration(item.duration) : 'Não informada'}</b></li>
          <li><IconExpand size={13} /><span>Resolução</span><b>{item.width && item.height ? `${item.width} × ${item.height}` : 'Não informada'}</b></li>
          <li><IconFilm size={13} /><span>Formato</span><b>{(item.format ?? 'arquivo').toUpperCase()}</b></li>
        </ul>
        <a
          className={`media-download ${downloading ? 'is-active' : ''}`.trim()}
          href={item.downloadUrl}
          onClick={(event: MouseEvent<HTMLAnchorElement>) => {
            if (!window.desktop) return
            event.preventDefault()
            onDownload()
          }}
          aria-busy={downloading || undefined}
        >
          {downloading ? <LoadingSpinner size="sm" label="Preparando download" /> : <IconDownload size={15} />}
          <span>{downloading ? 'Preparando…' : complete ? 'Baixar novamente' : 'Baixar vídeo'}</span>
        </a>
      </div>
    </MotionCard>
  )
}

export function VideosPage({
  url,
  onUrlChange,
  onSubmit,
  onPaste,
  loading,
  status,
  videos,
  videoTotal,
  linkKind,
  downloads,
  activeMediaId,
  onDownload,
  onDownloadMany,
  onRetry,
  onOpenFile,
  folder,
  folderError,
  onSelectFolder,
  onOpenFolder,
  desktopAvailable,
}: VideosPageProps) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    setSelected(new Set(videos.map(video => video.id)))
  }, [videos])

  const hasError = !loading && !videos.length && status?.type === 'error'
  const mixed = videoTotal > videos.length
  const allSelected = videos.length > 0 && selected.size === videos.length
  const selectedItems = videos.filter(video => selected.has(video.id))
  const busy = activeMediaId !== null

  const toggle = (id: string) => {
    setSelected(previous => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(videos.map(video => video.id)))
  }
  const downloadSelected = () => {
    if (!selectedItems.length || busy) return
    onDownloadMany(selectedItems)
  }

  const kindFor = (item: Media) =>
    linkKind === 'reel' ? 'Reel'
      : linkKind === 'stories' ? 'Story'
        : mixed ? 'Carrossel'
          : 'Publicação'

  return (
    <div className="videos-page">
      <VideoHero />
      <VideoComposer url={url} onUrlChange={onUrlChange} onSubmit={onSubmit} onPaste={onPaste} loading={loading} />
      <FolderBar folder={folder} error={folderError} onSelect={onSelectFolder} onOpen={() => onOpenFolder()} available={desktopAvailable} />
      <StatusBanner status={status} />
      <section className="media-panel" aria-label="Vídeos encontrados" aria-busy={loading || undefined}>
        <div className="panel-heading">
          <div className="panel-heading__title"><IconVideo size={16} /><h2>Vídeos encontrados</h2></div>
          <span aria-live="polite">
            {loading
              ? 'Buscando vídeos…'
              : videos.length
                ? `${videos.length} vídeo${videos.length === 1 ? '' : 's'} disponível${videos.length === 1 ? '' : 'is'}`
                : hasError ? 'Nenhum vídeo' : 'Aguardando um link…'}
          </span>
        </div>
        <div className="media-scroll" tabIndex={0} aria-label="Lista de vídeos">
          {loading ? (
            <div className="skeleton-grid" aria-label="Carregando vídeos">
              {Array.from({ length: 3 }, (_, index) => (
                <div className="skeleton-card" key={index} style={{ animationDelay: `${index * 90}ms` }}>
                  <span className="skeleton-card__preview" />
                  <span className="skeleton-card__line skeleton-card__line--short" />
                  <span className="skeleton-card__line" />
                  <span className="skeleton-card__button" />
                </div>
              ))}
            </div>
          ) : videos.length ? (
            <div className="video-content">
              {videos.length > 1 || mixed ? (
                <div className="video-content__bar">
                  {videos.length > 1 ? (
                    <label className="video-select-all">
                      <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Selecionar todos os vídeos" />
                      <span>Selecionar todos</span>
                    </label>
                  ) : null}
                  {videos.length > 1 ? (
                    <span className="video-content__hint">
                      {selected.size} de {videos.length} selecionado{selected.size === 1 ? '' : 's'}
                    </span>
                  ) : null}
                  <GlowButton
                    size="sm"
                    variant="primary"
                    icon={<IconDownload size={15} />}
                    disabled={!selectedItems.length || busy}
                    onClick={downloadSelected}
                  >
                    Baixar {selectedItems.length === 1 ? 'vídeo' : `seleção (${selectedItems.length})`}
                  </GlowButton>
                </div>
              ) : null}
              {mixed ? (
                <p className="video-content__note">
                  <IconImage size={13} />
                  Esta publicação também contém imagens — elas continuam disponíveis no menu Imagens.
                </p>
              ) : null}
              <div className="video-results">
                {videos.map((item, index) => (
                  <VideoCard
                    key={item.id}
                    item={item}
                    index={index}
                    kind={kindFor(item)}
                    selected={selected.has(item.id)}
                    downloading={activeMediaId === item.id}
                    complete={completedFile(downloads, item)}
                    onToggle={() => toggle(item.id)}
                    onDownload={() => onDownload(item)}
                  />
                ))}
              </div>
            </div>
          ) : hasError ? (
            <div className="media-error">
              <span className="media-error__icon" aria-hidden="true"><IconAlert size={28} /></span>
              <strong>Não foi possível encontrar os vídeos</strong>
              <p>{status?.message}</p>
              <GlowButton size="sm" icon={<IconRefresh size={15} />} onClick={onRetry}>Tentar novamente</GlowButton>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-orbit" aria-hidden="true">
                <span className="empty-orbit__ring empty-orbit__ring--one" />
                <span className="empty-orbit__ring empty-orbit__ring--two" />
                <span className="empty-orbit__ring empty-orbit__ring--three" />
                <span className="empty-orbit__icon"><IconVideo size={28} /></span>
              </div>
              <strong>Tudo pronto para o vídeo</strong>
              <p>Cole o link de um Reel, story ou publicação para encontrar os vídeos disponíveis.</p>
            </div>
          )}
        </div>
      </section>
      <DownloadActivity downloads={downloads} onOpenFile={onOpenFile} onOpenFolder={onOpenFolder} />
    </div>
  )
}
