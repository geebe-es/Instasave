# InstaSave

## Aplicativo Windows

A versão desktop preserva o frontend existente e inclui Electron, Node e Python. Consulte [desenvolvimento, build, instalação e testes desktop](docs/desktop.md).

```powershell
npm ci
npm run setup
npm run electron:dev
# Gerar o instalador completo:
npm run release:win
```

Saída: `release/InstaSave-Setup-<versão>.exe` (nome definido em `package.json`). Atualizações: instale o instalador da versão nova por cima; a versão acompanha o [changelog](CHANGELOG.md).

Interface moderna e API segura para baixar mídia **publicamente disponível** de links do Instagram. O projeto não solicita credenciais e não implementa contornos de login, CAPTCHA, conteúdo privado ou outros controles de acesso.

## Executar localmente

Requisitos: Python 3.14 (o lock não tem wheels para 3.15) e Node.js 24+.

Em um primeiro terminal, execute o resolvedor Python privado (ele ocupa a porta 8000):

```powershell
cd python-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Em um segundo terminal, execute a API Node.js:

```powershell
cd backend
Copy-Item .env.example .env
npm install
npm run dev
```

Em outro terminal, execute o frontend React:

```powershell
cd frontend
npm install
npm run dev
```

Abra `http://localhost:5173`. O Vite encaminha automaticamente a API para `http://localhost:3000`.

Para gerar os arquivos estáticos de produção:

```powershell
cd frontend
npm run build
```

O resultado fica em `dist/`.

## Arquitetura

No fluxo atual Node/Python e no aplicativo Windows, as imagens são convertidas automaticamente para PNG antes do download, incluindo fotos de carrosséis. A conversão preserva a resolução e não recupera detalhes perdidos na fonte; vídeos mantêm seu formato original.

- `frontend/`: aplicação React + TypeScript com Vite, landing page responsiva e estados de interface.
- `backend/`: API Node.js + TypeScript, validação, limites e resolver modular.
- `python-service/`: resolvedores anônimos (Instaloader, yt-dlp para vídeos e página pública como fallback de imagem/carrossel).
- `MediaResolver`: ponto de extensão para integrar um provedor autorizado de mídia pública completa.
- `assets/brand/`: logo e ícone vetoriais.

## Estrutura do projeto

- `electron/`, `frontend/`, `backend/`, `python-service/`: código do aplicativo desktop.
- `assets/`, `resources/`, `build/`: entradas de build (fontes, ícone, licenças e NSIS).
- `scripts/`, `tests/`, `docs/`: automação, testes e documentação.
- `legacy/web/`: servidor web anterior, mantido apenas para referência (não usado no desktop).
- `dist/`, `desktop-dist/`, `release/`, `test-results/`: saídas geradas — não editar.

Mapa completo e comandos por pasta: [docs/estrutura.md](docs/estrutura.md).

## Segurança

A API aceita apenas caminhos de publicação `instagram.com/p`, `reel` e `reels`; remove query strings; rejeita outros hosts, portas, URLs longas e esquemas que não sejam HTTP(S). A prévia (`thumbnail_url`) é separada da URL de mídia completa (`media_url`) e jamais é usada no download. Quando o endpoint JSON anônimo do Instagram recusa uma mídia pública, um fallback adicional lê a própria página pública da publicação (sem cookies, sessão ou credenciais) e baixa o maior candidato de imagem oferecido na página. Quando a fonte expõe somente Open Graph/preview, a API recusa o download para evitar arquivos cortados. O limite de tamanho (`MAX_DOWNLOAD_MB`, em MB) vale para todos os canais; `0` desativa o limite. Para integrar um provedor autorizado que exponha várias versões, use `select_best_image_candidate()`, que seleciona a maior área válida e faz streaming dos bytes sem redimensionar ou recomprimir.

Para produção, use HTTPS, um rate limiter distribuído, logs com IP anonimizado, cache com expiração e um provider que respeite os termos da fonte. Nunca adicione credenciais, cookies ou mecanismos para acessar conteúdo protegido.
