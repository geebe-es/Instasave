# Serviço Python do InstaSave

Serviço privado usado pela API Node para resolver somente mídias que Instagram/Instaloader ou yt-dlp exponham publicamente ao servidor. Não recebe ou armazena login, cookies ou senhas; conteúdo privado, challenge, checkpoint e rate limit retornam erro estruturado.

## Windows

```powershell
cd python-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

## Linux/macOS

```bash
cd python-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

O serviço grava arquivos em `downloads/` com UUID, expõe apenas `GET /download/{id}` e os remove após `FILE_TTL_MINUTES` (30 por padrão). Em produção, mantenha-o em rede interna; a API Node faz o proxy público.
