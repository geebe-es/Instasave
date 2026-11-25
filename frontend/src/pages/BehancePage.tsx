import type { FormEvent } from 'react'
import { Composer } from '../components/Composer'
import { DownloadActivity } from '../components/Downloads'
import { FolderBar } from '../components/FolderBar'
import { MediaPanel } from '../components/MediaPanel'
import { StatusBanner } from '../components/StatusBanner'
import { IconBehance, IconSparkles } from '../components/Icons'
import type { Media, Status } from '../types'

type BehancePageProps = {
  url: string
  onUrlChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onPaste: () => void
  onDropLink: (value: string) => void
  loading: boolean
  status: Status
  media: Media[]
  title: string
  downloads: Record<string, DownloadStatus>
  activeMediaId: string | null
  onDownload: (media: Media) => void
  onDownloadAll: (items: Media[]) => void
  onRetry: () => void
  onOpenFile: (id: string) => void
  folder: string
  folderError: string
  onSelectFolder: () => void
  onOpenFolder: (id?: string) => void
  desktopAvailable: boolean
}

export function BehancePage({
  url,
  onUrlChange,
  onSubmit,
  onPaste,
  onDropLink,
  loading,
  status,
  media,
  title,
  downloads,
  activeMediaId,
  onDownload,
  onDownloadAll,
  onRetry,
  onOpenFile,
  folder,
  folderError,
  onSelectFolder,
  onOpenFolder,
  desktopAvailable,
}: BehancePageProps) {
  return (
    <div className="download-page behance-page">
      <section className="page-intro behance-intro">
        <span className="page-kicker"><IconBehance size={14} />Portfólios</span>
        <h1>Baixar imagens do <span>Behance</span></h1>
        <p>Cole o link de um projeto público para salvar todas as imagens em PNG, na maior resolução disponível.</p>
        <div className="behance-intro__badges">
          <span><IconSparkles size={13} />Até 3840 px</span>
          <span><IconSparkles size={13} />Download em lote</span>
          <span><IconSparkles size={13} />Projetos públicos</span>
        </div>
      </section>
      <Composer
        url={url}
        onUrlChange={onUrlChange}
        onSubmit={onSubmit}
        onPaste={onPaste}
        loading={loading}
        placeholder="Cole o link do projeto do Behance..."
        submitLabel="Analisar projeto"
        ariaLabel="Link do projeto do Behance"
        onDropLink={onDropLink}
      />
      <FolderBar folder={folder} error={folderError} onSelect={onSelectFolder} onOpen={() => onOpenFolder()} available={desktopAvailable} />
      <StatusBanner status={status} />
      {title ? <div className="behance-project"><IconBehance size={15} /><span>{title}</span></div> : null}
      <MediaPanel
        media={media}
        loading={loading}
        status={status}
        downloads={downloads}
        activeMediaId={activeMediaId}
        onDownload={onDownload}
        onRetry={onRetry}
        title="Imagens do projeto"
        emptyTitle="Seu próximo portfólio começa aqui"
        emptyText="Cole o link de um projeto do Behance para encontrar todas as imagens disponíveis."
        onDownloadAll={onDownloadAll}
      />
      <DownloadActivity downloads={downloads} onOpenFile={onOpenFile} onOpenFolder={onOpenFolder} />
    </div>
  )
}
