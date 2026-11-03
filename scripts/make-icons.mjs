// Render the icon PNGs from the source SVGs with headless Chromium.
// Usage: npm run icons   (replace assets/app/app-icon*.svg with your design's art first)
import { chromium } from 'playwright';
import { readFile, mkdir } from 'node:fs/promises';

const jobs = [
  ['assets/app/app-icon.svg', 'icons/icon-512.png', 512],
  ['assets/app/app-icon.svg', 'icons/icon-192.png', 192],
  // iOS rounds the corners itself, so the Apple icon uses the full-bleed art.
  ['assets/app/app-icon-maskable.svg', 'icons/apple-touch-icon.png', 180],
  ['assets/app/app-icon-maskable.svg', 'icons/icon-maskable-512.png', 512],
];

await mkdir('icons', { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [src, out, size] of jobs) {
  const svg = (await readFile(src, 'utf8')).replace('<svg', `<svg width="${size}" height="${size}"`);
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<!doctype html><style>html,body{margin:0}svg{display:block}</style>${svg}`);
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: size, height: size } });
  console.log('wrote', out);
}
await browser.close();
