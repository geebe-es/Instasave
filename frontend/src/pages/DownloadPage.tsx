import type { FormEvent } from 'react'
import { Composer } from '../components/Composer'
import { DownloadActivity } from '../components/Downloads'
import { FolderBar } from '../components/FolderBar'
import { Hero } from '../components/Hero'
import { MediaPanel } from '../components/MediaPanel'
import { StatusBanner } from '../components/StatusBanner'
import type { Media, Status } from '../types'

type DownloadPageProps = {
  url: string
  onUrlChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onPaste: () => void
  loading: boolean
  status: Status
  media: Media[]
  downloads: Record<string, DownloadStatus>
  activeMediaId: string | null
  onDownload: (media: Media) => void
  onOpenFile: (id: string) => void
  onRetry: () => void
  folder: string
  folderError: string
  onSelectFolder: () => void
  onOpenFolder: (id?: string) => void
  desktopAvailable: boolean
}

export function DownloadPage({
  url,
  onUrlChange,
  onSubmit,
  onPaste,
  loading,
  status,
  media,
  downloads,
  activeMediaId,
  onDownload,
  onOpenFile,
  onRetry,
  folder,
  folderError,
  onSelectFolder,
  onOpenFolder,
  desktopAvailable,
}: DownloadPageProps) {
  return (
    <div className="download-page">
      <Hero />
      <Composer url={url} onUrlChange={onUrlChange} onSubmit={onSubmit} onPaste={onPaste} loading={loading} />
      <FolderBar folder={folder} error={folderError} onSelect={onSelectFolder} onOpen={() => onOpenFolder()} available={desktopAvailable} />
      <StatusBanner status={status} />
      <MediaPanel
        media={media}
        loading={loading}
        status={status}
        downloads={downloads}
        activeMediaId={activeMediaId}
        onDownload={onDownload}
        onRetry={onRetry}
      />
      <DownloadActivity downloads={downloads} onOpenFile={onOpenFile} onOpenFolder={onOpenFolder} />
    </div>
  )
}
