# Product Passport Outreach Engine

This repo contains a proof-of-concept for generating a **brand-specific product-page simulation** with an image-native product-passport interaction.

## What the engine is for

Input a brand/product URL.

1. Open the product page.
2. Extract the page structure, product images, title, price and basic metadata.
3. Recreate the product page as an isolated static preview.
4. Add a **"The journey of this piece"** pill on the real product image.
5. Hover/click the pill to open a scrollable product passport **inside the image area**.
6. Populate the passport with high-quality images sourced from the brand's own product/gallery pages — not stock photography.

The included demo is an Iro Iro Saaya Blazer example.

## Repo

- `demos/iroiro/saaya-blazer.html` — working visual proof of concept.
- `tools/make-passport.mjs` — starter generator for turning a product URL into a static passport demo.

## Run the generator

```bash
npm install
node tools/make-passport.mjs "https://example.com/products/example"
```

The current generator is deliberately a POC: it captures the public page, removes scripts from the saved copy, extracts product imagery/metadata, and injects the passport overlay. A production version should add robust product discovery, asset mirroring, Shopify/theme-specific handling, responsive visual regression, and evidence/claim extraction.

## Important

Generated demos should clearly distinguish:
- information explicitly found on the public product page;
- information inferred from the site structure;
- information that still needs a supplier/production record.

The demo does **not** represent an integration with the brand site.
