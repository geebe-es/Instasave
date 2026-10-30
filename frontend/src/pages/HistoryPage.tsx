import { DownloadHistory } from '../components/Downloads'
import { IconCheck, IconDownload, IconFolderOpen, IconHistory, IconRefresh } from '../components/Icons'
import { GlowButton } from '../components/ui/GlowButton'
import { GlassPanel } from '../components/ui/GlassPanel'

type HistoryPageProps = {
  downloads: Record<string, DownloadStatus>
  onOpenFile: (id: string) => void
  onOpenFolder: (id?: string) => void
  folder: string
  desktopAvailable: boolean
}

export function HistoryPage({ downloads, onOpenFile, onOpenFolder, folder, desktopAvailable }: HistoryPageProps) {
  const entries = Object.values(downloads)
  const completed = entries.filter(item => item.state === 'completed').length
  const active = entries.filter(item => item.state === 'progress').length
  return (
    <div className="inner-page history-page">
      <div className="page-heading">
        <div>
          <span className="page-kicker"><IconHistory size={14} />Atividade</span>
          <h1>Histórico de downloads</h1>
          <p>Acompanhe os arquivos iniciados nesta sessão do InstaSave.</p>
        </div>
        <GlowButton icon={<IconFolderOpen size={16} />} onClick={() => onOpenFolder()} disabled={!desktopAvailable}>Abrir pasta</GlowButton>
      </div>

      <div className="stats-row">
        <GlassPanel className="stat-card">
          <span className="stat-card__icon"><IconDownload size={18} /></span>
          <div><strong>{entries.length}</strong><small>Nesta sessão</small></div>
        </GlassPanel>
        <GlassPanel className="stat-card stat-card--success">
          <span className="stat-card__icon"><IconCheck size={18} /></span>
          <div><strong>{completed}</strong><small>Concluídos</small></div>
        </GlassPanel>
        <GlassPanel className="stat-card stat-card--active">
          <span className="stat-card__icon"><IconRefresh size={18} /></span>
          <div><strong>{active}</strong><small>Em andamento</small></div>
        </GlassPanel>
        <GlassPanel className="stat-card stat-card--folder">
          <span className="stat-card__icon"><IconFolderOpen size={18} /></span>
          <div><strong title={folder}>{folder ? folder.split(/[\\/]/).pop() : 'Pasta padrão'}</strong><small>Destino atual</small></div>
        </GlassPanel>
      </div>

      <DownloadHistory downloads={downloads} onOpenFile={onOpenFile} onOpenFolder={onOpenFolder} />
    </div>
  )
}
