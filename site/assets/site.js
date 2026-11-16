// Shared behaviour for every language version of the landing page.
// Page-specific strings come from <script type="application/json" id="i18n">.
(() => {
  'use strict';

  const T = JSON.parse(document.getElementById('i18n').textContent);
  const lang = document.documentElement.lang;
  const fmtNum = n => n.toLocaleString(T.locale);

  // Remember the language the visitor picked, so the root page sends them back here.
  document.querySelectorAll('.lang a').forEach(a => a.addEventListener('click', () => {
    try { localStorage.setItem('lang', a.hreflang); } catch { /* storage blocked */ }
  }));
  try { localStorage.setItem('lang', lang); } catch { /* storage blocked */ }

  // ---------- copy buttons ----------
  document.querySelectorAll('.copy').forEach(b => {
    const label = b.textContent;
    b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(b.dataset.copy); } catch { return; }
      b.textContent = T.copied; b.classList.add('ok');
      setTimeout(() => { b.textContent = label; b.classList.remove('ok'); }, 1400);
    });
  });

  // ---------- estimator: time ≈ 64^n / (8 × cores) seconds ----------
  const $ = id => document.getElementById(id);
  const ALPH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  const rnd = n => Array.from({ length: n }, () => ALPH[Math.random() * 64 | 0]).join('');
  const fakeHead = 'UQ' + rnd(46);
  const VALID = /^[A-Za-z0-9_-]+$/;

  function fmtTime(s) {
    const units = [['y', 31557600], ['d', 86400], ['h', 3600], ['m', 60], ['s', 1]];
    for (const [k, v] of units) {
      if (s < v && k !== 's') continue;
      const x = s / v;
      const num = x >= 100 ? fmtNum(Math.round(x))
        : x.toLocaleString(T.locale, { maximumFractionDigits: x >= 10 ? 0 : 1, minimumFractionDigits: x >= 10 ? 0 : 1 });
      return '≈ ' + num + ' ' + T.units[k];
    }
  }

  function estimate() {
    const end = $('end').value, cores = +$('cores').value;
    const ok = VALID.test(end);
    $('coresVal').textContent = cores;
    const hint = $('hint');
    hint.className = end && !ok ? 'hint bad' : 'hint';
    hint.textContent = !end ? T.hintEmpty : ok ? T.hintLen.replaceAll('{n}', end.length) : T.hintBad;

    const preview = $('preview');
    preview.textContent = fakeHead.slice(0, 48 - end.length);
    if (ok) { const b = document.createElement('b'); b.textContent = end; preview.append(b); }

    if (!ok) { $('time').textContent = $('attempts').textContent = $('speed').textContent = '—'; return; }
    const attempts = 64 ** end.length, speed = 8 * cores;
    $('time').textContent = fmtTime(attempts / speed);
    $('attempts').textContent = fmtNum(attempts);
    $('speed').textContent = '~' + fmtNum(speed) + ' ' + T.units.ps;
  }
  $('end').addEventListener('input', estimate);
  $('cores').addEventListener('input', estimate);
  estimate();

  // ---------- terminal animation (CLI output is English in every language) ----------
  const term = $('term');
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sleep = ms => new Promise(r => setTimeout(r, reduce ? 0 : ms));

  async function run() {
    const target = 'cafe';
    for (;;) {
      let lines = [];
      const draw = extra => { term.innerHTML = lines.join('\n') + (extra ?? '\n<span class="cursor"></span>'); };
      let cmd = '';
      for (const ch of 'npx tonwf ' + target) {
        cmd += ch; lines = ['<span class="t-acc">$</span> ' + esc(cmd)]; draw(''); await sleep(55);
      }
      await sleep(300);
      lines.push('<span class="t-dim">Wallet v5r1 · 8 workers · ending "' + target + '"</span>');
      lines.push('Password: <span class="t-dim">••••••••••</span>');
      draw(); await sleep(500);
      const base = lines.length;
      let attempts = 0;
      for (let i = 0; i < 26; i++) {
        attempts += 64 + (Math.random() * 40 | 0);
        lines.length = base;
        lines.push('<span class="t-dim">…' + esc(rnd(18)) + '</span>');
        lines.push('<span class="t-dim">attempts</span> ' + attempts.toLocaleString('en-US') +
          '  <span class="t-dim">speed</span> 64/s  <span class="t-dim">eta</span> ~1h');
        draw(); await sleep(90);
      }
      lines.length = base;
      const addr = 'UQ' + rnd(42);
      lines.push('<span class="t-ok">✔ Found after ' + (attempts * 97).toLocaleString('en-US') + ' attempts</span>');
      lines.push('');
      lines.push('<span class="t-dim">address</span>  ' + esc(addr.slice(0, 22)) + '…' + esc(addr.slice(-4)) +
        '<span class="t-hit">' + target + '</span>');
      lines.push('<span class="t-dim">saved to</span> ton_wallet_results.enc.json');
      draw();
      if (reduce) return;
      await sleep(5200);
    }
  }
  run();
})();
