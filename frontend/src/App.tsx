import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { AnimatedBackground } from './components/motion/AnimatedBackground'
import { DesktopTitlebar } from './Desktop'
import { Header } from './components/Header'
import { IconImage } from './components/Icons'
import { LoadingSpinner } from './components/ui/LoadingSpinner'
import { useToast } from './components/ui/Toast'
import { useSystemReducedMotion } from './hooks/useReducedMotion'
import { DownloadPage } from './pages/DownloadPage'
import { HistoryPage } from './pages/HistoryPage'
import { SettingsPage } from './pages/SettingsPage'
import { UpdatesPage } from './pages/UpdatesPage'
import { VideosPage } from './pages/VideosPage'
import type { AppInfo, Media, Page, Status } from './types'

function isInstagramUrl(value: string) {
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    if (url.protocol !== 'https:' || (host !== 'instagram.com' && host !== 'www.instagram.com')) return false
    if (url.port || url.username || url.password) return false
    return /^\/(p|reel|reels)\/[A-Za-z0-9_-]{5,80}\/?$/i.test(url.pathname)
  } catch {
    return false
  }
}

type VideoLinkKind = 'post' | 'reel' | 'stories'

function detectVideoLinkKind(value: string): VideoLinkKind | null {
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    if (url.protocol !== 'https:' || (host !== 'instagram.com' && host !== 'www.instagram.com')) return null
    if (url.port || url.username || url.password) return null
    const reel = /^\/reels?\/[A-Za-z0-9_-]{5,80}\/?$/i.exec(url.pathname)
    if (reel) return 'reel'
    if (/^\/p\/[A-Za-z0-9_-]{5,80}\/?$/i.test(url.pathname)) return 'post'
    if (/^\/stories\/[A-Za-z0-9._]{1,80}\/\d{8,32}\/?$/i.test(url.pathname)) return 'stories'
    return null
  } catch {
    return null
  }
}

function initialMotionPreference() {
  try {
    return localStorage.getItem('instasave:reduce-motion') === 'true'
  } catch {
    return false
  }
}

export function App() {
  const [page, setPage] = useState<Page>('download')
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState<Status>(null)
  const [media, setMedia] = useState<Media[]>([])
  const [loading, setLoading] = useState(false)
  const [downloads, setDownloads] = useState<Record<string, DownloadStatus>>({})
  const [activeMediaId, setActiveMediaId] = useState<string | null>(null)
  const [folder, setFolder] = useState('')
  const [folderError, setFolderError] = useState('')
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [reduceMotion, setReduceMotion] = useState(initialMotionPreference)
  const [booting, setBooting] = useState(true)
  const [videoUrl, setVideoUrl] = useState('')
  const [videos, setVideos] = useState<Media[]>([])
  const [videoTotal, setVideoTotal] = useState(0)
  const [videoKind, setVideoKind] = useState<VideoLinkKind | null>(null)
  const [videoStatus, setVideoStatus] = useState<Status>(null)
  const [videoLoading, setVideoLoading] = useState(false)
  const [videoQueue, setVideoQueue] = useState<Media[]>([])

  const systemReduced = useSystemReducedMotion()
  const pushToast = useToast()
  const loadingRef = useRef(false)
  const activeMediaRef = useRef<string | null>(null)
  const videoOwnedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const timer = window.setTimeout(() => setBooting(false), 1200)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (reduceMotion) root.dataset.motion = 'reduced'
    else delete root.dataset.motion
    try { localStorage.setItem('instasave:reduce-motion', String(reduceMotion)) } catch { /* preferência local opcional */ }
  }, [reduceMotion])

  useEffect(() => {
    if (!window.desktop) return
    window.desktop.getInfo()
      .then(value => { setInfo(value); setFolder(value.downloadFolder); setFolderError('') })
      .catch(() => setFolderError('Não foi possível ler a pasta de downloads.'))
  }, [])

  const openFolder = useCallback(async (id?: string) => {
    if (!window.desktop) return
    try {
      await window.desktop.openFolder(id)
    } catch {
      pushToast({ kind: 'error', title: 'Não foi possível abrir a pasta', message: 'Verifique se o destino ainda existe e tente novamente.' })
    }
  }, [pushToast])

  const openFile = useCallback(async (id: string) => {
    if (!window.desktop) return
    try {
      const message = await window.desktop.openFile(id)
      if (message) throw new Error(message)
    } catch {
      setStatus({ type: 'error', message: 'Não foi possível abrir o arquivo. Use Abrir pasta para localizá-lo.' })
      pushToast({ kind: 'error', title: 'Arquivo indisponível', message: 'Use Abrir pasta para localizar o download.' })
    }
  }, [pushToast])

  useEffect(() => {
    if (!window.desktop) return
    return window.desktop.onDownload(value => {
      const key = value.id ?? `pending-${Date.now()}-${Math.random().toString(16).slice(2)}`
      setDownloads(previous => ({ ...previous, [key]: value }))
      if (value.state === 'completed') {
        setStatus({ type: 'success', message: 'Download concluído!' })
        if (value.id && videoOwnedRef.current.has(value.id)) {
          setVideoStatus({ type: 'success', message: 'Download concluído!' })
        }
        setActiveMediaId(null)
        activeMediaRef.current = null
        pushToast({
          kind: 'success',
          title: 'Download concluído',
          message: value.filename ?? 'O arquivo foi salvo com sucesso.',
          action: value.id ? { label: 'Abrir pasta', onClick: () => { void openFolder(value.id) } } : undefined,
        })
      } else if (value.state === 'error') {
        setStatus({ type: 'error', message: value.message ?? 'Download interrompido. Tente novamente.' })
        if (value.id && videoOwnedRef.current.has(value.id)) {
          setVideoStatus({ type: 'error', message: value.message ?? 'Download interrompido. Tente novamente.' })
        }
        setActiveMediaId(null)
        activeMediaRef.current = null
        pushToast({ kind: 'error', title: 'Download interrompido', message: value.message ?? 'Tente novamente em instantes.' })
      } else {
        setStatus({ type: 'loading', message: 'Baixando…' })
      }
    })
  }, [openFolder, pushToast])

  const resolveLink = useCallback(async (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) {
      setStatus({ type: 'error', message: 'Insira um link válido do Instagram.' })
      return
    }
    if (!navigator.onLine) {
      setStatus({ type: 'error', message: 'Sem conexão com a internet. Verifique sua conexão e tente novamente.' })
      return
    }
    if (!isInstagramUrl(trimmed)) {
      setStatus({ type: 'error', message: 'Insira um link de publicação, Reel ou carrossel do Instagram.' })
      return
    }
    if (loadingRef.current) return
    loadingRef.current = true
    setLoading(true)
    setMedia([])
    setStatus({ type: 'loading', message: 'Analisando link público…' })
    try {
      const response = await fetch('/api/instagram/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      })
      const result = await response.json() as { success: boolean; error?: { message?: string }; data?: { media?: Media[] } }
      if (!response.ok || !result.success) throw new Error(result.error?.message ?? 'Não foi possível processar o link.')
      const found = result.data?.media ?? []
      setMedia(found)
      setStatus({ type: 'success', message: found.length ? `${found.length} imagem${found.length === 1 ? '' : 's'} completa${found.length === 1 ? '' : 's'} encontrada${found.length === 1 ? '' : 's'}.` : 'Nenhuma imagem disponível foi encontrada.' })
      if (found.length) pushToast({ kind: 'success', title: 'Imagens encontradas', message: `${found.length} imagem${found.length === 1 ? '' : 's'} pronta${found.length === 1 ? '' : 's'} para baixar.` })
    } catch (error) {
      const message = error instanceof TypeError
        ? 'Não foi possível conectar. Verifique sua conexão com a internet e tente novamente.'
        : error instanceof Error ? error.message : 'Erro temporário.'
      setStatus({ type: 'error', message })
      pushToast({ kind: 'error', title: 'Não foi possível analisar o link', message })
    } finally {
      loadingRef.current = false
      setLoading(false)
    }
  }, [pushToast])

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void resolveLink(url)
  }

  const paste = async () => {
    try {
      const value = (await (window.desktop ? window.desktop.readClipboard() : navigator.clipboard.readText())).trim()
      setUrl(value)
      setStatus(null)
      if (value) pushToast({ kind: 'info', title: 'Link colado', message: 'Confira o link e clique em Baixar imagem.', duration: 2800 })
    } catch {
      setStatus({ type: 'error', message: 'Permita o acesso à área de transferência ou cole o link manualmente.' })
    }
  }

  const resolveVideo = useCallback(async (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) {
      setVideoStatus({ type: 'error', message: 'Insira um link de vídeo do Instagram.' })
      return
    }
    if (!navigator.onLine) {
      setVideoStatus({ type: 'error', message: 'Sem conexão com a internet. Verifique sua conexão e tente novamente.' })
      return
    }
    const kind = detectVideoLinkKind(trimmed)
    if (!kind) {
      setVideoStatus({ type: 'error', message: 'Insira um link válido de Reel, Stories, publicação ou carrossel com vídeo do Instagram.' })
      return
    }
    if (loadingRef.current) return
    loadingRef.current = true
    setVideoLoading(true)
    setVideos([])
    setVideoTotal(0)
    setVideoKind(kind)
    setVideoStatus({ type: 'loading', message: 'Verificando e analisando o vídeo…' })
    try {
      const response = await fetch('/api/instagram/video/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      })
      const result = await response.json() as {
        success: boolean
        error?: { message?: string }
        data?: { total?: number; totalMedia?: number; media?: Media[] }
      }
      if (!response.ok || !result.success) throw new Error(result.error?.message ?? 'Não foi possível processar o vídeo.')
      const found = result.data?.media ?? []
      const total = Math.max(result.data?.totalMedia ?? result.data?.total ?? found.length, found.length)
      setVideos(found)
      setVideoTotal(total)
      if (!found.length) {
        setVideoStatus({ type: 'error', message: 'Este link não contém vídeos. Use o menu Imagens para salvar imagens.' })
        return
      }
      if (found.length === 1) {
        setVideoStatus({ type: 'success', message: '1 vídeo encontrado. Download automático iniciado.' })
        pushToast({ kind: 'success', title: 'Vídeo encontrado', message: 'Download iniciado automaticamente.' })
        setVideoQueue(previous => [...previous, found[0]])
      } else {
        setVideoStatus({ type: 'success', message: `${found.length} vídeos encontrados. Selecione os que deseja baixar.` })
        pushToast({ kind: 'success', title: 'Vídeos encontrados', message: 'Selecione os vídeos e confirme o download.' })
      }
    } catch (error) {
      const message = error instanceof TypeError
        ? 'Não foi possível conectar. Verifique sua conexão com a internet e tente novamente.'
        : error instanceof Error ? error.message : 'Erro temporário.'
      setVideoStatus({ type: 'error', message })
      pushToast({ kind: 'error', title: 'Não foi possível analisar o vídeo', message })
    } finally {
      loadingRef.current = false
      setVideoLoading(false)
    }
  }, [pushToast])

  const submitVideo = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void resolveVideo(videoUrl)
  }

  const pasteVideo = async () => {
    try {
      const value = (await (window.desktop ? window.desktop.readClipboard() : navigator.clipboard.readText())).trim()
      setVideoUrl(value)
      setVideoStatus(null)
      if (value) pushToast({ kind: 'info', title: 'Link colado', message: 'Confira o link e clique em Baixar vídeo.', duration: 2800 })
    } catch {
      setVideoStatus({ type: 'error', message: 'Permita o acesso à área de transferência ou cole o link manualmente.' })
    }
  }

  const selectFolder = useCallback(async () => {
    if (!window.desktop) return
    try {
      const next = await window.desktop.selectFolder()
      setFolder(next)
      setFolderError('')
      setInfo(previous => previous ? { ...previous, downloadFolder: next } : previous)
      pushToast({ kind: 'success', title: 'Pasta atualizada', message: next })
    } catch {
      setFolderError('Não foi possível selecionar a pasta.')
      pushToast({ kind: 'error', title: 'Pasta não alterada', message: 'Escolha uma pasta válida e tente novamente.' })
    }
  }, [pushToast])

  const startDownload = useCallback(async (item: Media) => {
    if (!window.desktop) return
    if (activeMediaRef.current) return
    activeMediaRef.current = item.id
    setActiveMediaId(item.id)
    setStatus({ type: 'loading', message: 'Preparando download…' })
    try {
      await window.desktop.download(item.id)
    } catch {
      activeMediaRef.current = null
      setActiveMediaId(null)
      setStatus({ type: 'error', message: 'Não foi possível iniciar o download.' })
      pushToast({ kind: 'error', title: 'Download não iniciado', message: 'Tente novamente em instantes.' })
    }
  }, [pushToast])

  const downloadMany = useCallback((items: Media[]) => {
    setVideoQueue(previous => [...previous, ...items.filter(item => item.id !== activeMediaRef.current)])
  }, [])

  const downloadVideo = useCallback((item: Media) => {
    downloadMany([item])
  }, [downloadMany])

  // Sequential video queue: one download at a time, ever. The next item starts
  // as soon as the previous one completes or fails (activeMediaId back to null).
  useEffect(() => {
    if (!videoQueue.length) return
    if (activeMediaRef.current) return
    const [next, ...rest] = videoQueue
    setVideoQueue(rest)
    videoOwnedRef.current.add(next.id)
    void startDownload(next)
  }, [videoQueue, activeMediaId, startDownload])

  const desktopAvailable = Boolean(window.desktop)
  const busy = loading || status?.type === 'loading'
  // Estado do banner de vídeo: durante um download acionado pelo menu Vídeos,
  // espelha o estado real do download; fora disso, usa a análise local do vídeo.
  const activeVideoStatus = activeMediaId !== null && (videoOwnedRef.current.has(activeMediaId) || videos.some(video => video.id === activeMediaId))
    ? status
    : videoStatus

  return (
    <div className={`app-shell ${booting ? 'is-booting' : ''}`.trim()}>
      <AnimatedBackground />
      <DesktopTitlebar />
      <Header
        page={page}
        onPageChange={setPage}
        loading={loading}
        mediaCount={media.length}
        videoCount={videos.length}
        videoLoading={videoLoading}
        status={status}
      />
      <main className="app-main">
        <div className="page-stage" key={page}>
          {page === 'download' ? (
            <DownloadPage
              url={url}
              onUrlChange={setUrl}
              onSubmit={submit}
              onPaste={paste}
              loading={loading}
              status={status}
              media={media}
              downloads={downloads}
              activeMediaId={activeMediaId}
              onDownload={startDownload}
              onOpenFile={openFile}
              onRetry={() => resolveLink(url)}
              folder={folder}
              folderError={folderError}
              onSelectFolder={selectFolder}
              onOpenFolder={openFolder}
              desktopAvailable={desktopAvailable}
            />
          ) : null}
          {page === 'videos' ? (
            <VideosPage
              url={videoUrl}
              onUrlChange={setVideoUrl}
              onSubmit={submitVideo}
              onPaste={pasteVideo}
              loading={videoLoading}
              status={activeVideoStatus}
              videos={videos}
              videoTotal={videoTotal}
              linkKind={videoKind}
              downloads={downloads}
              activeMediaId={activeMediaId}
              onDownload={downloadVideo}
              onDownloadMany={downloadMany}
              onRetry={() => resolveVideo(videoUrl)}
              onOpenFile={openFile}
              folder={folder}
              folderError={folderError}
              onSelectFolder={selectFolder}
              onOpenFolder={openFolder}
              desktopAvailable={desktopAvailable}
            />
          ) : null}
          {page === 'history' ? (
            <HistoryPage
              downloads={downloads}
              onOpenFile={openFile}
              onOpenFolder={openFolder}
              folder={folder}
              desktopAvailable={desktopAvailable}
            />
          ) : null}
          {page === 'settings' ? (
            <SettingsPage
              folder={folder}
              folderError={folderError}
              onSelectFolder={selectFolder}
              onOpenFolder={() => { void openFolder() }}
              desktopAvailable={desktopAvailable}
              version={info?.version ?? ''}
              systemReduced={systemReduced}
              reduceMotion={reduceMotion}
              onReduceMotionChange={setReduceMotion}
            />
          ) : null}
          {page === 'updates' ? <UpdatesPage version={info?.version ?? ''} /> : null}
        </div>
      </main>
      <footer className="app-footer">
        <span className="app-footer__note"><IconImage size={14} />Imagens salvas automaticamente em PNG.</span>
        <span className={`app-footer__status ${busy ? 'is-loading' : ''}`.trim()}>
          {busy ? <LoadingSpinner size="sm" label="Processando" /> : <span className="app-footer__dot" aria-hidden="true" />}
          {busy ? 'Processando…' : 'Pronto para download'}
        </span>
      </footer>
    </div>
  )
}
