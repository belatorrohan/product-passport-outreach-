// Web UI for the generator: paste a brand's website link, get a link to its product
// passport proof of concept.
//
//   npm run ui            then open http://localhost:4173
//
// Each request runs tools/make-passport.mjs (one at a time; each run drives a browser)
// into generated/<brand>/ and the result is served from there. Env: PORT (4173),
// HOST (127.0.0.1), CHROMIUM_PATH (passed through to the generator).
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import dns from 'node:dns/promises';
import net from 'node:net';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = {p: path.join(ROOT, 'generated'), d: path.join(ROOT, 'demos')};
const UI = path.join(ROOT, 'tools', 'ui', 'index.html');
const PORT = Number(process.env.PORT) || 4173, HOST = process.env.HOST || '127.0.0.1';
const RUN_TIMEOUT = 10 * 60 * 1000;

const TYPES = {'.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf'};

const slug = s => String(s).toLowerCase().replace(/^www\./, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

// Loopback, private, link-local and similar ranges: the generator drives a real browser,
// so it must only ever be pointed at public websites.
const PRIVATE = [/^0\./, /^10\./, /^127\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^::1?$/, /^f[cd][0-9a-f]{2}:/i, /^fe80:/i, /^::ffff:(0|10|127|169\.254|192\.168)\./i];
const isPrivate = ip => PRIVATE.some(re => re.test(ip));

async function normalizeUrl(raw) {
  let s = String(raw || '').trim();
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  let u;
  try { u = new URL(s); } catch { u = null; }
  if (!u || !/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) throw new Error('Enter a website address, for example https://www.ethicus.in');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  let addrs = [];
  try { addrs = net.isIP(host) ? [host] : (await dns.lookup(host, {all: true})).map(a => a.address); } catch {}
  if (!addrs.length) throw new Error('That website address could not be found. Check the link.');
  if (addrs.some(isPrivate)) throw new Error('Only public websites can be used.');
  return u.href;
}

// Turn the generator's last error line into something a person can act on.
function explain(log) {
  const text = log.join('\n');
  if (/ERR_NAME_NOT_RESOLVED|ENOTFOUND/.test(text)) return 'That website address could not be found. Check the link.';
  if (/ERR_TUNNEL_CONNECTION_FAILED|ERR_CONNECTION|ERR_TIMED_OUT|Timeout .*exceeded/.test(text)) return 'The website could not be reached or took too long to load. Try again, or paste a direct product link.';
  if (/No product link discovered/.test(text)) return 'No product page was found from that link. Paste a direct product link, or add a product name.';
  if (/Could not identify hero image|No hero container/.test(text)) return 'The product photo could not be found on that page. Try a different product link.';
  if (/Executable doesn't exist|playwright install/i.test(text)) return 'The browser used by the generator is not installed. Run: npx playwright install chromium';
  const line = [...log].reverse().find(l => /error|failed|cannot|could not/i.test(l));
  return line ? line.trim().slice(0, 300) : null;
}

const jobs = new Map();
let queue = Promise.resolve();

function startJob(url, product) {
  const name = slug(new URL(url).hostname) + (product ? '-' + slug(product) : '');
  const job = {id: crypto.randomUUID(), url, product, name, status: 'queued', step: 'Waiting for the previous passport to finish', log: [], startedAt: null};
  jobs.set(job.id, job);
  queue = queue.then(() => run(job));
  return job;
}

function run(job) {
  return new Promise(resolve => {
    Object.assign(job, {status: 'running', step: 'Starting', startedAt: Date.now()});
    const out = path.join('generated', job.name, 'passport.html');
    const child = spawn(process.execPath, [path.join(ROOT, 'tools', 'make-passport.mjs'), job.url, out, job.product || ''], {cwd: ROOT, env: process.env});
    let stdout = '';
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => {
      for (const line of String(d).split('\n')) {
        if (line.startsWith('step: ')) job.step = line.slice(6);
        else if (line.trim()) job.log.push(line);
      }
      job.log = job.log.slice(-60);
    });
    const timer = setTimeout(() => { job.log.push('Timeout exceeded'); child.kill('SIGKILL'); }, RUN_TIMEOUT);
    const finish = async code => {
      clearTimeout(timer);
      try {
        JSON.parse(stdout.slice(stdout.indexOf('{')));
        job.result = await describe('p', job.name);
        Object.assign(job, {status: 'done', step: 'Done'});
      } catch {
        Object.assign(job, {status: 'error', error: explain(job.log) || `The generator stopped (exit code ${code}).`});
      }
      resolve();
    };
    child.on('close', finish);
    child.on('error', err => { job.log.push(String(err)); finish(-1); });
  });
}

// One passport folder (generated/<name>/ or demos/<name>/) as shown in the UI.
async function describe(kind, name) {
  const dir = path.join(DIRS[kind], name);
  const files = await fs.readdir(dir);
  const standalone = files.find(f => f.endsWith('.standalone.html'));
  if (!standalone) return null;
  const base = standalone.replace(/\.standalone\.html$/, '');
  let m = {};
  try { m = JSON.parse(await fs.readFile(path.join(dir, 'snapshot-manifest.json'), 'utf8')); } catch {}
  const p = m.passport || {};
  const at = `/${kind}/${encodeURIComponent(name)}/`;
  return {
    name, example: kind === 'd', brand: m.brand || name, title: m.title || '', price: m.price || '', sourceUrl: m.sourceUrl || '',
    generatedAt: m.generatedAt || null, material: p.material?.name?.value || null, craft: p.craft?.label || null,
    traceability: p.traceability?.status || null,
    page: at + encodeURIComponent(base + '.html'), standalone: at + encodeURIComponent(standalone),
    preview: files.includes(base + '.png') ? at + encodeURIComponent(base + '.png') : null,
  };
}

async function listPassports() {
  const out = [];
  for (const kind of ['p', 'd']) {
    let names = [];
    try { names = await fs.readdir(DIRS[kind]); } catch {}
    for (const name of names) {
      try { const d = await describe(kind, name); if (d) out.push(d); } catch {}
    }
  }
  return out.sort((a, b) => (a.example - b.example) || String(b.generatedAt).localeCompare(String(a.generatedAt)));
}

const send = (res, status, body, type = 'application/json') => {
  res.writeHead(status, {'content-type': type, 'cache-control': 'no-store'});
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
};

async function readJson(req) {
  let body = '';
  for await (const chunk of req) { body += chunk; if (body.length > 1e5) throw new Error('Request too large'); }
  return JSON.parse(body || '{}');
}

async function serveFile(res, kind, rest, download) {
  const root = DIRS[kind];
  const file = path.resolve(root, decodeURIComponent(rest));
  if (!file.startsWith(root + path.sep)) return send(res, 404, {error: 'Not found'});
  let data;
  try { data = await fs.readFile(file); } catch { return send(res, 404, {error: 'Not found'}); }
  const headers = {'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream'};
  if (download) headers['content-disposition'] = `attachment; filename="${path.basename(path.dirname(file))}-${path.basename(file)}"`;
  res.writeHead(200, headers);
  res.end(data);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (req.method === 'GET' && url.pathname === '/') return send(res, 200, await fs.readFile(UI), TYPES['.html']);
    if (req.method === 'GET' && url.pathname === '/api/passports') return send(res, 200, await listPassports());
    if (req.method === 'POST' && url.pathname === '/api/passports') {
      const body = await readJson(req);
      let target;
      try { target = await normalizeUrl(body.url); } catch (e) { return send(res, 400, {error: e.message}); }
      const job = startJob(target, String(body.product || '').trim().slice(0, 80));
      return send(res, 202, {id: job.id});
    }
    const jobMatch = url.pathname.match(/^\/api\/jobs\/([\w-]+)$/);
    if (req.method === 'GET' && jobMatch) {
      const job = jobs.get(jobMatch[1]);
      if (!job) return send(res, 404, {error: 'Unknown job'});
      const {id, url: target, product, status, step, error, result, startedAt} = job;
      return send(res, 200, {id, url: target, product, status, step, error, result, elapsed: startedAt ? Date.now() - startedAt : 0});
    }
    const fileMatch = url.pathname.match(/^\/(p|d)\/(.+)$/);
    if (req.method === 'GET' && fileMatch) return serveFile(res, fileMatch[1], fileMatch[2], url.searchParams.has('download'));
    send(res, 404, {error: 'Not found'});
  } catch (e) {
    send(res, 500, {error: String(e.message || e)});
  }
});

server.listen(PORT, HOST, () => console.log(`Product passport UI: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`));
