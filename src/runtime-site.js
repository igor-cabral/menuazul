/* Código que roda dentro do site gerado (serializado com toString). Sem dependências.
   Dois modos de carrinho:
   - WhatsApp (padrão): monta a mensagem e abre o wa.me
   - Mesa (?m=TOKEN, com o sistema ligado): entra na comanda com o nome e envia o pedido para a cozinha */
function siteRuntime() {
  var d = document;
  function $(s, r) { return (r || d).querySelector(s); }
  var DATA = {};
  try { DATA = JSON.parse($('#menu-data').textContent); } catch (e) {}
  function money(n) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); }
  function el(t, a, k) {
    var e = d.createElement(t);
    for (var n in (a || {})) {
      var v = a[n];
      if (n === 'class') e.className = v;
      else if (n === 'text') e.textContent = v;
      else if (n.indexOf('on') === 0) e.addEventListener(n.slice(2), v);
      else if (v !== false && v != null) e.setAttribute(n, v === true ? '' : v);
    }
    (k || []).forEach(function (c) { if (c != null && c !== false) e.appendChild(typeof c === 'string' ? d.createTextNode(c) : c); });
    return e;
  }
  var toastEl, toastT;
  function toast(msg) {
    if (!toastEl) { toastEl = el('div', { class: 'toast', role: 'status' }); d.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('on'); }, 3800);
  }

  /* ---------- abas + busca ---------- */
  var tabs = [].slice.call(d.querySelectorAll('.tabs a')), secs = [].slice.call(d.querySelectorAll('.cat')), on = -1;
  function act(i) {
    if (i === on) return; on = i;
    tabs.forEach(function (t, k) { t.classList.toggle('on', k === i); });
    var t = tabs[i]; if (t && t.parentNode.scrollTo) t.parentNode.scrollTo({ left: t.offsetLeft - 16, behavior: 'smooth' });
  }
  function spy() {
    var idx = 0, last = 0;
    secs.forEach(function (s, k) { if (s.hidden) return; last = k; if (s.getBoundingClientRect().top <= 72) idx = k; });
    if (window.innerHeight + window.scrollY >= d.documentElement.scrollHeight - 4) idx = last;
    act(idx);
  }
  tabs.forEach(function (a) {
    a.addEventListener('click', function (e) {
      var s = d.getElementById(a.getAttribute('href').slice(1));
      if (s) { e.preventDefault(); s.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
  });
  var q = $('#q'), none = $('#none');
  if (q) q.addEventListener('input', function () {
    var v = norm(q.value), any = false;
    secs.forEach(function (s, k) {
      var n = 0;
      [].forEach.call(s.querySelectorAll('.item'), function (it) { var m = !v || it.getAttribute('data-s').indexOf(v) > -1; it.hidden = !m; if (m) n++; });
      s.hidden = !n; if (tabs[k]) tabs[k].hidden = !n; if (n) any = true;
    });
    none.hidden = any; on = -1; spy();
  });
  window.addEventListener('scroll', spy, { passive: true }); spy();

  /* ---------- aberto agora ---------- */
  var DN = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'], W = 10080;
  var sched = DATA.sched || [], stEl = $('#st');
  function tmin(t) { var p = String(t).split(':'); return (+p[0]) * 60 + (+p[1] || 0); }
  function fh(t) { var p = String(t).split(':'), m = +p[1] || 0, h = +p[0]; return (h < 10 ? '0' + h : h) + 'h' + (m ? (m < 10 ? '0' : '') + m : ''); }
  function nowMin() {
    try {
      var parts = new Intl.DateTimeFormat('en-US', { timeZone: DATA.tz || 'America/Sao_Paulo', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date());
      var o = {}; parts.forEach(function (p) { o[p.type] = p.value; });
      return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(o.weekday) * 1440 + (+o.hour % 24) * 60 + (+o.minute);
    } catch (e) { var n = new Date(); return n.getDay() * 1440 + n.getHours() * 60 + n.getMinutes(); }
  }
  function status() {
    if (!sched.length) return null;
    var now = nowMin(), L = [], i, k, offs = [-W, 0, W];
    sched.forEach(function (s, di) { if (!s || !s.o) return; var f = tmin(s.f), t = tmin(s.t), a = di * 1440 + f, b = di * 1440 + t; if (t <= f) b += 1440; L.push({ a: a, b: b, t: s.t, f: s.f }); });
    if (!L.length) return null;
    for (i = 0; i < L.length; i++) for (k = 0; k < 3; k++) if (now >= L[i].a + offs[k] && now < L[i].b + offs[k]) return { open: true, until: L[i].t };
    var best = null;
    for (i = 0; i < L.length; i++) for (k = 1; k < 3; k++) { var a2 = L[i].a + offs[k]; if (a2 > now && (!best || a2 < best.a)) best = { a: a2, f: L[i].f }; }
    var dd = Math.floor(best.a / 1440) - Math.floor(now / 1440);
    return { open: false, when: dd === 0 ? 'hoje' : dd === 1 ? 'amanhã' : DN[Math.floor(best.a / 1440) % 7], at: best.f };
  }
  function paint() {
    var s = status(); if (!stEl || !s) return;
    stEl.hidden = false; stEl.className = 'st ' + (s.open ? 'on' : 'off');
    stEl.firstChild.textContent = s.open ? 'Aberto agora · fecha às ' + fh(s.until) : 'Fechado · abre ' + s.when + ' às ' + fh(s.at);
  }
  paint(); setInterval(paint, 60000);

  /* ---------- visualizador 3D / AR (model-viewer, carregado só no primeiro toque) ---------- */
  var M3D = DATA.m3d || {}, mvPromise = null, T3 = DATA.t3 || null, apiT = null;
  function track(id, tipo) { // conta a abertura do 3D / o toque em "Ver na sua mesa" (anônimo, só no site publicado)
    if (!T3 || typeof makeApi !== 'function') return;
    try { apiT = apiT || makeApi(T3.url, T3.key); apiT('publico_3d_evento', { p_slug: T3.slug, p_item: id, p_tipo: tipo }).catch(function () {}); } catch (e) {}
  }
  function orderBtn(id) { // botão de pedido que o cardápio já tem para este prato (carrinho ou WhatsApp)
    var th = d.querySelectorAll('[data-3d]');
    for (var i = 0; i < th.length; i++) {
      if (th[i].getAttribute('data-3d') !== id) continue;
      var art = th[i].closest('.item');
      return art ? (art.querySelector('.add') || art.querySelector('a.order')) : null;
    }
    return null;
  }
  function loadMV() {
    if (window.customElements && customElements.get('model-viewer')) return Promise.resolve();
    if (mvPromise) return mvPromise;
    var srcs = (DATA.sys ? [location.origin + '/vendor/model-viewer.min.js'] : []).concat(['https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js']);
    function tryAt(i) {
      return new Promise(function (ok, no) {
        if (i >= srcs.length) return no(new Error('model-viewer'));
        var sc = d.createElement('script'); sc.type = 'module'; sc.src = srcs[i];
        sc.onload = function () { ok(); };
        sc.onerror = function () { sc.remove(); tryAt(i + 1).then(ok, no); };
        d.head.appendChild(sc);
      });
    }
    mvPromise = tryAt(0).then(function () { return customElements.whenDefined('model-viewer'); });
    mvPromise.catch(function () { mvPromise = null; });
    return mvPromise;
  }
  function open3d(id) {
    var m = M3D[id]; if (!m || !m.m) return;
    track(id, 'abrir');
    var ov = el('div', { class: 'ov' }), sh = el('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' });
    function close() { ov.remove(); if (!d.querySelector('.ov')) d.body.classList.remove('noscroll'); d.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape') close(); }
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    d.addEventListener('keydown', onKey);
    var stage = el('div', { class: 'v3d-msg', text: 'Carregando o modelo 3D…' });
    sh.appendChild(el('div', { class: 'sh-head' }, [el('h2', { text: m.n }), el('button', { class: 'x', type: 'button', 'aria-label': 'Fechar', text: '✕', onclick: close })]));
    sh.appendChild(stage);
    ov.appendChild(sh); d.body.appendChild(ov); d.body.classList.add('noscroll');
    loadMV().then(function () {
      var mv = d.createElement('model-viewer');
      mv.className = 'v3d';
      mv.setAttribute('src', m.m);
      if (m.i) mv.setAttribute('ios-src', m.i);
      if (m.p) mv.setAttribute('poster', m.p);
      mv.setAttribute('alt', 'Modelo 3D de ' + m.n);
      mv.setAttribute('camera-controls', ''); mv.setAttribute('auto-rotate', ''); mv.setAttribute('touch-action', 'pan-y');
      mv.setAttribute('shadow-intensity', '1'); mv.setAttribute('exposure', '1.05');
      mv.setAttribute('ar', ''); mv.setAttribute('ar-modes', 'webxr scene-viewer quick-look'); mv.setAttribute('ar-scale', 'fixed'); mv.setAttribute('ar-placement', 'floor');
      var ar = el('button', { class: 'v3d-ar', type: 'button', text: 'Ver na sua mesa', hidden: true, onclick: function () { track(id, 'ar'); try { mv.activateAR(); } catch (e) {} } });
      var hint = el('p', { class: 'v3d-hint', text: 'Arraste para girar · pince para aproximar' });
      mv.addEventListener('load', function () { if (mv.canActivateAR) { ar.hidden = false; hint.textContent = 'Arraste para girar · toque em “Ver na sua mesa” e aponte para a mesa'; } });
      mv.addEventListener('error', function () { stage.textContent = 'Não foi possível carregar o modelo 3D.'; if (mv.parentNode) mv.remove(); });
      var ob = orderBtn(id), add = ob ? el('button', { class: 'v3d-add', type: 'button', text: ob.classList.contains('add') ? 'Adicionar ao pedido' : 'Pedir pelo WhatsApp', onclick: function () { close(); ob.click(); } }) : null;
      stage.replaceWith(mv); if (add) sh.appendChild(add); sh.appendChild(ar); sh.appendChild(hint);
    }, function () { stage.textContent = 'Não foi possível carregar o visualizador 3D. Verifique sua conexão.'; });
  }
  d.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-3d]') : null;
    if (b) { e.preventDefault(); open3d(b.getAttribute('data-3d')); }
  });

  /* ---------- prévia 3D girando no lugar da foto (só cards visíveis, no máximo 3 por vez) ---------- */
  (function live3d() {
    var cards = d.querySelectorAll('.thumb3d');
    if (!cards.length || !('IntersectionObserver' in window)) return;
    var net = navigator.connection || {};
    if (net.saveData || /^(slow-2g|2g|3g)$/.test(net.effectiveType || '')) return; // internet lenta ou economia de dados: fica a foto
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var MAX = 3, want = [], on = [], ready = false;
    function off(b) {
      var i = on.indexOf(b); if (i < 0) return;
      on.splice(i, 1); b.classList.remove('live');
      var mv = b.querySelector('model-viewer'); if (mv) mv.remove(); // libera o contexto WebGL
    }
    function start(b) {
      var m = M3D[b.getAttribute('data-3d')]; if (!m || !m.m) return;
      on.push(b);
      var mv = d.createElement('model-viewer');
      mv.setAttribute('src', m.m); mv.setAttribute('auto-rotate', ''); mv.setAttribute('rotation-per-second', '35deg');
      mv.setAttribute('disable-zoom', ''); mv.setAttribute('disable-pan', ''); mv.setAttribute('interaction-prompt', 'none');
      mv.setAttribute('camera-orbit', '0deg 68deg auto'); mv.setAttribute('shadow-intensity', '0.5'); mv.setAttribute('exposure', '1.05');
      mv.setAttribute('aria-hidden', 'true'); mv.setAttribute('tabindex', '-1');
      mv.addEventListener('load', function () { if (mv.parentNode) b.classList.add('live'); });
      mv.addEventListener('error', function () { off(b); });
      b.appendChild(mv);
    }
    function pump() { if (!ready) return; for (var i = 0; i < want.length && on.length < MAX; i++) if (on.indexOf(want[i]) < 0) start(want[i]); }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        var b = e.target, i = want.indexOf(b);
        if (e.isIntersecting) { if (i < 0) want.push(b); } else { if (i >= 0) want.splice(i, 1); off(b); }
      });
      want.sort(function (a, b) { return a.getBoundingClientRect().top - b.getBoundingClientRect().top; });
      pump();
    }, { threshold: 0.5 });
    [].forEach.call(cards, function (c) { io.observe(c); });
    function go() { loadMV().then(function () { ready = true; pump(); }, function () {}); }
    if (window.requestIdleCallback) requestIdleCallback(go, { timeout: 2500 }); else setTimeout(go, 1200); // depois que o cardápio já apareceu
  })();

  /* ---------- carrinho ---------- */
  var C = DATA.cart, SYS = DATA.sys || null, MESA = SYS ? SYS.slug + ':' + SYS.codigo : '';
  if (C) cart();

  function cart() {
    var MM = !!SYS; // modo mesa
    var DLV = DATA.dlv || null; // delivery/retirada direto no sistema (KDS e caixa)
    if (!MM && !C.wa && !DLV) { [].forEach.call(d.querySelectorAll('.add'), function (b) { b.remove(); }); return; }

    var KEY = 'gc-cart:' + (MM ? 'm:' + MESA : location.pathname), lines = [], info = {};
    try { var sv = JSON.parse(localStorage.getItem(KEY) || '{}'); lines = sv.lines || []; info = sv.info || {}; } catch (e) {}
    function save() { try { localStorage.setItem(KEY, JSON.stringify({ lines: lines, info: info })); } catch (e) {} }
    function unit(l) {
      var it = DATA.items[l.id]; if (!it) return null;
      var p = it.p;
      if (it.v.length) { var v = null; it.v.forEach(function (x) { if (x.l === l.v) v = x; }); if (!v) return null; p = v.p; }
      if (p == null) return null;
      (l.a || []).forEach(function (al) { it.a.forEach(function (x) { if (x.l === al) p += x.p; }); });
      return p;
    }
    lines = lines.filter(function (l) { return l && l.q > 0 && unit(l) != null; });
    function sub() { return lines.reduce(function (s, l) { return s + unit(l) * l.q; }, 0); }
    function count() { return lines.reduce(function (s, l) { return s + l.q; }, 0); }
    function key(x) { return x.id + '|' + x.v + '|' + (x.a || []).slice().sort().join(','); }
    function add(l) {
      var f = null; lines.forEach(function (x) { if (key(x) === key(l)) f = x; });
      if (f) f.q += l.q; else lines.push(l);
      save(); bar();
    }
    /* ---------- cardápio por horário (a regra de verdade está no servidor; aqui é só a vitrine) ---------- */
    function agoraNoFuso() {
      try {
        var p = {}; new Intl.DateTimeFormat('en-US', { timeZone: DATA.tz || 'America/Sao_Paulo', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
        return { dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday), min: Number(p.hour) * 60 + Number(p.minute) };
      } catch (e) { var n = new Date(); return { dow: n.getDay(), min: n.getHours() * 60 + n.getMinutes() }; }
    }
    function hm(t) { var x = String(t || '').split(':'); return Number(x[0]) * 60 + Number(x[1] || 0); }
    function inWin(w) {
      if (!w) return true;
      var n = agoraNoFuso(), de = hm(w.de), ate = hm(w.ate), dias = w.dias || [];
      function dia(d) { return !dias.length || dias.indexOf(d) >= 0; }
      if (de <= ate) return dia(n.dow) && n.min >= de && n.min <= ate;
      return (n.min >= de && dia(n.dow)) || (n.min <= ate && dia((n.dow + 6) % 7));
    }
    function winText(w) {
      var N = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
      return 'das ' + w.de + ' às ' + w.ate + ((w.dias || []).length ? ' (' + w.dias.map(function (d) { return N[d]; }).join(', ') + ')' : '');
    }
    function applyWin() {
      [].forEach.call(d.querySelectorAll('section.cat[data-win]'), function (sec) {
        var w; try { w = JSON.parse(sec.getAttribute('data-win')); } catch (e) { return; }
        var ok = inWin(w), note = sec.querySelector('.win-note');
        sec.classList.toggle('off', !ok);
        sec.hidden = !ok && DATA.off === 'hide';
        var tab = d.querySelector('.tabs a[href="#' + sec.id + '"]'); if (tab) tab.hidden = sec.hidden;
        if (!ok && !note) { note = el('div', { class: 'win-note' }); sec.insertBefore(note, sec.children[1] || null); }
        if (note) { note.hidden = ok; note.textContent = '🕒 Disponível ' + winText(w); }
        [].forEach.call(sec.querySelectorAll('[data-add]'), function (b) {
          if (!ok) { if (!b.hasAttribute('data-ot')) b.setAttribute('data-ot', b.textContent); b.disabled = true; b.textContent = 'Indisponível agora'; }
          else if (b.hasAttribute('data-ot')) { b.disabled = false; b.textContent = b.getAttribute('data-ot'); b.removeAttribute('data-ot'); }
        });
      });
    }
    applyWin(); setInterval(applyWin, 60000);
    function fee() { return (!MM && info.type === 'delivery') ? C.fee : 0; }
    function dedupe() { var out = []; lines.forEach(function (l) { var f = null; out.forEach(function (x) { if (key(x) === key(l)) f = x; }); if (f) f.q += l.q; else out.push(l); }); lines = out; }
    // sugestões do carrinho: o que mais sai junto com o que já está no pedido (histórico do restaurante), depois os mais pedidos
    function sugestoes() {
      var pop = DATA.pop; if (!pop || !lines.length) return [];
      var no = {}, seen = {}, out = []; lines.forEach(function (l) { no[l.id] = 1; });
      function push(id) { var it = DATA.items[id]; if (!seen[id] && !no[id] && it && it.v.length <= 1 && unit({ id: id, v: it.v.length ? it.v[0].l : '', a: [] }) != null) { seen[id] = 1; out.push(id); } }
      lines.forEach(function (l) { ((pop.juntos || {})[l.id] || []).forEach(push); });
      Object.keys(pop.qtd || {}).sort(function (a, b) { return pop.qtd[b] - pop.qtd[a]; }).forEach(push);
      return out.slice(0, 3);
    }
    function sugBox(onChange) {
      var box = el('div', { class: 'sug' });
      box.draw = function () {
        box.textContent = '';
        var ids = sugestoes(); if (!ids.length) return;
        box.appendChild(el('h4', { text: 'Que tal adicionar?' }));
        box.appendChild(el('div', { class: 'sug-r' }, ids.map(function (id) {
          var it = DATA.items[id], v = it.v.length ? it.v[0] : null;
          return el('div', { class: 'sug-i', 'data-sug': id }, [el('b', { text: it.n }), el('span', { text: money(v ? v.p : it.p) }),
            el('button', { type: 'button', text: '+ Adicionar', onclick: function () { add({ id: id, v: v ? v.l : '', a: [], q: 1, o: '', src: 'sugestao' }); onChange(); } })]);
        })));
      };
      return box;
    }

    /* ----- estado do modo mesa ----- */
    var api = MM ? makeApi(SYS.url, SYS.key) : DLV ? makeApi(DLV.url, DLV.key) : null;
    var SKEY = 'gc-mesa:' + MESA;
    var S = { info: null, sess: null, est: null, fatal: '', offline: false, ended: false, asked: false, render: null, prev: null };
    var LBL = { novo: 'Enviado', preparando: 'Preparando', pronto: 'Pronto!', entregue: 'Entregue', cancelado: 'Cancelado' };
    if (MM) { try { S.sess = JSON.parse(localStorage.getItem(SKEY) || 'null'); } catch (e) {} }
    function saveSess(v) { try { if (v) localStorage.setItem(SKEY, JSON.stringify(v)); else localStorage.removeItem(SKEY); } catch (e) {} }
    function ready() { return !!(S.sess && S.est && S.est.comanda && S.est.comanda.status === 'aberta'); }
    function mesaNum() { return (S.est && S.est.mesa && S.est.mesa.numero) || (S.info && S.info.mesa && S.info.mesa.numero) || ''; }

    /* ----- barra fixa ----- */
    var nEl = el('span', { class: 'n', text: '0' }), tEl = el('b', { class: 't', text: '' }), ordN = el('span', { class: 'n', text: '', hidden: true });
    var cartBtn = el('button', { type: 'button', class: 'cb-cart', onclick: function () { if (MM) cartSheetMesa(); else cartSheet(); } }, [el('span', {}, [nEl, ' Ver pedido']), tEl]);
    var ordBtn = MM ? el('button', { type: 'button', class: 'cb-ord', 'aria-label': 'Pedidos da mesa', onclick: ordersSheet }, ['🧾 Pedidos ', ordN]) : null;
    var TKEY = 'gc-dlv:' + (DLV ? DLV.slug : ''), trk = null;
    try { trk = JSON.parse(localStorage.getItem(TKEY) || 'null'); } catch (e) {}
    var trkBtn = DLV ? el('button', { type: 'button', class: 'cb-ord', id: 'track-btn', hidden: !trk, onclick: function () { if (trk) trackSheet(trk); } }, ['🧾 Meu pedido']) : null;
    var barEl = el('div', { class: 'cartbar', hidden: true }, [ordBtn, trkBtn, cartBtn]);
    d.body.appendChild(barEl);
    function bar() {
      var n = count();
      cartBtn.hidden = !n; nEl.textContent = String(n); tEl.textContent = money(sub());
      if (trkBtn) trkBtn.hidden = !trk;
      barEl.hidden = MM ? !S.sess : (DLV ? (!n && !trk) : !n);
    }
    bar();

    /* ----- folhas (modais) ----- */
    function overlay(build, onClose) {
      var ov = el('div', { class: 'ov' });
      function close() { ov.remove(); if (!d.querySelector('.ov')) d.body.classList.remove('noscroll'); d.removeEventListener('keydown', onKey); if (onClose) onClose(); }
      function onKey(e) { if (e.key === 'Escape') close(); }
      ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
      d.addEventListener('keydown', onKey);
      var sh = el('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' });
      ov.appendChild(sh); build(sh, close);
      d.body.appendChild(ov); d.body.classList.add('noscroll');
      return close;
    }
    function head(title, close) {
      return el('div', { class: 'sh-head' }, [el('h2', { text: title }), el('button', { class: 'x', type: 'button', 'aria-label': 'Fechar', text: '✕', onclick: close })]);
    }
    function field(label, ctrl, id) { var f = el('label', { class: 'fld' }, [label, ctrl]); if (id) f.id = id; return f; }

    d.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-add]') : null;
      if (!b) return;
      var id = b.getAttribute('data-add'), it = DATA.items[id];
      if (!it) return;
      if (it.w && !inWin(it.w)) { toast('Fora do horário: disponível ' + winText(it.w)); return; }
      if (MM && !ready()) { gate(); return; }
      if (it.v.length > 1 || it.a.length) { itemSheet(id); return; }
      add({ id: id, v: it.v.length ? it.v[0].l : '', a: [], q: 1, o: '' });
      b.classList.add('ok'); var old = b.textContent; b.textContent = '✓ Adicionado';
      setTimeout(function () { b.classList.remove('ok'); b.textContent = old; }, 1100);
    });

    function itemSheet(id) {
      var it = DATA.items[id], vi = 0, q = 1, ad = {}, obs = '';
      overlay(function (sh, close) {
        var total = el('span');
        function price() { var p = it.v.length ? it.v[vi].p : it.p; it.a.forEach(function (x, i) { if (ad[i]) p += x.p; }); return p * q; }
        function upd() { total.textContent = money(price()); }
        sh.appendChild(head(it.n, close));
        if (it.v.length > 1) {
          sh.appendChild(el('div', { class: 'grp', text: 'Escolha uma opção' }));
          it.v.forEach(function (v, i) {
            var r = el('input', { type: 'radio', name: 'v' }); if (!i) r.checked = true;
            r.addEventListener('change', function () { vi = i; upd(); });
            sh.appendChild(el('label', { class: 'opt' }, [el('span', {}, [r, v.l]), el('b', { text: money(v.p) })]));
          });
        }
        if (it.a.length) {
          sh.appendChild(el('div', { class: 'grp', text: 'Adicionais' }));
          it.a.forEach(function (x, i) {
            var c = el('input', { type: 'checkbox' });
            c.addEventListener('change', function () { ad[i] = c.checked; upd(); });
            sh.appendChild(el('label', { class: 'opt' }, [el('span', {}, [c, x.l]), el('b', { text: x.p ? '+ ' + money(x.p) : 'grátis' })]));
          });
        }
        var o = el('input', { type: 'text', placeholder: 'Ex.: sem cebola' });
        o.addEventListener('input', function () { obs = o.value; });
        sh.appendChild(field('Observação', o));
        var qn = el('b', { text: '1' });
        function setQ(n) { q = Math.max(1, n); qn.textContent = String(q); upd(); }
        sh.appendChild(el('div', { class: 'qrow' }, [el('span', { text: 'Quantidade' }), el('span', { class: 'qty' }, [
          el('button', { type: 'button', 'aria-label': 'Diminuir', text: '−', onclick: function () { setQ(q - 1); } }), qn,
          el('button', { type: 'button', 'aria-label': 'Aumentar', text: '+', onclick: function () { setQ(q + 1); } })])]));
        sh.appendChild(el('button', {
          class: 'send go', type: 'button', onclick: function () {
            add({ id: id, v: it.v.length ? it.v[vi].l : '', a: it.a.filter(function (x, i) { return ad[i]; }).map(function (x) { return x.l; }), q: q, o: obs });
            close();
          }
        }, ['Adicionar · ', total]));
        upd();
      });
    }

    /* linhas do carrinho (compartilhado entre WhatsApp e mesa) */
    function fillLines(box, onChange) {
      box.textContent = '';
      if (!lines.length) box.appendChild(el('p', { class: 'none', text: 'Seu pedido está vazio.' }));
      lines.forEach(function (l) {
        var it = DATA.items[l.id], det = [];
        if (it.v.length > 1 && l.v) det.push(l.v);
        (l.a || []).forEach(function (a) { det.push('+ ' + a); });
        var o = el('input', { type: 'text', placeholder: 'Observação (ex.: sem cebola)' }); o.value = l.o || '';
        var livres = it.a.filter(function (x) { return (l.a || []).indexOf(x.l) < 0; });
        var fav = (DATA.pop && DATA.pop.ad && DATA.pop.ad[l.id]) || '';
        livres.sort(function (x, y) { return (y.l === fav) - (x.l === fav); });
        var chips = livres.length ? el('div', { class: 'achips' }, livres.slice(0, 2).map(function (x) {
          return el('button', { type: 'button', 'data-ad': x.l, text: '+ ' + x.l + (x.p ? ' (' + money(x.p) + ')' : ''), onclick: function () { l.a = (l.a || []).concat(x.l); dedupe(); save(); bar(); fillLines(box, onChange); onChange(); } });
        })) : null;
        o.addEventListener('input', function () { l.o = o.value; save(); });
        function step(n) { l.q += n; if (l.q <= 0) lines.splice(lines.indexOf(l), 1); save(); bar(); fillLines(box, onChange); onChange(); }
        box.appendChild(el('div', { class: 'line' }, [
          el('div', { class: 'line-top' }, [el('span', { text: it.n }), el('span', { text: money(unit(l) * l.q) })]),
          det.length ? el('small', { text: det.join(' · ') }) : null,
          chips,
          el('div', { class: 'line-bot' }, [o, el('span', { class: 'qty' }, [
            el('button', { type: 'button', 'aria-label': 'Diminuir', text: '−', onclick: function () { step(-1); } }), el('b', { text: String(l.q) }),
            el('button', { type: 'button', 'aria-label': 'Aumentar', text: '+', onclick: function () { step(1); } })])])
        ]));
      });
    }
    function bind(inp, k) { inp.value = info[k] || ''; inp.addEventListener('input', function () { info[k] = inp.value; save(); }); return inp; }

    /* ================= modo WhatsApp ================= */
    function cartSheet() {
      overlay(function (sh, close) {
        var TYPES = DLV ? C.types.filter(function (t) { return t.k !== 'dinein'; }) : C.types;
        if (!TYPES.length) TYPES = [{ k: 'pickup', l: 'Retirada' }];
        if (!info.type || !TYPES.some(function (t) { return t.k === info.type; })) info.type = TYPES[0].k;
        sh.appendChild(head('Seu pedido', close));
        var linesBox = el('div'), totals = el('div', { class: 'tot' }), notes = el('div'), err = el('div', { class: 'warn', hidden: true });
        var send = el('button', { class: 'send', id: 'send-order', type: 'button' }, [DLV ? 'Enviar pedido' : 'Enviar pedido pelo WhatsApp']);
        var sug = sugBox(function () { fillLines(linesBox, renderTotals); renderTotals(); });
        var st = status();
        if (st && !st.open) sh.appendChild(el('div', { class: 'warn', text: 'Estamos fechados agora. Você pode enviar o pedido e ele será respondido quando abrirmos.' }));

        function renderTotals() {
          var s = sub(), f = fee();
          totals.textContent = '';
          totals.appendChild(el('div', {}, [el('span', { text: 'Subtotal' }), el('span', { text: money(s) })]));
          if (f) totals.appendChild(el('div', {}, [el('span', { text: 'Taxa de entrega' }), el('span', { text: money(f) })]));
          totals.appendChild(el('div', { class: 'g' }, [el('span', { text: 'Total' }), el('span', { text: money(s + f) })]));
          notes.textContent = '';
          var low = C.min > 0 && s < C.min;
          if (low) notes.appendChild(el('div', { class: 'warn', text: 'Pedido mínimo: ' + money(C.min) + ' (faltam ' + money(C.min - s) + ')' }));
          send.disabled = !lines.length || low; sug.draw();
        }

        var nameI = bind(el('input', { type: 'text', id: 'cf-name', autocomplete: 'name', placeholder: 'Seu nome' }), 'name');
        var tbox = el('div', { class: 'types' });
        var addrF = field('Endereço de entrega', bind(el('textarea', { id: 'cf-addr', rows: '2', placeholder: 'Rua, número, bairro, complemento' }), 'addr'));
        var payI = el('select', { id: 'cf-pay' }, [el('option', { value: '', text: 'Selecione…' })].concat(C.pays.map(function (p) { return el('option', { value: p, text: p }); })));
        payI.value = info.pay || '';
        var chgF = field('Troco para quanto?', bind(el('input', { type: 'text', id: 'cf-change', placeholder: 'Ex.: 50,00' }), 'change'));
        function sync() {
          addrF.hidden = info.type !== 'delivery';
          chgF.hidden = !/dinheiro/i.test(info.pay || '');
          renderTotals();
        }
        TYPES.forEach(function (ty) {
          var r = el('input', { type: 'radio', name: 'ty' }); r.checked = info.type === ty.k;
          var lb = el('label', { class: info.type === ty.k ? 'on' : '' }, [r, ty.l]);
          r.addEventListener('change', function () { info.type = ty.k; save(); [].forEach.call(tbox.children, function (x) { x.classList.remove('on'); }); lb.classList.add('on'); sync(); });
          tbox.appendChild(lb);
        });
        payI.addEventListener('change', function () { info.pay = payI.value; save(); sync(); });
        var notesI = bind(el('textarea', { id: 'cf-notes', rows: '2', placeholder: 'Algo mais que devemos saber?' }), 'notes');

        sh.appendChild(linesBox); sh.appendChild(sug);
        sh.appendChild(el('button', { class: 'link', type: 'button', text: 'Adicionar mais itens', onclick: close }));
        var telI = bind(el('input', { type: 'tel', id: 'cf-tel', autocomplete: 'tel', inputmode: 'tel', placeholder: '(47) 99999-9999' }), 'tel');
        sh.appendChild(field('Seu nome', nameI));
        if (DLV) sh.appendChild(field('Telefone (WhatsApp)', telI));
        sh.appendChild(el('div', { class: 'fld' }, ['Como você quer receber?', tbox]));
        sh.appendChild(addrF);
        if (C.pays.length) { sh.appendChild(field('Forma de pagamento', payI)); sh.appendChild(chgF); }
        sh.appendChild(field('Observações do pedido', notesI));
        sh.appendChild(totals); sh.appendChild(notes); sh.appendChild(err); sh.appendChild(send);
        sh.appendChild(el('button', {
          class: 'link', type: 'button', text: 'Limpar pedido', onclick: function () { if (confirm('Esvaziar o pedido?')) { lines.length = 0; save(); bar(); close(); } }
        }));

        send.addEventListener('click', function () {
          var miss = [];
          if (!(info.name || '').trim()) miss.push('seu nome');
          if (DLV && String(info.tel || '').replace(/\D/g, '').length < 10) miss.push('o telefone com DDD');
          if (info.type === 'delivery' && !(info.addr || '').trim()) miss.push('o endereço de entrega');
          if (C.pays.length && !info.pay) miss.push('a forma de pagamento');
          if (miss.length) { err.hidden = false; err.textContent = 'Preencha ' + miss.join(', ') + '.'; return; }
          err.hidden = true;
          if (DLV) {
            send.disabled = true; send.textContent = 'Enviando…';
            api('publico_pedir_delivery', {
              p_slug: DLV.slug, p_canal: info.type === 'delivery' ? 'delivery' : 'retirada', p_nome: info.name, p_tel: info.tel,
              p_endereco: info.type === 'delivery' ? (info.addr || '') : '', p_pagto: info.pay || '', p_troco: /dinheiro/i.test(info.pay || '') ? (info.change || '') : '',
              p_obs: info.notes || '',
              p_itens: lines.map(function (l) { return { id: l.id, v: l.v || '', a: l.a || [], q: l.q, o: l.o || '', src: l.src || undefined }; })
            }).then(function (r) {
              var rec = { token: r.cliente_token, numero: r.numero, canal: r.canal };
              try { localStorage.setItem(TKEY, JSON.stringify(rec)); } catch (e) {}
              trk = rec;
              lines.length = 0; info.notes = ''; save(); bar(); close(); trackSheet(rec);
            }, function (e) {
              send.disabled = false; send.textContent = 'Enviar pedido';
              err.hidden = false; err.textContent = e.status ? e.message : 'Sem conexão. Seu pedido não foi enviado, tente de novo.';
            });
            return;
          }
          var url = 'https://wa.me/' + C.wa + '?text=' + encodeURIComponent(message());
          var w = window.open(url, '_blank');
          if (!w) location.href = url;
        });
        fillLines(linesBox, renderTotals); sync();
      });
    }

    function message() {
      var out = [C.msg || 'Olá! Gostaria de fazer um pedido:', '', '*Pedido*'];
      lines.forEach(function (l) {
        var it = DATA.items[l.id];
        out.push(l.q + 'x ' + it.n + (l.v && it.v.length > 1 ? ' (' + l.v + ')' : '') + ' — ' + money(unit(l) * l.q));
        (l.a || []).forEach(function (a) { out.push('   + ' + a); });
        if (l.o) out.push('   Obs: ' + l.o);
      });
      var f = fee();
      out.push(''); out.push('Subtotal: ' + money(sub()));
      if (f) out.push('Taxa de entrega: ' + money(f));
      out.push('*Total: ' + money(sub() + f) + '*'); out.push('');
      out.push('*Nome:* ' + info.name);
      var tl = ''; C.types.forEach(function (t) { if (t.k === info.type) tl = t.l; });
      out.push('*Tipo:* ' + tl);
      if (info.type === 'delivery') out.push('*Endereço:* ' + info.addr);
      if (info.pay) out.push('*Pagamento:* ' + info.pay + (/dinheiro/i.test(info.pay) && info.change ? ' (troco para ' + info.change + ')' : ''));
      if (info.notes) out.push('*Observações:* ' + info.notes);
      return out.join('\n');
    }

    /* ================= acompanhamento do pedido de delivery/retirada ================= */
    function trackSheet(rec) {
      var LBLD = { novo: 'Recebido', preparando: 'Em preparo', pronto: rec.canal === 'delivery' ? 'Pronto, saindo para entrega' : 'Pronto para retirar!', entregue: rec.canal === 'delivery' ? 'Saiu para entrega' : 'Retirado', cancelado: 'Cancelado' };
      var tm = null, gone = false;
      overlay(function (sh, close) {
        var box = el('div');
        sh.appendChild(head('Pedido #' + rec.numero, close)); sh.appendChild(box);
        function done() { trk = null; try { localStorage.removeItem(TKEY); } catch (e) {} bar(); }
        function draw(est) {
          box.textContent = '';
          if (est.comanda.status !== 'aberta') {
            box.appendChild(el('div', { class: 'warn ok', text: '✓ Pedido concluído. Obrigado pela preferência! 💛' }));
            done(); gone = true; return;
          }
          box.appendChild(el('p', { class: 'muted', text: rec.canal === 'delivery' ? 'Entrega' : 'Retirada no local' }));
          est.pedidos.forEach(function (p) {
            box.appendChild(el('div', { class: 'ord' + (p.status === 'cancelado' ? ' cx' : '') }, [
              el('div', { class: 'ord-top' }, [el('b', { text: '#' + p.numero + (p.setor ? ' · ' + p.setor : '') }), el('span', { class: 'pill ' + p.status, text: LBLD[p.status] || p.status })]),
              el('div', { class: 'ord-items' }, p.itens.map(function (i) { return el('div', { class: 'oi' }, [el('span', { text: itemText(i) }), el('span', { text: money(i.preco_unit * i.qtd) })]); }))]));
          });
          var t = est.totais, rows = [el('div', {}, [el('span', { text: 'Subtotal' }), el('span', { text: money(Number(t.subtotal)) })])];
          if (Number(t.taxa_entrega)) rows.push(el('div', {}, [el('span', { text: 'Taxa de entrega' }), el('span', { text: money(Number(t.taxa_entrega)) })]));
          rows.push(el('div', { class: 'g' }, [el('span', { text: 'Total' }), el('span', { text: money(Number(t.total)) })]));
          box.appendChild(el('div', { class: 'tot' }, rows));
          if (est.pedidos.every(function (p) { return p.status === 'cancelado'; })) box.appendChild(el('div', { class: 'warn', text: 'O restaurante cancelou este pedido. Fale com ele para saber o motivo.' }));
          if (C.wa) box.appendChild(el('a', { class: 'send alt', id: 'track-wa', href: 'https://wa.me/' + C.wa + '?text=' + encodeURIComponent('Olá! Sobre o meu pedido #' + rec.numero + ' feito pelo cardápio.'), target: '_blank', rel: 'noopener', text: 'Falar com o restaurante no WhatsApp' }));
        }
        function load() {
          if (gone) return;
          api('publico_estado', { p_cliente_token: rec.token }).then(draw, function (e) {
            if (/sessao_invalida/.test(e.message)) { box.textContent = ''; box.appendChild(el('p', { class: 'none', text: 'Não encontramos mais este pedido.' })); done(); gone = true; }
          }).then(function () { if (!gone) tm = setTimeout(load, 6000); });
        }
        box.appendChild(el('p', { class: 'none', text: 'Carregando…' })); load();
      }, function () { gone = true; clearTimeout(tm); });
    }
    function itemText(i) {
      return i.qtd + 'x ' + i.nome + (i.variante ? ' (' + i.variante + ')' : '') + (i.adicionais && i.adicionais.length ? ' + ' + i.adicionais.map(function (a) { return a.l; }).join(', ') : '');
    }
    if (DLV && trk) trackSheetSoon();
    function trackSheetSoon() { /* não abre sozinho: o cliente toca em "Meu pedido" */ }

    if (!MM) return;

    /* ================= modo mesa ================= */
    var mbar = el('div', { class: 'mesabar' });
    var hdr = $('header'); hdr.parentNode.insertBefore(mbar, hdr.nextSibling);

    function render() {
      mbar.textContent = '';
      if (S.fatal) { mbar.appendChild(el('div', { class: 'mb-in warn', text: S.fatal })); bar(); return; }
      var kids = [el('b', { text: 'Mesa ' + mesaNum() })];
      if (ready()) kids.push(el('span', { text: 'Olá, ' + S.sess.nome + '!' }));
      else if (S.sess) kids.push(el('span', { class: 'muted', text: 'Conectando…' }));
      else if (S.info && (S.info.aberta || S.info.abertura_automatica)) kids.push(el('button', { class: 'add', type: 'button', text: 'Entrar na mesa', onclick: nameSheet }));
      else if (S.info) kids.push(el('span', { class: 'muted', text: 'Aguardando o atendente abrir a mesa…' }));
      else kids.push(el('span', { class: 'muted', text: 'Conectando…' }));
      if (S.offline) kids.push(el('span', { class: 'off', text: 'sem conexão' }));
      mbar.appendChild(el('div', { class: 'mb-in' }, kids));
      var n = S.est && S.est.pedidos ? S.est.pedidos.filter(function (p) { return p.status !== 'entregue' && p.status !== 'cancelado'; }).length : 0;
      ordN.hidden = !n; ordN.textContent = String(n);
      bar();
      if (S.render) S.render();
    }

    function gate() {
      if (S.fatal) { toast(S.fatal); return; }
      if (S.sess) { toast('Atualizando a mesa…'); refresh(); return; }
      if (!S.info) { toast('Conectando… tente de novo em instantes.'); return; }
      if (!S.info.aberta && !S.info.abertura_automatica) { toast('Esta mesa ainda não foi aberta. Chame o atendente.'); return; }
      nameSheet();
    }

    function nameSheet() {
      if (d.querySelector('.ov')) return;
      overlay(function (sh, close) {
        var inp = el('input', { type: 'text', id: 'mesa-nome', maxlength: '40', placeholder: 'Seu nome', autocomplete: 'given-name' });
        var err = el('div', { class: 'warn', hidden: true });
        var go = el('button', { class: 'send go', type: 'button', text: 'Entrar na mesa' });
        function submit() {
          var nome = inp.value.trim();
          if (!nome) { err.hidden = false; err.textContent = 'Digite seu nome.'; return; }
          go.disabled = true;
          api('publico_entrar', { p_slug: SYS.slug, p_codigo: SYS.codigo, p_nome: nome }).then(function (r) {
            S.sess = { token: r.cliente_token, nome: r.nome }; S.ended = false; saveSess(S.sess); close(); refresh();
          }, function (e) {
            go.disabled = false; err.hidden = false;
            err.textContent = /mesa_fechada/.test(e.message) ? 'Esta mesa ainda não foi aberta. Chame o atendente.' : /mesa_invalida/.test(e.message) ? 'QR Code inválido.' : (e.status ? e.message : 'Sem conexão. Tente de novo.');
          });
        }
        go.addEventListener('click', submit);
        inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
        sh.appendChild(head('Bem-vindo!', close));
        sh.appendChild(el('p', { class: 'muted', text: 'Mesa ' + mesaNum() + '. Como podemos chamar você?' }));
        sh.appendChild(field('Seu nome', inp)); sh.appendChild(err); sh.appendChild(go);
        sh.appendChild(el('p', { class: 'muted', style: 'font-size:.74rem;text-align:center;margin-top:10px' }, ['Ao entrar, você concorda com os ', el('a', { href: 'https://menuazul.igorcabral.dev.br/termos', target: '_blank', rel: 'noopener', text: 'Termos de Uso' }), ' e a ', el('a', { href: 'https://menuazul.igorcabral.dev.br/privacidade', target: '_blank', rel: 'noopener', text: 'Política de Privacidade' }), '. Usamos só o seu nome e os seus pedidos para atender a mesa.']));
        setTimeout(function () { inp.focus(); }, 60);
      });
    }

    function cartSheetMesa() {
      if (!ready()) { gate(); return; }
      overlay(function (sh, close) {
        sh.appendChild(head('Seu pedido · Mesa ' + mesaNum(), close));
        var linesBox = el('div'), totals = el('div', { class: 'tot' }), err = el('div', { class: 'warn', hidden: true });
        var send = el('button', { class: 'send go', id: 'send-kitchen', type: 'button', text: 'Enviar para a cozinha' });
        var notesI = bind(el('textarea', { id: 'cf-notes', rows: '2', placeholder: 'Algo para a cozinha? (opcional)' }), 'notes');
        var sug = sugBox(function () { fillLines(linesBox, renderTotals); renderTotals(); });
        function renderTotals() {
          totals.textContent = '';
          totals.appendChild(el('div', { class: 'g' }, [el('span', { text: 'Este pedido' }), el('span', { text: money(sub()) })]));
          send.disabled = !lines.length; sug.draw();
        }
        sh.appendChild(linesBox); sh.appendChild(sug);
        sh.appendChild(el('button', { class: 'link', type: 'button', text: 'Adicionar mais itens', onclick: close }));
        sh.appendChild(field('Observações do pedido', notesI));
        sh.appendChild(totals); sh.appendChild(err); sh.appendChild(send);
        send.addEventListener('click', function () {
          err.hidden = true; send.disabled = true; send.textContent = 'Enviando…';
          api('publico_pedir', {
            p_cliente_token: S.sess.token, p_obs: info.notes || '',
            p_itens: lines.map(function (l) { return { id: l.id, v: l.v || '', a: l.a || [], q: l.q, o: l.o || '', src: l.src || undefined }; })
          }).then(function (r) {
            lines.length = 0; info.notes = ''; save(); bar(); close();
            toast((r.pedidos && r.pedidos.length > 1 ? 'Pedidos ' + r.pedidos.map(function (x) { return '#' + x.numero + (x.setor ? ' (' + x.setor + ')' : ''); }).join(' e ') + ' enviados! 🍳' : 'Pedido #' + r.numero + ' enviado! 🍳'));
            refresh();
          }, function (e) {
            send.textContent = 'Enviar para a cozinha'; send.disabled = false;
            if (/sessao_invalida|conta_encerrada/.test(e.message)) { close(); refresh(); return; }
            err.hidden = false; err.textContent = e.status ? e.message : 'Sem conexão. Seu pedido não foi enviado, tente de novo.';
          });
        });
        fillLines(linesBox, renderTotals); renderTotals();
      });
    }

    function itemText(i) {
      return i.qtd + 'x ' + i.nome + (i.variante ? ' (' + i.variante + ')' : '') + (i.adicionais && i.adicionais.length ? ' + ' + i.adicionais.map(function (a) { return a.l; }).join(', ') : '');
    }
    function ordersSheet() {
      if (!S.sess) { gate(); return; }
      overlay(function (sh, close) {
        var box = el('div');
        sh.appendChild(head('Pedidos · Mesa ' + mesaNum(), close));
        sh.appendChild(box);
        S.render = function () {
          var est = S.est; box.textContent = '';
          if (!est || !est.pedidos) { box.appendChild(el('p', { class: 'none', text: 'Carregando…' })); return; }
          var peds = est.pedidos.slice().reverse();
          if (!peds.length) box.appendChild(el('p', { class: 'none', text: 'Nenhum pedido ainda.' }));
          peds.forEach(function (p) {
            var mine = p.cliente_id === est.eu.id;
            box.appendChild(el('div', { class: 'ord' + (p.status === 'cancelado' ? ' cx' : '') }, [
              el('div', { class: 'ord-top' }, [el('b', { text: '#' + p.numero + (p.setor ? ' · ' + p.setor : '') + ' · ' + (mine ? 'Você' : p.cliente) }), el('span', { class: 'pill ' + p.status, text: LBL[p.status] || p.status })]),
              el('div', { class: 'ord-items' }, p.itens.map(function (i) { return el('div', { class: 'oi' }, [el('span', { text: itemText(i) }), el('span', { text: money(i.preco_unit * i.qtd) })]); })),
              p.obs ? el('small', { text: 'Obs: ' + p.obs }) : null,
              (mine && p.status === 'novo') ? el('button', {
                class: 'link', type: 'button', text: 'Cancelar pedido', onclick: function () {
                  api('publico_cancelar', { p_cliente_token: S.sess.token, p_pedido: p.id }).then(refresh, function (e) { toast(e.message); });
                }
              }) : null
            ]));
          });
          var t = est.totais, me = null;
          est.clientes.forEach(function (c) { if (c.id === est.eu.id) me = c; });
          var rows = [];
          if (me) rows.push(el('div', {}, [el('span', { text: 'Seu consumo' }), el('span', { text: money(Number(me.subtotal)) })]));
          rows.push(el('div', {}, [el('span', { text: 'Total da mesa' }), el('span', { text: money(Number(t.subtotal)) })]));
          if (Number(t.taxa)) rows.push(el('div', {}, [el('span', { text: 'Serviço (' + Number(t.taxa_pct) + '%)' }), el('span', { text: money(Number(t.taxa)) })]));
          if (Number(t.desconto)) rows.push(el('div', {}, [el('span', { text: 'Desconto' }), el('span', { text: '− ' + money(Number(t.desconto)) })]));
          rows.push(el('div', { class: 'g' }, [el('span', { text: 'Total com serviço' }), el('span', { text: money(Number(t.total)) })]));
          box.appendChild(el('div', { class: 'tot' }, rows));
          if (est.comanda.conta_pedida) box.appendChild(el('div', { class: 'warn ok', text: '✓ Conta solicitada. O atendente já vai até a sua mesa.' }));
          else box.appendChild(el('button', {
            class: 'send', id: 'ask-bill', type: 'button', text: 'Pedir a conta', onclick: function () {
              api('publico_pedir_conta', { p_cliente_token: S.sess.token }).then(function () { toast('Conta solicitada!'); refresh(); }, function (e) { toast(e.message); });
            }
          }));
          if (est.comanda.chamado) box.appendChild(el('div', { class: 'warn ok', text: '✓ Garçom chamado. Ele já vai até a sua mesa.' }));
          else box.appendChild(el('button', {
            class: 'send alt', id: 'call-waiter', type: 'button', text: '🔔 Chamar o garçom', onclick: function () {
              api('publico_chamar_garcom', { p_cliente_token: S.sess.token }).then(function () { toast('Garçom chamado!'); refresh(); }, function (e) { toast(e.message); });
            }
          }));
        };
        S.render();
      }, function () { S.render = null; });
    }

    // Conta encerrada: agradecimento do restaurante + "Uma experiência Menu Azul"; em 5 s vai para a página inicial da plataforma
    function endScreen() {
      if (d.querySelector('.ov.end')) return;
      var home = location.origin + '/', rv = SYS && SYS.review ? SYS.review : '', left = rv ? 10 : 5, tick = null;   // com link de avaliação o cliente tem mais tempo
      var cd = el('p', { class: 'end-cd', text: 'Voltando para o Menu Azul em ' + left + 's…' });
      function stay() { clearInterval(tick); ov.remove(); d.body.classList.remove('noscroll'); }
      var ov = el('div', { class: 'ov end', role: 'dialog', 'aria-live': 'polite' }, [el('div', { class: 'endcard' }, [
        SYS && SYS.logo ? el('img', { class: 'end-logo', src: SYS.logo, alt: '' }) : null,
        el('h2', { text: 'Obrigado pela visita!' }),
        el('p', { class: 'muted', text: (SYS && SYS.nome ? SYS.nome + ' agradece a sua presença. ' : '') + 'Volte sempre! 💛' }),
        el('div', { class: 'end-exp' }, [el('span', { text: 'Uma experiência' }), el('img', { src: home + 'brand/menuazul.png', alt: 'Menu Azul' })]),
        rv ? el('a', { class: 'end-rv', href: rv, target: '_blank', rel: 'noopener', text: '⭐ Avaliar no Google', onclick: function () { clearInterval(tick); cd.textContent = 'Obrigado pela avaliação! 💛'; } }) : null,
        cd,
        el('button', { class: 'end-stay', type: 'button', text: 'Ficar no cardápio', onclick: stay }),
        el('div', { class: 'end-bar' })])]);
      d.body.appendChild(ov); d.body.classList.add('noscroll');
      tick = setInterval(function () {
        left--;
        if (left <= 0) { clearInterval(tick); location.href = home; return; }
        cd.textContent = 'Voltando para o Menu Azul em ' + left + 's…';
      }, 1000);
    }

    var timer = null, busy = false;
    // atualização econômica: só baixa a lista quando algo mudou (p_hash), fica mais devagar quando nada acontece e espera mais se a rede falha
    var same = 0, fails = 0;
    function delay() { var b = same >= 24 ? 15000 : same >= 8 ? 8000 : 4000; if (fails) b = Math.min(30000, b * Math.pow(2, fails)); return Math.round(b * (0.85 + Math.random() * 0.3) * (window.GC_POLL_SCALE || 1)); }
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) { d.addEventListener(ev, function () { same = 0; }, { passive: true }); });
    function refresh() {
      if (busy) return Promise.resolve();
      busy = true;
      var p;
      if (S.sess) {
        p = api('publico_estado', { p_cliente_token: S.sess.token, p_hash: S.h }).then(function (est) {
          if (est.sem_mudanca && S.estFull) { same++; est = S.estFull; } else { same = 0; S.estFull = est; S.h = est.h; }
          if (est.comanda.status !== 'aberta') {
            S.sess = null; S.est = null; S.ended = true; saveSess(null); lines.length = 0; info.notes = ''; save(); bar();
            endScreen();
            return api('publico_info', { p_slug: SYS.slug, p_codigo: SYS.codigo }).then(function (i) { S.info = i; });
          }
          // avisa quando um pedido meu fica pronto
          var prev = S.prev, now = {};
          est.pedidos.forEach(function (o) { now[o.id] = o.status; if (prev && prev[o.id] && prev[o.id] !== 'pronto' && o.status === 'pronto' && o.cliente_id === est.eu.id) toast('Seu pedido #' + o.numero + ' está pronto! 🎉'); });
          S.prev = now; S.est = est;
        }, function (e) {
          if (/sessao_invalida|restaurante_bloqueado/.test(e.message)) { S.sess = null; S.est = null; saveSess(null); return api('publico_info', { p_slug: SYS.slug, p_codigo: SYS.codigo }).then(function (i) { S.info = i; }); }
          throw e;
        });
      } else {
        p = api('publico_info', { p_slug: SYS.slug, p_codigo: SYS.codigo }).then(function (i) { var sg = JSON.stringify(i); if (sg === S.infoSig) same++; else { same = 0; S.infoSig = sg; } S.info = i; });
      }
      return p.then(function () {
        S.offline = false; S.fatal = ''; fails = 0;
        render();
        if (!S.sess && S.info && (S.info.aberta || S.info.abertura_automatica) && !S.asked && !S.ended) { S.asked = true; nameSheet(); }
      }, function (e) {
        if (/restaurante_bloqueado/.test(e.message)) { S.fatal = 'Serviço indisponível no momento. Chame o atendente.'; clearTimeout(timer); render(); return; }
        if (/mesa_invalida/.test(e.message)) { S.fatal = 'QR Code inválido ou desativado. Peça ajuda ao atendente.'; clearTimeout(timer); render(); return; }
        fails = Math.min(fails + 1, 4); S.offline = !e.status; if (e.status) toast(e.message);
        render();
      }).then(function () { busy = false; });
    }
    function loop() { clearTimeout(timer); if (S.fatal || S.ended) return; timer = setTimeout(function () { (d.hidden ? Promise.resolve() : refresh()).then(loop, loop); }, delay()); }   // conta encerrada: para de consultar
    d.addEventListener('visibilitychange', function () { if (!d.hidden) refresh(); });
    render(); refresh().then(loop, loop);
  }
}
