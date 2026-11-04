// Theme before first paint (same behavior as moneywithai.net). Preference: light | dark | system.
(function () {
  var KEY = 'sc-theme';
  var root = document.documentElement;
  var mq = window.matchMedia('(prefers-color-scheme: dark)');
  function pref() {
    try { var t = localStorage.getItem(KEY); return t === 'light' || t === 'dark' ? t : 'system'; } catch (e) { return 'system'; }
  }
  function apply() {
    var p = pref();
    var dark = p === 'dark' || (p === 'system' && mq.matches);
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    root.setAttribute('data-theme-pref', p);
  }
  apply();
  window.scApplyTheme = apply;
  if (mq.addEventListener) mq.addEventListener('change', apply);
})();
