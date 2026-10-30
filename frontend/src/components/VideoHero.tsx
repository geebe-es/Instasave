import { IconBolt, IconInstagram, IconPlay, IconSparkles, IconVideo } from './Icons'

export function VideoHero() {
  return (
    <section className="hero hero--videos" aria-labelledby="video-hero-title">
      <div className="hero-copy">
        <span className="hero-eyebrow"><span className="hero-eyebrow__dot" aria-hidden="true" />Vídeos públicos em alta qualidade</span>
        <h1 id="video-hero-title">Baixar vídeos do Instagram</h1>
        <p>Baixe Reels, Stories e vídeos de publicações em um só lugar.</p>
        <div className="chips" aria-label="Formatos reconhecidos automaticamente">
          <span className="chip chip--accent"><IconVideo size={13} />Reels</span>
          <span className="chip"><IconPlay size={13} />Stories</span>
          <span className="chip"><IconInstagram size={13} />Publicações</span>
          <span className="chip chip--spark"><IconSparkles size={13} />Detecção automática</span>
        </div>
      </div>
      <div className="hero-visual" aria-hidden="true">
        <span className="hero-visual__halo" />
        <span className="hero-visual__orbit hero-visual__orbit--one" />
        <span className="hero-visual__orbit hero-visual__orbit--two" />
        <div className="hero-app hero-app--main">
          <span className="hero-app__shine" />
          <IconVideo size={64} />
        </div>
        <div className="hero-app hero-app--video">
          <span className="hero-app__shine" />
          <IconPlay size={30} />
        </div>
        <div className="hero-app hero-app--image">
          <span className="hero-app__shine" />
          <IconInstagram size={30} />
        </div>
        <div className="hero-app hero-app--download">
          <span className="hero-app__shine" />
          <IconBolt size={27} />
        </div>
        <span className="hero-spark hero-spark--one" />
        <span className="hero-spark hero-spark--two" />
        <span className="hero-spark hero-spark--three" />
      </div>
    </section>
  )
}
