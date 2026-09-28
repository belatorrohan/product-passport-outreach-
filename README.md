# Product Passport Outreach Engine

This repo contains a proof-of-concept for generating a **brand-specific product-page simulation** with an image-native product-passport interaction.

> A brand story explains what a brand does. A product passport should explain what happened to this specific piece.
> — see `product-passport-chat-brainstorm.md`

## What the engine does

Input a brand website or product URL.

1. Open the site and find the product page (optionally matching a product-name hint).
2. Snapshot the page as a static, self-contained copy (scripts stripped, CSS/images/fonts localized).
3. Extract product-page facts: name, SKU, price, description, material phrases, gallery.
4. Lightly crawl the brand archive (About / Craft / Story pages and craft-related blog posts) for brand-level claims, named makers and classified imagery.
5. Build an **evidence model** for the garment, in which every field carries its evidence level.
6. Add a **"The journey of this piece"** pill on the visible product image. Hovering over or clicking it opens the passport **inside the image area**:
   - header with product identity, Garment ID and a traceability indicator
   - 01 Fabric · 02 Craft (weaving / embroidery / … chosen from the product) · 03 The maker · 04 From fabric to garment (expandable timeline) · 05 Garment record
   - "Connect production record →" call to action and a list of sources

   On desktop the pill and the open panel stay inside the part of the photo that is on screen, below any sticky site header, so the passport header never scrolls away on product photos taller than the screen. Hover gives a preview that closes when the pointer leaves the photo; clicking the pill, or clicking or scrolling inside the panel, pins it open until ×, Esc or a click elsewhere. On phones it opens full-screen.

## Evidence levels

| Label | Meaning |
|---|---|
| ✓ PRODUCT PAGE | Stated on this product's own page |
| ✓ BRAND ARCHIVE | Stated elsewhere on the brand site: brand-level, **not** proof about this garment |
| ◎ PRODUCTION RECORD | From a real production/traceability record (none are connected yet) |
| — NOT LINKED | A known field with no evidence for this garment |

**Never fake traceability.** The generator never invents lots, looms, people, places, dates, quantities or IDs. Anything not found in a public source renders as *Not linked*. A maker named in the brand archive is shown as a *story maker* with "Relationship to this garment: Not established".

## Images

Each section picks an image by its evidentiary role, from the brand's own site where possible:
- **Fabric:** a brand image whose own alt text, caption or filename marks it as fabric; otherwise a close crop of the product photo, captioned as such.
- **Craft:** a brand image of the loom, embroidery, dyeing or workshop; otherwise an empty "No public image linked" tile.
- **Maker:** a brand photo of an artisan (founder, designer and model photos are excluded). If the brand publishes none, an **illustrative stock image** from `tools/stock/` (Wikimedia Commons, CC BY-SA, credited) is shown, captioned *"Illustrative stock image · not the maker of this garment"*.

## Repo

- `tools/make-passport.mjs`: CLI orchestration
- `tools/refresh-demo.mjs`: re-applies the current passport UI and snapshot fixes to an existing demo offline (evidence model and asset map from its manifest, no re-crawl)
- `tools/lib/snapshot.mjs`: browsing, product discovery, asset localization and URL rewriting
- `tools/lib/extract.mjs`: product-page extraction and visible-hero detection
- `tools/lib/archive.mjs`: brand-archive crawl and image classification
- `tools/lib/passport-model.mjs`: evidence model (the "never invent" rules live here)
- `tools/lib/passport-ui.mjs`: passport markup, scoped CSS and the runtime shipped in the demo
- `tools/stock/`: fallback artisan images plus attribution (`stock.json`)
- `demos/theloomart/`, `demos/iroiro/`: generated demos (HTML, single-file `*.standalone.html`, `assets/`, `snapshot-manifest.json` with the full evidence model, and a preview PNG)

## Run the generator

```bash
npm install
npx playwright install --with-deps chromium
node tools/make-passport.mjs "https://theloomart.com/" demos/theloomart/black-spade-blazer.html "black spade blazer"
node tools/make-passport.mjs "https://iroiro.in/" demos/iroiro/saaya-blazer.html "saaya"
```

Open the resulting HTML file directly in a browser. It loads its styles and images from the `assets/` folder next to it, so open it from inside its folder. Fonts are inlined as data URIs because browsers block font files on `file://` pages.

Each run also writes `<name>.standalone.html`: a single file with every stylesheet, font and image embedded (each image once). Use it when the page is downloaded, emailed or moved on its own; it works without the `assets/` folder. The demo does **not** represent an integration with the brand site.

After changing `passport-ui.mjs` or `snapshot.mjs`, refresh the committed demos without re-crawling:

```bash
node tools/refresh-demo.mjs demos/theloomart/black-spade-blazer.html demos/iroiro/saaya-blazer.html
```
