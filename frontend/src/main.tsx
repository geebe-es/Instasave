import { FormEvent, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import './preview.css'

type Status = { type: 'loading' | 'error' | 'success'; message: string } | null
type Media = { id: string; type: 'image' | 'video'; downloadUrl: string; previewUrl: string; width?: number; height?: number; format?: string; filename?: string }

function App() {
  const [url, setUrl] = useState('')
  const [status, setStatus] = useState<Status>(null)
  const [media, setMedia] = useState<Media[]>([])
  const [loading, setLoading] = useState(false)
  const paste = async () => {
    try { setUrl(await navigator.clipboard.readText()) }
    catch { setStatus({ type: 'error', message: 'Permita o acesso à área de transferência ou cole o link manualmente.' }) }
  }
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!url.trim()) { setStatus({ type: 'error', message: 'Insira um link válido do Instagram.' }); return }
    setLoading(true); setMedia([]); setStatus({ type: 'loading', message: 'Analisando link público…' })
    try {
      const response = await fetch('/api/instagram/resolve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) })
      const result = await response.json() as { success: boolean; error?: { message?: string }; data?: { media?: Media[] } }
      if (!response.ok || !result.success) throw new Error(result.error?.message ?? 'Não foi possível processar o link.')
      const found = result.data?.media ?? []
      setMedia(found); setStatus({ type: 'success', message: `${found.length} mídia(s) completa(s) encontrada(s).` })
    } catch (error) { setStatus({ type: 'error', message: error instanceof Error ? error.message : 'Erro temporário.' }) }
    finally { setLoading(false) }
  }
  return <><div className="aurora one" /><div className="aurora two" />
    <header className="container"><a className="brand" href="#inicio"><img src="/brand/instasave-icon.svg" alt=""/><span>Insta<i>Save</i></span></a><nav><a href="#como">Como funciona</a><a href="#faq">FAQ</a><a className="nav-cta" href="#baixar">Baixar agora ↓</a></nav></header>
    <main><section className="hero container" id="inicio"><div className="eyebrow"><b/> Rápido, simples e seguro</div><h1>Baixe imagens e vídeos do Instagram <em>em alta qualidade.</em></h1><p className="lead">Cole o link de uma publicação pública e faça o download da mídia disponível com a melhor qualidade encontrada.</p>
      <div className="downloader" id="baixar"><form onSubmit={submit}><div className="input-wrap"><span>⌁</span><input value={url} onChange={e => setUrl(e.target.value)} placeholder="Cole aqui o link do Instagram..." aria-label="Link do Instagram" inputMode="url"/><button type="button" onClick={paste}>Colar link</button></div><button className="download" disabled={loading}>{loading ? 'Analisando…' : '↓  Baixar mídia'}</button></form><p className="note">✓ Sem login, senha ou cookies. Use apenas conteúdo público autorizado.</p>{status && <div className={`status ${status.type}`}>{status.message}</div>}{media.length > 0 && <div className="results">{media.map(item => <article className="media-card" key={item.id}><div className="media-preview">{item.type === 'video' ? <video src={item.previewUrl} muted preload="metadata" /> : <img src={item.previewUrl} alt="Prévia da imagem encontrada" />}</div><span><strong>{item.type === 'video' ? 'Vídeo encontrado' : 'Imagem encontrada'}</strong><small>{item.width && item.height ? `${item.width} × ${item.height}` : 'Melhor versão pública disponível'} · {(item.format ?? 'arquivo').toUpperCase()}</small></span><a href={item.downloadUrl}>↓ Baixar em alta qualidade</a></article>)}</div>}</div>
      <div className="trust"><span>✓ Melhor mídia pública disponível</span><span>✓ Funciona em qualquer dispositivo</span><span>✓ Arquivos temporários</span></div></section>
      <section className="container content" id="como"><div className="heading"><div><small>Como funciona</small><h2>Três passos, sem complicação.</h2></div><p>Um fluxo direto para salvar sua mídia quando ela estiver publicamente disponível.</p></div><div className="steps">{[['01','↗','Copie o link','Abra uma publicação pública e copie o link no Instagram.'],['02','⌁','Cole no InstaSave','Insira o link no campo acima para analisar a publicação.'],['03','↓','Baixe sua mídia','Escolha o arquivo encontrado e salve no seu dispositivo.']].map(([number, icon, title, text]) => <article key={number}><b>{number}</b><div className="icon">{icon}</div><h3>{title}</h3><p>{text}</p></article>)}</div></section>
      <section className="container content faq" id="faq"><div className="heading"><div><small>Perguntas frequentes</small><h2>Tudo o que você precisa saber.</h2></div></div><div className="questions">{[['Preciso instalar algum programa?','Não. O InstaSave funciona diretamente pelo navegador.'],['Preciso entrar na minha conta do Instagram?','Não. Nunca pedimos login, senha, cookies ou credenciais.'],['Posso baixar qualquer perfil?','Somente conteúdo publicamente acessível e sujeito às regras aplicáveis.'],['A qualidade será original?','Disponibilizamos a maior qualidade pública encontrada, sem prometer uma qualidade que a fonte não ofereça.']].map(([q, a], i) => <details key={q} open={i === 0}><summary>{q}<span>+</span></summary><p>{a}</p></details>)}</div></section></main>
    <footer className="container"><a className="brand" href="#inicio"><img src="/brand/instasave-icon.svg" alt=""/><span>Insta<i>Save</i></span></a><p>© {new Date().getFullYear()} InstaSave. Use com responsabilidade.</p><div><a href="#">Privacidade</a><a href="#">Termos</a></div></footer></>
}
createRoot(document.getElementById('root')!).render(<App />)
