import { IconAlert, IconCheck, IconDownload, IconFolderOpen, IconImage, IconVideo } from './Icons'
import { GlassPanel } from './ui/GlassPanel'
import { ProgressBar } from './ui/ProgressBar'

type DownloadActions = {
  onOpenFile: (id: string) => void
  onOpenFolder: (id?: string) => void
}

function stateLabel(value: DownloadStatus) {
  if (value.state === 'completed') return 'Download concluído!'
  if (value.state === 'error') return value.message ?? 'Download interrompido. Tente novamente.'
  if (value.percent === 0) return 'Preparando download…'
  return value.percent == null ? 'Baixando…' : `Baixando… ${value.percent}%`
}

function progressState(value: DownloadStatus): 'preparing' | 'downloading' | 'completed' | 'error' {
  if (value.state === 'completed') return 'completed'
  if (value.state === 'error') return 'error'
  return value.percent === 0 ? 'preparing' : 'downloading'
}

function isVideoFile(filename?: string) {
  return Boolean(filename && /\.(mp4|mov|webm)$/i.test(filename))
}

export function DownloadRow({ value, id, onOpenFile, onOpenFolder }: { value: DownloadStatus; id: string } & DownloadActions) {
  const completed = value.state === 'completed'
  const error = value.state === 'error'
  return (
    <div className={`download-state ${completed ? 'is-complete' : ''} ${error ? 'is-error' : ''}`.trim()} role="status">
      <div className="download-state__head">
        <span className={`download-state__badge download-state__badge--${value.state}`} aria-hidden="true">
          {completed ? <IconCheck size={16} /> : error ? <IconAlert size={16} /> : isVideoFile(value.filename) ? <IconVideo size={16} /> : <IconImage size={16} />}
        </span>
        <div className="download-state__text">
          <strong>{stateLabel(value)}</strong>
          <small title={value.filename}>{value.filename ?? 'Arquivo de mídia'}</small>
        </div>
        {completed ? (
          <span className="download-state__actions">
            <button type="button" className="mini-action" onClick={() => onOpenFile(id)}>Abrir arquivo</button>
            <button type="button" className="mini-action mini-action--ghost" onClick={() => onOpenFolder(id)}>
              <IconFolderOpen size={13} />Abrir pasta
            </button>
          </span>
        ) : null}
      </div>
      {value.state === 'progress' ? (
        <ProgressBar percent={value.percent ?? null} state={progressState(value)} compact label={value.filename ? `Progresso de ${value.filename}` : 'Progresso do download'} />
      ) : null}
      {error ? <p className="download-state__error">{value.message ?? 'Não foi possível concluir o download.'}</p> : null}
    </div>
  )
}

export function DownloadActivity({ downloads, onOpenFile, onOpenFolder }: { downloads: Record<string, DownloadStatus> } & DownloadActions) {
  const entries = Object.entries(downloads)
  if (!entries.length) return null
  return (
    <GlassPanel className="download-activity" aria-label="Atividade de downloads">
      <div className="panel-heading panel-heading--compact">
        <div className="panel-heading__title"><IconDownload size={15} /><h2>Atividade</h2></div>
        <span>{entries.length} nesta sessão</span>
      </div>
      <div className="download-list" tabIndex={0} aria-label="Lista de downloads">
        {entries.map(([id, value]) => (
          <DownloadRow key={id} id={id} value={value} onOpenFile={onOpenFile} onOpenFolder={onOpenFolder} />
        ))}
      </div>
    </GlassPanel>
  )
}

export function DownloadHistory({ downloads, onOpenFile, onOpenFolder }: { downloads: Record<string, DownloadStatus> } & DownloadActions) {
  const entries = Object.entries(downloads)
  return (
    <GlassPanel className="history-panel" aria-label="Histórico de downloads">
      <span className="history-panel__watermark" aria-hidden="true"><IconDownload size={190} /></span>
      <div className="panel-heading">
        <div className="panel-heading__title"><IconDownload size={16} /><h2>Downloads desta sessão</h2></div>
        <span>{entries.length ? `${entries.length} arquivo${entries.length === 1 ? '' : 's'}` : 'Nenhum arquivo'}</span>
      </div>
      {entries.length ? (
        <div className="download-list download-list--full" tabIndex={0} aria-label="Lista de downloads">
          {entries.map(([id, value]) => (
            <DownloadRow key={id} id={id} value={value} onOpenFile={onOpenFile} onOpenFolder={onOpenFolder} />
          ))}
          <div className="download-list__tail">
            <span aria-hidden="true" />
            <small>Fim da atividade desta sessão</small>
            <span aria-hidden="true" />
          </div>
        </div>
      ) : (
        <div className="history-empty">
          <span className="history-empty__icon" aria-hidden="true"><IconDownload size={26} /></span>
          <strong>Nenhum download nesta sessão</strong>
          <p>Os arquivos concluídos aparecerão aqui enquanto o aplicativo estiver aberto.</p>
        </div>
      )}
    </GlassPanel>
  )
}
