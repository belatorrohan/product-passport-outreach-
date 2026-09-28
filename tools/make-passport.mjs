import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const input = process.argv[2];
const outArg = process.argv[3] || "generated/passport.html";
if (!input) {
  console.error("Usage: node tools/make-passport.mjs <product-url> [output.html]");
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
await page.goto(input, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(1200);

const data = await page.evaluate(() => {
  const text = el => (el?.textContent || "").replace(/\s+/g, " ").trim();
  const og = n => document.querySelector('meta[property="' + n + '"]')?.content || "";
  const abs = u => { try { return new URL(u, location.href).href; } catch { return ""; } };

  const title = text(document.querySelector("h1")) || document.title;
  const price = text(document.querySelector('[class*="price" i], [data-price], .price, [itemprop="price"]'));
  const images = [...document.images]
    .map(i => ({src: abs(i.currentSrc || i.src), alt: i.alt || ""}))
    .filter(x => x.src)
    .slice(0, 24);

  const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')]
    .map(s => { try { return JSON.parse(s.textContent); } catch { return null; } })
    .filter(Boolean);

  return {
    url: location.href,
    brand: og("og:site_name"),
    title,
    price,
    hero: abs(og("og:image")) || images[0]?.src || "",
    images,
    html: document.documentElement.outerHTML,
    jsonLd
  };
});

const safeHtml = data.html
  .replace(/<script[\s\S]*?<\/script>/gi, "")
  .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
  .replace(/<base[^>]*>/gi, "");

const passportCss = `
<style>
.pp-pill{position:fixed;left:20px;bottom:20px;z-index:2147483000;border:0;border-radius:999px;padding:12px 16px;background:#fff;box-shadow:0 5px 20px rgba(0,0,0,.14);font:13px system-ui;cursor:pointer}
.pp-panel{position:fixed;inset:0 auto 0 0;width:min(560px,82vw);z-index:2147483001;background:#181817;color:#fff;transform:translateX(-102%);transition:.35s ease;overflow:auto;padding:28px}
.pp-open .pp-panel{transform:translateX(0)}
.pp-panel img{width:100%;aspect-ratio:4/3;object-fit:cover;margin:0 0 18px}
.pp-close{position:absolute;top:12px;right:16px;border:0;background:none;color:#fff;font-size:28px}
.pp-eyebrow{font-size:10px;letter-spacing:.15em;color:#aaa;text-transform:uppercase}
.pp-panel h2{font:400 34px Georgia,serif}
.pp-step{border-top:1px solid #3c3c39;padding:24px 0}.pp-step h3{font:400 21px Georgia,serif}.pp-step p{font:13px/1.55 system-ui;color:#d0cbc3}
</style>`;

const imgData = data.images.slice(0, 4).map(x => x.src);
const cards = imgData.map((src, i) => `
<article class="pp-step">
  <img src="${src}" alt="">
  <div class="pp-eyebrow">0${i+1} · PRODUCT STORY</div>
  <h3>${["Material","Craft","Making","Technique"][i] || "Product detail"}</h3>
  <p>Public product-page information captured from the brand site. Replace this block with evidence-backed production records as they become available.</p>
</article>`).join("");

const inject = `
${passportCss}
<button class="pp-pill" id="pp-pill">◎ The journey of this piece</button>
<aside class="pp-panel" id="pp-panel" aria-hidden="true">
<button class="pp-close" id="pp-close">×</button>
<div class="pp-eyebrow">PRODUCT PASSPORT</div>
<h2>${data.title.replace(/</g,"&lt;")}</h2>
<p class="pp-eyebrow">${data.brand.replace(/</g,"&lt;")}</p>
${cards}
</aside>
<script>
(()=>{const p=document.getElementById("pp-panel"),b=document.getElementById("pp-pill"),c=document.getElementById("pp-close");
const o=()=>p.classList.add("pp-open"),x=()=>p.classList.remove("pp-open");
b.addEventListener("mouseenter",o);b.addEventListener("click",()=>p.classList.toggle("pp-open"));c.addEventListener("click",x);
})();</script>`;

const final = safeHtml.replace("</body>", inject + "</body>");
await fs.mkdir(path.dirname(outArg), { recursive: true });
await fs.writeFile(outArg, final, "utf8");
console.log(JSON.stringify({ output: outArg, url: data.url, title: data.title, hero: data.hero, images: data.images.length }, null, 2));
await browser.close();
