import { FolderBar } from '../components/FolderBar'
import { IconInfo, IconSettings, IconShield, IconSparkles, IconUser } from '../components/Icons'
import { GlassPanel } from '../components/ui/GlassPanel'
import { GlowButton } from '../components/ui/GlowButton'

type SettingsPageProps = {
  folder: string
  folderError: string
  onSelectFolder: () => void
  onOpenFolder: () => void
  desktopAvailable: boolean
  version: string
  systemReduced: boolean
  reduceMotion: boolean
  onReduceMotionChange: (value: boolean) => void
  accountConnected: boolean
  onConnectAccount: () => void
  onDisconnectAccount: () => void
}

export function SettingsPage({
  folder,
  folderError,
  onSelectFolder,
  onOpenFolder,
  desktopAvailable,
  version,
  systemReduced,
  reduceMotion,
  onReduceMotionChange,
  accountConnected,
  onConnectAccount,
  onDisconnectAccount,
}: SettingsPageProps) {
  const motionReduced = systemReduced || reduceMotion
  return (
    <div className="inner-page settings-page">
      <div className="page-heading">
        <div>
          <span className="page-kicker"><IconSettings size={14} />Preferências</span>
          <h1>Configurações</h1>
          <p>Ajuste o destino dos arquivos e a intensidade das animações.</p>
        </div>
      </div>

      <div className="settings-grid">
        <GlassPanel className="settings-card settings-card--folder">
          <div className="settings-card__heading">
            <span className="settings-card__icon"><IconSettings size={18} /></span>
            <div><h2>Pasta de downloads</h2><p>Onde as imagens e os vídeos serão salvos.</p></div>
          </div>
          <FolderBar
            folder={folder}
            error={folderError}
            onSelect={onSelectFolder}
            onOpen={onOpenFolder}
            available={desktopAvailable}
          />
        </GlassPanel>

        <GlassPanel className="settings-card">
          <div className="settings-card__heading">
            <span className="settings-card__icon settings-card__icon--pink"><IconSparkles size={18} /></span>
            <div><h2>Aparência</h2><p>Movimento e efeitos visuais da interface.</p></div>
          </div>
          <div className="setting-row">
            <div>
              <strong>Reduzir animações</strong>
              <small>{systemReduced ? 'O sistema está solicitando movimento reduzido.' : 'Desativa ondas, partículas e transições mais longas.'}</small>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={motionReduced}
              aria-label="Reduzir animações"
              className={`switch ${motionReduced ? 'is-on' : ''}`.trim()}
              disabled={systemReduced}
              onClick={() => onReduceMotionChange(!reduceMotion)}
            >
              <span className="switch__thumb" />
            </button>
          </div>
        </GlassPanel>

        <GlassPanel className="settings-card settings-card--account">
          <div className="settings-card__heading">
            <span className="settings-card__icon settings-card__icon--blue"><IconUser size={18} /></span>
            <div><h2>Conta do Instagram</h2><p>Opcional. Melhora a análise de publicações restritas.</p></div>
          </div>
          <div className="setting-row">
            <div>
              <strong>{accountConnected ? 'Conta conectada' : 'Acesso público'}</strong>
              <small>
                {accountConnected
                  ? 'O InstaSave usa os cookies da sessão criada na janela de login. Nenhuma senha é armazenada.'
                  : 'Sem conta, o Instagram pode bloquear algumas publicações. Conectar só é necessário nesses casos.'}
              </small>
            </div>
            <span className={`account-badge ${accountConnected ? 'is-on' : ''}`.trim()} aria-hidden="true">
              {accountConnected ? 'Ativa' : 'Pública'}
            </span>
          </div>
          <div className="setting-actions">
            {accountConnected ? (
              <GlowButton size="sm" variant="secondary" onClick={onDisconnectAccount}>Desconectar conta</GlowButton>
            ) : (
              <GlowButton size="sm" variant="secondary" icon={<IconUser size={15} />} disabled={!desktopAvailable} onClick={onConnectAccount}>
                Conectar conta
              </GlowButton>
            )}
            <small>O login abre dentro do próprio InstaSave; nenhuma credencial passa pelo servidor local.</small>
          </div>
        </GlassPanel>

        <GlassPanel className="settings-card settings-card--wide settings-card--about">
          <div className="settings-card__heading">
            <span className="settings-card__icon settings-card__icon--violet"><IconInfo size={18} /></span>
            <div><h2>Sobre o InstaSave</h2><p>Informações desta instalação.</p></div>
          </div>
          <div className="about-grid">
            <div><small>Versão</small><strong>v{version || '1.0.0'}</strong></div>
            <div><small>Formato das imagens</small><strong>PNG sem perdas</strong></div>
            <div><small>Conteúdo</small><strong><IconShield size={14} />Respeita o acesso da conta</strong></div>
          </div>
        </GlassPanel>
      </div>
    </div>
  )
}
