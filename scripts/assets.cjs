const fs = require('node:fs/promises');
const sharp = require('sharp');
module.exports = async function () {
  await fs.mkdir('resources', { recursive: true });
  const png = await sharp('assets/brand/instasave-icon.svg').resize(256, 256).png().toBuffer();
  const ico = await (await import('png-to-ico')).default(png);
  await fs.writeFile('resources/icon.ico', ico);
  const path = require('node:path');
  const notices = [], seen = new Set();
  async function collect(name, parent = path.resolve('backend')) {
    let directory = path.join(parent, 'node_modules', name);
    try { await fs.access(path.join(directory, 'package.json')); } catch { directory = path.resolve('backend/node_modules', name); }
    if (seen.has(directory)) return;
    seen.add(directory);
    const pkg = JSON.parse(await fs.readFile(path.join(directory, 'package.json'), 'utf8'));
    notices.push(`\n===== ${pkg.name} ${pkg.version} (${pkg.license || 'see license'}) =====\n`);
    for (const file of await fs.readdir(directory)) {
      if (/^(license|copying|notice)(\.|$)/i.test(file)) notices.push(await fs.readFile(path.join(directory, file), 'utf8'));
    }
    for (const dependency of Object.keys(pkg.dependencies || {})) await collect(dependency, directory);
  }
  for (const dependency of Object.keys(require('../backend/package.json').dependencies)) await collect(dependency);
  await fs.writeFile('resources/THIRD-PARTY-NOTICES.txt', notices.join('\n'));
  for (const family of ['dm-sans', 'manrope']) {
    for (const target of ['assets/fonts', 'dist/fonts']) {
      await fs.mkdir(target, { recursive: true });
      await fs.copyFile(`frontend/node_modules/@fontsource-variable/${family}/files/${family}-latin-wght-normal.woff2`, `${target}/${family}-latin-wght-normal.woff2`);
      await fs.copyFile(`frontend/node_modules/@fontsource-variable/${family}/LICENSE`, `${target}/${family}-LICENSE.txt`);
    }
  }
  await fs.mkdir('dist/brand', { recursive: true });
  await fs.copyFile('assets/brand/instasave-icon.svg', 'dist/brand/instasave-icon.svg');
  await fs.mkdir('build', { recursive: true });
  const logo = await fs.readFile('assets/brand/instasave-icon.svg');
  for (const [name, width, height, size] of [['installer-sidebar',164,314,120],['installer-header',150,57,48]]) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#100b22"/><stop offset="1" stop-color="#2b1157"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#bg)"/><image href="data:image/svg+xml;base64,${logo.toString('base64')}" x="${(width-size)/2}" y="${(height-size)/2}" width="${size}" height="${size}"/></svg>`;
    const pixels = await sharp(Buffer.from(svg)).flatten({ background: '#100b22' }).removeAlpha().raw().toBuffer();
    const stride = Math.ceil(width * 3 / 4) * 4;
    const bmp = Buffer.alloc(54 + stride * height);
    bmp.write('BM'); bmp.writeUInt32LE(bmp.length, 2); bmp.writeUInt32LE(54, 10); bmp.writeUInt32LE(40, 14);
    bmp.writeInt32LE(width, 18); bmp.writeInt32LE(height, 22); bmp.writeUInt16LE(1, 26); bmp.writeUInt16LE(24, 28);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const from = (y * width + x) * 3, to = 54 + (height - 1 - y) * stride + x * 3;
      bmp[to] = pixels[from + 2]; bmp[to + 1] = pixels[from + 1]; bmp[to + 2] = pixels[from];
    }
    await fs.writeFile(`build/${name}.bmp`, bmp);
  }
};
