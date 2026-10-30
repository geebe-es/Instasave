import { IconAlert, IconSparkles } from './Icons'
import { LoadingSpinner } from './ui/LoadingSpinner'
import { Navigation } from './Navigation'
import type { Page, Status } from '../types'

type HeaderProps = {
  page: Page
  onPageChange: (page: Page) => void
  loading: boolean
  mediaCount: number
  videoCount: number
  videoLoading: boolean
  status: Status
}

export function Header({ page, onPageChange, loading, mediaCount, videoCount, videoLoading, status }: HeaderProps) {
  const resolving = loading && page === 'download'
  const resolvingVideo = videoLoading && page === 'videos'
  const downloading = (page === 'download' || page === 'videos') && !resolving && !resolvingVideo && status?.type === 'loading'
  const failed = (page === 'download' || page === 'videos') && status?.type === 'error'
  const working = resolving || downloading || resolvingVideo
  const statusText = page === 'download'
    ? resolving
      ? 'Analisando link…'
      : downloading
        ? 'Baixando…'
        : failed
          ? 'Atenção'
          : mediaCount > 0
            ? `${mediaCount} imagem${mediaCount === 1 ? '' : 's'} pronta${mediaCount === 1 ? '' : 's'}`
            : 'Pronto para imagens'
    : page === 'videos'
      ? resolvingVideo
        ? 'Analisando vídeo…'
        : downloading
          ? 'Baixando…'
          : failed
            ? 'Atenção'
            : videoCount > 0
              ? `${videoCount} vídeo${videoCount === 1 ? '' : 's'} pronto${videoCount === 1 ? '' : 's'}`
              : 'Pronto para vídeos'
      : page === 'history'
        ? 'Sessão local ativa'
        : page === 'settings'
          ? 'Preferências salvas'
          : 'Canal não configurado'
  const warning = page === 'updates'

  return (
    <header className="app-header">
      <div className="app-header__inner">
        <button type="button" className="brand" onClick={() => onPageChange('download')} aria-label="InstaSave — ir para Download">
          <span className="brand__mark"><img src="/brand/instasave-icon.svg" alt="" /></span>
          <span className="brand__word">Insta<i>Save</i></span>
        </button>
        <Navigation page={page} onChange={onPageChange} />
        <div className={`header-status ${working ? 'is-loading' : ''} ${warning ? 'is-warning' : ''} ${failed ? 'is-error' : ''}`.trim()}>
          {working
            ? <LoadingSpinner size="sm" label="Processando" />
            : warning || failed
              ? <IconAlert size={14} aria-hidden="true" />
              : <span className="header-status__dot" aria-hidden="true" />}
          <span>{statusText}</span>
          {page === 'download' && !working && !failed && mediaCount === 0 ? <IconSparkles size={14} className="header-status__spark" /> : null}
        </div>
      </div>
    </header>
  )
}
