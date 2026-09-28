// Page snapshotting: browsing, product discovery, and turning the live page into
// a static, self-contained HTML file with localized CSS/image/font assets.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {chromium} from 'playwright';

const PRODUCT_PATH = /\/(products?|item|p)\//i;

export async function openBrowser() {
  // CHROMIUM_PATH: use an existing Chromium build instead of Playwright's download.
  const browser = await chromium.launch({headless: true, executablePath: process.env.CHROMIUM_PATH || undefined});
  const context = await browser.newContext({viewport: {width: 1440, height: 1100}, deviceScaleFactor: 1});
  const page = await context.newPage();
  return {browser, context, page};
}

// Record every stylesheet/image/font the product page loads so it can be saved locally.
export function captureResources(page) {
  const resources = new Map();
  page.on('response', r => {
    const type = r.request().resourceType(), url = r.url().split('#')[0];
    if (!['stylesheet', 'image', 'font'].includes(type) || !/^https?:/i.test(url) || resources.has(url) || r.status() >= 400) return;
    resources.set(url, {type, ct: r.headers()['content-type'] || '', body: r.body().catch(() => null)});
  });
  return resources;
}

export async function load(page, url, {settle = 1200} = {}) {
  await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 60000});
  try { await page.waitForLoadState('networkidle', {timeout: 10000}); } catch {}
  await page.waitForTimeout(settle);
}

// If we were given a homepage, pick the best product link (optionally matching a name hint).
export async function findProductPage(page, hint) {
  if (PRODUCT_PATH.test(new URL(page.url()).pathname)) return page.url();
  const links = await page.evaluate(({h, pattern}) => {
    const re = new RegExp(pattern, 'i'), out = [];
    for (const a of document.querySelectorAll('a[href]')) {
      let u = '';
      try { u = new URL(a.getAttribute('href'), location.href).href; } catch {}
      if (!u || !re.test(new URL(u).pathname)) continue;
      const card = a.closest('article,li,[class*="card" i],[class*="product" i]');
      const text = ((a.textContent || '') + ' ' + (a.getAttribute('aria-label') || '') + ' ' + (card?.textContent || '')).replace(/\s+/g, ' ').trim();
      const score = (h && text.toLowerCase().includes(h) ? 100 : 0) + (a.querySelector('img') ? 20 : 0) + Math.min(text.length, 40) / 10;
      out.push({u, score});
    }
    return [...new Map(out.map(x => [x.u, x])).values()].sort((a, b) => b.score - a.score);
  }, {h: (hint || '').toLowerCase(), pattern: PRODUCT_PATH.source});
  if (!links.length) throw new Error('No product link discovered. Pass a direct product URL or product name.');
  await load(page, links[0].u);
  return page.url();
}

// Close pop-ups (newsletter, cookie, verification, region pickers) and their backdrops, and
// lift the scroll lock they set, so they neither hide the product photo from hero detection
// nor end up frozen over the saved copy.
export async function hideOverlays(page) {
  await page.keyboard.press('Escape').catch(() => {});
  await page.evaluate(() => {
    const W = innerWidth, H = innerHeight;
    const DIALOG = /modal|popup|pop-up|overlay|backdrop|newsletter|klaviyo|privy|verify|captcha|interstitial|cookie|consent|geolocation|country-selector/i;
    for (const e of document.querySelectorAll('body *')) {
      const s = getComputedStyle(e);
      if (s.position !== 'fixed' || s.display === 'none' || s.visibility === 'hidden' || Number(s.opacity) === 0) continue;
      const r = e.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const covers = r.width >= W * .85 && r.height >= H * .85;
      const centred = Math.abs(r.left + r.width / 2 - W / 2) < W * .2 && Math.abs(r.top + r.height / 2 - H / 2) < H * .25;
      const dialog = e.matches('dialog[open],[role="dialog"],[role="alertdialog"],[aria-modal="true"]') || DIALOG.test(`${e.className} ${e.id}`);
      if (covers || (dialog && centred && r.width * r.height > W * H * .03)) e.style.setProperty('display', 'none', 'important');
    }
    for (const e of [document.documentElement, document.body]) if (getComputedStyle(e).overflowY === 'hidden') e.style.setProperty('overflow', 'visible', 'important');
  });
}

// Scroll through the page so lazy images load, then return to the top instantly
// (smooth-scroll themes otherwise skew hero detection).
export async function primeLazyContent(page) {
  await page.evaluate(async () => {
    for (let y = 0; y < Math.min(document.body.scrollHeight, 14000); y += 900) scrollTo({top: y, behavior: 'instant'});
    await new Promise(r => setTimeout(r, 700));
    scrollTo({top: 0, behavior: 'instant'});
  });
  await page.waitForTimeout(500);
}

function extFor(url, type, ct) {
  const m = new URL(url).pathname.match(/\.([a-z0-9]{2,5})$/i);
  if (m) return m[1];
  if (ct.includes('css') || type === 'stylesheet') return 'css';
  for (const [k, e] of [['woff2', 'woff2'], ['woff', 'woff'], ['svg', 'svg'], ['webp', 'webp'], ['png', 'png'], ['jpeg', 'jpg']]) if (ct.includes(k)) return e;
  return 'bin';
}

function localName(url, type, ct) {
  const u = new URL(url);
  const hash = crypto.createHash('sha1').update(url).digest('hex').slice(0, 10);
  const base = (u.hostname + u.pathname).replace(/[^a-z0-9]+/gi, '-').slice(-60);
  return `assets/${base}-${hash}.${extFor(url, type, ct)}`;
}

const SIZE_LIMIT = {image: 15 * 1024 * 1024, stylesheet: 4 * 1024 * 1024, font: 8 * 1024 * 1024};

// Write captured (and extra) assets under <dir>/assets and rewrite every URL form
// (absolute, protocol-relative, root-relative, srcset) in the HTML to the local copy.
export async function localize({html, resources, extra = [], source, dir}) {
  const entries = await Promise.all([...resources].map(async ([url, r]) => ({url, ...r, body: await r.body})));
  entries.push(...extra);
  const map = new Map();
  for (const e of entries) {
    if (!e.body || e.body.byteLength > (SIZE_LIMIT[e.type] || SIZE_LIMIT.font)) continue;
    map.set(e.url, localName(e.url, e.type, e.ct));
  }
  const cssRewrite = (txt, base) => txt.replace(/url\(([^)]+)\)/gi, (m, x) => {
    const q = x.trim().replace(/^['"]|['"]$/g, '');
    if (/^(data:|blob:|#)/i.test(q)) return m;
    let abs;
    try { abs = new URL(q, base).href.split('#')[0]; } catch { return m; }
    return map.has(abs) ? `url("../${map.get(abs)}")` : m;
  });
  for (const e of entries) {
    const local = map.get(e.url);
    if (!local || !e.body) continue;
    const body = e.type === 'stylesheet' ? Buffer.from(cssRewrite(e.body.toString('utf8'), e.url)) : e.body;
    const file = path.resolve(dir, local);
    await fs.mkdir(path.dirname(file), {recursive: true});
    await fs.writeFile(file, body);
  }
  return {html: await finalizeHtml({html, map, source, dir}), map};
}

const FONT_TYPE = {woff2: 'font/woff2', woff: 'font/woff', ttf: 'font/ttf', otf: 'font/otf'};
// Same image at another size: ignore the query and Shopify's size suffix in the file name
// ("photo_180x.jpg", "photo_2048x2048.jpg", "photo_grande.jpg" are all "photo.jpg").
const SIZE_SUFFIX = /_(?:\d+x\d*|x\d+|pico|icon|thumb|small|compact|medium|large|grande|original|master)(?:_crop_[a-z]+)?(?:@\dx)?(?=\.[a-z0-9]+$)/i;
const pathKey = u => { try { const x = new URL(u); return x.hostname + x.pathname.replace(SIZE_SUFFIX, ''); } catch { return ''; } };

// Rewrite the saved HTML so it renders when opened straight from disk (file://):
// - every URL form (absolute, protocol-relative, root-relative, srcset, inline CSS url())
//   points at the local copy, falling back to another captured size of the same image
//   (themes request a different srcset width at other viewport sizes), else to https;
// - fonts are inlined as data: URIs, because browsers block @font-face files on file://.
// Idempotent, so it can also repair an already generated demo (tools/refresh-demo.mjs).
export async function finalizeHtml({html, map, source, dir}) {
  const byPath = new Map();
  for (const [url, local] of map) if (!byPath.has(pathKey(url))) byPath.set(pathKey(url), local);
  const resolve = raw => {
    try {
      const abs = new URL(raw.replace(/&amp;/g, '&'), source);
      const href = abs.href.split('#')[0];
      return map.get(href) || (/^https?:$/.test(abs.protocol) ? byPath.get(pathKey(href)) || abs.href : raw);
    } catch { return raw; }
  };
  const skip = /^(#|data:|blob:|javascript:|mailto:|tel:|assets\/)/i;

  for (const [orig, local] of map) html = html.split(orig).join(local);
  html = html.replace(/\b(src|data-src|poster|href)=(['"])([^'"]+)\2/gi, (m, a, q, u) =>
    skip.test(u) ? m : `${a}=${q}${resolve(u)}${q}`);
  html = html.replace(/\b(srcset|data-srcset)=(['"])([^'"]+)\2/gi, (m, a, q, v) =>
    `${a}=${q}${v.split(',').map(s => s.trim()).filter(Boolean).map(s => { const p = s.split(/\s+/); if (!skip.test(p[0])) p[0] = resolve(p[0]); return p.join(' '); }).join(', ')}${q}`);
  html = html.replace(/url\(\s*(&quot;|["']?)((?:(?!&quot;)[^"'()])+?)\1\s*\)/gi, (m, q, u) =>
    skip.test(u) ? m : `url(${q}${resolve(u)}${q})`);

  const fontCache = new Map();
  const inlineFonts = async (css, prefix) => {
    const refs = [...css.matchAll(new RegExp(`url\\(\\s*(&quot;|["']?)${prefix}(assets/[^"'()&]+?\\.(woff2?|ttf|otf))\\1\\s*\\)`, 'gi'))];
    for (const [m, q, local, ext] of refs) {
      if (!fontCache.has(local)) {
        try { fontCache.set(local, `data:${FONT_TYPE[ext.toLowerCase()]};base64,${(await fs.readFile(path.resolve(dir, local))).toString('base64')}`); }
        catch { fontCache.set(local, null); }
      }
      if (fontCache.get(local)) css = css.split(m).join(`url(${q}${fontCache.get(local)}${q})`);
    }
    return css;
  };
  html = await inlineFonts(html, '');
  // Font preloads of local files would only fail on file:// now that the fonts are inlined.
  html = html.replace(/<link\b[^>]*\bas=(["'])font\1[^>]*>/gi, m => /href=(["'])assets\//i.test(m) ? '' : m);
  for (const local of new Set(map.values())) {
    if (!local.endsWith('.css')) continue;
    const file = path.resolve(dir, local);
    try {
      const css = await fs.readFile(file, 'utf8'), out = await inlineFonts(css, '\\.\\./');
      if (out !== css) await fs.writeFile(file, out);
    } catch {}
  }
  return html;
}

const MIME = {css: 'text/css', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', svg: 'image/svg+xml', ...FONT_TYPE};

// Single-file variant of a finalized page: stylesheets become <style> blocks and every
// local asset a data: URI, so the page renders even when opened without its assets/
// folder (downloaded, emailed, or moved on its own).
export async function inlineAssets(html, dir) {
  const cache = new Map();
  const dataUri = async local => {
    if (!cache.has(local)) {
      const ext = (local.match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();
      try { cache.set(local, MIME[ext] ? `data:${MIME[ext]};base64,${(await fs.readFile(path.resolve(dir, local))).toString('base64')}` : null); }
      catch { cache.set(local, null); }
    }
    return cache.get(local);
  };
  const replaceAsync = async (str, re, fn) => {
    const parts = [];
    let last = 0;
    for (const m of str.matchAll(re)) { parts.push(str.slice(last, m.index), await fn(...m)); last = m.index + m[0].length; }
    return parts.join('') + str.slice(last);
  };
  const LOCAL = `assets/[^"'()\\s,&]+`;
  // Preload hints for local files would only duplicate the embedded bytes.
  html = html.replace(/<link\b[^>]*\brel=(["'])(preload|prefetch)\1[^>]*>/gi, m => /href=(["'])assets\//i.test(m) ? '' : m);

  html = await replaceAsync(html, /<link\b[^>]*\brel=(["'])stylesheet\1[^>]*>/gi, async m => {
    const local = m.match(new RegExp(`href=(["'])(${LOCAL})\\1`, 'i'))?.[2];
    if (!local) return m;
    let css;
    try { css = await fs.readFile(path.resolve(dir, local), 'utf8'); } catch { return m; }
    css = await replaceAsync(css, new RegExp(`url\\(\\s*(["']?)\\.\\./(${LOCAL})\\1\\s*\\)`, 'gi'), async (u, q, a) => (await dataUri(a)) ? `url(${q}${await dataUri(a)}${q})` : u);
    const media = m.match(/\bmedia=(["'])([^"']*)\1/i)?.[2];
    return `<style${media ? ` media="${media}"` : ''}>${css.replace(/<\/style/gi, '<\\/style')}</style>`;
  });
  // The same photo is referenced by the gallery, thumbnails, zoom links and the passport.
  // Embed each image once in a table and let a small script fill the attributes in,
  // instead of repeating the same data: URI in every attribute.
  const table = [], slot = new Map();
  const ref = async local => {
    if (!slot.has(local)) {
      const uri = await dataUri(local);
      slot.set(local, uri && uri.startsWith('data:image/') ? table.push(uri) - 1 : null);
    }
    return slot.get(local);
  };
  html = await replaceAsync(html, /\b(srcset|data-srcset)=(["'])([^"']+)\2/gi, async (m, a, q, v) => {
    const seen = new Set(), keep = [];
    for (const s of v.split(',')) {
      const [u, d] = s.trim().split(/\s+/);
      if (!/^assets\//.test(u) || seen.has(u)) continue;
      seen.add(u);
      const i = await ref(u);
      if (i !== null) keep.push(d ? `#${i} ${d}` : `#${i}`);
    }
    return keep.length ? `data-pp-${a}=${q}${keep.join(', ')}${q}` : m;
  });
  html = await replaceAsync(html, new RegExp(`\\b(src|data-src|poster|href)=(["'])(${LOCAL})\\2`, 'gi'), async (m, a, q, u) => {
    const i = await ref(u);
    if (i !== null) return `data-pp-${a}=${q}#${i}${q}`;
    return (await dataUri(u)) ? `${a}=${q}${await dataUri(u)}${q}` : m;
  });
  html = await replaceAsync(html, new RegExp(`url\\(\\s*(&quot;|["']?)(${LOCAL})\\1\\s*\\)`, 'gi'), async (m, q, u) =>
    (await dataUri(u)) ? `url(${q}${await dataUri(u)}${q})` : m);
  const fill = `<script data-pp-assets>(()=>{const A=${JSON.stringify(table)};`
    + `for(const a of ['src','data-src','poster','href','srcset','data-srcset'])for(const e of document.querySelectorAll('[data-pp-'+a+']')){`
    + `e.setAttribute(a,e.getAttribute('data-pp-'+a).replace(/#(\\d+)/g,(m,i)=>A[i]));e.removeAttribute('data-pp-'+a)}})();</script>`;
  const at = html.indexOf('<script data-pp-runtime>');
  return at < 0 ? html.replace('</body>', fill + '</body>') : html.slice(0, at) + fill + html.slice(at);
}

// Remove the site's own scripts/embeds so the copy is inert, then add our runtime.
// Comments go first: their text is not escaped, so a comment that merely mentions
// "<script>" would otherwise start a match that eats the comment's closing "-->" and
// turn the rest of the page (passport included) into one long comment.
export function stripScripts(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '')
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, '');
}

// Download images that were not loaded by the product page (e.g. from brand archive pages).
export async function fetchExtraImages(context, urls) {
  const out = [];
  for (const url of urls) {
    try {
      const r = await context.request.get(url, {timeout: 20000});
      if (!r.ok()) continue;
      out.push({url, type: 'image', ct: r.headers()['content-type'] || '', body: await r.body()});
    } catch {}
  }
  return out;
}
