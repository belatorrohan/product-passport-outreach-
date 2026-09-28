// Passport panel markup, styles and runtime (brainstorm §5, §11–15, §23).
// Visual language: dark ground, cream type, serif headlines, small uppercase labels,
// fine dividers — "luxury editorial × supply-chain record", not a dashboard.
import {EVIDENCE} from './passport-model.mjs';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

const CHIP = {
  [EVIDENCE.PRODUCT]: ['✓', 'Product page', 'pp-ev-public'],
  [EVIDENCE.ARCHIVE]: ['✓', 'Brand archive', 'pp-ev-public'],
  [EVIDENCE.RECORD]: ['◎', 'Production record', 'pp-ev-record'],
  [EVIDENCE.NONE]: ['—', 'Not linked', 'pp-ev-none'],
};

function chip(f) {
  const [icon, label, cls] = CHIP[f.evidence];
  const inner = `<span aria-hidden="true">${icon}</span> ${esc(label)}`;
  return f.source && f.evidence !== EVIDENCE.NONE
    ? `<a class="pp-chip ${cls}" href="${esc(f.source)}" target="_blank" rel="noopener">${inner}</a>`
    : `<span class="pp-chip ${cls}">${inner}</span>`;
}

const val = (f, missing = 'Not linked') => f.value ? esc(f.value) : `<span class="pp-missing">${esc(missing)}</span>`;

function rows(list) {
  return `<dl class="pp-fields">${list.map(([k, f, missing]) =>
    `<div class="pp-row"><dt>${esc(k)}</dt><dd>${val(f, missing)}</dd><dd class="pp-ev">${chip(f)}</dd></div>`).join('')}</dl>`;
}

// Small fixed-size thumbnail beside each section (the text is the point, the image is
// context). Captions say where the image comes from; illustrative images never claim to
// show this garment.
function thumb(img) {
  if (!img) return '<div class="pp-media" aria-hidden="true"></div>';
  const link = (href, text) => `<a href="${esc(href)}" target="_blank" rel="noopener">${text}</a>`;
  const caption = img.kind === 'stock' ? 'Illustrative image<br>Not this garment'
    : img.kind === 'product' ? link(img.source, 'Product photo') + '<br>Brand site'
    : link(img.source, 'Brand archive') + '<br>Not linked to this garment';
  return `<figure class="pp-media"><img src="${esc(img.src)}" alt="${esc(img.alt || '')}" loading="lazy"><figcaption>${caption}</figcaption></figure>`;
}

const section = (img, body) => `<section class="pp-sec">${thumb(img)}<div class="pp-body">${body}</div></section>`;

function quote(f) {
  return f.value ? `<blockquote class="pp-quote">“${esc(f.value.length > 260 ? f.value.slice(0, 257).replace(/\s+\S*$/, '') + '…' : f.value)}”${chip(f)}</blockquote>` : '';
}

function record(id, title, list) {
  return `<button class="pp-more" type="button" aria-expanded="false" aria-controls="${id}" data-pp-toggle>View record <span aria-hidden="true">→</span></button>`
    + `<div class="pp-record" id="${id}" hidden><div class="pp-label">${esc(title)}</div>${rows(list)}</div>`;
}

export function renderPassport(m) {
  const p = m.product, mat = m.material, c = m.craft, mk = m.maker, t = m.traceability;
  const craftTitle = {weaving: 'The loom', embroidery: 'The embroidery', dyeing: 'The dye bath', printing: 'The block table', stitching: 'The workroom'}[c.key];

  const head = `<header class="pp-head">
  <img class="pp-thumb" src="${esc(p.hero)}" alt="">
  <div class="pp-id">
    <div class="pp-label">Product passport · The journey of this piece</div>
    <h2>${esc(p.name)}</h2>
    <div class="pp-sub">${esc(p.brand)}${p.price ? ' · ' + esc(p.price) : ''}</div>
    <div class="pp-idrow">
      <div><div class="pp-label">Garment ID</div><div class="pp-idval">${val(p.garmentId, 'Not linked yet')}</div></div>
      <div><div class="pp-label">Traceability</div><div class="pp-idval">${esc(t.status)}</div>
        <div class="pp-trace"><span>${t.publicRecords} public record${t.publicRecords === 1 ? '' : 's'}</span><span>${t.missing} production link${t.missing === 1 ? '' : 's'} missing</span></div></div>
    </div>
  </div>
  <button class="pp-close" type="button" aria-label="Close passport">×</button>
</header>`;

  const fabric = section(m.images.fabric, `
  <div class="pp-label">01 · Fabric</div>
  <h3>${mat.name.value ? esc(mat.name.value) : 'Material not stated'}</h3>
  ${rows([['Fabric lot', mat.fabricLot], ['Weave', mat.weave, 'Not stated'], ['Composition', mat.composition, 'Not stated']])}
  ${record('pp-rec-fabric', 'Fabric record', [['Material', mat.name, 'Not stated'], ['Weave', mat.weave, 'Not stated'], ['Composition', mat.composition, 'Not stated'], ['Fabric lot', mat.fabricLot], ['Quantity', mat.quantity], ['Recorded', {value: null, evidence: EVIDENCE.NONE}]])}`);

  const craft = section(m.images.craft, `
  <div class="pp-label">02 · ${esc(c.label)}</div>
  <h3>${esc(craftTitle)}</h3>
  ${quote(c.claim)}
  ${rows([[c.role, c.person, 'Not linked to this garment'], ['Location', c.location], ['Production period', c.period], ['Fabric lot', mat.fabricLot]])}`);

  const maker = section(m.images.maker, `
  <div class="pp-label">03 · The maker</div>
  <h3>The person behind the work</h3>
  ${rows([[mk.name.value ? 'Story maker' : 'Name', mk.name], ['Role', mk.role.value ? mk.role : {value: c.role, evidence: EVIDENCE.NONE}], ['Relationship to this garment', {value: null, evidence: EVIDENCE.NONE}, 'Not established']])}
  ${quote(mk.statement)}`);

  const timeline = section(null, `
  <div class="pp-label">04 · From fabric to garment</div>
  <h3>The production chain</h3>
  <ol class="pp-chain">${m.stages.map((s, i) => `<li>
    <button type="button" class="pp-node" aria-expanded="false" aria-controls="pp-stage-${i}" data-pp-toggle>
      <span class="pp-dot" data-ev="${s.process.evidence}"></span><span class="pp-node-name">${esc(s.label)}</span><span class="pp-node-ev">${chip(s.process)}</span>
    </button>
    <div class="pp-node-body" id="pp-stage-${i}" hidden>${rows([['Date', s.date], ['Location', s.location], ['Person / unit', s.person], ['Lot / record ID', s.lot]])}</div>
  </li>`).join('')}</ol>`);

  const garment = section(m.images.garment || {src: p.hero, alt: p.name, source: p.url, kind: 'product'}, `
  <div class="pp-label">05 · Garment record</div>
  <h3>Every record attached to this piece</h3>
  ${rows(m.garmentRecord)}
  <div class="pp-gap">
    <p>This information may exist outside the public website. Connect the production record to complete this passport.</p>
    <span class="pp-cta">Connect production record <span aria-hidden="true">→</span></span>
  </div>`);

  const credits = [...new Map(Object.values(m.images).filter(i => i?.kind === 'stock').map(i => [i.credit, i])).values()];
  const sources = `<footer class="pp-foot"><div class="pp-label">Sources</div><ul>
  <li><a href="${esc(p.url)}" target="_blank" rel="noopener">Product page</a></li>
  ${m.sources.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title || s.url)}</a></li>`).join('')}
  </ul><p>Prototype. Public-web evidence only; nothing on this passport is invented. Fields marked “Not linked” need a production record.</p>
  ${credits.length ? `<p>Illustrative images: ${credits.map(i => `<a href="${esc(i.source)}" target="_blank" rel="noopener">${esc(i.credit)}</a>`).join(', ')}.</p>` : ''}</footer>`;

  return {
    pill: `<button id="pp-pill" type="button" data-pp-pill aria-controls="pp-passport"><span aria-hidden="true">◎</span><span>The journey of this piece</span></button>`,
    panel: `<aside id="pp-passport" data-pp-panel aria-hidden="true" aria-label="Product passport">${head}<div class="pp-scroll">${fabric}${craft}${maker}${timeline}${garment}${sources}</div></aside>`,
  };
}

// Everything is scoped under IDs so the brand's own CSS cannot restyle the passport.
export const PASSPORT_CSS = `
.pp-engine-hero{position:relative!important;overflow:hidden!important}
#pp-pill,#pp-pill *,#pp-passport,#pp-passport *{all:revert;box-sizing:border-box}
#pp-pill{position:absolute;left:18px;bottom:var(--pp-pill-b,18px);z-index:2147483000;border:0;border-radius:999px;background:#fff;color:#1d1c1a;padding:11px 16px;box-shadow:0 6px 22px rgba(0,0,0,.17);font:500 12px/1 system-ui,-apple-system,sans-serif;cursor:pointer;display:flex;gap:8px;align-items:center;letter-spacing:.01em}
#pp-passport{position:absolute;left:0;top:var(--pp-top,0);height:var(--pp-h,100%);width:min(88%,700px);z-index:2147483001;background:#151513;color:#efe9df;transform:translateX(-103%);transition:transform .38s ease;box-shadow:22px 0 50px rgba(0,0,0,.3);display:flex;flex-direction:column;font:12px/1.55 system-ui,-apple-system,sans-serif;text-align:left}
.pp-open #pp-passport,#pp-passport.pp-show{transform:translateX(0)}
#pp-passport a{color:inherit;text-decoration:none}
#pp-passport .pp-label{font:500 9px/1.3 system-ui,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#a39c91}
#pp-passport .pp-head{flex:none;display:grid;grid-template-columns:62px 1fr;gap:16px;align-items:start;padding:20px 52px 16px 24px;border-bottom:1px solid #34332f;position:relative;background:#151513}
#pp-passport .pp-thumb{width:62px;height:80px;object-fit:cover;display:block}
#pp-passport h2{font:400 26px/1.05 Georgia,'Times New Roman',serif;margin:6px 0 3px;color:#f4efe6}
#pp-passport .pp-sub{font-size:10px;color:#8f897f}
#pp-passport .pp-id{min-width:0}
#pp-passport .pp-idrow{display:grid;grid-template-columns:repeat(2,max-content);gap:0 32px;align-items:start;margin-top:12px}
#pp-passport .pp-idval{font:400 14px/1.3 Georgia,serif;margin-top:4px}
#pp-passport .pp-trace{display:flex;flex-wrap:wrap;gap:2px 12px;font-size:9.5px;color:#8f897f;margin-top:2px}
#pp-passport .pp-close{position:absolute;right:14px;top:12px;border:0;background:none;color:#efe9df;font-size:28px;line-height:1;cursor:pointer;padding:4px}
#pp-passport .pp-scroll{flex:1;min-height:0;overflow:auto;padding:0 24px 28px;overscroll-behavior:contain}
#pp-passport .pp-sec{display:grid;grid-template-columns:120px minmax(0,1fr);gap:0 24px;align-items:start;padding:24px 0;border-bottom:1px solid #2f2e2a}
#pp-passport .pp-body{min-width:0}
#pp-passport h3{font:400 21px/1.15 Georgia,serif;margin:8px 0 10px;color:#f4efe6}
#pp-passport .pp-media{margin:0;min-width:0}
#pp-passport .pp-media img{display:block;width:100%;aspect-ratio:5/6;height:auto;object-fit:cover;background:#22211e}
#pp-passport .pp-media figcaption{margin-top:7px;font-size:8.5px;line-height:1.4;letter-spacing:.04em;color:#77726a}
#pp-passport .pp-media figcaption a{text-decoration:underline;color:#8f897f}
#pp-passport .pp-fields{margin:6px 0 0}
#pp-passport .pp-row{display:grid;grid-template-columns:minmax(110px,34%) 1fr auto;gap:10px;align-items:baseline;padding:7px 0;border-top:1px solid #262522}
#pp-passport dt{color:#a39c91;font-size:10.5px}
#pp-passport dd{margin:0;color:#efe9df;font-size:11.5px}
#pp-passport .pp-missing{color:#77726a;font-style:italic}
#pp-passport .pp-chip{display:inline-flex;gap:4px;align-items:center;white-space:nowrap;font:500 8px/1 system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;padding:4px 6px;border-radius:2px}
#pp-passport .pp-ev-public{color:#9fbf9a;background:rgba(159,191,154,.1)}
#pp-passport a.pp-ev-public:hover{background:rgba(159,191,154,.2)}
#pp-passport .pp-ev-record{color:#e1c58c;background:rgba(225,197,140,.12)}
#pp-passport .pp-ev-none{color:#77726a;border:1px solid #33312d}
#pp-passport .pp-quote{margin:4px 0 10px;padding:0 0 0 12px;border-left:1px solid #4a4741;font:italic 400 13px/1.5 Georgia,serif;color:#cfc8bc}
#pp-passport .pp-quote .pp-chip{margin-left:8px;font-style:normal;vertical-align:1px}
#pp-passport .pp-more{margin-top:12px;border:0;background:none;color:#d8cfbf;font:500 9px system-ui,sans-serif;letter-spacing:.16em;text-transform:uppercase;cursor:pointer;padding:4px 0}
#pp-passport .pp-more[aria-expanded="true"] span{display:inline-block;transform:rotate(90deg)}
#pp-passport .pp-record{margin-top:8px;padding:12px 14px;background:#1d1c19;border:1px solid #2f2e2a}
#pp-passport [hidden]{display:none!important}
#pp-passport .pp-chain{list-style:none;margin:6px 0 0;padding:0}
#pp-passport .pp-chain li{position:relative;padding-left:0}
#pp-passport .pp-chain li:not(:last-child)::before{content:"";position:absolute;left:5px;top:24px;bottom:-8px;width:1px;background:#3a3834}
#pp-passport .pp-node{display:grid;grid-template-columns:11px 1fr auto;gap:14px;align-items:center;width:100%;border:0;background:none;color:inherit;padding:9px 0;cursor:pointer;text-align:left}
#pp-passport .pp-dot{width:11px;height:11px;border-radius:50%;border:1px solid #77726a;background:#151513;position:relative;z-index:1}
#pp-passport .pp-dot[data-ev="product-page"],#pp-passport .pp-dot[data-ev="brand-archive"]{border-color:#9fbf9a;background:#2c3a2a}
#pp-passport .pp-dot[data-ev="production-record"]{border-color:#e1c58c;background:#e1c58c}
#pp-passport .pp-node-name{font:400 15px Georgia,serif}
#pp-passport .pp-node-body{margin:0 0 8px 25px}
#pp-passport .pp-gap{margin-top:16px;padding:16px;border:1px solid #3a3834}
#pp-passport .pp-gap p{margin:0 0 10px;color:#bdb6aa;font-size:11.5px}
#pp-passport .pp-cta{font:500 9.5px system-ui,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#e1c58c}
#pp-passport .pp-foot{padding:18px 0 0 144px;color:#77726a;font-size:10px}
#pp-passport .pp-foot ul{margin:6px 0 8px;padding:0;list-style:none;display:flex;flex-wrap:wrap;gap:4px 14px}
#pp-passport .pp-foot a{text-decoration:underline;color:#a39c91}
#pp-passport .pp-foot p{margin:0 0 6px}
@media (max-width:800px){
  #pp-passport{position:fixed;inset:0;width:100%;height:100%}
  #pp-passport .pp-head{grid-template-columns:48px 1fr;padding:16px 46px 12px 16px}
  #pp-passport .pp-thumb{width:48px;height:62px}
  #pp-passport .pp-idrow{grid-template-columns:1fr 1fr;gap:0 16px}
  #pp-passport h2{font-size:21px}
  #pp-passport .pp-scroll{padding:0 16px 24px}
  #pp-passport .pp-sec{grid-template-columns:84px minmax(0,1fr);gap:0 14px}
  #pp-passport .pp-foot{padding-left:0}
  #pp-passport .pp-row{grid-template-columns:1fr auto;}
  #pp-passport .pp-row dd:not(.pp-ev){grid-column:1/-1;grid-row:2}
}`;

// Runtime shipped inside the static demo (the site's own scripts are stripped).
export const PASSPORT_RUNTIME = `(()=>{
const pill=document.querySelector('[data-pp-pill]'),panel=document.querySelector('[data-pp-panel]');
let wrap=document.querySelector('.pp-engine-hero');
if(!pill||!wrap||!panel)return;
// Themes often swap galleries per breakpoint (e.g. desktop grid hidden on mobile). If the
// captured hero container is hidden, re-mount on the largest visible photo of the same gallery.
const remount=()=>{
  if(wrap.getBoundingClientRect().width)return;
  let scope=wrap.parentElement;while(scope&&!scope.getBoundingClientRect().width)scope=scope.parentElement;
  const area=e=>{const r=e.getBoundingClientRect();return r.width*r.height};
  const img=scope&&[...scope.querySelectorAll('img')].filter(i=>area(i)>1e4).sort((a,b)=>area(b)-area(a))[0];
  if(!img)return;
  let box=img.parentElement;while(box.parentElement&&box.parentElement!==scope&&area(box.parentElement)<=area(img)*1.15)box=box.parentElement;
  wrap.classList.remove('pp-engine-hero','pp-open');panel.classList.remove('pp-show');['--pp-top','--pp-h','--pp-pill-b'].forEach(p=>wrap.style.removeProperty(p));
  box.classList.add('pp-engine-hero');box.append(pill,panel);box.addEventListener('mouseleave',leave);box.addEventListener('mouseenter',stay);wrap=box;
};
// Desktop product photos are often taller than the screen. Keep the pill and the open
// panel inside the part of the photo that is actually on screen (like position:sticky),
// and below any sticky/fixed site header, so the passport header never scrolls away.
const MIN_H=360;
const barBottom=x=>{let b=0;for(const e of document.elementsFromPoint(x,2)){if(wrap.contains(e)||e.contains(wrap))continue;
  for(let a=e;a&&a!==document.body;a=a.parentElement){const p=getComputedStyle(a).position;if(p==='fixed'||p==='sticky'){const r=a.getBoundingClientRect();if(r.top<=2&&r.height<innerHeight*.4)b=Math.max(b,r.bottom);break}}}return b};
const layout=()=>{
  const s=wrap.style;
  if(mobile()){['--pp-top','--pp-h','--pp-pill-b'].forEach(p=>s.removeProperty(p));return}
  const r=wrap.getBoundingClientRect();if(!r.height)return;
  const top=Math.max(r.top,barBottom(r.left+r.width/2)),bottom=Math.min(r.bottom,innerHeight);
  const h=Math.min(r.height,Math.max(bottom-top,MIN_H)),y=Math.min(Math.max(top-r.top,0),r.height-h);
  s.setProperty('--pp-top',y+'px');s.setProperty('--pp-h',h+'px');
  s.setProperty('--pp-pill-b',Math.max(18,Math.min(r.bottom-bottom+18,r.height-pill.offsetHeight-18))+'px');
};
let frame=0;const schedule=()=>{if(!frame)frame=requestAnimationFrame(()=>{frame=0;layout()})};
// Hover opens a preview that closes when the pointer leaves the photo (after a brief grace
// period). Clicking the pill, or clicking/scrolling inside the panel, pins it open so the
// page can be scrolled freely; it then closes via ×, Escape or a click elsewhere.
let leaveTimer=0,pinned=false;
const stay=()=>clearTimeout(leaveTimer);
const leave=()=>{if(!pinned&&matchMedia('(hover:hover) and (min-width:801px)').matches){clearTimeout(leaveTimer);leaveTimer=setTimeout(close,350)}};
const isOpen=()=>wrap.classList.contains('pp-open');
// Full-screen on phones: lift the panel to <body> while open so a sticky site header,
// which outranks the theme's gallery stacking context, cannot paint over it.
const mobile=()=>matchMedia('(max-width:800px)').matches;
let homeTimer=0;
const open=pin=>{stay();clearTimeout(homeTimer);pinned=pinned||!!pin;layout();
  if(mobile()&&panel.parentElement!==document.body){document.body.append(panel);panel.getBoundingClientRect()}
  wrap.classList.add('pp-open');panel.classList.add('pp-show');panel.setAttribute('aria-hidden','false')};
const close=()=>{stay();pinned=false;wrap.classList.remove('pp-open');panel.classList.remove('pp-show');panel.setAttribute('aria-hidden','true');
  if(panel.parentElement!==wrap){clearTimeout(homeTimer);homeTimer=setTimeout(()=>{if(!panel.classList.contains('pp-show'))wrap.append(panel)},400)}};
// A tap fires mouseenter then click; a click right after a hover-open just pins it.
let hoverOpenedAt=0;
pill.addEventListener('mouseenter',()=>{if(!isOpen()){hoverOpenedAt=Date.now();open()}});
pill.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(Date.now()-hoverOpenedAt<600){pinned=true;return}isOpen()&&pinned?close():open(true)});
panel.querySelector('.pp-close').addEventListener('click',e=>{e.preventDefault();e.stopPropagation();close()});
panel.addEventListener('wheel',()=>{pinned=true},{passive:true});
document.addEventListener('click',e=>{if(isOpen()&&!wrap.contains(e.target)&&!panel.contains(e.target))close()});
panel.addEventListener('click',e=>{e.stopPropagation();pinned=true;const t=e.target.closest('[data-pp-toggle]');if(!t)return;e.preventDefault();const b=document.getElementById(t.getAttribute('aria-controls'));const on=t.getAttribute('aria-expanded')!=='true';t.setAttribute('aria-expanded',String(on));if(b)b.hidden=!on});
wrap.addEventListener('mouseleave',leave);wrap.addEventListener('mouseenter',stay);
remount();layout();
addEventListener('resize',()=>{remount();schedule()});addEventListener('scroll',schedule,{passive:true});
document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
document.querySelectorAll('form').forEach(f=>f.addEventListener('submit',e=>e.preventDefault()));
})();`;
