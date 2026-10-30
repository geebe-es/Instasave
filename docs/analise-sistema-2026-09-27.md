# Análise do sistema — 27/09/2026

## Atualização após as correções

Os sete problemas descritos no diagnóstico abaixo foram corrigidos no código:

- Caminhos estáticos são resolvidos e limitados à raiz autorizada, inclusive caminhos codificados e com barras do Windows.
- Cada análise roda em processo descartável; timeout ou desconexão encerra e recolhe o processo. Há limite de duas análises simultâneas, e somente operações concluídas publicam arquivos no armazenamento principal.
- O yt-dlp verifica tamanho conhecido e bytes transferidos, interrompe o excesso e remove arquivos parciais. A leitura usa blocos de 64 KiB; o limite durante a transferência pode ser detectado após um bloco adicional.
- A limpeza mantém os registros de arquivos bloqueados para tentar novamente e não encerra seu loop por erro de sistema de arquivos.
- `/reels/` e variações de maiúsculas são normalizados para `/reel/`, preservando o shortcode.
- Autoridades e portas malformadas geram erro de validação também no servidor alternativo.
- O proxy mantém o prazo durante o corpo completo da resposta, cancela o upstream na desconexão e encerra streams incompletos sem acrescentar JSON aos bytes da mídia.

Testes de regressão: 14 testes Python, 4 do servidor alternativo e 6 testes/subtestes do backend aprovados. Os 2 testes do desktop em desenvolvimento passaram; as compilações TypeScript do backend e frontend e o build Vite também passaram.

O serviço Python reconstruído passou no teste de autenticação, validação e encerramento. O diagnóstico offline do executável retornou `worker_spawn: ok`, confirmando o funcionamento do processo do resolvedor no pacote congelado. A interface Electron reconstruída passou no teste empacotado com PATH restrito (1 aprovado; 1 cenário exclusivo de desenvolvimento ignorado).

O instalador atualizado está em `release/InstaSave-Setup-1.0.0.exe`. Não foi instalado automaticamente nesta máquina. Downloads reais do Instagram, instalação em máquina limpa e auditoria das dependências continuam fora desta validação.

## Diagnóstico inicial (registro histórico)

O sistema compila e passa nas verificações registradas abaixo, mas há defeitos que impedem considerá-lo totalmente correto. Esta revisão não alterou o código da aplicação. Os builds e testes atualizam artefatos gerados.

## Problemas encontrados

### 1. Alta — acesso a arquivos fora da pasta pública no servidor alternativo

Local: `server.py:198–202`.

`translate_path()` concatena o caminho recebido sem eliminar `..` ou verificar se o destino permanece dentro da pasta pública. Uma requisição HTTP local `GET /../package.json` retornou 200 e o conteúdo do manifesto do projeto. Outros arquivos legíveis pelo processo podem ser expostos por caminhos relativos.

Escopo: servidor alternativo iniciado por `server.py`, em loopback. Esse código não é o servidor usado pelo Electron. A exposição depende de esse servidor estar em execução e acessível.

Correção recomendada: resolver e validar o caminho contra a raiz autorizada antes de servir arquivos, inclusive nas rotas de assets.

### 2. Alta — timeout não interrompe a operação Python

Local: `python-service/app/main.py:89`.

`wait_for(to_thread(...))` termina a espera, mas a thread continua executando o resolvedor e pode continuar baixando arquivos. Uma reprodução com resolvedor controlado confirmou trabalho concluído depois da resposta `RESOLVE_TIMEOUT`. Repetições podem acumular trabalho, consumo de rede e arquivos que o usuário não recebe.

Correção recomendada: cancelamento cooperativo com prazo verificado durante as transferências, ou isolamento do trabalho em processo que possa ser encerrado, além de limite de concorrência.

### 3. Média — limite de tamanho aplicado somente depois do download pelo yt-dlp

Locais: `python-service/app/resolvers/ytdlp_resolver.py:39–46` e `python-service/app/services/download_service.py:29`.

As opções do yt-dlp não limitam bytes durante a transferência. O tamanho é validado por `register()` depois de baixar o arquivo inteiro. O limite configurado, portanto, não protege o disco e a rede durante esse download. Constatação por inspeção; nenhum arquivo grande foi baixado nesta revisão.

Correção recomendada: verificar tamanhos conhecidos antes de baixar e impor limite durante a transferência, removendo arquivos parciais ao falhar.

### 4. Média — erro de exclusão interrompe a limpeza automática

Locais: `python-service/app/services/download_service.py:48–56` e `python-service/app/services/cleanup_service.py:9–12`.

Erros de `unlink()` não são tratados. Uma reprodução com `PermissionError` simulado confirmou que a exceção sai de `cleanup()`. Como o loop periódico também não a trata, a tarefa termina e deixa de limpar os próximos arquivos. O registro ainda é removido antes de confirmar a exclusão. Isso é relevante quando arquivos estão em uso no Windows.

Correção recomendada: tratar falhas por arquivo, preservar a possibilidade de nova tentativa e manter a tarefa periódica ativa.

### 5. Média — links `/reels/` não usam o fallback de vídeo

Locais: `python-service/app/utils/url_validator.py` e `python-service/app/resolvers/instagram.py:21`.

O validador aceita `/reels/`, mas o fallback exige a substring `/reel/`. Se o primeiro resolvedor falhar com um erro elegível, o mesmo vídeo pode ter comportamentos diferentes conforme o formato do link. A validação de `/reels/` foi reproduzida; a condição do fallback foi verificada no código.

Correção recomendada: normalizar rotas equivalentes ou decidir pelo tipo de rota validado.

### 6. Média — URL malformada produz erro inesperado

Local: `python-service/app/utils/url_validator.py:13`.

`https://instagram.com:abc/p/Abcde12/` lança `ValueError` ao acessar `parsed.port`, em vez de `ServiceError` com `LINK_INVALID`. O fluxo pode resultar em erro 500 genérico. A exceção foi reproduzida diretamente.

Correção recomendada: converter erros de parsing em resposta de validação 422 e cobrir portas e hosts malformados.

### 7. Média — timeout do proxy termina antes do corpo da resposta

Locais: `backend/src/app.ts:27–29` e `backend/src/app.ts:40–52`.

O timer é removido assim que `fetch()` recebe os cabeçalhos, antes de ler o JSON ou terminar o streaming. Assim, `DOWNLOAD_TIMEOUT_MS` não limita a transferência inteira. A desconexão do cliente também não cancela explicitamente a requisição upstream. Constatação por inspeção.

Correção recomendada: manter o prazo até o término do corpo, propagar desconexões e tratar erros após o envio dos cabeçalhos sem tentar emitir um segundo JSON.

## Verificações executadas

- Backend: 1 teste aprovado; compilação TypeScript aprovada.
- Serviço Python: 3 testes unitários aprovados.
- Servidor alternativo: 2 testes unitários aprovados.
- Frontend: compilação TypeScript e build Vite aprovados.
- Serviço Python congelado: 1 teste aprovado, incluindo autenticação, porta dinâmica, validação e encerramento.
- Electron em desenvolvimento: 2 testes aprovados, incluindo inicialização, isolamento, interface offline, tamanhos de janela, download controlado, encerramento e tela de falha de inicialização.
- Electron empacotado existente: 1 teste aprovado; teste de falha de inicialização ignorado pela própria suíte nesse modo. O teste restringe o PATH para verificar independência dos runtimes instalados.
- Reproduções adicionais: travessia de diretórios por HTTP, URL inválida, continuidade após timeout e falha de limpeza simulada.

## Limites da conclusão

Os testes existentes cobrem poucos casos do resolvedor. Não foram realizados downloads reais de imagem, Reel ou carrossel do Instagram, auditoria de vulnerabilidades das dependências, reinstalação/desinstalação nem teste em máquina Windows limpa. Os resultados de executáveis já presentes no projeto não comprovam, isoladamente, equivalência com o código-fonte atual.

Prioridade sugerida: corrigir acesso a arquivos no servidor alternativo, cancelamento e limites de recursos; depois limpeza, validação e tratamento do proxy. Acrescentar testes de regressão para esses defeitos.
