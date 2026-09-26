import assert from 'node:assert/strict'
import test from 'node:test'
import { selectBestMediaVersion } from '../src/services/instagram/media-selector.js'

test('selects the largest verified version by pixels', () => {
  const result = selectBestMediaVersion([{ url: 'https://media.example/320.jpg', width: 320, height: 320 }, { url: 'https://media.example/1080.jpg', width: 1080, height: 1080 }, { url: 'https://media.example/640.jpg', width: 640, height: 640 }])
  assert.equal(result?.width, 1080)
})
