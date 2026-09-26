# InstaSave

Interface moderna e API segura para baixar mídia **publicamente disponível** de links do Instagram. O projeto não solicita credenciais e não implementa contornos de login, CAPTCHA, conteúdo privado ou outros controles de acesso.

## Executar localmente

Requisitos: Python 3.11+ e Node.js 20+.

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

- `frontend/`: aplicação React + TypeScript com Vite, landing page responsiva e estados de interface.
- `backend/`: API Node.js + TypeScript, validação, limites e resolver modular.
- `MediaResolver`: ponto de extensão para integrar um provedor autorizado de mídia pública completa.
- `assets/brand/`: logo e ícone vetoriais.

## Segurança

A API aceita apenas caminhos de publicação `instagram.com/p`, `reel` e `reels`; remove query strings; rejeita outros hosts, portas, URLs longas e esquemas que não sejam HTTP(S). A prévia (`thumbnail_url`) é separada da URL de mídia completa (`media_url`) e jamais é usada no download. Quando a fonte expõe somente Open Graph/preview, a API recusa o download para evitar arquivos cortados. Para integrar um provedor autorizado que exponha várias versões, use `select_best_image_candidate()`, que seleciona a maior área válida e faz streaming dos bytes sem redimensionar ou recomprimir.

Para produção, use HTTPS, um rate limiter distribuído, logs com IP anonimizado, cache com expiração e um provider que respeite os termos da fonte. Nunca adicione credenciais, cookies ou mecanismos para acessar conteúdo protegido.
