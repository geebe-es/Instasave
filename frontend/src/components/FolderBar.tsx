import { IconFolder, IconFolderOpen } from './Icons'
import { GlowButton } from './ui/GlowButton'

type FolderBarProps = {
  folder: string
  error?: string
  onSelect: () => void
  onOpen: () => void
  available: boolean
}

export function FolderBar({ folder, error, onSelect, onOpen, available }: FolderBarProps) {
  return (
    <div className="folder-bar">
      <div className="folder-bar__path">
        <span className="folder-bar__label"><IconFolder size={14} />Pasta de destino</span>
        <small title={folder}>{folder || 'Carregando pasta…'}</small>
      </div>
      <div className="folder-bar__actions">
        <GlowButton size="sm" icon={<IconFolder size={15} />} onClick={onSelect} disabled={!available}>Escolher pasta</GlowButton>
        <GlowButton size="sm" icon={<IconFolderOpen size={15} />} onClick={onOpen} disabled={!available}>Abrir pasta</GlowButton>
      </div>
      {error ? <p className="folder-bar__error" role="alert">{error}</p> : null}
    </div>
  )
}
