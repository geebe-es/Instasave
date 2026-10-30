# InstaSave para Windows

## Arquitetura real

```text
InstaSave.exe (Electron, processo principal)
├─ preload isolado → React / TypeScript / Vite existentes
├─ utilityProcess → API Express existente (Node incluído no Electron)
└─ downloader-service.exe → FastAPI → Instaloader / yt-dlp
```

O frontend, CSS, logo e resolvedores existentes foram preservados. `server.py` e `static/`, implementações anteriores, permanecem no repositório e não são usados no desktop. A API Express é compilada em um único arquivo com esbuild. O frontend de produção é servido pela API local e recebe CSP do Helmet; o renderer não executa Node.

Os serviços reservam suas próprias portas com bind em `127.0.0.1:0`; não há seleção seguida de liberação de porta. O Python informa a porta em arquivo de prontidão na pasta temporária da sessão. O Node informa sua porta por IPC. O Electron aguarda `/health` dos dois processos. Um token aleatório por execução autentica as requisições, inserido pelo processo principal e pela API; não é entregue ao JavaScript da página nem persistido em configurações.

O serviço Python é empacotado com PyInstaller **onedir**, evitando extração de executáveis a cada abertura. Dependências, extratores do yt-dlp, certificados e metadados são coletados. Os binários ficam em `resources/python`, fora do ASAR. A API e a interface ficam no ASAR.

O resolvedor de vídeo escolhe o melhor formato que já contém vídeo e áudio. Ele não usa FFmpeg nem combina faixas separadas. **FFmpeg não é necessário nem distribuído.** Os vídeos mantêm seus bytes originais.

As imagens, incluindo itens de carrosséis, são convertidas automaticamente para PNG com Pillow antes de serem disponibilizadas. A conversão mantém a resolução, aplica a orientação EXIF e preserva transparência; imagens animadas são salvas como PNG animado (APNG). Nome, extensão, prévia e tipo MIME correspondem ao PNG gerado. Não há redimensionamento ou aumento artificial de nitidez. PNG não recupera detalhes perdidos na origem e pode ocupar mais espaço. O limite de tamanho também é aplicado durante a escrita do PNG. Pillow e os codecs necessários são incluídos no executável.

## Desenvolvimento

Ferramentas validadas nesta máquina: Windows 11 x64, Node 24.21.0 e Python 3.14.7. Somente o desenvolvedor precisa delas.

Preparação de um checkout novo:

```powershell
npm ci
npm run setup
npm run electron:dev
```

`setup` instala as dependências de frontend/backend pelos lockfiles e prepara `python-service/.venv` com `requirements-lock.txt`. Se necessário, defina `INSTASAVE_BUILD_PYTHON` com o caminho de outro Python de desenvolvimento. Não use esta variável para distribuir o aplicativo.

O comando de desenvolvimento compila a API, prepara assets, abre Electron, inicia Python e Vite automaticamente. Vite mantém o hot reload do React; Python permanece ativo. O modo web descrito no README continua disponível. O desktop injeta sua configuração em tempo de execução: não usa segredos `VITE_*` ou `.env.production` no renderer. Os `.env.example` do modo web continuam válidos.

## Builds

```powershell
npm run build:web       # somente frontend
npm run python:build    # Python standalone e licenças
npm run build:desktop   # frontend + Python + release/win-unpacked
npm run dist:win        # build completo + instalador NSIS
npm run release:win     # alias do build completo
```

Resultado:

```text
release/InstaSave-Setup-1.0.0.exe
release/win-unpacked/InstaSave.exe
```

Distribua o **Setup.exe**. Para usar a versão sem instalador, preserve a pasta `win-unpacked` inteira, incluindo `resources`; o executável isolado não basta. A primeira compilação requer internet para baixar ferramentas de build. A interface instalada e seus assets abrem offline.

Metadados ficam em `package.json` (`version`, `description`, `author` e `desktop`). Nome do publicador atual: InstaSave; substitua pelo responsável real antes de publicar, se aplicável. Os scripts geram ICO e bitmaps a partir do SVG original. Consulte `desktop-design.md` para paleta e limitações dos controles NSIS.

## Instalação e dados

Instalação por usuário em `%LOCALAPPDATA%\Programs\InstaSave`, sem elevação. O instalador cria atalhos no Menu Iniciar e Área de Trabalho, registro em Aplicativos instalados e desinstalador. A pasta padrão é fixa para simplificar a experiência. A pasta de **downloads** pode ser escolhida dentro do aplicativo.

| Dados | Destino |
|---|---|
| Preferência de downloads | `app.getPath('userData')/preferences.json` |
| Logs de ciclo de vida | `app.getPath('userData')/logs/desktop.log` |
| Temporários de mídia | `app.getPath('temp')/InstaSave/session-*` |
| Downloads finais | `app.getPath('downloads')`, ou pasta escolhida |

Não se gravam mídias ou preferências na instalação. Downloads de mesmo nome recebem sufixos numéricos. Só arquivos baixados pela sessão atual podem ser abertos pelo IPC. A desinstalação preserva downloads e dados pessoais. Os logs de produção registram códigos de ciclo de vida; saída de bibliotecas que pode conter URLs ou informações sensíveis é suprimida. Há rotação do log de 1 MiB na abertura.

Ao fechar, downloads ativos são cancelados, Node recebe pedido de encerramento, Python recebe `/shutdown` autenticado, e temporários da sessão são removidos. Após o prazo de encerramento gracioso, `taskkill /T` é o fallback oculto para a árvore Python. Python também monitora o PID do Electron e sai se o pai terminar abruptamente. Na próxima abertura, pastas temporárias de sessões anteriores são limpas.

## Segurança e manutenção

As análises de mídia rodam em processos Python descartáveis, com no máximo duas operações simultâneas. Timeout ou desconexão encerra o processo e remove seus arquivos parciais; apenas arquivos de operações concluídas são publicados para download. A limpeza periódica tenta novamente arquivos temporariamente bloqueados pelo Windows. O fallback de vídeo verifica o tamanho conhecido e interrompe transferências que ultrapassem o limite (com margem de um bloco de leitura).

Renderer com `contextIsolation`, sandbox e `nodeIntegration: false`; IPC específico com verificação do emissor e validação de IDs. Navegação externa não substitui a interface; somente HTTPS para o Instagram é elegível para abertura externa. Popups e webviews são bloqueados. DevTools só são habilitadas em desenvolvimento. CSP de produção não contém `unsafe-eval`.

O executável e instalador atuais **não são assinados**. O Windows SmartScreen pode mostrar aviso de aplicativo não reconhecido. O electron-builder mantém suporte à assinatura: configure `CSC_LINK` e `CSC_KEY_PASSWORD` no ambiente seguro do build quando houver certificado real. Não coloque certificado/senha no Git. Nenhum certificado foi inventado.

Não há atualização automática habilitada nem servidor de distribuição. O appId estável, versão semântica e instalador NSIS permitem atualizar por reinstalação. Uma futura integração com electron-updater deve incluir endpoint de distribuição e validação de assinatura.

## Testes reproduzíveis

```powershell
npm --prefix backend test
npm --prefix backend run build
cd python-service
.venv\Scripts\python.exe -m unittest discover -s tests -v
cd ..
npm run test:desktop
node --test tests/python-service.test.cjs
$env:INSTASAVE_TEST_EXE = (Resolve-Path release/win-unpacked/InstaSave.exe).Path
npm run test:desktop
release\win-unpacked\resources\python\downloader-service.exe --self-test test-results/fixtures
```

O teste desktop gera PNG e WebM válidos para o diagnóstico dos motores congelados. A fixture de download do Electron usa uma resposta HTTP controlada; os cliques de abertura são observados com as APIs do shell substituídas no teste para evitar abrir aplicativos externos. Isso verifica transferência e encaminhamento de caminhos, mas **não substitui downloads reais do Instagram**. O relatório da entrega separa esses testes.

Capturas ficam em `test-results/`. Testes de resolução de janela não equivalem a testar DPI real de vários monitores. PATH restrito no teste empacotado demonstra independência de runtimes no PATH, mas não equivale a uma VM limpa.

Para inspecionar o instalador por automação opcional, instale `pywinauto` e `Pillow` em `.tools/ui` e use `scripts/installer-ui-test.py`. Essas ferramentas não são distribuídas.

## Rollback

O projeto original foi registrado em um commit anterior à integração desktop. Use `git log --oneline` para localizar o checkpoint `Checkpoint original web application before desktop integration`. Crie uma branch a partir dele para comparar ou restaurar; evite sobrescrever alterações locais não salvas.

Referências: [Electron utilityProcess](https://www.electronjs.org/docs/latest/api/utility-process), [NSIS no electron-builder](https://www.electron.build/v26/docs/nsis/), [PyInstaller onedir](https://www.pyinstaller.org/en/stable/usage.html).
