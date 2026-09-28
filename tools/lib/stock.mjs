// Fixed illustrative section images (tools/stock/stock.json), the same for every brand.
// Each gets a placeholder URL that the generator serves from disk and localizes like
// any other image.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const STOCK_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'stock');
export const STOCK_ORIGIN = 'https://stock.passport.local/';

export async function loadStock() {
  const meta = JSON.parse(await fs.readFile(path.join(STOCK_DIR, 'stock.json'), 'utf8'));
  return Object.fromEntries(Object.entries(meta).filter(([k]) => !k.startsWith('_'))
    .map(([k, v]) => [k, {...v, src: STOCK_ORIGIN + v.file}]));
}
