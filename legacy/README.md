# Legado — servidor web anterior

Esta pasta guarda a implementação web anterior do InstaSave, mantida apenas
para referência. **O aplicativo desktop não usa este código.**

- `web/server.py`: servidor HTTP da biblioteca padrão, com o resolvedor
  OpenGraph e a interface em `web/static/`.
- `web/test_server.py`: testes do servidor legado.
- `web/static/`: HTML, CSS e JS da interface antiga.

Os assets visuais continuam em `assets/` na raiz do projeto.

## Executar (opcional)

```powershell
cd legacy\web
python server.py
# abra http://localhost:8000
```

## Testar

```powershell
cd legacy\web
python test_server.py
```

Requisitos: Python 3.11+ (somente biblioteca padrão para o servidor).
