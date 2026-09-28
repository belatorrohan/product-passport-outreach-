// Page snapshotting: browsing, product discovery, and turning the live page into
// a static, self-contained HTML file with localized CSS/image/font assets.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {chromium} from 'playwright';

const PRODUCT_PATH = /\/(products?|item|p)\//i;

export async function openBrowser() {
  const browser = await chromium.launch({headless: true});
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

  const resolve = raw => {
    try {
      const abs = new URL(raw.replace(/&amp;/g, '&'), source);
      return map.get(abs.href.split('#')[0]) || (/^https?:$/.test(abs.protocol) ? abs.href : raw);
    } catch { return raw; }
  };
  for (const [orig, local] of map) html = html.split(orig).join(local);
  html = html.replace(/\b(src|data-src|poster|href)=(['"])([^'"]+)\2/gi, (m, a, q, u) =>
    /^(#|data:|blob:|javascript:|mailto:|tel:|assets\/)/i.test(u) ? m : `${a}=${q}${resolve(u)}${q}`);
  html = html.replace(/\b(srcset|data-srcset)=(['"])([^'"]+)\2/gi, (m, a, q, v) =>
    `${a}=${q}${v.split(',').map(s => { const p = s.trim().split(/\s+/); if (!/^assets\//.test(p[0])) p[0] = resolve(p[0]); return p.join(' '); }).join(', ')}${q}`);
  return {html, map};
}

// Remove the site's own scripts/embeds so the copy is inert, then add our runtime.
export function stripScripts(html) {
  return html
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
