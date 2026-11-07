/* KDS — tela da cozinha (serializada com toString para cozinha/index.html). */
const KDS_CSS = `
*{box-sizing:border-box;margin:0}
[hidden]{display:none!important}
html,body{height:100%}
body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#0f1114;color:#f1f1f1;-webkit-font-smoothing:antialiased}
button{font:inherit;color:inherit;cursor:pointer}
.login{min-height:100%;display:flex;align-items:center;justify-content:center;padding:20px}
.login form{background:#1a1d22;border:1px solid #2a2e35;border-radius:18px;padding:28px;width:100%;max-width:360px;display:flex;flex-direction:column;gap:14px;text-align:center}
.login h1{font-size:1.4rem}
.login p{color:#9aa1ab;font-size:.9rem}
.login input{font:inherit;font-size:1.6rem;letter-spacing:.4em;text-align:center;padding:12px;border-radius:12px;border:1px solid #3a3f48;background:#0f1114;color:#fff;width:100%}
.login .err{color:#ff8a80;font-size:.9rem;min-height:1.2em}
.btn{border:0;border-radius:12px;padding:12px 18px;font-weight:700;background:var(--primary);color:var(--on-primary)}
.btn.sec{background:#2a2e35;color:#e8e8e8}
.btn.sm{padding:7px 12px;font-size:.85rem;border-radius:9px}
.top{display:flex;align-items:center;gap:12px;padding:12px 18px;border-bottom:1px solid #23272d;background:#14171b}
.top h1{font-size:1.15rem}
.top .sp{flex:1}
.dot{width:10px;height:10px;border-radius:50%;background:#2ecc71;display:inline-block}
.dot.off{background:#e74c3c}
.board{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;padding:14px;height:calc(100% - 56px)}
.col{background:#14171b;border-radius:16px;display:flex;flex-direction:column;min-height:0}
.col h2{padding:14px 16px;font-size:.95rem;letter-spacing:.06em;text-transform:uppercase;display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid var(--c)}
.col h2 b{background:var(--c);color:#111;border-radius:99px;padding:2px 11px;font-size:.85rem}
.cards{overflow:auto;padding:12px;display:flex;flex-direction:column;gap:12px}
.empty{color:#68707b;text-align:center;padding:30px 0}
.card{background:#1e2228;border:2px solid #2a2e35;border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:10px}
.card.warn{border-color:#e0a030}
.card.late{border-color:#e74c3c}
.card.fresh{animation:pulse 1s ease-in-out 5}
@keyframes pulse{50%{box-shadow:0 0 0 5px color-mix(in srgb,var(--c) 55%,transparent)}}
.ch{display:flex;align-items:baseline;gap:10px}
.mesa{font-size:1.7rem;font-weight:800;line-height:1}
.num{color:#9aa1ab;font-size:.9rem}
.tm{margin-left:auto;font-variant-numeric:tabular-nums;font-weight:700;color:#cfd3d9}
.late .tm{color:#ff8a80}
.who{color:#9aa1ab;font-size:.9rem}
.its{display:flex;flex-direction:column;gap:7px}
.it .q{font-weight:800;color:var(--primary);margin-right:6px}
.it .n{font-size:1.1rem;font-weight:600}
.it .ad{color:#c9cdd3;font-size:.92rem;margin-left:26px}
.it .ob{margin:3px 0 0 26px;background:#4a3a12;color:#ffd77a;border-radius:7px;padding:3px 9px;font-size:.92rem;font-weight:600;display:inline-block}
.pobs{background:#4a3a12;color:#ffd77a;border-radius:8px;padding:6px 10px;font-weight:600}
.acts{display:flex;gap:8px;margin-top:2px}
.acts .btn{flex:1;padding:13px 10px;font-size:1rem}
.x{background:none;border:0;color:#7b838e;font-size:.8rem;text-decoration:underline;padding:4px 2px;text-align:left}
@media(max-width:900px){.board{grid-template-columns:1fr;height:auto}.col{max-height:none}}
`;

/* CFG = {api, token, nome, expired(), logout()} — devolve stop() */
function kdsRuntime(app, CFG) {
  var d = document, api = CFG.api, stopped = false;
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} return null; }
  function el(t, a, k) {
    var e = d.createElement(t);
    for (var n in (a || {})) {
      var v = a[n];
      if (n === 'class') e.className = v; else if (n === 'text') e.textContent = v;
      else if (n.indexOf('on') === 0) e.addEventListener(n.slice(2), v);
      else if (v !== false && v != null) e.setAttribute(n, v === true ? '' : v);
    }
    (k || []).forEach(function (c) { if (c != null && c !== false) e.appendChild(typeof c === 'string' ? d.createTextNode(c) : c); });
    return e;
  }
  var token = CFG.token, sound = ls('gc-kds-sound') === '1';
  var S = { pedidos: [], offset: 0, known: null, online: true, sig: '', fresh: {} }, timer = null, ctx = null, connEl = null;
  var COLS = [['novo', 'Novos', '#ff6b5e'], ['preparando', 'Em preparo', '#f2b134'], ['pronto', 'Prontos', '#3ddc84']];
  var NEXT = { novo: ['preparando', 'Iniciar preparo'], preparando: ['pronto', 'Marcar pronto'], pronto: ['entregue', 'Entregue ✓'] };
  var PREV = { preparando: ['novo', '↩ Voltar'], pronto: ['preparando', '↩ Voltar'] };

  function audio() { try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); } catch (e) {} }
  /* ---------- impressão do pedido (bobina 80 mm) ---------- */
  // Ligada, imprime cada pedido NOVO que chega (uma vez só). Para imprimir sem a janela de confirmação, abra o Chrome/Edge do computador da cozinha
  // com o atalho "--kiosk-printing" e deixe a impressora da cozinha como padrão.
  var printOn = ls('gc-kds-print') === '1', printed = [], printQ = [], printing = false, prnEl = null;
  try { printed = JSON.parse(ls('gc-kds-printed') || '[]'); } catch (e) {}
  function markPrinted(ids) { ids.forEach(function (i) { if (printed.indexOf(i) < 0) printed.push(i); }); printed = printed.slice(-400); ls('gc-kds-printed', JSON.stringify(printed)); }
  function esc(x) { return String(x == null ? '' : x).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function ticketHtml(p) {
    var t = new Date(p.criado_em), hm = (t.getHours() < 10 ? '0' : '') + t.getHours() + ':' + (t.getMinutes() < 10 ? '0' : '') + t.getMinutes();
    var h = '<div class="c big">MESA ' + esc(p.mesa) + '</div><div class="c">Pedido #' + p.numero + ' · ' + hm + '</div>' + (p.cliente ? '<div class="c">' + esc(p.cliente) + '</div>' : '') + '<hr>';
    p.itens.forEach(function (i) {
      h += '<div class="it"><b>' + i.qtd + '×</b> ' + esc(i.nome + (i.variante ? ' · ' + i.variante : '')) + '</div>';
      (i.adicionais || []).forEach(function (a) { h += '<div class="ad">+ ' + esc(a.l) + '</div>'; });
      if (i.obs) h += '<div class="ad">!! ' + esc(i.obs) + '</div>';
    });
    if (p.obs) h += '<hr><div>OBS: ' + esc(p.obs) + '</div>';
    return '<html><head><meta charset="utf-8"><style>@page{size:80mm auto;margin:2mm}body{font:bold 15px/1.3 monospace;width:72mm;margin:0;color:#000}.c{text-align:center}.big{font-size:28px}.it{font-size:17px;margin-top:6px}.ad{padding-left:16px;font-size:14px}hr{border:0;border-top:2px dashed #000;margin:8px 0}.f{text-align:center;font-size:11px;margin-top:8px}</style></head><body>' + h + '<hr><div class="f">' + esc(CFG.nome) + '</div></body></html>';
  }
  function drainPrint() {
    if (printing || !printQ.length) return;
    printing = true;
    var html = printQ.shift(), f = d.createElement('iframe'); f.style.cssText = 'position:fixed;width:0;height:0;border:0'; d.body.appendChild(f);
    f.contentDocument.open(); f.contentDocument.write(html); f.contentDocument.close();
    setTimeout(function () { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) {} setTimeout(function () { f.remove(); printing = false; drainPrint(); }, 1800); }, 150);
  }
  function printTicket(p) { printQ.push(ticketHtml(p)); drainPrint(); }
  function prnLabel() { return printOn ? '🖨 Impressão: ligada' : '🖨 Impressão: desligada'; }

  // lembrete sonoro a cada 30 s enquanto houver pedido novo parado, e aviso se o som estiver bloqueado pelo navegador
  var sndEl = null;
  function sndLabel() { return !sound ? '🔕 Ativar som' : (ctx && ctx.state === 'running' ? '🔔 Som ligado' : '🔇 Toque para liberar o som'); }
  function unlock() { if (sound) audio(); }
  function beep() {
    if (!sound) return;
    S.lastBeep = Date.now();
    try {
      audio();
      [880, 1175, 880].forEach(function (f, i) {
        var o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
        var t = ctx.currentTime + i * 0.2; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
        o.start(t); o.stop(t + 0.19);
      });
    } catch (e) {}
  }
  function wake() { try { if (navigator.wakeLock) navigator.wakeLock.request('screen').catch(function () {}); } catch (e) {} }
  function fmt(ms) { var s = Math.max(0, Math.floor(ms / 1000)), m = Math.floor(s / 60); return (m < 10 ? '0' : '') + m + ':' + (s % 60 < 10 ? '0' : '') + (s % 60); }
  function age(p) { return Date.now() + S.offset - new Date(p.criado_em).getTime(); }

  /* ---------- quadro ---------- */
  function card(p, color) {
    var a = age(p), cls = 'card' + (a > 20 * 60000 ? ' late' : a > 10 * 60000 ? ' warn' : '') + (S.fresh[p.id] && S.fresh[p.id] > Date.now() ? ' fresh' : '');
    var items = p.itens.map(function (i) {
      var kids = [el('div', { class: 'n' }, [el('span', { class: 'q', text: i.qtd + '×' }), i.nome + (i.variante ? ' · ' + i.variante : '')])];
      (i.adicionais || []).forEach(function (ad) { kids.push(el('div', { class: 'ad', text: '+ ' + ad.l })); });
      if (i.obs) kids.push(el('div', { class: 'ob', text: '⚠ ' + i.obs }));
      return el('div', { class: 'it' }, kids);
    });
    var nx = NEXT[p.status], pv = PREV[p.status];
    return el('div', { class: cls, 'data-id': p.id, style: '--c:' + color }, [
      el('div', { class: 'ch' }, [el('span', { class: 'mesa', text: 'Mesa ' + p.mesa }), el('span', { class: 'num', text: '#' + p.numero }), el('span', { class: 'tm', 'data-t': p.id, text: '⏱ ' + fmt(a) })]),
      p.cliente ? el('div', { class: 'who', text: 'Pedido de ' + p.cliente }) : null,
      el('div', { class: 'its' }, items),
      p.obs ? el('div', { class: 'pobs', text: '📝 ' + p.obs }) : null,
      el('div', { class: 'acts' }, [
        pv ? el('button', { class: 'btn sec', type: 'button', text: pv[1], onclick: function () { setStatus(p, pv[0]); } }) : null,
        el('button', { class: 'btn', type: 'button', text: nx[1], onclick: function () { setStatus(p, nx[0]); } })]),
      el('button', { class: 'x', type: 'button', 'data-print': p.numero, text: '🖨 Imprimir', onclick: function () { printTicket(p); } }),
      el('button', { class: 'x', type: 'button', text: 'Cancelar pedido', onclick: function () { if (confirm('Cancelar o pedido #' + p.numero + ' da mesa ' + p.mesa + '?')) setStatus(p, 'cancelado'); } })
    ]);
  }
  function board() {
    app.textContent = '';
    connEl = el('span', { class: 'dot' + (S.online ? '' : ' off'), title: S.online ? 'Conectado' : 'Sem conexão' });
    var snd = sndEl = el('button', { class: 'btn sec sm', type: 'button', id: 'snd', text: sndLabel(), onclick: function () {
      sound = !sound; ls('gc-kds-sound', sound ? '1' : '0'); if (sound) { audio(); beep(); } snd.textContent = sndLabel();
    } });
    app.appendChild(el('div', { class: 'top' }, [el('h1', { text: '👨‍🍳 Cozinha · ' + CFG.nome }), connEl, el('span', { class: 'sp' }), prnEl = el('button', { class: 'btn sec sm', type: 'button', id: 'prn', title: 'Imprime cada pedido novo (bobina 80 mm). Para imprimir sem a janela de confirmação, abra o navegador com --kiosk-printing.', text: prnLabel(), onclick: function () {
      printOn = !printOn; ls('gc-kds-print', printOn ? '1' : '0'); if (printOn) markPrinted(S.pedidos.map(function (x) { return x.id; })); prnEl.textContent = prnLabel();
    } }), snd, el('button', { class: 'btn sec sm', type: 'button', text: 'Sair', onclick: function () { CFG.logout(); } })]));
    var cols = COLS.map(function (c) {
      var list = S.pedidos.filter(function (p) { return p.status === c[0]; });
      return el('section', { class: 'col', style: '--c:' + c[2], 'data-col': c[0] }, [
        el('h2', {}, [el('span', { text: c[1] }), el('b', { text: String(list.length) })]),
        el('div', { class: 'cards' }, list.length ? list.map(function (p) { return card(p, c[2]); }) : [el('div', { class: 'empty', text: 'Nenhum pedido' })])
      ]);
    });
    app.appendChild(el('main', { class: 'board' }, cols));
    var n = S.pedidos.filter(function (p) { return p.status === 'novo'; }).length;
    d.title = (n ? '(' + n + ') ' : '') + 'Cozinha — ' + CFG.nome;
  }
  function tickTimes() {
    [].forEach.call(d.querySelectorAll('[data-t]'), function (e) {
      var p = S.pedidos.filter(function (x) { return x.id === e.getAttribute('data-t'); })[0]; if (!p) return;
      var a = age(p); e.textContent = '⏱ ' + fmt(a);
      var c = e.closest('.card'); if (c) { c.classList.toggle('late', a > 20 * 60000); c.classList.toggle('warn', a > 10 * 60000 && a <= 20 * 60000); }
    });
  }

  function setStatus(p, st) {
    p.status = st; if (st === 'entregue' || st === 'cancelado') S.pedidos = S.pedidos.filter(function (x) { return x.id !== p.id; });
    S.sig = ''; board();
    api('pedido_status', { p_token: token, p_pedido: p.id, p_status: st }).then(refresh, function (e) {
      if (/sessao_invalida|restaurante_bloqueado/.test(e.message)) { CFG.expired(); return; }
      alert(e.message); refresh();
    });
  }

  function refresh() {
    return api('kds_listar', { p_token: token }).then(function (r) {
      S.offset = new Date(r.agora).getTime() - Date.now();
      var wasOff = !S.online; S.online = true;
      var ids = {}; r.pedidos.forEach(function (p) { ids[p.id] = 1; });
      if (printOn) { var np = r.pedidos.filter(function (p) { return p.status === 'novo' && printed.indexOf(p.id) < 0; }); if (np.length) { markPrinted(np.map(function (p) { return p.id; })); np.forEach(printTicket); } }
      if (S.known) {
        var fresh = r.pedidos.filter(function (p) { return p.status === 'novo' && !S.known[p.id]; });
        if (fresh.length) { fresh.forEach(function (p) { S.fresh[p.id] = Date.now() + 6000; }); beep(); }
      }
      S.known = ids;
      var novos = r.pedidos.filter(function (p) { return p.status === 'novo'; }).length;
      if (novos && sound && Date.now() - (S.lastBeep || 0) > 30000) beep();
      var sig = JSON.stringify(r.pedidos);
      if (sig !== S.sig || wasOff) { S.sig = sig; S.pedidos = r.pedidos; board(); }
    }, function (e) {
      if (/sessao_invalida|restaurante_bloqueado/.test(e.message)) { CFG.expired(); return; }
      if (S.online) { S.online = false; if (connEl) { connEl.className = 'dot off'; connEl.title = 'Sem conexão'; } }
    });
  }
  function loop() { clearTimeout(timer); if (stopped) return; timer = setTimeout(function () { if (stopped) return; refresh().then(loop, loop); }, d.hidden ? 8000 : 3000); }
  function start() { board(); wake(); refresh().then(loop, loop); }

  var tk = setInterval(function () { tickTimes(); if (sndEl) sndEl.textContent = sndLabel(); }, 1000);
  d.addEventListener('pointerdown', unlock);
  function vis() { if (!d.hidden) { wake(); refresh(); } }
  d.addEventListener('visibilitychange', vis);
  start();
  return function stop() { stopped = true; clearTimeout(timer); clearInterval(tk); d.removeEventListener('visibilitychange', vis); d.removeEventListener('pointerdown', unlock); };
}
