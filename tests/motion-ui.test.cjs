const { test } = require('node:test')
const assert = require('node:assert/strict')
const { _electron: electron } = require('@playwright/test')
const path = require('node:path')
const fs = require('node:fs/promises')
const os = require('node:os')
const sharp = require('sharp')

const root = path.resolve(__dirname, '..')
const previewImage = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#7c3aed"/><stop offset="1" stop-color="#ec4899"/></linearGradient></defs><rect width="640" height="400" fill="url(#g)"/><circle cx="500" cy="110" r="150" fill="#fff" opacity=".16"/><text x="34" y="350" fill="#fff" font-family="Arial" font-size="34" font-weight="700">Prévia de teste</text></svg>',
)}`

test('motion ui: navigation, skeletons, results, card download, history, reduced motion and narrow layout', { timeout: 120000 }, async () => {
  const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'instasave-motion-test-'))
  const downloadDir = path.join(userData, 'downloads')
  await fs.mkdir(downloadDir)
  await fs.writeFile(path.join(userData, 'preferences.json'), JSON.stringify({ downloadFolder: downloadDir }))
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  const application = await electron.launch({
    executablePath: require('electron'),
    args: ['.', '--desktop-dev', `--user-data-dir=${userData}`],
    cwd: root,
    env,
    timeout: 60000,
  })

  try {
    let page = null
    const deadline = Date.now() + 60000
    while (Date.now() < deadline) {
      page = application.windows().find(window => window.url().startsWith('http:'))
      if (page) break
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    assert.ok(page, 'main window loaded')
    await page.locator('h1').waitFor()
    await application.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows().find(item => item.webContents.getURL().startsWith('http:'))
      window.setSize(1366, 768)
    })
    await page.waitForTimeout(250)

    assert.equal(await page.locator('.nav-item').count(), 5)

    await page.getByRole('button', { name: 'Histórico' }).click()
    await page.getByRole('heading', { level: 1, name: 'Histórico de downloads' }).waitFor()
    await page.getByRole('button', { name: 'Configurações' }).click()
    await page.getByRole('heading', { level: 1, name: 'Configurações' }).waitFor()

    const reducedSwitch = page.getByRole('switch', { name: 'Reduzir animações' })
    await reducedSwitch.waitFor()
    assert.equal(await page.locator('.background-scene__particle').count(), 10)
    await reducedSwitch.click()
    await page.waitForTimeout(100)
    assert.equal(await page.evaluate(() => document.documentElement.dataset.motion), 'reduced')
    assert.equal(await page.locator('.background-scene__particle').count(), 0)
    await reducedSwitch.click()
    await page.waitForTimeout(100)
    assert.equal(await page.evaluate(() => document.documentElement.dataset.motion ?? null), null)
    assert.equal(await page.locator('.background-scene__particle').count(), 10)

    await page.getByRole('button', { name: 'Atualizações' }).click()
    await page.getByRole('heading', { level: 1, name: 'Atualizações' }).waitFor()
    assert.match(await page.locator('.updates-card').innerText(), /Canal não configurado/)
    assert.equal(await page.locator('.updates-card .progress-bar').count(), 0)

    await page.getByRole('button', { name: 'Imagens', exact: true }).click()
    await page.locator('h1').waitFor()
    await page.evaluate(image => {
      const media = [
        { id: '00000000-0000-0000-0000-000000000001', type: 'image', downloadUrl: image, previewUrl: image, width: 640, height: 400, format: 'png', filename: 'ui-test.png' },
        { id: '00000000-0000-0000-0000-000000000002', type: 'image', downloadUrl: image, previewUrl: image, width: 640, height: 400, format: 'png', filename: 'ui-test-2.png' },
      ]
      const original = window.fetch
      window.fetch = async (input, init) => {
        const target = typeof input === 'string' ? input : input.url
        if (target.includes('/api/instagram/resolve')) {
          await new Promise(resolve => setTimeout(resolve, 700))
          return new Response(JSON.stringify({ success: true, data: { media } }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        return original(input, init)
      }
    }, previewImage)
    await page.getByLabel('Link do Instagram').fill('https://www.instagram.com/p/UiPreview1/')
    await page.getByRole('button', { name: 'Baixar imagem' }).click()
    await page.locator('.skeleton-card').first().waitFor()
    await page.locator('.media-card').first().waitFor()
    assert.equal(await page.locator('.media-card').count(), 2)
    assert.match(await page.locator('.media-card').first().innerText(), /640 × 400/)
    assert.match(await page.locator('.toast').first().innerText(), /Imagens encontradas/)
    for (let attempt = 0; attempt < 6 && await page.getByRole('button', { name: 'Fechar notificação' }).count(); attempt++) {
      await page.getByRole('button', { name: 'Fechar notificação' }).first().click().catch(() => undefined)
      await page.waitForTimeout(220)
    }

    const fixture = await sharp({ create: { width: 80, height: 50, channels: 3, background: '#ec4899' } }).png().toBuffer()
    await application.evaluate(({ session, net }, bytes) => {
      session.fromPartition('instasave').protocol.handle('http', request => {
        if (new URL(request.url).pathname === '/api/instagram/download/00000000-0000-0000-0000-000000000001') {
          return new Response(Buffer.from(bytes), { headers: { 'Content-Type': 'image/png', 'Content-Disposition': 'attachment; filename="ui-test.png"' } })
        }
        return net.fetch(request, { bypassCustomProtocolHandlers: true })
      })
    }, [...fixture])

    await page.locator('.media-card').first().getByRole('link', { name: 'Baixar arquivo' }).click()
    await page.waitForFunction(() => [...document.querySelectorAll('.download-state')].some(element => element.textContent.includes('Download concluído!')))
    assert.match(await page.locator('.download-state').first().innerText(), /ui-test\.png/)
    for (let attempt = 0; attempt < 50; attempt++) {
      try {
        if ((await fs.readFile(path.join(downloadDir, 'ui-test.png'))).equals(fixture)) break
      } catch {}
      await page.waitForTimeout(100)
    }
    assert.deepEqual(await fs.readFile(path.join(downloadDir, 'ui-test.png')), fixture)

    await page.getByRole('button', { name: 'Histórico' }).click()
    await page.getByRole('heading', { level: 1, name: 'Histórico de downloads' }).waitFor()
    assert.match(await page.locator('.history-panel').innerText(), /ui-test\.png/)

    await application.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows().find(item => item.webContents.getURL().startsWith('http:'))
      window.setSize(720, 560)
    })
    await page.waitForTimeout(450)
    const layout = await page.evaluate(() => {
      const indicator = document.querySelector('.nav-indicator')
      const active = document.querySelector('.nav-item.is-active')
      const icon = document.querySelector('.nav-item .animated-icon')
      const label = document.querySelector('.nav-item .nav-item__label')
      return {
        overflow: [...document.querySelectorAll('header, main, footer, input, button')]
          .filter(element => element.getBoundingClientRect().right > innerWidth + 1)
          .map(element => element.className),
        indicatorWidth: indicator?.getBoundingClientRect().width ?? 0,
        activeWidth: active?.getBoundingClientRect().width ?? 0,
        iconDisplay: icon ? getComputedStyle(icon).display : null,
        labelDisplay: label ? getComputedStyle(label).display : null,
      }
    })
    assert.deepEqual(layout.overflow, [])
    assert.ok(Math.abs(layout.indicatorWidth - layout.activeWidth) < 1, 'active indicator follows compact nav item')
    assert.notEqual(layout.iconDisplay, 'none')
    assert.equal(layout.labelDisplay, 'none')
  } finally {
    await application.close()
  }
})
