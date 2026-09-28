# The Loom Art test

Test input: `https://theloomart.com/`

The engine's website-level flow was applied conceptually to the live public site:

1. The homepage exposes product links under its shop/best-seller areas.
2. **Black Spade Blazer** was selected as the concrete product example.
3. The product page exposes the title, Rs.17,000 price, XS–XXL sizes, Add to cart, and product description.
4. The product description states that the blazer is made in handwoven satin silk.
5. The brand site separately states that its fabrics are handwoven, and describes fair trade, artisans, weavers and handcrafted work.

The POC output is `demos/theloomart/black-spade-blazer.html`.

The passport uses images from the actual The Loom Art product gallery (not stock imagery). Product-specific facts and broader brand-level context are deliberately separated in the passport UI.

Note: this environment could inspect the live site but could not execute Playwright against the external site directly. The generated demo is therefore a site-specific fixture based on the inspected public page, while the generic generator code is structured to perform the same discovery and injection when run locally with network access.
