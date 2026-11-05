// Progressive enhancement only: every page works without JavaScript (times then show in UTC).
// Time zone: the visitor's own, or one they pick in the header (display only; feeds stay UTC).
(function () {
  'use strict';
  var TZ_KEY = 'imc-tz';
  var lang = navigator.language || 'en-US';
  var auto;
  try { auto = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { auto = 'UTC'; }
  // Usage counting (first-party, no cookies, no IDs): one small beacon per click on our own server.
  function track(t, k) { try { navigator.sendBeacon('/e', JSON.stringify({ t: t, k: k })); } catch (e) {} }
  var EMBED = document.documentElement.hasAttribute('data-embed');
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a, button');
    if (!a) return;
    if (a.classList.contains('add-opt')) return track('add', (EMBED ? 'widget:' : '') + (a.getAttribute('data-kind') || 'ics'));
    if (a.hasAttribute('data-feed')) return track('follow', (EMBED ? 'widget:' : '') + a.getAttribute('data-feed'));
    if (a.closest('.search-list')) return track('search', a.getAttribute('href'));
    var href = a.getAttribute('href') || '';
    if (/^https?:\/\//.test(href)) { try { var h = new URL(href).hostname; if (h !== location.hostname) track('out', h); } catch (err) {} }
  }, true);
  function picked() { try { return localStorage.getItem(TZ_KEY) || ''; } catch (e) { return ''; } }
  function zone() { var z = picked() || auto || 'UTC'; try { new Intl.DateTimeFormat('en', { timeZone: z }); return z; } catch (e) { return 'UTC'; } }

  // Clock: 12-hour with AM/PM for US time zones, 24-hour elsewhere, unless the visitor picked one in the footer.
  var H_KEY = 'imc-hours';
  var US_ZONE = /^(America\/(New_York|Chicago|Denver|Phoenix|Los_Angeles|Anchorage|Juneau|Sitka|Nome|Yakutat|Metlakatla|Adak|Boise|Detroit|Indiana|Kentucky|Menominee|North_Dakota|Puerto_Rico)|Pacific\/Honolulu|US\/)/;
  function hourPick() { try { var h = localStorage.getItem(H_KEY); return h === '12' || h === '24' ? h : ''; } catch (e) { return ''; } }
  function hours() { return hourPick() || (US_ZONE.test(zone()) ? '12' : '24'); }
  // 12-hour clock: "8:15 PM", not "08:15 PM"; the 24-hour clock keeps two digits ("08:15").
  function fmt(opts) { var o = Object.assign({ timeZone: zone() }, opts); if (o.hour) { o.hour12 = hours() === '12'; if (o.hour12) o.hour = 'numeric'; } return new Intl.DateTimeFormat(lang, o); }
  function localDay(d) { var p = fmt({ year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d); var o = {}; p.forEach(function (x) { o[x.type] = x.value; }); return o.year + '-' + o.month + '-' + o.day; }
  function dayName(ymd) { return new Intl.DateTimeFormat(lang, { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(ymd + 'T12:00:00Z')); }
  function rel(ymd) {
    var t = localDay(new Date());
    var tm = localDay(new Date(Date.now() + 86400000));
    var ye = localDay(new Date(Date.now() - 86400000));
    return ymd === t ? 'Today' : ymd === tm ? 'Tomorrow' : ymd === ye ? 'Yesterday' : dayName(ymd);
  }

  function renderTimes() {
    var timeFmt = fmt({ hour: '2-digit', minute: '2-digit' });
    var fullFmt = fmt({ weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    document.querySelectorAll('time[data-utc]').forEach(function (el) {
      var d = new Date(el.getAttribute('data-utc'));
      if (isNaN(d)) return;
      el.textContent = el.getAttribute('data-mode') === 'full' ? fullFmt.format(d) : timeFmt.format(d);
    });
    document.querySelectorAll('time[data-date]').forEach(function (el) {
      el.textContent = el.getAttribute('data-mode') === 'full' ? dayName(el.getAttribute('data-date')) + ' · TBC' : 'TBC';
      el.title = 'Time not announced yet';
    });
    var z = zone();
    document.querySelectorAll('[data-tz]').forEach(function (el) { el.textContent = z.split('/').pop().replace(/_/g, ' '); });
  }

  // Footer switch: 24h or 12h AM/PM, remembered in this browser only.
  document.querySelectorAll('[data-hours]').forEach(function (box) {
    var paint = function () { box.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-h') === hours() ? 'true' : 'false'); }); };
    box.hidden = false;
    paint();
    box.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-h]');
      if (!b) return;
      try { localStorage.setItem(H_KEY, b.getAttribute('data-h')); } catch (err) {}
      paint();
      renderTimes();
    });
  });

  // Small round label at the start of a row ("First round"), or none.
  function roundLabel(r, text) {
    var el = r.querySelector('.ev-rd');
    if (!text) { if (el) r.removeChild(el); r.classList.remove('ev-hasrd'); return; }
    if (!el) { el = document.createElement('span'); el.className = 'ev-rd'; r.insertBefore(el, r.firstChild); }
    el.textContent = text;
    r.classList.add('ev-hasrd');
  }

  // Regroup each list by the visitor's local day and add day chips (All, Today, Tomorrow, ...).
  function regroup() {
    document.querySelectorAll('[data-evlist]').forEach(function (list) {
      var rows = [].slice.call(list.querySelectorAll('li.ev'));
      if (!rows.length) return;
      var groups = {};
      var order = [];
      rows.forEach(function (r) {
        var u = r.getAttribute('data-utc');
        var day = u ? localDay(new Date(u)) : r.getAttribute('data-date');
        r.setAttribute('data-local-day', day);
        if (!groups[day]) { groups[day] = []; order.push(day); }
        groups[day].push(r);
      });
      order.sort();
      list.innerHTML = '';
      order.forEach(function (day) {
        var h = document.createElement('li');
        h.className = 'ev-day';
        h.setAttribute('data-day', day);
        var t = document.createElement('h3');
        t.textContent = rel(day) === dayName(day) ? dayName(day) : rel(day) + ' · ' + dayName(day);
        // Same round for every match that day: name it once in the heading, not on each row. A day that mixes
        // rounds names the round on each row (the server does the same for its UTC days).
        var rs = groups[day].map(function (r) { return r.getAttribute('data-round') || ''; });
        var same = rs.every(function (x) { return x === rs[0]; });
        if (rs[0] && same) t.textContent += ' · ' + rs[0];
        h.appendChild(t);
        list.appendChild(h);
        groups[day].forEach(function (r) { roundLabel(r, same ? '' : r.getAttribute('data-round') || ''); list.appendChild(r); });
      });
      // Today always shows first, even when nothing is on, so an empty day reads as empty, not missing.
      var today = localDay(new Date());
      if (order[0] > today) {
        var th = document.createElement('li');
        th.className = 'ev-day';
        th.setAttribute('data-day', today);
        var tt = document.createElement('h3');
        tt.textContent = 'Today · ' + dayName(today);
        th.appendChild(tt);
        var te = document.createElement('li');
        te.className = 'ev-none';
        te.setAttribute('data-day', today);
        te.textContent = 'No events today in our competitions. Next up: ' + rel(order[0]) + '.';
        list.insertBefore(te, list.firstChild);
        list.insertBefore(th, te);
        order.unshift(today);
      }
      var chips = list.previousElementSibling;
      if (!chips || !chips.hasAttribute('data-day-chips') || order.length < 2) { if (chips && chips.hasAttribute('data-day-chips')) chips.hidden = true; return; }
      chips.innerHTML = '';
      var mk = function (label, day) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = label;
        b.setAttribute('aria-pressed', day ? 'false' : 'true');
        b.addEventListener('click', function () {
          chips.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
          list.querySelectorAll('li').forEach(function (li) {
            var d = li.getAttribute('data-local-day') || li.getAttribute('data-day');
            li.hidden = !!day && d !== day;
          });
        });
        chips.appendChild(b);
      };
      mk('All', '');
      order.slice(0, 5).forEach(function (day) { mk(rel(day), day); }); // the next five days with events
      chips.hidden = false;
    });
  }

  renderTimes();
  regroup();

  // ---------- Search: leagues, clubs and national teams, instant and offline ----------
  var sw = document.querySelector('[data-search]');
  if (sw) {
    var norm = function (t) { return String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); };
    var IDX = [];
    var loading = null;
    // The index is one small cached file, fetched once the page is idle (or on first focus).
    var load = function () {
      if (!loading) loading = fetch('/search.json').then(function (r) { return r.json(); }).then(function (data) {
        IDX = data.map(function (d) { var n = norm(d[0]); return { d: d, n: n, nw: n.split(/[^a-z0-9]+/), w: (n + ' ' + norm(d[5])).split(/[^a-z0-9]+/) }; });
        if (qi.value.trim()) render();
      }).catch(function () { loading = null; });
      return loading;
    };
    (window.requestIdleCallback || function (f) { setTimeout(f, 1200); })(load);
    var qi = sw.querySelector('input');
    var list = sw.querySelector('.search-list');
    var active = -1;
    sw.hidden = false;
    var starts = function (words, p) { for (var i = 0; i < words.length; i++) if (words[i].indexOf(p) === 0) return true; return false; };
    var find = function (raw) {
      var q = norm(raw).trim();
      if (!q) return [];
      var parts = q.split(/[^a-z0-9]+/).filter(Boolean);
      var out = [];
      IDX.forEach(function (x) {
        var hit = parts.every(function (p) { return starts(x.w, p); }) || (q.length > 3 && x.n.indexOf(q) !== -1);
        if (!hit) return;
        var score = x.n.indexOf(q) === 0 ? 0 : parts.every(function (p) { return starts(x.nw, p); }) ? 1 : 2;
        out.push({ x: x, s: score });
      });
      out.sort(function (a, b) { return a.s - b.s || a.x.d[6] - b.x.d[6] || a.x.n.length - b.x.n.length; });
      return out.slice(0, 8);
    };
    var setActive = function (i) {
      var opts = list.querySelectorAll('[role="option"]');
      if (!opts.length) { active = -1; return; }
      active = (i + opts.length) % opts.length;
      opts.forEach(function (o, j) { o.setAttribute('aria-selected', j === active ? 'true' : 'false'); });
      qi.setAttribute('aria-activedescendant', opts[active].id);
      opts[active].scrollIntoView({ block: 'nearest' });
    };
    var close = function () { list.hidden = true; qi.setAttribute('aria-expanded', 'false'); qi.removeAttribute('aria-activedescendant'); active = -1; };
    var render = function () {
      var res = find(qi.value);
      list.textContent = '';
      if (!qi.value.trim()) { close(); return; }
      if (!res.length) {
        var none = document.createElement('li');
        none.className = 'search-none';
        none.textContent = 'No match. Try a club, league or country.';
        list.appendChild(none);
      }
      res.forEach(function (r, i) {
        var d = r.x.d;
        var li = document.createElement('li');
        li.setAttribute('role', 'option');
        li.id = 'q-o-' + i;
        var a = document.createElement('a');
        a.href = d[1];
        a.tabIndex = -1;
        var ico;
        if (d[3]) { ico = document.createElement('img'); ico.src = d[3]; ico.alt = ''; ico.width = 24; ico.height = 24; }
        else { ico = document.createElement('span'); ico.className = 'search-badge'; ico.textContent = d[4]; }
        ico.classList.add('search-ico-r');
        var nm = document.createElement('span'); nm.className = 'search-nm'; nm.textContent = d[0];
        var meta = document.createElement('span'); meta.className = 'search-meta'; meta.textContent = d[2];
        a.appendChild(ico); a.appendChild(nm); a.appendChild(meta);
        li.appendChild(a);
        li.addEventListener('mousemove', function () { if (active !== i) setActive(i); });
        list.appendChild(li);
      });
      list.hidden = false;
      qi.setAttribute('aria-expanded', 'true');
      if (res.length) setActive(0);
    };
    qi.addEventListener('input', render);
    qi.addEventListener('focus', function () { load(); if (qi.value.trim()) render(); });
    qi.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
      else if (e.key === 'Enter') {
        var opt = list.querySelectorAll('[role="option"] a')[Math.max(active, 0)];
        if (opt) { e.preventDefault(); track('search', opt.getAttribute('href')); location.href = opt.getAttribute('href'); }
      } else if (e.key === 'Escape') { qi.value = ''; close(); qi.blur(); }
    });
    document.addEventListener('click', function (e) { if (!sw.contains(e.target)) close(); });
    document.addEventListener('keydown', function (e) {
      var t = e.target.tagName;
      if (e.key === '/' && t !== 'INPUT' && t !== 'TEXTAREA' && t !== 'SELECT' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); qi.focus(); }
    });
  }

  // ---------- Calendars, ordered for this device (first one is pre-selected) ----------
  var ua = navigator.userAgent || '';
  var platform = /iPhone|iPad|iPod|Macintosh|Mac OS X/.test(ua) ? 'apple' : /Android/.test(ua) ? 'google' : /Windows/.test(ua) ? 'outlook' : 'google';
  var ORDER = { apple: ['apple', 'google', 'outlook', 'ics'], google: ['google', 'outlook', 'ics', 'apple'], outlook: ['outlook', 'google', 'ics', 'apple'] }[platform];
  var DEVICE = /iPhone|iPad|iPod/.test(ua) ? 'iPhone, iPad' : /Macintosh|Mac OS X/.test(ua) ? 'Mac' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : '';
  var ICONS = {
    apple: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.4 12.6c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.2 1-4 2.5-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8 1.5 0 1.9.8 3.2.8 1.3 0 2.1-1.2 2.9-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.4-.9-2.4-4M14 5.3c.7-.8 1.1-1.9 1-3-1 0-2.1.6-2.8 1.4-.6.7-1.2 1.8-1 2.9 1 .1 2.1-.5 2.8-1.3"/></svg>',
    google: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4M16 2v4"/><text x="12" y="18.5" text-anchor="middle" font-size="8" font-weight="700" fill="currentColor" stroke="none">G</text></svg>',
    outlook: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="4" width="18" height="17" rx="3"/><path d="M3 9h18M8 2v4M16 2v4"/><circle cx="12" cy="15" r="3"/></svg>',
    copy: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/></svg>'
  };

  function z(iso) { return iso.replace(/[-:]/g, '').replace(/\.\d{3}/, ''); }
  function nextDay(d) { return new Date(Date.parse(d + 'T00:00:00Z') + 86400000).toISOString().slice(0, 10); }
  function eventLinks(li) {
    var uid = li.getAttribute('data-uid');
    var title = li.getAttribute('data-title') || '';
    var venue = li.getAttribute('data-venue') || '';
    var s = li.getAttribute('data-utc');
    var e = li.getAttribute('data-end');
    var d = li.getAttribute('data-date');
    var details = 'Added from inmycal.com. Kickoff times can change: follow the team on inmycal.com for automatic updates.';
    var ics = location.origin + '/cal/event/' + uid + '.ics';
    var g = 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(title) + '&dates=' + (s ? z(s) + '/' + z(e) : d.replace(/-/g, '') + '/' + nextDay(d).replace(/-/g, '')) + '&location=' + encodeURIComponent(venue) + '&details=' + encodeURIComponent(details);
    var o = 'https://outlook.live.com/calendar/0/deeplink/compose?path=%2Fcalendar%2Faction%2Fcompose&rru=addevent&subject=' + encodeURIComponent(title) + (s ? '&startdt=' + encodeURIComponent(s) + '&enddt=' + encodeURIComponent(e) : '&allday=true&startdt=' + d + '&enddt=' + nextDay(d)) + '&location=' + encodeURIComponent(venue) + '&body=' + encodeURIComponent(details);
    return {
      apple: { href: ics, label: 'Apple Calendar', k: 'iPhone, iPad, Mac' },
      google: { href: g, label: 'Google Calendar', k: 'Android, web', blank: true },
      outlook: { href: o, label: 'Outlook', k: 'Outlook.com', blank: true },
      ics: { href: ics, label: 'Other calendar app', k: '.ics file', download: true },
    };
  }
  function opt(kind, l, first) {
    var a = document.createElement('a');
    a.className = 'add-opt' + (first ? ' primary' : '');
    a.setAttribute('data-kind', kind);
    a.href = l.href;
    if (l.blank) { a.target = '_blank'; a.rel = 'noopener'; }
    if (l.download) a.setAttribute('download', '');
    a.innerHTML = (ICONS[kind === 'ics' ? 'copy' : kind] || '') + '<span></span><small></small>';
    a.querySelector('span').textContent = l.label;
    a.querySelector('small').textContent = first && DEVICE ? 'This ' + DEVICE : l.k;
    return a;
  }
  document.querySelectorAll('details[data-add]').forEach(function (d) {
    d.addEventListener('toggle', function () {
      if (!d.open || d.getAttribute('data-ready')) return;
      var li = d.closest('li.ev');
      var box = d.querySelector('[data-add-opts]');
      if (!li || !box) return;
      var links = eventLinks(d.hasAttribute('data-uid') ? d : li); // a menu with its own event (UFC prelims)
      box.innerHTML = '';
      ORDER.forEach(function (k, i) { box.appendChild(opt(k, links[k], i === 0)); });
      var pop = d.querySelector('.add-pop');
      var head = document.createElement('p');
      head.className = 'add-head';
      head.textContent = 'Add to your calendar';
      pop.insertBefore(head, box);
      var follow = [];
      try { follow = JSON.parse(d.getAttribute('data-follow') || '[]'); } catch (e) {}
      if (follow.length) {
        var sub = document.createElement('p');
        sub.className = 'add-head add-sub';
        sub.textContent = 'Follow the whole season, updates itself';
        pop.appendChild(sub);
        follow.forEach(function (f) {
          var a = document.createElement('a');
          a.className = 'add-follow';
          a.href = f[0];
          var icon = f[2] && li.querySelector(f[2]);
          if (icon) { icon = icon.cloneNode(true); icon.setAttribute('width', '18'); icon.setAttribute('height', '18'); a.appendChild(icon); }
          var t = document.createElement('span');
          t.textContent = f[1];
          a.appendChild(t);
          pop.appendChild(a);
        });
      }
      d.setAttribute('data-ready', '1');
    });
  });
  // Season subscriptions: same order, first one highlighted.
  document.querySelectorAll('.sub-list').forEach(function (list) {
    var map = {};
    list.querySelectorAll('[data-feed]').forEach(function (a) { map[a.getAttribute('data-feed')] = a; });
    var order = ORDER.map(function (k) { return k === 'ics' ? 'copy' : k; });
    order.forEach(function (k, i) { var a = map[k]; if (!a) return; a.classList.toggle('primary', i === 0); list.appendChild(a); });
  });

  // ---------- "More" menu: open under its own tab (the tab row scrolls, so the menu sits on the top bar) ----------
  document.querySelectorAll('.tb-more').forEach(function (d) {
    d.addEventListener('toggle', function () {
      if (!d.open) return;
      var pop = d.querySelector('.tb-pop');
      var bar = d.closest('.topbar');
      if (!pop || !bar) return;
      var left = d.querySelector('summary').getBoundingClientRect().left - bar.getBoundingClientRect().left;
      pop.style.right = 'auto';
      pop.style.left = Math.max(8, Math.min(left, bar.clientWidth - pop.offsetWidth - 8)) + 'px';
    });
  });

  // ---------- Football sidebar filter: leagues, countries and their leagues ----------
  document.querySelectorAll('[data-side-filter]').forEach(function (side) {
    var input = side.querySelector('.side-search');
    if (!input) return;
    var nz = function (t) { return String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); };
    input.hidden = false;
    input.addEventListener('input', function () {
      var q = nz(input.value.trim());
      side.querySelectorAll('.side-top li, .side-flat li').forEach(function (li) { li.hidden = !!q && nz(li.textContent).indexOf(q) === -1; });
      side.querySelectorAll('.side-group').forEach(function (g) {
        var country = nz(g.querySelector('summary').textContent);
        var any = false;
        g.querySelectorAll('li').forEach(function (li) { var hit = !q || country.indexOf(q) !== -1 || nz(li.textContent).indexOf(q) !== -1; li.hidden = !hit; any = any || hit; });
        g.hidden = !!q && !any;
        if (q) g.open = any; 
      });
    });
  });

  // ---------- "Follow your team" search on competition pages (uses the same cached /search.json) ----------
  document.querySelectorAll('[data-pick-search]').forEach(function (box) {
    var input = box.querySelector('input');
    var out = box.querySelector('.pick-results');
    var scope = box.getAttribute('data-scope') || '';
    var kind = box.getAttribute('data-kind') || '';
    var rows = null;
    var nz = function (t) { return String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); };
    var get = function () {
      if (rows) return Promise.resolve(rows);
      return fetch('/search.json').then(function (r) { return r.json(); }).then(function (data) {
        // Every club and team is searchable from any page (Paris works on the La Liga page); this page's own
        // teams are listed first.
        rows = data.filter(function (d) { return kind ? d[2] === kind : /^(Club|Team) |^National team$/.test(d[2]); });
        rows.sort(function (a, b) { return (scope && b[1].indexOf(scope) === 0 ? 1 : 0) - (scope && a[1].indexOf(scope) === 0 ? 1 : 0); });
        return rows;
      });
    };
    var show = function () {
      var q = nz(input.value.trim());
      out.textContent = '';
      if (!q) return;
      get().then(function (list) {
        out.textContent = '';
        var hits = list.filter(function (d) { return nz(d[0] + ' ' + d[5]).indexOf(q) !== -1; }).slice(0, 8);
        if (!hits.length) { var li = document.createElement('li'); li.className = 'search-none'; li.textContent = 'No match.'; out.appendChild(li); return; }
        hits.forEach(function (d) {
          var li = document.createElement('li');
          var a = document.createElement('a');
          a.href = d[1] + '#subscribe';
          if (d[3]) { var img = document.createElement('img'); img.src = d[3]; img.width = 20; img.height = 20; img.alt = ''; a.appendChild(img); }
          var t = document.createElement('span'); t.textContent = d[0]; a.appendChild(t);
          var m = document.createElement('small'); m.textContent = d[2].replace(/^(Club|Team) · /, ''); a.appendChild(m);
          li.appendChild(a); out.appendChild(li);
        });
      }).catch(function () {});
    };
    box.hidden = false;
    input.addEventListener('input', show);
    input.addEventListener('focus', function () { get().catch(function () {}); });
  });

  // ---------- My team (remembered in this browser only) ----------
  var TEAM_KEY = 'imc-team';
  function myTeam() { try { return localStorage.getItem(TEAM_KEY) || ''; } catch (e) { return ''; } }
  function setMyTeam(slug) { try { if (slug) localStorage.setItem(TEAM_KEY, slug); else localStorage.removeItem(TEAM_KEY); } catch (e) {} }
  document.querySelectorAll('[data-set-team]').forEach(function (b) {
    var slug = b.getAttribute('data-set-team');
    var paint = function () { var on = myTeam() === slug; b.textContent = on ? '★ My team' : '☆ Make this my team'; b.setAttribute('aria-pressed', on ? 'true' : 'false'); };
    b.hidden = false;
    paint();
    b.addEventListener('click', function () { setMyTeam(myTeam() === slug ? '' : slug); paint(); });
  });

  // Time zone list: GMT offsets refreshed for today (DST-aware), current choice checked.
  function gmt(tz) {
    try {
      var p = {}; new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
      var m = Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) - Math.floor(Date.now() / 60000) * 60000) / 60000);
      var a = Math.abs(m);
      return 'GMT' + (m < 0 ? '-' : '+') + ('0' + Math.floor(a / 60)).slice(-2) + ':' + ('0' + a % 60).slice(-2);
    } catch (e) { return ''; }
  }
  function offMins(g) { var m = /^GMT([+-])(\d\d):(\d\d)$/.exec(g || ''); return m ? (m[1] === '-' ? -1 : 1) * (60 * Number(m[2]) + Number(m[3])) : null; }
  var tzList = document.getElementById('tz-list');
  if (tzList) {
    tzList.querySelectorAll('[data-tz-off]').forEach(function (el) { var g = gmt(el.getAttribute('data-tz-off')); if (g) el.textContent = g; });
    var autoEl = tzList.querySelector('[data-tz-auto]');
    if (autoEl) autoEl.textContent = gmt(auto) || 'Auto';
    // The visitor's own zone sits in its place in the offset order (not pinned on top): the row with the
    // same offset today becomes "automatic", and the open list scrolls to the checked row.
    var mineOff = gmt(auto);
    var mine = null;
    tzList.querySelectorAll('[data-tz-off]').forEach(function (el) { if (!mine && el.textContent === mineOff) mine = el.closest('label'); });
    if (mine && autoEl) {
      autoEl.closest('label').hidden = true;
      var mi = mine.querySelector('input');
      mi.setAttribute('data-auto', '1');
      mine.classList.add('tz-mine');
      var city = mine.querySelector('.tz-city');
      if (city) city.textContent = city.textContent + ' · your time zone';
    } else if (autoEl && offMins(mineOff) !== null) {
      // No listed zone has the visitor's offset (Kathmandu, Tehran, Caracas): the automatic row moves to
      // its place in the offset order instead of staying pinned on top.
      var autoRow = autoEl.closest('label');
      var next = null;
      tzList.querySelectorAll('[data-tz-off]').forEach(function (el) { var m = offMins(el.textContent); if (!next && m !== null && m > offMins(mineOff)) next = el.closest('label'); });
      tzList.insertBefore(autoRow, next);
      autoRow.classList.add('tz-mine');
    }
    var cur = (picked() && tzList.querySelector('input[value="' + picked().replace(/"/g, '') + '"]')) || (mine && mine.querySelector('input')) || tzList.querySelector('input[value=""]');
    if (cur) cur.checked = true;
    var tzBox = tzList.closest('details');
    if (tzBox) tzBox.addEventListener('toggle', function () {
      var c = tzList.querySelector('input:checked');
      if (tzBox.open && c) { var l = c.closest('label'); tzList.scrollTop = l.offsetTop - tzList.clientHeight / 2 + l.offsetHeight / 2; }
    });
    tzList.addEventListener('change', function (e) {
      var v = e.target.hasAttribute('data-auto') ? '' : e.target.value;
      track('tz', v || 'auto');
      try { if (v) localStorage.setItem(TZ_KEY, v); else localStorage.removeItem(TZ_KEY); } catch (err) {}
      renderTimes();
      regroup();
      var d = tzList.closest('details');
      if (d) d.open = false;
    });
  }

  // One open popover at a time; close on outside click or Escape.
  var pops = document.querySelectorAll('details.add, details.tz');
  pops.forEach(function (d) { d.addEventListener('toggle', function () { if (d.open) pops.forEach(function (o) { if (o !== d) o.open = false; }); }); });
  document.addEventListener('click', function (e) { pops.forEach(function (d) { if (d.open && !d.contains(e.target)) d.open = false; }); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') pops.forEach(function (d) { d.open = false; }); });

  // Theme toggle: light -> dark -> system.
  var NEXT = { light: 'dark', dark: 'system', system: 'light' };
  document.querySelectorAll('.theme-btn').forEach(function (b) {
    b.addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme-pref') || 'system';
      var next = NEXT[cur] || 'light';
      try { if (next === 'system') localStorage.removeItem('sc-theme'); else localStorage.setItem('sc-theme', next); } catch (e) {}
      if (window.scApplyTheme) window.scApplyTheme();
      b.setAttribute('aria-label', 'Theme: ' + next);
    });
  });

  // Copy feed link.
  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var src = btn.getAttribute('data-copy-from');
      var url = src ? document.getElementById(src).value : btn.getAttribute('data-copy');
      var toast = document.getElementById('copy-toast');
      var isCode = src === 'b-code';
      function done(ok) { if (toast) toast.textContent = ok ? (isCode ? 'Code copied. Paste it into your website.' : 'Link copied. Paste it into your calendar app under "Add calendar from URL".') : (isCode ? 'Select the code above and copy it.' : url); }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(function () { done(true); }, function () { done(false); });
      else done(false);
    });
  });

  // F1 session picker: rebuild every subscribe link from the selected groups.
  var picker = document.getElementById('f1-picker');
  if (picker) {
    var groupsOrder = ['race', 'qualifying', 'sprint', 'practice'];
    var names = { race: 'Race', qualifying: 'Qualifying', sprint: 'Sprint', practice: 'Practice' };
    var host = picker.getAttribute('data-host');
    var update = function () {
      var on = groupsOrder.filter(function (g) { var i = picker.querySelector('input[value="' + g + '"]'); return i && i.checked; });
      var empty = on.length === 0;
      document.querySelectorAll('[data-feed]').forEach(function (el) { el.classList.toggle('disabled', empty); });
      document.querySelectorAll('li[data-group]').forEach(function (r) { r.classList.toggle('off', on.indexOf(r.getAttribute('data-group')) === -1); });
      var note = document.getElementById('f1-empty');
      if (note) note.hidden = !empty;
      if (empty) return;
      var path = host + '/cal/f1.ics?s=' + on.join(',');
      var label = 'Formula 1 · ' + on.map(function (g) { return names[g]; }).join(', ');
      var https = 'https://' + path;
      var webcal = 'webcal://' + path;
      var set = function (s, href) { var a = document.querySelector(s); if (a) a.setAttribute('href', href); };
      set('[data-feed="apple"]', webcal);
      set('[data-feed="google"]', 'https://calendar.google.com/calendar/render?cid=' + encodeURIComponent(webcal));
      set('[data-feed="outlook"]', 'https://outlook.live.com/calendar/0/addfromweb?url=' + encodeURIComponent(https) + '&name=' + encodeURIComponent(label));
      var c = document.querySelector('[data-feed="copy"]');
      if (c) c.setAttribute('data-copy', https);
      set('[data-manual]', '/how-to/?url=' + encodeURIComponent(https) + '#manual');
    };
    picker.addEventListener('change', update);
    update();
  }
  // ---------- How it works: the calendar link handed over from a team page ----------
  var calUrl = document.querySelector('[data-cal-url]');
  if (calUrl) {
    var given = new URLSearchParams(location.search).get('url') || '';
    if (/^https:\/\/(inmycal\.com|sports\.anthonytoday\.com)\/cal\/[a-z0-9\/-]+\.ics(\?s=[a-z,]+)?$/.test(given)) {
      calUrl.value = given;
      var hint = document.querySelector('[data-cal-hint]');
      if (hint) hint.textContent = 'This is the link for the calendar you picked. Copy it, then follow the steps for your app.';
    }
    var plat = /iPhone|iPad|iPod/.test(navigator.userAgent) ? 'iphone' : /Macintosh/.test(navigator.userAgent) ? 'mac' : /Android/.test(navigator.userAgent) ? 'google' : /Windows/.test(navigator.userAgent) ? 'outlook' : '';
    var tab = plat && document.getElementById('app-' + plat);
    if (tab) tab.checked = true;
  }

  // ---------- For clubs: embed code builder ----------
  var builder = document.querySelector('[data-builder]');
  if (builder) {
    var origin = builder.getAttribute('data-origin');
    var bTeam = document.getElementById('b-team');
    var bCode = document.getElementById('b-code');
    var bFrame = document.getElementById('b-frame');
    var val = function (n) { var i = builder.querySelector('input[name="' + n + '"]:checked'); return i ? i.value : ''; };
    var build = function () {
      var view = val('b-view');
      var theme = val('b-theme');
      var q = [];
      if (view === 'button') q.push('view=button');
      if (theme !== 'light') q.push('theme=' + theme);
      var path = '/embed/' + bTeam.value + '/' + (q.length ? '?' + q.join('&') : '');
      var h = view === 'button' ? 132 : 520;
      var name = bTeam.options[bTeam.selectedIndex].text;
      bCode.value = '<iframe src="' + origin + path + '" title="' + name.replace(/"/g, '') + ' matches calendar" width="100%" height="' + h + '" style="border:0;max-width:480px" loading="lazy"></iframe>';
      bFrame.src = path;
      bFrame.height = h;
    };
    builder.addEventListener('change', build);
    build();
  }

  // ---------- Widget on another website: every link opens in a new tab ----------
  if (document.documentElement.hasAttribute('data-embed')) {
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href]');
      if (a && !a.target) { a.target = '_blank'; a.rel = 'noopener'; }
    }, true);
  }
})();
