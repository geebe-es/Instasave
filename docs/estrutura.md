# Estrutura do projeto

Mapa das pastas do InstaSave, separando **código-fonte**, **saídas geradas**,
**legado** e **ferramentas opcionais**.

```text
InstaSave/
├─ electron/            Processo principal, preload e splash do Electron
├─ frontend/            Interface React + TypeScript + Vite (src, configs)
├─ backend/             API Express + TypeScript (src, test)
├─ python-service/      FastAPI e resolvedores anônimos (app, tests, entrypoints)
├─ assets/              Fontes e SVGs usados como publicDir do Vite
├─ resources/           Ícone (.ico) e avisos de licença de terceiros
├─ build/               Recursos do instalador NSIS (bitmaps + script)
├─ scripts/             Automação de setup, build, testes e instalador
├─ tests/               Testes Node/Playwright e fixtures (tests/fixtures)
├─ docs/                Documentação (este mapa, desktop, design, análise)
├─ legacy/web/          Servidor web anterior — NÃO usado pelo desktop
├─ dist/                GERADO: frontend de produção (Vite)
├─ desktop-dist/        GERADO: backend empacotado em um arquivo (esbuild)
├─ release/             GERADO: instalador NSIS + versão portátil (win-unpacked)
├─ test-results/        GERADO: capturas e logs das execuções de teste
├─ node_modules/        Dependências de desenvolvimento (npm ci)
└─ .tools/              OPCIONAL: pywinauto/Pillow para testar o instalador
```

## O que é fonte e o que é gerado

| Pasta | Tipo | Observação |
|---|---|---|
| `electron/`, `frontend/`, `backend/`, `python-service/` | Fonte | Editar aqui |
| `assets/`, `resources/`, `build/` | Fonte | Entradas do build; `resources` também recebe avisos gerados |
| `scripts/`, `tests/`, `docs/` | Fonte | Automação, testes e documentação |
| `legacy/web/` | Legado | Apenas referência; não participa do build desktop |
| `dist/` | Gerado | `npm run build:web` |
| `desktop-dist/` | Gerado | `npm run build:desktop` (ou `electron:dev`) |
| `release/` | Gerado | `npm run dist:win` / `npm run release:win` |
| `test-results/` | Gerado | Recriado pelos testes; ignorado pelo Git |
| `node_modules/` | Instalado | `npm ci` no root, `frontend` e `backend` |
| `python-service/.venv/` | Instalado | Recriado por `npm run setup` |
| `python-service/downloads/` | Temporário | Arquivos de mídia com TTL; ignorado pelo Git |
| `.tools/` | Opcional | Só para `scripts/installer-ui-test.py` |

## Regras práticas

- Não edite nada em `dist/`, `desktop-dist/`, `release/` ou `test-results/`:
  são regenerados pelos comandos de build/teste.
- `tests/fixtures/` contém arquivos pequenos usados pelo diagnóstico do serviço
  Python empacotado; pode ser regenerado por `npm run test:desktop`.
- `frontend/vite.config.js` e `frontend/vite.config.d.ts` são gerados pelo
  `tsc -b` a partir de `vite.config.ts` e estão no `.gitignore`. Se o Git
  estiver disponível, remova-os do índice com
  `git rm --cached frontend/vite.config.js frontend/vite.config.d.ts`.
- O app portátil é a pasta inteira `release/win-unpacked/`; para distribuir,
  use `release/InstaSave-Setup-<versão>.exe`.

## Comandos por área

```powershell
npm ci                  # dependências do desktop/root
npm run setup           # frontend + backend + venv Python
npm run electron:dev    # desenvolvimento (Electron + Vite + Python)

npm run build:web       # gera dist/
npm run python:build    # gera dist-python/ e resources/*NOTICES*
npm run build:desktop   # gera dist/, desktop-dist/ e release/win-unpacked/
npm run dist:win        # gera o instalador em release/

npm --prefix backend test
npm run test:desktop
npm run test:ui
```

## Ambiente de desenvolvimento

- Node.js 24+ e Python 3.14 (validado com Node 26.13.1 e Python 3.14.10).
  O lock atual não possui wheels para Python 3.15, que tentaria compilar
  httptools/pydantic-core/PyYAML e exigiria Visual C++ Build Tools.
- O `npm run setup` prefere `py -3.14` ao criar a venv; se a venv for movida
  de máquina/usuário, recrie:

```powershell
Remove-Item -Recurse -Force python-service\.venv
npm run setup
```

- Alternativa: defina `INSTASAVE_BUILD_PYTHON` com o caminho de outro Python
  antes de rodar `npm run setup` ou `npm run electron:dev`.
