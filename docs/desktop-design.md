# Identidade visual preservada

Valores extraídos de `frontend/src/styles.css` e `assets/brand/instasave-icon.svg`:

| Token | Valor existente |
|---|---|
| app-background | `#100b22` |
| app-surface | `#0f0a20` / `#0c091a` |
| app-primary | `#ff3d81` |
| app-secondary | `#7d3dfa` |
| app-accent | `#ffb000` |
| app-gradient | `linear-gradient(105deg,#ff9e19,#ff397e 55%,#9a48f7)` |
| app-text | `#f8f7fc` |
| app-text-muted | `#aaa5b9` |
| app-border | `#ffffff24` |
| app-radius | 11px (botões), 18px (card principal) |
| app-shadow | `0 26px 70px #03010d78` |
| fontes | DM Sans; Manrope nos títulos |

As fontes agora são locais (WOFF2 Latin, com acentos do português e licenças OFL), mantendo as famílias existentes. Logo convertido de SVG para ICO em múltiplos tamanhos, sem deformação.

A title bar, splash e erro usam esses valores. As páginas NSIS usam o fundo escuro, texto claro e bitmaps derivados do SVG original. A barra de progresso e os botões preservam controles nativos acessíveis do Windows; NSIS/MUI não reproduz gradientes CSS, animações nem bordas arredondadas da interface React. Não é um instalador HTML. A tipografia dos controles do instalador segue o Windows, sem instalar fontes no sistema.

Referências técnicas consultadas: [Electron utilityProcess](https://www.electronjs.org/docs/latest/api/utility-process), [electron-builder NSIS](https://www.electron.build/v26/docs/nsis/), [PyInstaller](https://www.pyinstaller.org/en/stable/usage.html).
