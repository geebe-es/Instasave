/*
 * Captura prévias visuais do InstaSave em modo de desenvolvimento.
 * Usa mídia de fixture apenas para compor as telas; não altera o backend.
 */
const { _electron: electron } = require('@playwright/test')
const path = require('node:path')
const fs = require('node:fs/promises')
const os = require('node:os')
const sharp = require('sharp')

const root = path.resolve(__dirname, '..')
const output = path.join(root, 'test-results', 'motion')

function art(title, from, to, accent) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="600" viewBox="0 0 960 600">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${from}"/>
        <stop offset="1" stop-color="${to}"/>
      </linearGradient>
      <radialGradient id="light" cx="28%" cy="22%" r="80%">
        <stop offset="0" stop-color="#ffffff" stop-opacity=".42"/>
        <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="960" height="600" fill="url(#bg)"/>
    <circle cx="770" cy="130" r="220" fill="${accent}" opacity=".24"/>
    <circle cx="140" cy="500" r="250" fill="#50106d" opacity=".25"/>
    <path d="M0 450 C210 360 340 560 560 420 C740 305 820 400 960 330 V600 H0Z" fill="#160a2c" opacity=".34"/>
    <rect x="54" y="52" width="852" height="496" rx="36" fill="none" stroke="#fff" stroke-opacity=".16"/>
    <text x="72" y="105" fill="#fff" font-family="Arial, sans-serif" font-size="19" font-weight="700" letter-spacing="5">INSTASAVE · PRÉVIA</text>
    <text x="72" y="470" fill="#fff" font-family="Arial, sans-serif" font-size="52" font-weight="800">${title}</text>
    <rect x="72" y="506" width="${Math.max(150, title.length * 24)}" height="6" rx="3" fill="${accent}"/>
    <rect width="960" height="600" fill="url(#light)"/>
  </svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

async function main() {
  await fs.mkdir(output, { recursive: true })
  const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'instasave-preview-'))
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
    if (!page) throw new Error('A janela principal não abriu.')
    await page.locator('h1').waitFor()
    await page.getByRole('button', { name: 'Escolher pasta' }).waitFor()
    await application.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows().find(item => item.webContents.getURL().startsWith('http:'))
      window.setContentSize(1920, 1080)
      window.center()
    })
    await page.waitForTimeout(700)

    const size = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }))
    console.log('viewport', size)
    await page.screenshot({ path: path.join(output, 'download-empty-1920.png') })

    await page.getByLabel('Link do Instagram').fill('https://127.0.0.1/p/Abcde12/')
    await page.getByRole('button', { name: 'Baixar imagem' }).click()
    await page.locator('.status.error').waitFor()
    await page.waitForTimeout(300)
    await page.screenshot({ path: path.join(output, 'download-error-1920.png') })

    const images = [
      art('Imagem 01', '#7c3aed', '#db2777', '#ff9e19'),
      art('Vídeo 01', '#4c1d95', '#be185d', '#fdba74'),
      art('Carrossel 01', '#312e81', '#9333ea', '#f472b6'),
    ]
    await page.evaluate((previewImages) => {
      const media = [
        { id: 'preview-image-1', type: 'image', downloadUrl: previewImages[0], previewUrl: previewImages[0], width: 960, height: 600, format: 'png', filename: 'instasave-imagem-01.png' },
        { id: 'preview-video-1', type: 'video', downloadUrl: previewImages[1], previewUrl: previewImages[1], width: 1080, height: 1920, format: 'mp4', filename: 'instasave-video-01.mp4' },
        { id: 'preview-carousel-1', type: 'image', downloadUrl: previewImages[2], previewUrl: previewImages[2], width: 1440, height: 1800, format: 'png', filename: 'instasave-carrossel-01.png' },
      ]
      const original = window.fetch
      window.fetch = async (input, init) => {
        const target = typeof input === 'string' ? input : input.url
        if (target.includes('/api/instagram/resolve')) {
          await new Promise(resolve => setTimeout(resolve, 900))
          return new Response(JSON.stringify({ success: true, data: { media } }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        return original(input, init)
      }
    }, images)
    await page.getByLabel('Link do Instagram').fill('https://www.instagram.com/p/PreviewCaso/')
    await page.getByRole('button', { name: 'Baixar imagem' }).click()
    await page.locator('.skeleton-card').first().waitFor()
    await page.waitForTimeout(120)
    await page.screenshot({ path: path.join(output, 'download-skeleton-1920.png') })
    await page.locator('.media-card').first().waitFor()
    await page.waitForTimeout(650)
    await page.screenshot({ path: path.join(output, 'download-results-1920.png') })

    const toasts = page.getByRole('button', { name: 'Fechar notificação' })
    for (let attempt = 0; attempt < 6 && await toasts.count(); attempt++) {
      await toasts.first().click().catch(() => undefined)
      await page.waitForTimeout(220)
    }
    await page.waitForTimeout(250)

    const fixture = await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#ff3d81' } })
      .png({ compressionLevel: 0 })
      .toBuffer()
    await application.evaluate(({ session, net }, encoded) => {
      session.fromPartition('instasave').protocol.handle('http', request => {
        if (new URL(request.url).pathname === '/api/instagram/download/00000000-0000-0000-0000-000000000000') {
          const bytes = Buffer.from(encoded, 'base64')
          const chunkSize = Math.ceil(bytes.length / 32)
          let offset = 0
          const stream = new ReadableStream({
            async pull(controller) {
              if (offset >= bytes.length) {
                controller.close()
                return
              }
              const end = Math.min(offset + chunkSize, bytes.length)
              controller.enqueue(bytes.subarray(offset, end))
              offset = end
              await new Promise(resolve => setTimeout(resolve, 90))
            },
          })
          return new Response(stream, {
            headers: {
              'Content-Type': 'image/png',
              'Content-Length': String(bytes.length),
              'Content-Disposition': 'attachment; filename="preview.png"',
            },
          })
        }
        return net.fetch(request, { bypassCustomProtocolHandlers: true })
      })
    }, fixture.toString('base64'))
    await page.evaluate(() => window.desktop.download('00000000-0000-0000-0000-000000000000'))
    await page.waitForFunction(() => {
      const bar = document.querySelector('.download-state [role="progressbar"]')
      if (!bar) return false
      const value = Number(bar.getAttribute('aria-valuenow'))
      return Number.isFinite(value) && value > 8 && value < 92
    }, null, { timeout: 20000 })
    await page.screenshot({ path: path.join(output, 'download-progress-1920.png') })
    await page.waitForFunction(() => [...document.querySelectorAll('.download-state')].some(element => element.textContent.includes('Download concluído!')), null, { timeout: 20000 })
    await page.waitForTimeout(700)
    await page.screenshot({ path: path.join(output, 'download-complete-1920.png') })
    for (let attempt = 0; attempt < 6 && await toasts.count(); attempt++) {
      await toasts.first().click().catch(() => undefined)
      await page.waitForTimeout(220)
    }
    await page.waitForTimeout(250)

    await page.getByRole('button', { name: 'Histórico' }).click()
    await page.locator('h1').filter({ hasText: 'Histórico de downloads' }).waitFor()
    await page.waitForTimeout(350)
    await page.screenshot({ path: path.join(output, 'history-1920.png') })

    await page.getByRole('button', { name: 'Configurações' }).click()
    await page.locator('h1').filter({ hasText: 'Configurações' }).waitFor()
    await page.waitForTimeout(350)
    await page.screenshot({ path: path.join(output, 'settings-1920.png') })

    const motionSwitch = page.getByRole('switch', { name: 'Reduzir animações' })
    await motionSwitch.click()
    await page.waitForTimeout(250)
    const motionAttr = await page.evaluate(() => document.documentElement.dataset.motion)
    console.log('motion', motionAttr)
    await page.screenshot({ path: path.join(output, 'settings-reduced-1920.png') })
    if (await motionSwitch.isChecked() && await motionSwitch.isEnabled()) {
      await motionSwitch.click()
      await page.waitForTimeout(250)
    }

    await page.getByRole('button', { name: 'Atualizações' }).click()
    await page.locator('h1').filter({ hasText: 'Atualizações' }).waitFor()
    await page.waitForTimeout(350)
    await page.screenshot({ path: path.join(output, 'updates-1920.png') })

    // ===================== Página de Vídeos (menu novo) =====================
    await page.getByRole('button', { name: 'Vídeos' }).click()
    await page.locator('h1').filter({ hasText: 'Baixar vídeos do Instagram' }).waitFor()
    await page.waitForTimeout(450)
    await page.screenshot({ path: path.join(output, 'videos-empty-1920.png') })

    const posters = [
      art('Reel 01', '#ff8a3d', '#ec4899', '#ffd9b0'),
      art('Reel 02', '#7c3aed', '#db2777', '#ffd1e5'),
      art('Reel 03', '#4c1d95', '#be185d', '#fdba74'),
    ]
    const singlePoster = art('Reel único', '#ff8a3d', '#ec4899', '#ffd1e5')
    await page.evaluate(previewPosters => {
      const media = [
        { id: '00000000-0000-0000-0000-000000000001', type: 'video', downloadUrl: '/api/instagram/download/00000000-0000-0000-0000-000000000001', previewUrl: previewPosters[0], videoPreviewUrl: '/api/instagram/preview/00000000-0000-0000-0000-000000000001', width: 1080, height: 1920, format: 'mp4', filename: 'instasave-carrossel-01.mp4', duration: 46.2 },
        { id: '00000000-0000-0000-0000-000000000002', type: 'video', downloadUrl: '/api/instagram/download/00000000-0000-0000-0000-000000000002', previewUrl: previewPosters[1], videoPreviewUrl: '/api/instagram/preview/00000000-0000-0000-0000-000000000002', width: 1920, height: 1080, format: 'mp4', filename: 'instasave-carrossel-02.mp4', duration: 128.7 },
        { id: '00000000-0000-0000-0000-000000000003', type: 'video', downloadUrl: '/api/instagram/download/00000000-0000-0000-0000-000000000003', previewUrl: previewPosters[2], videoPreviewUrl: '/api/instagram/preview/00000000-0000-0000-0000-000000000003', width: 1080, height: 1080, format: 'mp4', filename: 'instasave-carrossel-03.mp4', duration: 12.4 },
      ]
      const original = window.fetch
      window.fetch = async (input, init) => {
        const target = typeof input === 'string' ? input : input.url
        if (target.includes('/api/instagram/video/resolve')) {
          await new Promise(resolve => setTimeout(resolve, 900))
          return new Response(JSON.stringify({ success: true, data: { type: 'carousel', total: 3, totalMedia: 5, media } }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        return original(input, init)
      }
    }, posters)
    await page.getByLabel('Link do vídeo do Instagram').fill('https://www.instagram.com/p/PreviewCaso/')
    await page.getByRole('button', { name: 'Baixar vídeo' }).click()
    await page.locator('.skeleton-card').first().waitFor()
    await page.waitForTimeout(120)
    await page.screenshot({ path: path.join(output, 'videos-skeleton-1920.png') })
    await page.locator('.video-card').first().waitFor()
    await page.waitForTimeout(650)
    await page.screenshot({ path: path.join(output, 'videos-selection-1920.png') })
    for (let attempt = 0; attempt < 6 && await toasts.count(); attempt++) {
      await toasts.first().click().catch(() => undefined)
      await page.waitForTimeout(220)
    }

    const videoFixture = await sharp({ create: { width: 256, height: 256, channels: 3, background: '#b7277f' } })
      .png({ compressionLevel: 0 })
      .toBuffer()
    await application.evaluate(({ session, net }, payload) => {
      const { names, encoded } = payload
      const partition = session.fromPartition('instasave')
      try { partition.protocol.unhandle('http') } catch { /* handler antigo já removido */ }
      partition.protocol.handle('http', request => {
        const route = new URL(request.url).pathname
        const id = route.replace('/api/instagram/download/', '')
        const file = names[id]
        if (file) {
          const bytes = Buffer.from(encoded, 'base64')
          const chunkSize = Math.ceil(bytes.length / 32)
          let offset = 0
          const stream = new ReadableStream({
            async pull(controller) {
              if (offset >= bytes.length) {
                controller.close()
                return
              }
              const end = Math.min(offset + chunkSize, bytes.length)
              controller.enqueue(bytes.subarray(offset, end))
              offset = end
              await new Promise(resolve => setTimeout(resolve, 85))
            },
          })
          return new Response(stream, {
            headers: {
              'Content-Type': 'video/mp4',
              'Content-Length': String(bytes.length),
              'Content-Disposition': `attachment; filename="${file}"`,
            },
          })
        }
        return net.fetch(request, { bypassCustomProtocolHandlers: true })
      })
    }, {
      names: {
        '00000000-0000-0000-0000-000000000001': 'instasave-carrossel-01.mp4',
        '00000000-0000-0000-0000-000000000002': 'instasave-carrossel-02.mp4',
        '00000000-0000-0000-0000-000000000003': 'instasave-carrossel-03.mp4',
        '00000000-0000-0000-0000-000000000004': 'instasave-reel-01.mp4',
      },
      encoded: videoFixture.toString('base64'),
    })

    await page.getByRole('button', { name: 'Selecionar vídeo 2' }).click()
    await page.waitForTimeout(250)
    await page.getByRole('button', { name: 'Baixar seleção (2)' }).click()
    await page.waitForFunction(() => {
      const bar = document.querySelector('.download-state [role="progressbar"]')
      if (!bar) return false
      const value = Number(bar.getAttribute('aria-valuenow'))
      return Number.isFinite(value) && value > 8 && value < 92
    }, null, { timeout: 20000 })
    await page.screenshot({ path: path.join(output, 'videos-progress-1920.png') })
    await page.waitForFunction(() => [...document.querySelectorAll('.download-state')].filter(element => element.textContent.includes('Download concluído!')).length >= 2, null, { timeout: 30000 })
    await page.waitForTimeout(700)
    await page.screenshot({ path: path.join(output, 'videos-complete-1920.png') })
    for (let attempt = 0; attempt < 6 && await toasts.count(); attempt++) {
      await toasts.first().click().catch(() => undefined)
      await page.waitForTimeout(220)
    }
    await page.waitForTimeout(250)

    await page.evaluate(singlePreview => {
      const media = [
        { id: '00000000-0000-0000-0000-000000000004', type: 'video', downloadUrl: '/api/instagram/download/00000000-0000-0000-0000-000000000004', previewUrl: singlePreview, videoPreviewUrl: '/api/instagram/preview/00000000-0000-0000-0000-000000000004', width: 1080, height: 1920, format: 'mp4', filename: 'instasave-reel-01.mp4', duration: 46.2 },
      ]
      const original = window.fetch
      window.fetch = async (input, init) => {
        const target = typeof input === 'string' ? input : input.url
        if (target.includes('/api/instagram/video/resolve')) {
          await new Promise(resolve => setTimeout(resolve, 600))
          return new Response(JSON.stringify({ success: true, data: { type: 'video', total: 1, totalMedia: 1, media } }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        }
        return original(input, init)
      }
    }, singlePoster)
    await page.getByLabel('Link do vídeo do Instagram').fill('https://www.instagram.com/reel/PreviewReel1/')
    await page.getByRole('button', { name: 'Baixar vídeo' }).click()
    await page.locator('.video-card').waitFor()
    await page.waitForFunction(() => [...document.querySelectorAll('.download-state')].some(element => element.textContent.includes('instasave-reel-01.mp4') && element.textContent.includes('Baixando…')), null, { timeout: 30000 })
    await page.locator('.download-list').first().evaluate(element => { element.scrollTop = element.scrollHeight }).catch(() => undefined)
    await page.waitForTimeout(200)
    await page.screenshot({ path: path.join(output, 'videos-single-progress-1920.png') })
    await page.waitForFunction(() => [...document.querySelectorAll('.download-state')].some(element => element.textContent.includes('instasave-reel-01.mp4') && element.textContent.includes('Download concluído!')), null, { timeout: 30000 })
    await page.locator('.download-list').first().evaluate(element => { element.scrollTop = element.scrollHeight }).catch(() => undefined)
    await page.waitForTimeout(800)
    await page.screenshot({ path: path.join(output, 'videos-single-1920.png') })
    for (let attempt = 0; attempt < 6 && await toasts.count(); attempt++) {
      await toasts.first().click().catch(() => undefined)
      await page.waitForTimeout(220)
    }
    await page.waitForTimeout(250)

    await page.getByRole('button', { name: 'Histórico' }).click()
    await page.locator('h1').filter({ hasText: 'Histórico de downloads' }).waitFor()
    await page.waitForTimeout(350)
    await page.screenshot({ path: path.join(output, 'history-videos-1920.png') })

    await page.locator('.nav-item').first().click()
    await page.locator('h1').waitFor()
    await application.evaluate(({ BrowserWindow }) => {
      const window = BrowserWindow.getAllWindows().find(item => item.webContents.getURL().startsWith('http:'))
      window.setContentSize(720, 560)
      window.center()
    })
    await page.waitForTimeout(600)
    await page.screenshot({ path: path.join(output, 'download-results-720.png') })
    const overflow = await page.evaluate(() => [...document.querySelectorAll('header, main, footer, input, button')]
      .filter(element => element.getBoundingClientRect().right > innerWidth + 1)
      .map(element => element.className))
    const nav = await page.evaluate(() => {
      const indicator = document.querySelector('.nav-indicator')
      const item = document.querySelector('.nav-item.is-active')
      return {
        indicator: indicator ? indicator.getBoundingClientRect().toJSON() : null,
        item: item ? item.getBoundingClientRect().toJSON() : null,
      }
    })
    console.log('overflow', overflow)
    console.log('nav', nav)
    console.log('screenshots', output)
  } finally {
    await application.close()
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
