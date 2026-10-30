export function DesktopTitlebar() {
  if (!window.desktop) return null
  return (
    <div className="desktop-titlebar">
      <div className="desktop-titlebar__brand">
        <img src="/brand/instasave-icon.svg" alt="" />
        <span>InstaSave</span>
        <span className="desktop-titlebar__dot" aria-hidden="true" />
      </div>
      <section className="desktop-titlebar__controls">
        <button aria-label="Minimizar" onClick={() => window.desktop!.minimize()}><span aria-hidden="true">─</span></button>
        <button aria-label="Maximizar ou restaurar" onClick={() => window.desktop!.maximize()}><span aria-hidden="true">□</span></button>
        <button aria-label="Fechar aplicativo" onClick={() => window.desktop!.close()}><span aria-hidden="true">×</span></button>
      </section>
    </div>
  )
}
