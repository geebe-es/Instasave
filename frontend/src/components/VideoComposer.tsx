import { useRef, type FormEvent } from 'react'
import { IconClipboard, IconLink, IconVideo, IconX } from './Icons'
import { GlowButton } from './ui/GlowButton'

type VideoComposerProps = {
  url: string
  onUrlChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onPaste: () => void
  loading: boolean
}

export function VideoComposer({ url, onUrlChange, onSubmit, onPaste, loading }: VideoComposerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const clear = () => {
    onUrlChange('')
    inputRef.current?.focus()
  }
  return (
    <form className="composer" onSubmit={onSubmit} aria-label="Baixar vídeo do Instagram">
      <div className="input-wrap">
        <span className="input-wrap__icon" aria-hidden="true"><IconLink size={20} /></span>
        <input
          ref={inputRef}
          value={url}
          onChange={event => onUrlChange(event.target.value)}
          placeholder="Cole o link do vídeo aqui..."
          aria-label="Link do vídeo do Instagram"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
        />
        {url ? (
          <button type="button" className="input-clear" onClick={clear} aria-label="Limpar link do vídeo">
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
        loadingText="Analisando vídeo…"
        icon={<IconVideo size={18} />}
      >
        Baixar vídeo
      </GlowButton>
    </form>
  )
}
