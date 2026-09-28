# Generator test runs (2026-09-28)

Both demos in `demos/` are **real generator output**, not hand-built fixtures:

```bash
node tools/make-passport.mjs "https://theloomart.com/" demos/theloomart/black-spade-blazer.html "black spade blazer"
node tools/make-passport.mjs "https://iroiro.in/" demos/iroiro/saaya-blazer.html "saaya"
```

The full evidence model for each run is stored in the demo's `snapshot-manifest.json` (`passport` key).

## The Loom Art: Black Spade Blazer

- Homepage input → product discovered at `/products/black-spade-blazer`.
- Product page: title, ₹17,000, SKU `AR4321`, material **Handwoven satin silk** (product page).
- Archive crawl: About Us, News, and three craft-related posts, including *Meet Our Story Makers*.
- Maker: the post names artisans (e.g. **Dilshad Ji**, hand embroidery). The passport shows this as a brand-archive *story maker* with "Relationship to this garment: Not established".
- Images: the site publishes no fabric close-up and no artisan photo. The About page portrait is the founder, so it is excluded. The fabric card uses a captioned crop of the product photo; the maker card uses the **illustrative stock** weaver image (captioned and credited); the weaving card shows "No public image linked".

## Iro Iro: Saaya Blazer

- Product page: ₹57,441, SKU `IRMJA2601IVXS`, **Cotton**, weave **Flatweave**, composition **100% Cotton** (product page).
- Archive crawl: Sustainability, About and Journal pages. The weaving card uses the brand's own **loom photograph** from the Sustainability page and the claim *"These materials are transformed through handloom weaving and small-scale production…"* (brand archive).
- No named maker and no artisan portrait → stock weaver image, captioned.

## Checks (Playwright, all external requests blocked)

For both demos at 1440px desktop and 400px mobile:
- the pill sits on the visible main product image; hover (desktop) or tap (mobile) opens the passport;
- 5 sections render; the header stays fixed while the panel scrolls; "View record" and timeline nodes expand; Escape closes;
- every passport image loads from local `assets/`; there are no page errors;
- every garment-record field without a public source reads **Not linked** (Garment ID, fabric lot, quantity, loom, weaver, location, unit, date).

## Known limitations

- Some of the brand pages' own lazy-loaded images still reference the brand's CDN (the passport itself is fully local).
- On Iro Iro, the theme's floating "Story / More" labels sit above the open panel.
- On themes that swap galleries per breakpoint, the runtime re-mounts the pill on the visible mobile gallery photo.
