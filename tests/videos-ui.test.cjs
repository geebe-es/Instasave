const { test } = require('node:test')
const assert = require('node:assert/strict')
const { _electron: electron } = require('@playwright/test')
const path = require('node:path')
const fs = require('node:fs/promises')
const os = require('node:os')
const sharp = require('sharp')

const root = path.resolve(__dirname, '..')
const previewImage = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ff8a3d"/><stop offset="1" stop-color="#ec4899"/></linearGradient></defs><rect width="640" height="400" fill="url(#g)"/><circle cx="500" cy="110" r="150" fill="#fff" opacity=".16"/><text x="34" y="350" fill="#fff" font-family="Arial" font-size="34" font-weight="700">Poster de teste</text></svg>',
)}`

const VIDEO_IDS = ['00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003']
const VIDEO_NAMES = ['instasave-reel-01.mp4', 'instasave-carrossel-01.mp4', 'instasave-carrossel-02.mp4']

test('videos ui: navigation, detect, resolve, selection queue, history and restriction errors', { timeout: 140000 }, async () => {
  const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'instasave-videos-test-'))
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

    // ---------- página de vídeos: rótulos ePlaceholder ----------
    await page.getByRole('button', { name: 'Vídeos' }).click()
    await page.locator('h1').filter({ hasText: 'Baixar vídeos do Instagram' }).waitFor()
    const videosPageText = await page.locator('.videos-page').innerText()
    assert.match(videosPageText, /Baixe Reels, Stories e vídeos de publicações em um só lugar\./)
    const linkInput = page.getByLabel('Link do vídeo do Instagram')
    assert.equal(await linkInput.getAttribute('placeholder'), 'Cole o link do vídeo aqui...')

    // ---------- validação local: stories inválido não chama o backend ----------
    await page.evaluate(() => {
      const original = window.fetch
      window.fetch = async (input, init) => {
        const target = typeof input === 'string' ? input : input.url
        if (target.includes('/api/instagram/video/resolve')) throw new Error('backend não deveria ser chamado com link inválido')
        return original(input, init)
      }
      window.__videosOriginalFetch = original
    })
    await linkInput.fill('https://www.instagram.com/stories/u/123/')
    await page.getByRole('button', { name: 'Baixar vídeo' }).click()
    await page.locator('.status.error').waitFor()
    assert.match(await page.locator('.status').first().innerText(), /link válido de Reel, Stories/)
    await page.evaluate(() => { window.fetch = window.__videosOriginalFetch })

    // ---------- override único de fetch: 4 casos em rotas distintas ----------
    await page.evaluate(({ poster, ids, names }) => {
      const responses = new Map([
        ['https://www.instagram.com/reel/VideosTeste1/', {
          status: 200,
          payload: {
            success: true,
            data: {
              type: 'video', total: 1, totalMedia: 1,
              media: [{
                id: ids[0], type: 'video', downloadUrl: `/api/instagram/download/${ids[0]}`,
                previewUrl: poster, videoPreviewUrl: `/api/instagram/preview/${ids[0]}`,
                width: 1080, height: 1920, format: 'mp4', filename: names[0], duration: 81.5,
              }],
            },
          },
        }],
        ['https://www.instagram.com/p/PreviewCaso/', {
          status: 200,
          payload: {
            success: true,
            data: {
              type: 'carousel', total: 2, totalMedia: 4,
              media: [
                { id: ids[1], type: 'video', downloadUrl: `/api/instagram/download/${ids[1]}`, previewUrl: poster, videoPreviewUrl: `/api/instagram/preview/${ids[1]}`, width: 1920, height: 1080, format: 'mp4', filename: names[1], duration: 128.7 },
                { id: ids[2], type: 'video', downloadUrl: `/api/instagram/download/${ids[2]}`, previewUrl: poster, videoPreviewUrl: `/api/instagram/preview/${ids[2]}`, width: 1080, height: 1080, format: 'mp4', filename: names[2], duration: 54.9 },
              ],
            },
          },
        }],
        ['https://www.instagram.com/p/SoImagens1/', {
          status: 404,
          payload: { success: false, error: { code: 'NO_VIDEO', message: 'Esta publicação contém apenas imagens. Use o menu de imagens para salvá-las.' } },
        }],
        ['https://www.instagram.com/stories/usuario/3345123456789012345/', {
          status: 403,
          payload: { success: false, error: { code: 'STORY_ACCESS_RESTRICTED', message: 'O Instagram só disponibiliza stories para contas conectadas e autorizadas. O InstaSave não contorna controles de acesso.' } },
        }],
      ])
      const original = window.fetch
      window.fetch = async (input, init) => {
        const target = typeof input === 'string' ? input : input.url
        if (target.includes('/api/instagram/video/resolve')) {
          const body = JSON.parse(init.body)
          const response = responses.get(body.url) ?? { status: 500, payload: { success: false, error: { code: 'MISSING', message: `caso não mapeado: ${body.url}` } } }
          await new Promise(resolve => setTimeout(resolve, 450))
          return new Response(JSON.stringify(response.payload), { status: response.status, headers: { 'Content-Type': 'application/json' } })
        }
        return original(input, init)
      }
    }, { poster: previewImage, ids: VIDEO_IDS, names: VIDEO_NAMES })

    // ---------- download real (protocolo) das três mídias mp4 ----------
    const fixture = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#ff3d81' } }).png().toBuffer()
    await application.evaluate(({ session, net }, payload) => {
      const { names, bytes } = payload
      session.fromPartition('instasave').protocol.handle('http', request => {
        const route = new URL(request.url).pathname
        const fileName = names[route.replace('/api/instagram/download/', '')]
        if (fileName) {
          return new Response(Buffer.from(bytes), {
            headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(bytes.length), 'Content-Disposition': `attachment; filename="${fileName}"` },
          })
        }
        return net.fetch(request, { bypassCustomProtocolHandlers: true })
      })
    }, {
      names: {
        [VIDEO_IDS[0]]: VIDEO_NAMES[0],
        [VIDEO_IDS[1]]: VIDEO_NAMES[1],
        [VIDEO_IDS[2]]: VIDEO_NAMES[2],
      },
      bytes: [...fixture],
    })

    // ---------- 1) Reel público: análise, cartão e download automático ----------
    await linkInput.fill('https://www.instagram.com/reel/VideosTeste1/')
    await page.getByRole('button', { name: 'Baixar vídeo' }).click()
    await page.locator('.video-card').first().waitFor()
    const card = page.locator('.video-card').first()
    assert.match(await card.innerText(), /Reel/)
    assert.match(await card.innerText(), /1:22/)
    assert.match(await card.innerText(), /1080 × 1920/)
    assert.match(await card.innerText(), /MP4/)
    await page.waitForFunction(() => [...document.querySelectorAll('.download-state')].some(element => element.textContent.includes('Download concluído!')), null, { timeout: 20000 })
    assert.deepEqual(await fs.readFile(path.join(downloadDir, VIDEO_NAMES[0])), fixture)

    // ---------- 2) carrossel: seleção e download sequencial ----------
    await linkInput.fill('https://www.instagram.com/p/PreviewCaso/')
    await page.getByRole('button', { name: 'Baixar vídeo' }).click()
    await page.waitForFunction(() => document.querySelectorAll('.video-card').length === 2, null, { timeout: 15000 })
    assert.match(await page.locator('.video-content__note').innerText(), /também contém imagens/)
    assert.match(await page.locator('.video-content__bar').innerText(), /2 de 2 selecionado/)
    await page.locator('.video-content__bar .glow-button').click()
    await page.waitForFunction(() => [...document.querySelectorAll('.download-state')].filter(element => element.textContent.includes('Download concluído!')).length >= 3, null, { timeout: 30000 })
    assert.deepEqual(await fs.readFile(path.join(downloadDir, VIDEO_NAMES[1])), fixture)
    assert.deepEqual(await fs.readFile(path.join(downloadDir, VIDEO_NAMES[2])), fixture)

    // ---------- 3) publicação sem vídeo: erro amigável ----------
    await linkInput.fill('https://www.instagram.com/p/SoImagens1/')
    await page.getByRole('button', { name: 'Baixar vídeo' }).click()
    await page.locator('.media-error').waitFor()
    assert.match(await page.locator('.media-error').innerText(), /apenas imagens/)

    // ---------- 4) story restrito: erro honesto sem bypass ----------
    await linkInput.fill('https://www.instagram.com/stories/usuario/3345123456789012345/')
    await page.getByRole('button', { name: 'Baixar vídeo' }).click()
    await page.waitForFunction(() => [...document.querySelectorAll('.media-error')].some(element => element.textContent.includes('controles de acesso')), null, { timeout: 15000 })

    // ---------- 5) histórico preserva imagens e identifica vídeos ----------
    await page.getByRole('button', { name: 'Histórico' }).click()
    await page.locator('h1').filter({ hasText: 'Histórico de downloads' }).waitFor()
    const history = await page.locator('.history-panel').innerText()
    assert.match(history, /instasave-reel-01\.mp4/)
    assert.match(history, /instasave-carrossel-02\.mp4/)
  } finally {
    await application.close()
  }
})
