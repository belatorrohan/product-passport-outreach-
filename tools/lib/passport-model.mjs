// Evidence model for one garment (brainstorm §6, §7, §10, §19, §20).
//
// Every field is {value, evidence, source?} where evidence is one of:
//   product-page       stated on this product's own page
//   brand-archive      stated elsewhere on the brand site (brand-level, not garment-level)
//   production-record  supplied from a real production/traceability record
//   not-linked         a known field with no evidence for this garment
//
// Rule: never invent lots, looms, people, places, dates, quantities or IDs.
// Anything not found in a public source stays `not-linked`.

export const EVIDENCE = {
  PRODUCT: 'product-page',
  ARCHIVE: 'brand-archive',
  RECORD: 'production-record',
  NONE: 'not-linked',
};

const field = (value, evidence, source) => (value ? {value, evidence, ...(source ? {source} : {})} : {value: null, evidence: EVIDENCE.NONE});

const FIBRES = 'silk|cotton|linen|wool|khadi|hemp|jute|cashmere|pashmina|muslin|chanderi|organza|velvet|satin|denim|tussar|eri|mulberry|merino|bamboo|modal|viscose|flax';
const FIBRE_QUALIFIERS = 'satin|raw|pure|organic|mulberry|tussar|matka|slub|crepe|georgette|chanderi|mul|khadi|merino|kala|handspun|hand-spun|linen|cotton|silk';
const WEAVE = 'hand[- ]?woven|handloom|hand[- ]?spun|jacquard|ikat|jamdani|brocade|twill|seersucker|flatweave|dobby|khadi|hand[- ]?knit(?:ted)?';

// Production stages, in order. `on` decides whether a stage applies to this product
// (from its own page, or failing that the archive), `words` whether a text mentions it.
const STAGES = [
  {key: 'fibre', label: 'Yarn', words: /yarn|fib(re|er)|spun|spinning|hand[- ]?spun/i, always: true},
  {key: 'dyeing', label: 'Dyeing', words: /\bdye(d|ing)?\b|indigo|natural colou?r|madder/i},
  {key: 'weaving', label: 'Weaving', words: /hand[- ]?woven|handloom|\bloom|weav/i},
  {key: 'printing', label: 'Printing', words: /block[- ]?print|hand[- ]?print|dabu|ajrakh|kalamkari/i},
  {key: 'embroidery', label: 'Embroidery', words: /embroider|zardozi|chikan|aari|kantha|hand[- ]?stitch(ed)? (motif|detail)/i},
  {key: 'cutting', label: 'Cutting', words: /\bcut(ting)?\b|pattern/i, always: true},
  {key: 'stitching', label: 'Stitching', words: /stitch|tailor|sewn|construct/i, always: true},
  {key: 'finishing', label: 'Finishing', words: /finish|press|quality check/i, always: true},
];

const ROLES = {weaving: 'Weaver', embroidery: 'Embroiderer', dyeing: 'Dyer', printing: 'Block printer', stitching: 'Tailor'};

function sentences(pages) {
  const out = [];
  for (const p of pages) for (const para of p.paragraphs) {
    for (const s of para.split(/(?<=[.!?])\s+(?=[A-Z“"])/)) {
      const t = s.trim();
      if (t.length >= 40 && t.length <= 320) out.push({text: t, source: p.url, title: p.title});
    }
  }
  return out;
}

// Only a conservative, explicit pattern can name a person, e.g.
// "Meet Ramesh Kumar, our master weaver" / "Sunita, an embroiderer from ...".
const PERSON_ROLE = /\b(?:Meet\s+)?([A-Z][a-z]{2,}(?:\s[A-Z][a-z]{2,}){0,2})(?:\s+ji)?,?\s+(?:is\s+)?(?:a|an|our|the)?\s*(?:master\s+|senior\s+|lead\s+)?(weaver|artisan|karigar|embroiderer|tailor|craftsman|craftswoman|dyer|spinner|block printer)s?\b/;
const NOT_NAMES = /^(The|Our|We|Each|Every|This|These|Meet|Handloom|Indian|India|Local|Skilled|Master|Traditional|Every|All)$/;

// Indian honorific "<Name> Ji" in a paragraph about craft work also names a real maker,
// e.g. "Dilip Ji Is A Highly Skilled Worker … Handling The Sampling".
const HONORIFIC = /\b([A-Z][a-z]{2,}(?:\s[A-Z][a-z]{2,})?)\s+Ji\b/;
const CRAFT_ROLE = [
  [/embroider/i, 'Hand embroidery', 'embroidery'],
  [/weav|handloom|\bloom/i, 'Weaver', 'weaving'],
  [/pattern/i, 'Pattern master', 'cutting'],
  [/tailor|stitch/i, 'Tailor', 'stitching'],
  [/dye/i, 'Dyer', 'dyeing'],
  [/sampling/i, 'Sampling', 'stitching'],
  [/artisan|artesian|karigar|craft/i, 'Artisan', null],
];

// Candidates are named people the brand archive describes doing craft work; the one
// whose craft matches this product's primary craft is preferred. Still brand-level only.
function findMaker(pages, brand, craftKey, brandRe) {
  const found = [];
  for (const p of pages) for (const raw of p.paragraphs) {
    const para = brandRe ? raw.replace(brandRe, 'the brand') : raw;
    const m = para.match(PERSON_ROLE);
    if (m && !NOT_NAMES.test(m[1].split(' ')[0]) && !brand.toLowerCase().includes(m[1].toLowerCase())) {
      found.push({name: m[1], role: m[2][0].toUpperCase() + m[2].slice(1), quote: raw, source: p.url, craft: CRAFT_ROLE.find(([re]) => re.test(m[2]))?.[2]});
      continue;
    }
    const h = para.match(HONORIFIC);
    const role = h && CRAFT_ROLE.find(([re]) => re.test(para));
    if (h && role && !NOT_NAMES.test(h[1].split(' ')[0])) found.push({name: `${h[1]} Ji`, role: role[1], quote: raw, source: p.url, craft: role[2]});
  }
  return found.find(f => f.craft === craftKey) || found[0] || null;
}

// A claim must be a real sentence (not a Title Case headline), ranked by how many
// times it mentions the topic, then by closeness to a readable length.
function bestClaim(sents, re, brandRe) {
  const g = new RegExp(re.source, 'gi');
  const hits = t => ((brandRe ? t.replace(brandRe, '') : t).match(g) || []).length;
  const isSentence = t => /[.!?…]["”']?$/.test(t) && t.split(/\s+/).length >= 8
    && t.split(/\s+/).filter(w => /^[A-Z]/.test(w)).length / t.split(/\s+/).length < 0.6;
  return sents.filter(s => isSentence(s.text) && hits(s.text))
    .map(s => ({...s, score: hits(s.text) * 100 - Math.abs(s.text.length - 150)}))
    .sort((a, b) => b.score - a.score)[0] || null;
}

// Choose a small thumbnail per passport section by its evidentiary role (§9, §18). The
// brand's own archive image is preferred when one clearly fits; otherwise a fixed
// *illustrative* image (the same for every brand), always captioned as illustrative and
// never presented as this garment, its fabric or its maker. A model/product photo is
// never used for the fabric, craft or maker card; the garment record shows the product
// photo from the brand's own page.
export function pickImages(product, archive, craftKey, stock) {
  const used = new Set(), take = pred => {
    const img = archive.images.find(i => !used.has(i.src) && pred(i));
    if (img) used.add(img.src);
    return img ? {src: img.src, alt: img.alt, source: img.source, kind: 'archive'} : null;
  };
  const illustrative = key => {
    const s = stock?.[key];
    return s ? {src: s.src, alt: s.alt, source: s.url, credit: `${s.credit} · ${s.license}`, kind: 'stock'} : null;
  };
  const craftCls = {weaving: 'loom', embroidery: 'embroidery', dyeing: 'dyeing', printing: 'dyeing', stitching: 'stitching'}[craftKey];
  const craft = take(i => i.cls === craftCls && i.strong) || take(i => i.cls === craftCls)
    || illustrative(craftKey === 'embroidery' ? 'embroiderer' : 'loom');
  const maker = take(i => i.cls === 'portrait' && i.strong) || take(i => i.cls === 'portrait') || illustrative('maker');
  // Fabric needs the image's own alt/caption/filename to say so; section text is too loose.
  const fabric = take(i => i.cls === 'fabric' && i.strong) || illustrative('fabric');
  const garment = product.hero ? {src: product.hero, alt: product.title, source: product.url, kind: 'product'} : null;
  return {fabric, craft, maker, garment};
}

export function buildPassportModel(product, archive, stock = null) {
  const pageText = product.pageText || product.desc || '';
  const sents = sentences(archive.pages);
  // "The Loom Art" must not count as a mention of looms: match the brand name letter by
  // letter with optional spaces (og:site_name is often squashed, e.g. "Theloomart").
  const letters = (product.brand || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const brandRe = letters.length > 3 ? new RegExp(letters.split('').join('\\s*'), 'gi') : null;
  const claim = re => bestClaim(sents, re, brandRe);
  const pageFacts = brandRe ? pageText.replace(brandRe, ' ') : pageText;

  // Material: only phrases literally on the product page.
  const materialMatch = pageText.match(new RegExp(`\\b((?:(?:${WEAVE})\\s+)?(?:(?:${FIBRE_QUALIFIERS})\\s)?(?:${FIBRES}))\\b`, 'i'));
  const weaveMatch = pageText.match(new RegExp(`\\b(${WEAVE})\\b`, 'i'));
  const composition = (pageText.match(/\b\d{1,3}\s?%\s?[a-z]+(?:\s?[,/&]\s?\d{1,3}\s?%\s?[a-z]+)*/i) || [])[0];
  const cap = s => s && s[0].toUpperCase() + s.slice(1).toLowerCase();

  // Production chain (§10): stages the product page implies, plus universal garment steps.
  const stages = STAGES.filter(st => st.always || st.words.test(pageFacts)).map(st => {
    const onPage = st.words.test(pageFacts) && !st.always;
    const stageClaim = claim(st.words);
    return {
      key: st.key,
      label: st.label,
      // "Weaving is part of how this piece is made" is a product-page statement about the
      // process type; it is still not a record of *when/where/who* for this garment.
      process: onPage ? field(`Stated on product page`, EVIDENCE.PRODUCT, product.url)
        : stageClaim ? field('Described in brand archive', EVIDENCE.ARCHIVE, stageClaim.source)
        : field(null),
      date: field(null), location: field(null), person: field(null), lot: field(null),
    };
  });

  // The craft the passport's second section is about: the most specific stage present.
  const craftKey = ['embroidery', 'printing', 'weaving', 'dyeing'].find(k => stages.some(s => s.key === k && s.process.evidence !== EVIDENCE.NONE)) || 'stitching';
  const craftStage = STAGES.find(s => s.key === craftKey);
  const craftClaim = claim(craftStage.words);
  const maker = findMaker(archive.pages, product.brand, craftKey, brandRe);
  const makerClaim = maker ? null : claim(/artisans?|karigars?|weavers?|embroiderers?|craftsm[ae]n|craftswom[ae]n/i);

  const garmentRecord = [
    ['Product', field(product.title, EVIDENCE.PRODUCT, product.url)],
    ['SKU', field(product.sku, EVIDENCE.PRODUCT, product.url)],
    ['Garment ID', field(null)],
    ['Material', field(materialMatch && cap(materialMatch[1]), EVIDENCE.PRODUCT, product.url)],
    ['Fabric lot', field(null)],
    ['Fabric quantity', field(null)],
    [craftKey === 'weaving' ? 'Loom' : 'Workshop', field(null)],
    [ROLES[craftKey] || 'Maker', field(null)],
    ['Location', field(null)],
    ['Garment unit', field(null)],
    ['Production date', field(null)],
  ];

  const publicRecords = garmentRecord.filter(([, f]) => f.evidence === EVIDENCE.PRODUCT || f.evidence === EVIDENCE.ARCHIVE).length
    + stages.filter(s => s.process.evidence !== EVIDENCE.NONE).length + (maker ? 1 : 0);
  const recordLinks = garmentRecord.filter(([, f]) => f.evidence === EVIDENCE.RECORD).length;
  const missing = garmentRecord.filter(([, f]) => f.evidence === EVIDENCE.NONE).length;

  return {
    product: {
      name: product.title, brand: product.brand, price: product.price, url: product.url, hero: product.hero,
      sku: field(product.sku, EVIDENCE.PRODUCT, product.url),
      garmentId: field(null),
    },
    material: {
      name: field(materialMatch && cap(materialMatch[1]), EVIDENCE.PRODUCT, product.url),
      weave: field(weaveMatch && cap(weaveMatch[1]), EVIDENCE.PRODUCT, product.url),
      composition: field(composition, EVIDENCE.PRODUCT, product.url),
      fabricLot: field(null), quantity: field(null),
      statement: field(product.desc, EVIDENCE.PRODUCT, product.url),
    },
    craft: {
      key: craftKey,
      label: craftStage.label,
      role: ROLES[craftKey] || 'Maker',
      claim: craftClaim ? field(craftClaim.text, EVIDENCE.ARCHIVE, craftClaim.source) : field(null),
      person: field(null), location: field(null), period: field(null), workshop: field(null),
    },
    maker: {
      name: maker ? field(maker.name, EVIDENCE.ARCHIVE, maker.source) : field(null),
      role: maker ? field(maker.role, EVIDENCE.ARCHIVE, maker.source) : field(null),
      statement: maker ? field(maker.quote, EVIDENCE.ARCHIVE, maker.source) : makerClaim ? field(makerClaim.text, EVIDENCE.ARCHIVE, makerClaim.source) : field(null),
      // Only an explicit product-page attribution could make this true (§19); archive
      // mentions establish relevance to the brand, not to this garment.
      linkedToProduct: false,
    },
    stages,
    garmentRecord,
    traceability: {
      status: recordLinks ? 'Production record connected' : publicRecords ? 'Partially documented' : 'Not yet documented',
      publicRecords, recordLinks, missing,
    },
    images: pickImages(product, archive, craftKey, stock),
    sources: archive.pages.map(p => ({url: p.url, title: p.title})),
  };
}
