import 'dotenv/config'

function numberEnv(key: string, fallback: number) { const value = Number(process.env[key] ?? fallback); return Number.isFinite(value) && value > 0 ? value : fallback }
export const env = {
  port: numberEnv('PORT', 3000),
  resolveTimeout: numberEnv('RESOLVE_TIMEOUT_MS', 30_000),
  downloadTimeout: numberEnv('DOWNLOAD_TIMEOUT_MS', 120_000),
  temporaryTtl: numberEnv('TEMP_FILE_TTL_MINUTES', 30) * 60_000,
  pythonServiceUrl: (process.env.PYTHON_SERVICE_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, ''),
}
