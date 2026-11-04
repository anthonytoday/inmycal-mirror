# inmycal-mirror

Standby copy of [inmycal.com](https://inmycal.com), served by GitHub Pages at https://mirror.inmycal.com and refreshed every night at 05:17 UAE.

- Independent of Cloudflare when serving: pages, calendar feeds (`/cal/...ics`), logos and assets are static files here.
- No secrets: `crawl.mjs` reads the public site only. If the copy looks incomplete, the run fails and the last good copy stays online.
- Not indexed: `robots.txt` disallows crawling; every page's canonical link points to inmycal.com.
- Published to the `gh-pages` branch (one commit, replaced nightly). GitHub Pages serves that branch.
- Failover steps (point inmycal.com here during a Cloudflare outage): see `docs/agents/RESILIENCE.md` in the private sports-calendar repository.
