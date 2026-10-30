import { IconBolt, IconDownload, IconImage, IconInstagram, IconPlay, IconShield, IconSparkles } from './Icons'

export function Hero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <span className="hero-eyebrow"><span className="hero-eyebrow__dot" aria-hidden="true" />Imagens públicas em alta qualidade</span>
        <h1 id="hero-title">Baixe imagens <em>do Instagram.</em></h1>
        <p>Cole o link de uma publicação pública e salve as imagens com qualidade e rapidez.</p>
        <div className="hero-badges" aria-label="Vantagens do InstaSave">
          <span className="hero-badge"><IconBolt size={15} />Rápido</span>
          <span className="hero-badge"><IconImage size={15} />Alta qualidade</span>
          <span className="hero-badge"><IconShield size={15} />Seguro</span>
          <span className="hero-badge"><IconSparkles size={15} />Sem cadastro</span>
        </div>
      </div>
      <div className="hero-visual" aria-hidden="true">
        <span className="hero-visual__halo" />
        <span className="hero-visual__orbit hero-visual__orbit--one" />
        <span className="hero-visual__orbit hero-visual__orbit--two" />
        <div className="hero-app hero-app--main">
          <span className="hero-app__shine" />
          <IconInstagram size={64} />
        </div>
        <div className="hero-app hero-app--image">
          <span className="hero-app__shine" />
          <IconImage size={30} />
        </div>
        <div className="hero-app hero-app--video">
          <span className="hero-app__shine" />
          <IconPlay size={30} />
        </div>
        <div className="hero-app hero-app--download">
          <span className="hero-app__shine" />
          <IconDownload size={27} />
        </div>
        <span className="hero-spark hero-spark--one" />
        <span className="hero-spark hero-spark--two" />
        <span className="hero-spark hero-spark--three" />
      </div>
    </section>
  )
}
