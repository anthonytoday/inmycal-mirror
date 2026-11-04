/**
 * External uptime check for inmycal.com, run on GitHub's runners (outside Cloudflare) every 15 minutes.
 * Checks the home page, the search index and one calendar feed for status 200 plus expected content,
 * with one retry 20 s later so a single blip does not open an issue. Names Cloudflare error codes
 * (1027 = Workers free daily request limit, 1101/1102 = Worker exception or CPU limit) when it sees them.
 * Usage: node scripts/uptime.mjs [--origin https://inmycal.com] [--json out.json]. Exit 1 = a check failed twice.
 */
import { writeFileSync, appendFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const ORIGIN = opt('origin', 'https://inmycal.com').replace(/\/$/, '');
const CHECKS = [
  { name: 'Home', path: '/', expect: (b) => b.length > 5000 && /href="\/how-to\/"/.test(b) && /<\/html>/i.test(b) },
  { name: 'Search index', path: '/search.json', expect: (b) => { try { return JSON.parse(b).length > 100; } catch { return false; } } },
  { name: 'Calendar feed', path: '/cal/premier-league/arsenal.ics', expect: (b) => b.startsWith('BEGIN:VCALENDAR') && b.includes('BEGIN:VEVENT') },
];
const cfCode = (b) => { const m = b.match(/error code:?\s*(10\d\d|11\d\d|52\d)/i) || b.match(/Error (10\d\d|11\d\d|52\d)/); return m ? m[1] : null; };
async function once(c) {
  const t0 = Date.now();
  try {
    const res = await fetch(`${ORIGIN}${c.path}?uptime=${Date.now()}`, { headers: { 'User-Agent': 'inmycal-uptime/1 (+github actions)' }, signal: AbortSignal.timeout(15000) });
    const body = await res.text();
    const ok = res.status === 200 && c.expect(body);
    return { ok, status: res.status, ms: Date.now() - t0, cf: ok ? null : cfCode(body) };
  } catch (e) { return { ok: false, status: 0, ms: Date.now() - t0, error: String(e.message || e) }; }
}
const results = [];
for (const c of CHECKS) {
  let r = await once(c);
  if (!r.ok) { await new Promise((s) => setTimeout(s, 20000)); r = await once(c); }
  results.push({ name: c.name, path: c.path, ...r });
}
const line = (r) => `- ${r.ok ? 'OK' : 'FAIL'} ${r.name} (${r.path}): HTTP ${r.status}, ${r.ms} ms${r.cf ? `, Cloudflare error ${r.cf}` : ''}${r.error ? `, ${r.error}` : ''}`;
const summary = `${ORIGIN} at ${new Date().toISOString()}\n${results.map(line).join('\n')}\nStandby copy: https://mirror.inmycal.com`;
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n');
const out = opt('json', null);
if (out) writeFileSync(out, JSON.stringify({ origin: ORIGIN, results, summary }));
process.exit(results.every((r) => r.ok) ? 0 : 1);
