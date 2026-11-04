// Copies the public inmycal.com site (pages, calendar feeds, logos, assets) into a folder that GitHub Pages
// serves as a standby at https://mirror.inmycal.com. Runs nightly; needs no secrets. If the live site is
// unreachable or the copy looks incomplete, the job fails and the last good copy stays online.
// Usage: node crawl.mjs --out site
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

const ORIGIN = process.env.MIRROR_SOURCE || 'https://inmycal.com';
const out = process.argv[process.argv.indexOf('--out') + 1] || 'site';
const UA = 'inmycal-mirror/1.0 (+https://github.com/anthonytoday/inmycal-mirror)';
const KEEP = /^\/(assets|crests|cal)\/|\.(txt|json|xml|svg)$|\/$/;

const seen = new Set();
const queue = [];
const add = (p) => {
  if (!p || !p.startsWith('/') || p.startsWith('//')) return;
  const clean = p.split('#')[0];
  const path = clean.startsWith('/cal/f1.ics') ? '/cal/f1.ics' : clean.split('?')[0];
  if (path.startsWith('/embed/') || path === '/health' || path === '/mcp' || path.startsWith('/api/')) return;
  if (!KEEP.test(path) || seen.has(path)) return;
  seen.add(path);
  queue.push(clean.includes('?') && !path.startsWith('/cal/') ? clean : path);
};

async function get(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA } });
      if (r.ok || r.status === 404) return r;
    } catch { /* retry */ }
    await new Promise((s) => setTimeout(s, 1000 * (i + 1)));
  }
  throw new Error(`unreachable: ${url}`);
}

const fileFor = (path) => join(out, path.endsWith('/') ? `${path}index.html` : path);
let pages = 0, feeds = 0, logos = 0;

rmSync(out, { recursive: true, force: true });
const sitemap = await (await get(`${ORIGIN}/sitemap.xml`)).text();
for (const m of sitemap.matchAll(/<loc>https:\/\/inmycal\.com([^<]+)<\/loc>/g)) add(m[1]);
for (const p of ['/', '/how-to/', '/for-clubs/', '/developers/', '/privacy/', '/llms.txt', '/openapi.json', '/search.json', '/sitemap.xml', '/favicon.svg', '/cal/f1.ics']) add(p);

async function worker() {
  while (queue.length) {
    const target = queue.shift();
    const path = target.split('?')[0];
    const r = await get(ORIGIN + target);
    if (r.status === 404) continue;
    const buf = Buffer.from(await r.arrayBuffer());
    const dest = fileFor(path);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, buf);
    if ((r.headers.get('content-type') || '').startsWith('text/html')) {
      pages++;
      for (const m of buf.toString('utf8').matchAll(/(?:href|src)="(\/[^"]*)"/g)) add(m[1].replace(/&amp;/g, '&'));
    } else if (path.endsWith('.ics')) feeds++;
    else if (path.startsWith('/crests/')) logos++;
  }
}
await Promise.all(Array.from({ length: 6 }, worker));

// Not-found page, standby robots (search engines index only inmycal.com), custom domain.
const nf = await get(`${ORIGIN}/this-page-does-not-exist/`);
writeFileSync(join(out, '404.html'), Buffer.from(await nf.arrayBuffer()));
writeFileSync(join(out, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
writeFileSync(join(out, 'CNAME'), 'mirror.inmycal.com\n');
writeFileSync(join(out, '.nojekyll'), '');
writeFileSync(join(out, 'mirror.json'), JSON.stringify({ source: ORIGIN, builtAt: new Date().toISOString(), pages, feeds, logos }, null, 2));

console.log(`mirror: ${pages} pages, ${feeds} calendar feeds, ${logos} logos`);
if (pages < 150 || feeds < 100) throw new Error('copy looks incomplete; keeping the previous mirror online');
