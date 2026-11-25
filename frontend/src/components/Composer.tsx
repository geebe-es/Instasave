import { useRef, useState, type DragEvent, type FormEvent } from 'react'
import { IconClipboard, IconDownload, IconLink, IconX } from './Icons'
import { GlowButton } from './ui/GlowButton'

type ComposerProps = {
  url: string
  onUrlChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onPaste: () => void
  loading: boolean
  placeholder?: string
  submitLabel?: string
  ariaLabel?: string
  onDropLink?: (value: string) => void
}

export function Composer({
  url,
  onUrlChange,
  onSubmit,
  onPaste,
  loading,
  placeholder = 'Cole o link do Instagram...',
  submitLabel = 'Baixar imagem',
  ariaLabel = 'Link do Instagram',
  onDropLink,
}: ComposerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const clear = () => {
    onUrlChange('')
    inputRef.current?.focus()
  }
  const dragOver = (event: DragEvent<HTMLFormElement>) => {
    if (!onDropLink) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setDragging(true)
  }
  const drop = (event: DragEvent<HTMLFormElement>) => {
    if (!onDropLink) return
    event.preventDefault()
    setDragging(false)
    const value = event.dataTransfer.getData('text/plain').trim()
    if (/^https?:\/\//i.test(value)) onDropLink(value)
  }
  return (
    <form
      className={`composer ${dragging ? 'is-dragging' : ''}`.trim()}
      onSubmit={onSubmit}
      aria-label="Formulário de análise de link"
      onDragOver={dragOver}
      onDragLeave={() => setDragging(false)}
      onDrop={drop}
    >
      <div className="input-wrap">
        <span className="input-wrap__icon" aria-hidden="true"><IconLink size={20} /></span>
        <input
          ref={inputRef}
          value={url}
          onChange={event => onUrlChange(event.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel}
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
        />
        {url ? (
          <button type="button" className="input-clear" onClick={clear} aria-label="Limpar link">
            <IconX size={15} />
          </button>
        ) : null}
        <button type="button" className="paste-button" onClick={onPaste}>
          <IconClipboard size={15} />
          <span>Colar link</span>
        </button>
      </div>
      <GlowButton
        type="submit"
        variant="primary"
        size="lg"
        className="composer__submit"
        loading={loading}
        loadingText="Analisando…"
        icon={<IconDownload size={18} />}
      >
        {submitLabel}
      </GlowButton>
      {dragging ? <span className="composer__drop">Solte o link para analisar</span> : null}
    </form>
  )
}
