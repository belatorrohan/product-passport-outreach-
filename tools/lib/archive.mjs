// Light brand-archive crawl: visit a handful of About / Craft / Story pages on the
// same site, keep their text (as brand-level evidence with source URLs) and
// classify their imagery by keywords. Brand-level evidence is never treated as
// garment-level evidence; that distinction is made in passport-model.mjs.

const ARCHIVE_WORDS = /about|story|stories|craft|artisan|weav|maker|process|sustainab|behind|journal|blog|our-?people|heritage|handloom|community|impact|ethos|philosophy/i;
const SKIP_PATH = /\/(products?|collections|cart|account|checkout|search|policies|pages\/(contact|faq|shipping|returns?|refund|privacy|terms))/i;
const MAX_PAGES = 6;

export const IMAGE_CLASSES = {
  loom: /\bloom|weaving|weaver|handloom|warp|weft|shuttle/i,
  embroidery: /embroider|zardozi|chikan|aari|needlework|kantha/i,
  dyeing: /\bdye|dyeing|indigo|natural colou?r/i,
  portrait: /artisan|karigar|craftsm|craftswom|craftsperson|our people|the hands|meet the (weavers?|makers?|artisans?)/i,
  stitching: /stitch|tailor|sewing|cutting|pattern ?making|atelier|workshop/i,
  fabric: /fabric|textile|swatch|close[- ]?up|texture|weave|yarn|thread|silk|cotton|linen|khadi/i,
};

// Founder/designer/team imagery is brand marketing, not a maker of the garment.
const NOT_MAKER = /founder|designer|creative force|ceo|director|team photo|press|award|campaign|lookbook|model/i;

export function classifyImage(text) {
  for (const [cls, re] of Object.entries(IMAGE_CLASSES)) if (re.test(text)) return cls;
  return null;
}

async function discoverArchiveLinks(page) {
  return page.evaluate(({words, skip, max}) => {
    const W = new RegExp(words, 'i'), S = new RegExp(skip, 'i'), seen = new Map();
    for (const a of document.querySelectorAll('a[href]')) {
      let u;
      try { u = new URL(a.getAttribute('href'), location.href); } catch { continue; }
      if (u.origin !== location.origin || S.test(u.pathname) || u.pathname === '/' || u.pathname === location.pathname) continue;
      const text = (a.textContent || '').replace(/\s+/g, ' ').trim();
      const hay = u.pathname + ' ' + text;
      if (!W.test(hay)) continue;
      const key = u.origin + u.pathname;
      // Prefer craft/maker pages over generic blog indexes.
      const score = (/craft|artisan|weav|maker|process|handloom|people/i.test(hay) ? 3 : 0) + (/about|story/i.test(hay) ? 2 : 0) + (a.closest('nav,header,footer') ? 1 : 0);
      if (!seen.has(key) || seen.get(key).score < score) seen.set(key, {url: key, text, score});
    }
    return [...seen.values()].sort((a, b) => b.score - a.score).slice(0, max);
  }, {words: ARCHIVE_WORDS.source, skip: SKIP_PATH.source, max: MAX_PAGES});
}

async function readArchivePage(context, url) {
  const page = await context.newPage();
  try {
    await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 20000});
    try { await page.waitForLoadState('networkidle', {timeout: 6000}); } catch {}
    await page.evaluate(async () => {
      for (let y = 0; y < Math.min(document.body.scrollHeight, 10000); y += 800) scrollTo({top: y, behavior: 'instant'});
      await new Promise(r => setTimeout(r, 800));
    });
    return await page.evaluate(() => {
      const clean = s => (s || '').replace(/\s+/g, ' ').trim();
      const root = document.querySelector('main') || document.body;
      const paragraphs = [...root.querySelectorAll('p,li,blockquote,h1,h2,h3')]
        .filter(e => !e.closest('nav,header,footer,[class*="product-card" i],[class*="card-product" i]'))
        .map(e => clean(e.textContent)).filter(t => t.length > 30 && t.length < 1200);
      const images = [...root.querySelectorAll('img')].map(img => {
        const r = img.getBoundingClientRect();
        const src = img.currentSrc || img.src;
        if (!src || /^data:/.test(src) || img.closest('a[href*="/products/"]')) return null;
        if ((img.naturalWidth || r.width) < 350 || (img.naturalHeight || r.height) < 300) return null;
        const block = img.closest('figure,section,[class*="section" i],div');
        const caption = clean(img.closest('figure')?.querySelector('figcaption')?.textContent || '');
        const heading = clean(block?.querySelector('h1,h2,h3,h4')?.textContent || '');
        const near = clean(block?.textContent || '').slice(0, 240);
        return {src: new URL(src, location.href).href, alt: clean(img.alt), caption, heading, near, w: img.naturalWidth, h: img.naturalHeight};
      }).filter(Boolean);
      const posts = [...root.querySelectorAll('a[href]')].map(a => { try { const u = new URL(a.getAttribute('href'), location.href); return {url: u.origin + u.pathname, text: clean(a.textContent)}; } catch { return null; } })
        .filter(l => l && l.url.startsWith(location.origin) && /\/(blogs?|journal|stories)\/[^/]+\/[^/]+/.test(new URL(l.url).pathname));
      return {url: location.href, title: clean(document.querySelector('h1')?.textContent) || document.title, paragraphs, images, posts};
    });
  } catch {
    return null;
  } finally {
    await page.close();
  }
}

const srcKey = u => { try { const x = new URL(u); return x.hostname + x.pathname.replace(/_\d+x\d*(?=\.)/, ''); } catch { return u; } };

export async function crawlArchive(context, productPage, product) {
  const links = await discoverArchiveLinks(productPage);
  const pages = [], visited = new Set(links.map(l => l.url));
  for (const link of links) {
    const p = await readArchivePage(context, link.url);
    if (p && (p.paragraphs.length || p.images.length)) pages.push(p);
  }
  // One extra hop: blog/journal posts whose titles are about the craft.
  const posts = pages.flatMap(p => p.posts || [])
    .filter(l => !visited.has(l.url) && /loom|weav|artisan|craft|karigar|embroider|dye|handmade|hand[- ]?made|behind|made by|makers?/i.test(l.text + ' ' + l.url));
  for (const post of [...new Map(posts.map(l => [l.url, l])).values()].slice(0, 3)) {
    visited.add(post.url);
    const p = await readArchivePage(context, post.url);
    if (p && (p.paragraphs.length || p.images.length)) pages.push(p);
  }

  // Classify archive images; never reuse this product's own gallery shots.
  const productKeys = new Set([product.hero, ...product.gallery].map(srcKey));
  const images = [], seen = new Set();
  for (const p of pages) {
    for (const img of p.images) {
      const key = srcKey(img.src);
      if (seen.has(key) || productKeys.has(key)) continue;
      seen.add(key);
      // Own descriptors (alt/caption/filename) outrank surrounding section text.
      const own = [img.alt, img.caption, decodeURIComponent(new URL(img.src).pathname.split('/').pop())].join(' ');
      const context = img.heading + ' ' + img.near;
      let cls = classifyImage(own) || classifyImage(context);
      if (cls === 'portrait' && NOT_MAKER.test(own + ' ' + context)) cls = null;
      if (cls) images.push({...img, cls, strong: !!classifyImage(own), source: p.url, sourceTitle: p.title});
    }
  }
  images.sort((a, b) => b.strong - a.strong);
  return {pages: pages.map(({url, title, paragraphs}) => ({url, title, paragraphs})), images};
}
