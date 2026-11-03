# Changelog

O projeto segue [SemVer](https://semver.org/). O instalador `release/InstaSave-Setup-x.y.z.exe`
usa a versão do `package.json` raiz; para atualizar, instale a nova versão por cima.

## 1.1.0 — 2026-11-03

### Corrigido
- "O Instagram não disponibilizou esta mídia publicamente para o servidor.": a
  API JSON anônima do Instagram passou a recusar consultas (`401`) mesmo para
  conteúdo público. Um segundo canal anônimo — a página pública da publicação,
  sem cookies, sessão ou credenciais — agora resolve imagens, carrosséis e
  vídeos quando isso acontece.

### Adicionado
- `python-service/app/resolvers/webpage_resolver.py`: lê a página pública como
  o yt-dlp faz, escolhe o candidato de maior arquivo real (maior resolução
  disponível na página) e aplica a conversão para PNG como no fluxo principal.
- Testes do fallback e do modo sem limite em
  `python-service/tests/test_webpage_resolver.py`.

### Alterado
- Limite de download configurável: `MAX_DOWNLOAD_MB=0` (padrão) significa
  **sem limite**; valores maiores que zero reintroduzem o teto, em MB.
- Suíte de testes: 30 testes do serviço Python (7 novos), 10 de integração da
  API e 2 desktop.

## 1.0.0

- Release inicial desktop: Electron + API Express + serviço Python com
  Instaloader/yt-dlp; instalador NSIS em `release/InstaSave-Setup-1.0.0.exe`.
