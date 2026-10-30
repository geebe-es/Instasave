/* Captura a tela de abertura (splash) em três estados: entrada estável, decoração em movimento e falha. */
const { _electron: electron } = require('@playwright/test')
const path = require('node:path')
const fs = require('node:fs/promises')

const root = path.resolve(__dirname, '..')

async function main() {
  const application = await electron.launch({
    executablePath: require('electron'),
    args: [path.join(root, 'scripts', 'scratch-splash-entry.cjs')],
    cwd: root,
    timeout: 60000,
  })
  try {
    let window = null
    const deadline = Date.now() + 15000
    while (!window && Date.now() < deadline) {
      window = application.windows().find(item => item.url().includes('splash.html'))
      if (!window) await new Promise(resolve => setTimeout(resolve, 100))
    }
    if (!window) {
      console.log('splash window not caught')
      return
    }
    // Entrada concluída + decoração animada.
    await window.waitForTimeout(2500)
    await window.screenshot({ path: path.join(root, 'test-results', 'motion', 'splash-1920.png') })
    await window.waitForTimeout(2500)
    await window.screenshot({ path: path.join(root, 'test-results', 'motion', 'splash-late-1920.png') })
    // Estado de falha: simula a mensagem de app:status que o main envia nesse caso (apenas prévia visual).
    await window.evaluate(() => {
      document.querySelector('#status').textContent = 'Não foi possível conectar ao serviço de download.'
      document.body.classList.add('failed')
      document.querySelector('#actions').hidden = false
    })
    await window.waitForTimeout(900)
    await window.screenshot({ path: path.join(root, 'test-results', 'motion', 'splash-fail-1920.png') })
    console.log('splash captured')
  } finally {
    await application.close()
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
