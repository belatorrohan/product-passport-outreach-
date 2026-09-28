# Product Passport — Detailed Chat Brainstorm & UI Direction

## 1. Context

This document captures the discussion around the **Product Passport** concept being developed for outreach demos to Indian craft / sustainable fashion brands, using The Loom Art and similar brands as examples.

The current MVP opens a product-passport panel directly over a product page/image. The goal of this discussion was to determine whether the information and imagery currently shown inside the passport actually represent a **product passport**, and to define what should change.

The central conclusion is:

> **A brand story explains what a brand does. A product passport should explain what happened to this specific piece.**

The current passport is visually polished but is closer to a **brand-story / provenance storytelling layer** than a true garment-level traceability record.

---

# 2. The Core Problem With the Current Passport

The existing UI uses sections roughly like:

- 01 — Material
- 02 — Craft
- 03 — People
- 04 — Provenance

The visual pattern is approximately:

```text
PRODUCT PASSPORT

The journey of this piece.
Black Spade Blazer · The Loom Art · prototype

────────────────────────────────────────

[product/model image]   01 · MATERIAL
                        Handwoven satin silk
                        Product/brand description
                        DOCUMENTED · PRODUCT PAGE

────────────────────────────────────────

[product/model image]   02 · CRAFT
                        Handloom fabric
                        Brand description
                        DOCUMENTED · BRAND SITE

────────────────────────────────────────

[product/model image]   03 · PEOPLE
                        Made with skilled creative hands
                        Brand description
                        DOCUMENTED · BRAND SITE

────────────────────────────────────────

[product/model image]   04 · PROVENANCE
                        Connect the exact garment record
                        ...
```

### Why this does not yet feel like a true product passport

The content mainly answers:

> “What does this brand/product represent?”

rather than:

> “What can we prove about this individual garment?”

The repeated product/model images also function mostly as decoration rather than evidence.

The passport should instead connect the **specific garment** to concrete production information whenever such information is available.

---

# 3. What the Product Passport Should Show

The desired content direction identified in the discussion is:

### Fabric

Show an actual close-up or contextual photograph of the fabric itself.

Potential information:

- Material
- Weave
- Composition
- Fabric lot number
- Quantity in lot
- Source / weaving location
- Loom ID
- Production date or period

### Craftsman / Maker

Show an actual portrait of the relevant craftsman, artisan, weaver, embroiderer, tailor, etc.

Potential information:

- Name
- Role
- Location
- Craft / specialization
- Relationship to the garment
- Evidence source

### Craftsman working

Show a photograph of the person actually performing the relevant process.

Examples:

- Weaver working on a loom
- Artisan doing hand embroidery
- Spinner working yarn
- Dyer working with fabric
- Tailor cutting/stitching
- Finisher or craft worker working on the garment

This image should correspond to the **specific production context** whenever possible, rather than being another generic product/model photograph.

### Lot / production record

A true passport should expose structured identifiers.

For example:

```text
FABRIC LOT
SS-BLK-2408-17

42.6 metres recorded
Handwoven satin silk
Loom L-042
```

Potential garment-level fields:

```text
GARMENT ID       TLA-BSB-00037
PRODUCT          Black Spade Blazer
FABRIC LOT       SS-BLK-2408-17
FABRIC QTY       2.8 m
LOOM             L-042
WEAVER           [Name]
WEAVING LOCATION [Village / State]
GARMENT UNIT     [Unit]
PRODUCTION DATE  [Date]
```

The lot number is especially important because it creates a concrete link between the fabric and the individual garment.

---

# 4. The Key Conceptual Shift

The passport needs to move from:

> **Story of the brand/product**

toward:

> **Record of an individual object**

This can be summarized as:

| Current approach | Proposed approach |
|---|---|
| Handwoven satin silk | Fabric lot: SS-BLK-2408-17 |
| Handloom fabric | Loom: L-042 |
| Skilled creative hands | Named maker + role, where actually linked |
| Product image | Fabric/process/maker/record imagery |
| Brand claim | Evidence-linked claim |
| Generic provenance story | Garment-specific production chain |
| Editorial cards | Traceability records |

The product itself becomes the central identity of the passport.

---

# 5. Proposed New Passport Structure

## Header

The passport should begin with a strong garment identity.

Example:

```text
PRODUCT PASSPORT

The journey of this piece.

BLACK SPADE BLAZER
The Loom Art

GARMENT ID
TLA-BSB-00037

TRACEABILITY
Partially documented
```

A small traceability indicator could show how much of the production chain is actually documented.

The visual design should retain the premium/editorial character of the current implementation.

---

## 01 — THE FABRIC

Instead of a model image, use a fabric photograph.

```text
01 · FABRIC

[large fabric close-up]

HANDWOVEN SATIN SILK

Fabric lot
SS-BLK-2408-17

42.6 m recorded
Loom L-042

PRODUCT RECORD
```

The image should ideally make the weave and material immediately recognizable.

---

## 02 — THE LOOM / WEAVING

Use an image of an artisan actually working on a loom.

```text
02 · WEAVING

[artisan at loom]

THE LOOM

Weaver
[Name]

Location
[Village, District, State]

Production period
[Date range]

Fabric lot
SS-BLK-2408-17
```

The lot identifier should carry through from the fabric section.

---

## 03 — THE MAKER

Use a portrait of the relevant craftsman/maker.

```text
03 · THE MAKER

[artisan portrait]

THE PERSON BEHIND THE WORK

Name
[Name]

Role
Weaver / embroiderer / tailor / etc.

Location
[Location]

Evidence
Brand archive / production record
```

The critical rule is that the person should only be explicitly associated with the garment when the available evidence supports that relationship.

---

## 04 — FROM FABRIC TO GARMENT

Introduce a production timeline.

```text
YARN
  ↓
WEAVING
  ↓
DYEING
  ↓
CUTTING
  ↓
STITCHING
  ↓
FINISHING
```

Each node can expand to show:

- Date
- Location
- Person / unit
- Lot ID
- Record ID
- Supporting image

For example:

```text
WEAVING
12 Aug 2026
Loom L-042
Fabric lot SS-BLK-2408-17
```

This communicates that the garment has travelled through a chain of events rather than merely having a story attached to it.

---

## 05 — THE GARMENT RECORD

This section turns the passport into a structured record.

Example:

| Field | Record |
|---|---|
| Product | Black Spade Blazer |
| SKU | BSB-01 |
| Garment ID | TLA-BSB-00037 |
| Fabric lot | SS-BLK-2408-17 |
| Fabric quantity | 2.8 m |
| Loom | L-042 |
| Weaver | [Name / Not linked] |
| Weaving location | [Village / State / Not linked] |
| Garment unit | [Unit / Not linked] |
| Production date | [Date / Not linked] |

This is the section that most clearly distinguishes a product passport from a normal brand storytelling page.

---

# 6. Evidence / Traceability Levels

A major part of the discussion was that the automated demo must **not invent supply-chain facts** merely to make the UI look complete.

The passport should therefore visually distinguish different evidence levels.

## Proposed evidence labels

### PRODUCT PAGE

Information explicitly present on the actual product page.

Example:

```text
✓ PRODUCT PAGE
```

### BRAND ARCHIVE

Information found elsewhere on the brand website, such as:

- About pages
- Craft pages
- Behind-the-scenes pages
- Maker stories
- Blog posts
- Sustainability pages

Example:

```text
✓ BRAND ARCHIVE
```

### PRODUCTION RECORD

Piece-specific information supplied through actual production/traceability records.

Example:

```text
◎ PRODUCTION RECORD
```

### NOT LINKED

A known field that has not yet been connected to the individual garment.

Example:

```text
— NOT LINKED
```

This prevents unsupported claims from being presented as facts.

---

# 7. The Important Rule: Never Fake Traceability

The passport must not manufacture identifiers simply because the UI expects them.

Examples of information that should **not** be invented:

- Fabric lot number
- Weaver identity
- Loom ID
- Village
- Production date
- Artisan-to-garment relationship
- Material quantity
- Production unit
- Garment serial number

For example, the system should not invent:

```text
Fabric lot: TLA-2025-0093
Weaver: Ramesh
Loom: L-042
```

unless those facts are actually documented.

Instead it should display:

```text
FABRIC LOT
Not linked

WEAVER
Not linked

LOOM
Not linked
```

This is actually valuable for the product pitch because it makes the **data gap visible**.

---

# 8. A Better Missing-Data Experience

When public web information cannot establish a garment-level relationship, the passport can explicitly surface the gap.

Example:

```text
TRACEABILITY RECORD

Fabric lot       Not linked
Weaver           Not linked
Loom             Not linked
Production unit  Not linked

────────────────────────

This information may exist outside the public website.
Connect the production record to complete this passport.

CONNECT PRODUCTION RECORD →
```

This creates a strong business narrative:

> The brand already has much of the information internally; the problem is that it is not connected to the individual product in a customer-facing way.

---

# 9. Image Strategy

The current demo uses repeated model/product photography. The new version should use images according to their evidentiary role.

## Image types to prioritize

### Material image

Macro / close-up photograph of the fabric.

### Artisan portrait

A real person involved in the relevant craft process.

### Artisan at work

The same or another relevant person working on:

- Loom
- Embroidery
- Spinning
- Dyeing
- Cutting
- Stitching
- Finishing

### Production record image

Potential examples:

- Fabric roll
- Lot tag
- Loom record
- Production sheet
- Workshop photograph
- Batch documentation

### Garment image

Keep the main product image available as the anchor for the whole passport, but do not reuse it for every evidence card.

---

# 10. Product Context Should Determine the Passport

A generic template is not sufficient.

The content should be generated from the actual brand/product context.

For example:

A handwoven blazer should produce something like:

```text
Fabric
→ Weaving
→ Weaver
→ Cutting
→ Stitching
→ Garment
```

An embroidered garment might instead produce:

```text
Base fabric
→ Embroidery
→ Embroiderer
→ Stitching
→ Finishing
```

A naturally dyed product could have:

```text
Fiber
→ Dye source
→ Dyeing
→ Weaver
→ Garment
```

Therefore the engine should not simply fill a fixed set of “Material / Craft / People / Provenance” cards. It should construct a passport based on the production characteristics and evidence found for that particular product/brand.

---

# 11. Proposed UI Behavior

The existing interaction should remain:

1. User sees the original product page.
2. A small passport pill appears on the product image.
3. User clicks/opens the pill.
4. Passport panel opens directly over the product image.
5. The right-side product details remain visible where the layout allows.

The changes are primarily inside the passport panel.

---

# 12. Keep the Existing Visual Language

The redesign should not turn the passport into a generic SaaS dashboard.

The current aesthetic direction is strong:

- Dark / black background
- Cream typography
- Large serif headline
- Small uppercase labels
- Fine dividers
- Large editorial photography
- Generous whitespace

Keep these.

Add the traceability layer through:

- Record IDs
- Dates
- Lots
- Locations
- Evidence labels
- Timeline nodes
- Structured metadata
- Status indicators

The intended aesthetic is:

> **Luxury editorial design × supply-chain record**

rather than:

> **ERP / SaaS dashboard**

---

# 13. Proposed Header Improvement

The current header can become more useful by establishing a persistent identity for the individual garment.

Suggested structure:

```text
┌─────────────────────────────────────────────┐
│ [small garment image]  BLACK SPADE BLAZER × │
│                        TLA-BSB-00037         │
└─────────────────────────────────────────────┘
```

As the visitor scrolls through the passport, the product identity remains visible.

This keeps the user anchored to the specific object being traced.

---

# 14. Traceability Indicator

A lightweight indicator can make completeness visible without turning into a gamified score.

Example:

```text
TRACEABILITY
Partially documented

3 public records
2 production links missing
```

This is preferable to a simplistic “92% traceable” score unless the methodology is well defined.

The UI should distinguish between:

- public evidence found
- production data connected
- known fields missing

---

# 15. Expandable Evidence Objects

Cards can become interactive evidence units.

Example:

```text
┌────────────────────────────────────┐
│ [fabric photograph]                │
│                                    │
│ FABRIC LOT                         │
│ SS-BLK-2408-17                     │
│                                    │
│ 42.6 metres · Loom L-042           │
│                                    │
│ VIEW RECORD →                      │
└────────────────────────────────────┘
```

On clicking “VIEW RECORD”, expand the record:

```text
SS-BLK-2408-17

FABRIC RECORD

Material       Satin silk
Weave          Handwoven
Quantity       42.6 m
Loom           L-042
Location       [Location]
Recorded       [Date]

[photo of fabric / lot tag]
```

This adds depth without overcrowding the first viewport.

---

# 16. The Automated Engine Should Also Change

The new UI has implications for the scraping / generation engine.

The goal is still:

```text
Brand/product URL
        ↓
Automatic site analysis
        ↓
Rendered product-page snapshot
        ↓
Product + brand evidence extraction
        ↓
Image classification
        ↓
Passport generation
        ↓
Founder-ready shareable demo
```

However, the engine should now think in terms of **evidence and relationships**, not only page scraping.

---

# 17. Stage 1 — Website Intelligence

Input:

```text
https://theloomart.com/products/black-spade-blazer
```

The engine should discover:

### Product-level information

- Product name
- SKU
- Description
- Material / composition
- Product images
- Product variants
- Price

### Brand-level evidence

Crawl relevant pages such as:

- About
- Craft / Materials
- Maker stories
- Behind the scenes
- Sustainability pages
- Blog posts
- Artisan pages

The engine should build an internal evidence graph such as:

```text
BRAND
 ↓
HANDWOVEN FABRICS
 ↓
WEAVERS
 ↓
ARTISANS
 ↓
EMBROIDERY
 ↓
MAKER STORIES
```

The critical distinction is that brand-level evidence is **not automatically treated as garment-level evidence**.

---

# 18. Stage 2 — Image Intelligence

The crawler should collect actual brand-owned image assets and classify them.

Useful image categories include:

```text
PRODUCT
FABRIC
LOOM
ARTISAN PORTRAIT
ARTISAN AT WORK
EMBROIDERY
CUTTING
STITCHING
DYEING
FINISHING
LOT / DOCUMENT
WORKSHOP
```

The passport generator can then choose the right image for each section.

For example:

```text
FABRIC card
→ FABRIC image

WEAVING card
→ LOOM / ARTISAN AT WORK image

MAKER card
→ ARTISAN PORTRAIT

RECORD card
→ LOT / DOCUMENT image
```

This is far stronger than selecting four random product photographs.

---

# 19. Stage 3 — Evidence Linking

The engine needs to distinguish between:

### Explicit relationship

The website clearly says:

> Person X made / wove / embroidered this product.

This can support garment-level attribution.

### Contextual relationship

The website says:

> Person X is one of the brand's artisans.

This establishes relevance to the brand but not necessarily to the specific garment.

### Unsupported inference

The product is a handwoven blazer and an artisan appears elsewhere on the site.

This does **not** establish that the person made the blazer.

The generator must not silently turn contextual relationships into explicit ones.

---

# 20. Suggested Passport Data Model

A useful internal structure could look like:

```js
{
  product: {
    name: "Black Spade Blazer",
    sku: "BSB-01",
    garmentId: null
  },

  material: {
    name: "Handwoven satin silk",
    composition: null,
    fabricLot: null,
    evidence: "product-page"
  },

  weaving: {
    loomId: null,
    weaver: null,
    location: null,
    date: null,
    evidence: "brand-archive"
  },

  maker: {
    name: null,
    role: null,
    image: null,
    linkedToProduct: false
  },

  garmentRecord: {
    fabricLot: null,
    fabricQuantity: null,
    productionUnit: null,
    productionDate: null,
    recordAvailable: false
  }
}
```

The exact field set will vary by product category.

---

# 21. Important Product Philosophy

The product passport should make a useful distinction between three layers:

## Layer 1 — Public website story

What a customer can already learn from the website.

## Layer 2 — Reconstructed brand evidence

Relevant evidence distributed across the brand's website/archive.

## Layer 3 — Connected production record

Private / structured supply-chain information that identifies the actual chain behind an individual piece.

The commercial opportunity is primarily in **Layer 3**, while Layers 1 and 2 create an immediate personalized demo.

---

# 22. Better Outreach Narrative

Instead of pitching:

> “We make beautiful product passports for your products.”

The demo can communicate:

> “We took your existing product page and public craft archive and turned the product story into a traceability interface. The next step is connecting the production records you already have — fabric lot, artisan, loom, production unit and dates — to each individual garment.”

This is stronger because it identifies an existing operational problem rather than presenting the passport as another marketing widget.

---

# 23. What the The Loom Art Demo Should Eventually Demonstrate

For the Black Spade Blazer, the target experience should be approximately:

```text
BLACK SPADE BLAZER

GARMENT ID
Not linked yet

────────────────────────────────

01 · FABRIC

[actual fabric texture]

Handwoven satin silk

Fabric lot
Not linked

Source
Product page

────────────────────────────────

02 · WEAVING

[actual loom / weaving photo]

Handwoven textile

Weaver
Not linked to this garment

Evidence
Brand archive

────────────────────────────────

03 · THE MAKER

[actual artisan portrait]

Story Maker
[Name, when relevant]

Relationship to this garment
Not established

────────────────────────────────

04 · FROM FABRIC TO GARMENT

Yarn → Weaving → Cutting → Stitching → Finishing

────────────────────────────────

05 · GARMENT RECORD

Fabric lot       Not linked
Weaver           Not linked
Loom             Not linked
Production unit  Not linked

CONNECT PRODUCTION RECORD →
```

This may initially contain more “not linked” information than the current demo, but it is significantly more credible and demonstrates the actual product gap.

---

# 24. The Ideal Future Version

The eventual product passport should be able to say:

```text
THIS PIECE

BLACK SPADE BLAZER
TLA-BSB-00037

FABRIC
SS-BLK-2408-17

↓

WEAVING
Loom L-042

↓

WEAVER
[Named artisan]

↓

CUT & STITCH
[Production unit]

↓

FINISHING
[Maker]

──────────────────────

Every record attached to this garment.
```

And each node should open supporting evidence, photographs, dates, locations and source records.

That is the point at which the system starts feeling like a genuine **digital product passport / traceability record** rather than a marketing story.

---

# 25. Final Design Principle

The strongest design principle from this discussion is:

> **Do not ask “What story can we tell about this product?”**
>
> **Ask “What evidence can we attach to this specific product?”**

The UI, image selection, data model and scraping engine should all follow that principle.

The desired result is:

**Beautiful enough to feel like a premium fashion experience.**

**Structured enough to feel like a real production record.**

**Honest enough to clearly show what is documented and what is still missing.**
