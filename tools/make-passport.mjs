import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const input = process.argv[2];
const output = process.argv[3] || "generated/passport.html";
const productHint = process.argv[4] || "";

if (!input) {
  console.error('Usage: node tools/make-passport.mjs <website-or-product-url> [output.html] [product-name]');
  process.exit(1);
}

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });

async function openInput(url) {
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1000);
}

await openInput(input);

// A homepage can be supplied. The engine discovers a real product link from the
// page, optionally matching a product name supplied as argv[4].
let selectedUrl = page.url();
if (!/\/products\//i.test(selectedUrl)) {
  const candidates = await page.evaluate((hint) => {
    const norm = s => (s || "").replace(/\s+/g, " ").trim();
    const links = [...document.querySelectorAll("a[href]")]
      .map(a => ({ href: new URL(a.href, location.href).href, text: norm(a.textContent), aria: norm(a.getAttribute("aria-label")) }))
      .filter(x => /\/products\//i.test(x.href));
    const unique = [...new Map(links.map(x => [x.href, x])).values()];
    if (!hint) return unique;
    const h = hint.toLowerCase();
    unique.sort((a,b) => {
      const aa = (a.text + " " + a.aria).toLowerCase().includes(h) ? 1 : 0;
      const bb = (b.text + " " + b.aria).toLowerCase().includes(h) ? 1 : 0;
      return bb - aa;
    });
    return unique;
  }, productHint);
  if (!candidates.length) throw new Error("No product link found on the supplied website.");
  selectedUrl = candidates[0].href;
  await openInput(selectedUrl);
}

const info = await page.evaluate(() => {
  const text = el => (el?.textContent || "").replace(/\s+/g, " ").trim();
  const meta = n => document.querySelector('meta[property="' + n + '"]')?.content || document.querySelector('meta[name="' + n + '"]')?.content || "";
  const abs = u => { try { return new URL(u, location.href).href; } catch { return ""; } };

  const h1 = text(document.querySelector("h1"));
  const title = h1 || meta("og:title") || document.title;
  const description = text(document.querySelector('[itemprop="description"], .product__description, [class*="description" i]')) || meta("og:description");
  const price = text(document.querySelector('[itemprop="price"], .price, [class*="price" i], [data-price]')) || meta("product:price:amount");

  const imgs = [...document.images]
    .map(i => {
      const src = i.currentSrc || i.src || i.getAttribute("data-src") || "";
      return {src: abs(src), alt: i.alt || "", w: i.naturalWidth || 0, h: i.naturalHeight || 0};
    })
    .filter(x => x.src);

  // Prefer product/gallery images over logos/icons and other UI assets.
  const productImgs = imgs.filter(x => /product|blazer|shirt|dress|jacket|loom|silk|cotton|garment/i.test(x.alt + " " + x.src));
  const ranked = [...(productImgs.length ? productImgs : imgs)].sort((a,b) => (b.w*b.h) - (a.w*a.h));

  const bodyText = document.body.innerText || "";
  const colors = [...new Set((bodyText.match(/\b(black|white|blue|red|green|pink|yellow|brown|beige|cream|charcoal|raven)\b/gi)||[]).map(x=>x.toLowerCase()))].slice(0,8);
  const sizes = ["XXS","XS","S","M","L","XL","XXL"].filter(s => new RegExp("\\b"+s+"\\b").test(bodyText));

  return {
    url: location.href,
    brand: meta("og:site_name") || location.hostname.replace(/^www\./,""),
    title, description, price, colors, sizes,
    images: ranked.slice(0, 8),
    html: document.documentElement.outerHTML
  };
});

// Remove executable page scripts from the static replica, but retain styles and structure.
let replica = info.html
  .replace(/<script[\s\S]*?<\/script>/gi, "")
  .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
  .replace(/<base[^>]*>/gi, "");

const images = info.images.slice(0, 4).map(x => x.src);

const passportStyles = `
<style id="pp-engine-styles">
.pp-wrap{position:relative!important}
.pp-pill{position:absolute;left:18px;bottom:18px;z-index:2147483000;border:0;border-radius:999px;padding:12px 16px;background:#fff;color:#222;box-shadow:0 6px 22px rgba(0,0,0,.16);font:12px system-ui,sans-serif;cursor:pointer}
.pp-panel{position:absolute;left:0;top:0;bottom:0;width:min(82%,650px);z-index:2147483001;background:#181817;color:#f2eee6;transform:translateX(-102%);transition:transform .38s ease;box-shadow:22px 0 45px rgba(0,0,0,.28);overflow:auto;padding:26px}
.pp-wrap.pp-open .pp-panel{transform:translateX(0)}
.pp-close{position:absolute;right:15px;top:10px;background:none;border:0;color:#ddd;font-size:28px;cursor:pointer}
.pp-eyebrow{font:9px/1 system-ui,sans-serif;letter-spacing:.14em;color:#aaa299;text-transform:uppercase}
.pp-panel h2{font:400 31px/1.05 Georgia,serif;margin:9px 40px 5px 0}
.pp-meta{font:10px system-ui,sans-serif;color:#938d84;border-bottom:1px solid #383733;padding-bottom:18px}
.pp-scroll{display:block}
.pp-step{display:grid;grid-template-columns:115px 1fr;gap:18px;padding:23px 0;border-bottom:1px solid #35342f}
.pp-step img{display:block;width:115px;height:132px;object-fit:cover}
.pp-step h3{font:400 20px/1.08 Georgia,serif;margin:7px 0}
.pp-step p{font:11px/1.55 system-ui,sans-serif;color:#ccc7bf;margin:0 0 8px}
.pp-status{font:8px system-ui,sans-serif;letter-spacing:.1em;color:#91ad91}
.pp-next{padding:25px 0}.pp-next h3{font:400 21px Georgia,serif;margin:7px 0}.pp-next p{font:11px/1.5 system-ui,sans-serif;color:#bcb6ad}
@media(max-width:800px){.pp-panel{position:fixed;width:100%;height:100vh;bottom:auto}.pp-wrap.pp-open .pp-panel{transform:translateX(0)}.pp-step{grid-template-columns:90px 1fr}.pp-step img{width:90px;height:110px}}
</style>`;

const cards = images.map((src, i) => {
  const labels = ["Material", "Craft", "Making", "Technique"];
  const text = i === 0
    ? info.description || "Material and product details captured from the public product page."
    : "Product-page imagery retained from the brand's own gallery. Add the corresponding production record here when the brand supplies it.";
  return `<article class="pp-step"><img src="${esc(src)}" alt=""><div><div class="pp-eyebrow">0${i+1} · PRODUCT STORY</div><h3>${labels[i]}</h3><p>${esc(text)}</p><div class="pp-status">PUBLIC PAGE EVIDENCE · NO STOCK IMAGERY</div></div></article>`;
}).join("");

const injection = `
${passportStyles}
<button class="pp-pill" id="pp-pill">◎ The journey of this piece</button>
<aside class="pp-panel" id="pp-panel" aria-hidden="true">
<button class="pp-close" id="pp-close">×</button>
<div class="pp-eyebrow">PRODUCT PASSPORT</div>
<h2>${esc(info.title)}</h2>
<div class="pp-meta">${esc(info.brand)} · ${esc(info.price)} · generated from ${esc(info.url)}</div>
<div class="pp-scroll">${cards}
<div class="pp-next"><div class="pp-eyebrow">NEXT LAYER</div><h3>Connect the production record.</h3><p>Maker · material lot · craft cluster · workshop · production date · residual material</p></div>
</div>
</aside>
<script>
(()=>{const w=document.querySelector('[data-pp-wrap]'),b=document.getElementById("pp-pill"),p=document.getElementById("pp-panel"),c=document.getElementById("pp-close");
const open=()=>{w.classList.add("pp-open");p.setAttribute("aria-hidden","false")};
const close=()=>{w.classList.remove("pp-open");p.setAttribute("aria-hidden","true")};
b.addEventListener("mouseenter",open);b.addEventListener("click",()=>w.classList.contains("pp-open")?close():open);c.addEventListener("click",e=>{e.stopPropagation();close()});
document.addEventListener("keydown",e=>{if(e.key==="Escape")close()});
})();
</script>`;

const injectResult = await page.evaluate(({injection}) => {
  const imgs = [...document.images];
  if (!imgs.length) return {ok:false, reason:"No images found"};
  const usable = imgs
    .filter(i => i.naturalWidth >= 300 && i.naturalHeight >= 300)
    .sort((a,b)=>(b.naturalWidth*b.naturalHeight)-(a.naturalWidth*a.naturalHeight));
  const hero = usable[0] || imgs[0];
  let wrap = hero.closest("div, figure, picture") || hero.parentElement;
  if (!wrap) wrap = hero.parentElement;
  if (!wrap) return {ok:false, reason:"No image container"};
  wrap.setAttribute("data-pp-wrap","1");
  wrap.classList.add("pp-wrap");
  if (getComputedStyle(wrap).position === "static") wrap.style.position="relative";
  wrap.insertAdjacentHTML("beforeend", injection);
  return {ok:true,hero:hero.currentSrc||hero.src};
},{injection});

if (!injectResult.ok) throw new Error(injectResult.reason);

replica = await page.evaluate(() => document.documentElement.outerHTML);

await fs.mkdir(path.dirname(output), {recursive:true});
await fs.writeFile(output, replica, "utf8");

console.log(JSON.stringify({
  output,
  source: info.url,
  title: info.title,
  brand: info.brand,
  price: info.price,
  productImages: images.length,
  hero: injectResult.hero
}, null, 2));

await browser.close();
