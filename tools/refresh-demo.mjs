// Re-apply the current passport UI and snapshot fixes to an already generated demo,
// offline: no brand-site crawl, the evidence model and asset map come from the
// demo's snapshot-manifest.json. Also rewrites the single-file <name>.standalone.html.
//
//   node tools/refresh-demo.mjs demos/theloomart/black-spade-blazer.html [...more demos]
//
// Set CHROMIUM_PATH to use a specific Chromium build for the preview PNG.
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {finalizeHtml, inlineAssets} from './lib/snapshot.mjs';
import {renderPassport, PASSPORT_CSS, PASSPORT_RUNTIME} from './lib/passport-ui.mjs';
import {pickImages} from './lib/passport-model.mjs';
import {loadStock, STOCK_DIR} from './lib/stock.mjs';

const files = process.argv.slice(2);
if (!files.length) {
  console.error('Usage: node tools/refresh-demo.mjs <demo.html> [...]');
  process.exit(1);
}

const stock = await loadStock();

const replaceBetween = (html, start, end, next) => {
  const i = html.indexOf(start), j = i < 0 ? -1 : html.indexOf(end, i);
  if (j < 0) throw new Error(`Marker not found: ${start}`);
  return html.slice(0, i) + next + html.slice(j + end.length);
};

for (const file of files) {
  const dir = path.dirname(path.resolve(file));
  const manifestPath = path.join(dir, 'snapshot-manifest.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const m = manifest.passport, map = new Map(manifest.assets);

  // Re-pick section images with the current rules, from the archive images the crawl
  // recorded; copy any fixed illustrative image into assets/ like a captured image.
  m.images = pickImages({hero: m.product.hero, title: m.product.name, url: m.product.url},
    {images: manifest.archiveImagesConsidered || []}, m.craft.key, stock);
  for (const s of Object.values(stock)) {
    if (!Object.values(m.images).some(i => i?.src === s.src)) continue;
    const local = `assets/stock-${s.file}`;
    await fs.copyFile(path.join(STOCK_DIR, s.file), path.join(dir, local));
    map.set(s.src, local);
  }
  manifest.assets = [...map.entries()];
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

  const {pill, panel} = renderPassport(m);
  let html = await fs.readFile(file, 'utf8');
  html = replaceBetween(html, '<button id="pp-pill"', '</aside>', pill + panel);
  html = replaceBetween(html, '<style data-pp-style', '</style>', `<style data-pp-style="">${PASSPORT_CSS}</style>`);
  html = replaceBetween(html, '<script data-pp-runtime>', '</script>', `<script data-pp-runtime>${PASSPORT_RUNTIME}</script>`);
  html = await finalizeHtml({html, map, source: manifest.sourceUrl, dir});
  await fs.writeFile(file, html, 'utf8');
  await fs.writeFile(file.replace(/\.html?$/i, '') + '.standalone.html', await inlineAssets(html, dir), 'utf8');

  // Preview: passport open over the hero, same viewport as the generator.
  const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH || undefined});
  try {
    const page = await browser.newPage({viewport: {width: 1440, height: 1100}});
    await page.goto(pathToFileURL(path.resolve(file)).href);
    await page.waitForTimeout(800);
    await page.locator('.pp-engine-hero').scrollIntoViewIfNeeded();
    await page.click('[data-pp-pill]');
    await page.waitForTimeout(600);
    await page.screenshot({path: file.replace(/\.html?$/i, '') + '.png'});
  } finally {
    await browser.close();
  }
  console.log('refreshed', file);
}
