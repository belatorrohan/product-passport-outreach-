// Product-page extraction: identity, price, description, material phrases, gallery,
// and the visible hero image (tagged in the DOM with data-pp-hero-img).

export async function extractProduct(page) {
  const snap = await page.evaluate(async () => {
    const clean = s => (s || '').replace(/\s+/g, ' ').trim();
    const meta = n => (document.querySelector(`meta[property="${n}"]`) || document.querySelector(`meta[name="${n}"]`))?.content || '';
    const abs = u => { try { return new URL(u, location.href).href.split('#')[0]; } catch { return ''; } };

    // "Visible" means actually painted: passes checkVisibility and a hit test at its
    // centre lands inside the image's own tight container (zoom-button overlays are fine,
    // hidden lightbox/product-card copies are not).
    const ownsHit = (img, hit) => {
      if (!hit) return false;
      const r = img.getBoundingClientRect(), area = r.width * r.height;
      for (let e = img, k = 0; e && k < 5; e = e.parentElement, k++) {
        const q = e.getBoundingClientRect();
        if (k && q.width * q.height > area * 1.6) break;
        if (e === hit || e.contains(hit)) return true;
      }
      return hit.contains(img);
    };
    const shown = img => {
      const r = img.getBoundingClientRect();
      if (!r.width || !r.height || (img.checkVisibility && !img.checkVisibility({opacityProperty: true, visibilityProperty: true}))) return false;
      const x = r.left + r.width / 2, y = r.top + Math.min(r.height / 2, innerHeight / 2);
      if (x < 0 || x > innerWidth || y < 0 || y > innerHeight) return false;
      return ownsHit(img, document.elementFromPoint(x, y));
    };

    const imgs = [...document.images].map(i => {
      const r = i.getBoundingClientRect();
      return {el: i, src: abs(i.currentSrc || i.src || i.getAttribute('data-src') || ''), w: i.naturalWidth || 0, h: i.naturalHeight || 0, a: Math.max(0, r.width) * Math.max(0, r.height), v: shown(i)};
    }).filter(x => x.src);
    const large = imgs.filter(x => x.w >= 350 && x.h >= 350);
    const hero = large.filter(x => x.v).sort((a, b) => b.a - a.a)[0] || [...large].sort((a, b) => b.w * b.h - a.w * a.h)[0] || imgs[0];
    document.querySelectorAll('[data-pp-hero-img]').forEach(e => e.removeAttribute('data-pp-hero-img'));
    hero?.el?.setAttribute('data-pp-hero-img', '');

    // Structured product data, when the site publishes it.
    let ld = null;
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const items = [JSON.parse(s.textContent)].flat().flatMap(x => x['@graph'] || [x]);
        ld = items.find(x => [x['@type']].flat().includes('Product')) || ld;
      } catch {}
    }
    let shopify = null;
    try {
      const r = await fetch(location.pathname.replace(/\/$/, '') + '.js', {headers: {accept: 'application/json'}});
      if (r.ok) shopify = await r.json();
    } catch {}
    const variant = shopify?.variants?.[0];
    const sku = clean(variant?.sku || ld?.sku || [ld?.offers].flat()[0]?.sku || document.querySelector('[itemprop="sku"]')?.textContent || '');

    // Price: prefer structured values over scraping price text ("Regular price … Unit price /per").
    const offer = [ld?.offers].flat()[0];
    const amount = shopify ? shopify.price / 100 : Number(offer?.price || meta('product:price:amount') || meta('og:price:amount')) || null;
    const currency = offer?.priceCurrency || meta('product:price:currency') || meta('og:price:currency') || '';
    let price = '';
    if (amount && currency) {
      try { price = new Intl.NumberFormat('en-IN', {style: 'currency', currency, maximumFractionDigits: amount % 1 ? 2 : 0}).format(amount); } catch {}
    }
    if (!price) price = clean(document.querySelector('[itemprop="price"],.price,[class*="price" i]')?.textContent).replace(/^(regular|sale)\s+price\s*/i, '').replace(/\s*unit price.*$/i, '');

    const title = clean(document.querySelector('h1')?.textContent) || shopify?.title || ld?.name || meta('og:title') || document.title;
    const desc = clean(document.querySelector('[itemprop="description"],[class*="description" i]')?.textContent) || clean(ld?.description) || meta('og:description');

    // All product-page copy (including closed accordions such as Details / Materials).
    const root = document.querySelector('main') || document.body;
    const blocks = [...root.querySelectorAll('[class*="description" i],[class*="accordion" i],[class*="collapsible" i],details,[class*="product__info" i],[class*="product-info" i]')]
      .filter(e => !e.closest('[class*="recommend" i],[class*="related" i]'));
    const pageText = clean([desc, shopify?.description?.replace(/<[^>]+>/g, ' '), ...blocks.map(b => b.textContent)].join(' ')).slice(0, 8000);

    return {
      url: location.href,
      origin: location.origin,
      brand: meta('og:site_name') || shopify?.vendor || location.hostname.replace(/^www\./, ''),
      title, sku, price, desc, pageText,
      hero: hero?.src || '',
      gallery: [...large].sort((a, b) => b.w * b.h - a.w * a.h).slice(0, 8).map(x => x.src),
    };
  });
  if (!snap.hero) throw new Error('Could not identify hero image');
  return snap;
}
