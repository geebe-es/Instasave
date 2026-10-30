import { IconAlert, IconInfo, IconRefresh } from '../components/Icons'
import { GlowButton } from '../components/ui/GlowButton'
import { GlassPanel } from '../components/ui/GlassPanel'

export function UpdatesPage({ version }: { version: string }) {
  return (
    <div className="inner-page updates-page">
      <div className="page-heading">
        <div>
          <span className="page-kicker"><IconRefresh size={14} />Sistema</span>
          <h1>Atualizações</h1>
          <p>Consulte o estado do canal de atualizações desta instalação.</p>
        </div>
        <span className="status-chip status-chip--muted"><IconInfo size={14} />Instalação local</span>
      </div>

      <GlassPanel className="updates-card" glow>
        <div className="updates-card__visual" aria-hidden="true">
          <span className="updates-card__ring updates-card__ring--one" />
          <span className="updates-card__ring updates-card__ring--two" />
          <span className="updates-card__icon"><IconRefresh size={34} /></span>
        </div>
        <div className="updates-card__content">
          <span className="status-chip status-chip--warning"><IconAlert size={14} />Canal não configurado</span>
          <h2>Esta build não verifica atualizações automaticamente</h2>
          <p>O InstaSave está instalado localmente e nenhum canal de atualização foi conectado a esta versão. Nenhum download ou progresso é simulado nesta tela.</p>
          <div className="updates-card__meta">
            <span>Versão atual</span>
            <strong>v{version || '1.0.0'}</strong>
          </div>
          <GlowButton icon={<IconRefresh size={16} />} disabled title="Nenhum canal de atualização configurado">Verificar atualizações</GlowButton>
        </div>
      </GlassPanel>
    </div>
  )
}
