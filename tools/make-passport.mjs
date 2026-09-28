// Product passport generator.
//
//   node tools/make-passport.mjs <website-or-product-url> [output.html] [product-name-hint]
//
// 1. Open the site, find the product page, snapshot it.
// 2. Extract product-page facts and lightly crawl the brand archive (About/Craft/Story).
// 3. Build an evidence model (nothing invented; gaps stay "Not linked").
// 4. Inject the passport pill + panel into the visible hero image and save a static,
//    self-contained copy with localized assets, a manifest and a preview screenshot.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {openBrowser, captureResources, load, findProductPage, primeLazyContent, localize, stripScripts, fetchExtraImages, inlineAssets} from './lib/snapshot.mjs';
import {extractProduct} from './lib/extract.mjs';
import {crawlArchive} from './lib/archive.mjs';
import {buildPassportModel} from './lib/passport-model.mjs';
import {renderPassport, PASSPORT_CSS, PASSPORT_RUNTIME} from './lib/passport-ui.mjs';

const [input, output = 'generated/passport.html', hint = ''] = process.argv.slice(2);
if (!input) {
  console.error('Usage: node tools/make-passport.mjs <website-or-product-url> [output.html] [product-name]');
  process.exit(1);
}
const dir = path.resolve(path.dirname(output));

// Illustrative stock artisan images (fallback only; see tools/stock/stock.json).
const stockDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'stock');
const stockMeta = JSON.parse(await fs.readFile(path.join(stockDir, 'stock.json'), 'utf8'));
const stock = Object.fromEntries(Object.entries(stockMeta).filter(([k]) => !k.startsWith('_'))
  .map(([k, v]) => [k, {...v, src: `https://stock.passport.local/${v.file}`}]));
await fs.mkdir(dir, {recursive: true});

const {browser, context, page} = await openBrowser();
try {
  await context.route('https://stock.passport.local/**', route =>
    route.fulfill({path: path.join(stockDir, new URL(route.request().url()).pathname.slice(1)), contentType: 'image/jpeg'}));
  const resources = captureResources(page);
  await load(page, input);
  const source = await findProductPage(page, hint);
  await primeLazyContent(page);

  const product = await extractProduct(page);
  const archive = await crawlArchive(context, page, product);
  const model = buildPassportModel(product, archive, stock);
  const {pill, panel} = renderPassport(model);

  // Mount on the container that tightly wraps the tagged hero image.
  await page.evaluate(({pill, panel, css}) => {
    const hero = document.querySelector('img[data-pp-hero-img]') || document.images[0];
    const ir = hero?.getBoundingClientRect();
    const fits = e => {
      if (!e || !ir) return false;
      const r = e.getBoundingClientRect();
      return r.width >= ir.width * .92 && r.height >= ir.height * .92 && r.width <= innerWidth * 1.08;
    };
    let wrap = hero?.closest('figure');
    if (!fits(wrap)) for (let p = hero?.parentElement, i = 0; p && i < 8; p = p.parentElement, i++) if (fits(p)) { wrap = p; break; }
    wrap = wrap || hero?.parentElement;
    // Never mount inside a link: the panel contains links/buttons, and nested interactive
    // content is re-parented when the saved HTML is parsed again, scrambling the panel.
    while (wrap?.closest('a,button')) wrap = wrap.closest('a,button').parentElement;
    if (!wrap) throw new Error('No hero container');
    wrap.classList.add('pp-engine-hero');
    const style = document.createElement('style');
    style.setAttribute('data-pp-style', '');
    style.textContent = css;
    document.head.appendChild(style);
    wrap.insertAdjacentHTML('beforeend', pill + panel);
  }, {pill, panel, css: PASSPORT_CSS});

  const archiveImages = Object.values(model.images).filter(i => i?.kind === 'archive').map(i => i.src);
  const extra = await fetchExtraImages(context, archiveImages);
  for (const s of Object.values(stock)) if (Object.values(model.images).some(i => i?.src === s.src))
    extra.push({url: s.src, type: 'image', ct: 'image/jpeg', body: await fs.readFile(path.join(stockDir, s.file))});
  let {html, map} = await localize({html: stripScripts(await page.content()), resources, extra, source, dir});
  html = html.replace('</body>', `<script data-pp-runtime>${PASSPORT_RUNTIME}</script></body>`);
  await fs.writeFile(path.resolve(output), '<!doctype html>\n' + html, 'utf8');
  // Single-file copy that works without the assets/ folder (to download, email or move).
  await fs.writeFile(path.resolve(output).replace(/\.html?$/i, '') + '.standalone.html', '<!doctype html>\n' + await inlineAssets(html, dir), 'utf8');

  // Preview: passport open over the hero.
  try {
    await page.addScriptTag({content: PASSPORT_RUNTIME});
    await page.locator('.pp-engine-hero').scrollIntoViewIfNeeded();
    await page.click('[data-pp-pill]');
    await page.waitForTimeout(600);
    await page.screenshot({path: output.replace(/\.html?$/i, '') + '.png'});
  } catch {}

  await fs.writeFile(path.join(dir, 'snapshot-manifest.json'), JSON.stringify({
    sourceUrl: source, generatedAt: new Date().toISOString(),
    brand: product.brand, title: product.title, price: product.price, hero: product.hero,
    passport: model,
    archiveImagesConsidered: archive.images.map(({src, cls, strong, alt, source}) => ({src, cls, strong, alt, source})),
    assets: [...map.entries()],
  }, null, 2));

  console.log(JSON.stringify({
    output: path.resolve(output), sourceUrl: source, brand: product.brand, title: product.title, price: product.price,
    sku: product.sku || null, material: model.material.name.value, craft: model.craft.label,
    archivePages: archive.pages.length, archiveImages: archive.images.length,
    images: Object.fromEntries(Object.entries(model.images).map(([k, v]) => [k, v?.kind || null])),
    maker: model.maker.name.value, traceability: model.traceability, assets: map.size,
  }, null, 2));
} finally {
  await browser.close();
}
