/* Garçom — vê as mesas (quem chamou, o que está pronto para entregar) e lança pedidos para a cozinha. */
const GARCOM_CSS = `
*{box-sizing:border-box;margin:0}
[hidden]{display:none!important}
body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#eef3fb;color:#14213d;-webkit-font-smoothing:antialiased}
button{font:inherit;color:inherit;cursor:pointer}
input,textarea{font:inherit;color:inherit}
.btn{border:0;border-radius:12px;padding:12px 16px;font-weight:800;background:var(--primary,#0264f4);color:var(--on-primary,#fff)}
.btn.sec{background:#e1e8f5;color:#14213d}
.btn.ok{background:#12a05c;color:#fff}
.btn.sm{padding:7px 12px;font-size:.84rem;border-radius:9px}
.btn.big{width:100%;padding:15px;font-size:1.05rem}
.btn:disabled{opacity:.45}
.top{display:flex;align-items:center;gap:10px;padding:12px 16px;background:linear-gradient(110deg,#06286a,#0345a1);color:#fff;position:sticky;top:0;z-index:5;flex-wrap:wrap}
.top h1{font-size:1.05rem}.top .sp{flex:1}
.top .btn.sec{background:rgba(255,255,255,.16);color:#fff}
.dot{width:10px;height:10px;border-radius:50%;background:#2ecc71;display:inline-block}.dot.off{background:#e74c3c}
.chips{display:flex;gap:8px;padding:12px 16px 0;overflow-x:auto}
.chips button{border:0;background:#dbe5f6;border-radius:99px;padding:8px 14px;font-weight:800;white-space:nowrap;color:#33466e}
.chips button.on{background:#0264f4;color:#fff}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;padding:14px 16px 30px}
.mesa{background:#fff;border:2px solid #dbe5f6;border-radius:16px;padding:14px;text-align:left;display:flex;flex-direction:column;gap:5px;min-height:112px}
.mesa .nm{font-weight:900;font-size:1.15rem}.mesa .mt{color:#6b7a99;font-size:.82rem}
.mesa.livre{border-style:dashed;color:#6b7a99}.mesa.aberta{border-color:#0264f4}
.mesa.conta{border-color:#e0a030;background:#fff8e8}
.mesa.pronto{border-color:#12a05c;background:#effaf4}
.mesa.chama{border-color:#e74c3c;background:#fff0ee;animation:pulse 1.2s ease-in-out infinite}
@keyframes pulse{50%{box-shadow:0 0 0 6px rgba(231,76,60,.18)}}
.bdg{display:flex;flex-wrap:wrap;gap:5px;margin-top:2px}
.bdg span{font-size:.74rem;font-weight:800;border-radius:99px;padding:3px 9px}
.b-chama{background:#e74c3c;color:#fff}.b-pronto{background:#12a05c;color:#fff}.b-conta{background:#e0a030;color:#fff}.b-pend{background:#e1e8f5;color:#33466e}
.empty{padding:34px 16px;text-align:center;color:#6b7a99}
.ov{position:fixed;inset:0;background:rgba(6,40,106,.5);z-index:20;display:flex;align-items:flex-end;justify-content:center}
.sheet{background:#fff;width:100%;max-width:560px;max-height:92vh;overflow:auto;border-radius:22px 22px 0 0;padding:18px 16px 24px;display:flex;flex-direction:column;gap:12px}
.sheet h2{font-size:1.25rem}.sheet h3{font-size:.95rem;margin-top:4px;color:#33466e}
.sh{display:flex;align-items:center;gap:10px}.sh h2{flex:1}
.x{border:0;background:#e1e8f5;border-radius:50%;width:34px;height:34px;font-size:1.1rem}
.alert{display:flex;align-items:center;gap:10px;border-radius:14px;padding:12px 14px;font-weight:700}
.alert.chama{background:#ffe3df;color:#a3281b}.alert.conta{background:#fff1d6;color:#8a5a00}
.alert span{flex:1}
.ped{border:1px solid #dbe5f6;border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:6px}
.ped.pronto{border-color:#12a05c;background:#effaf4}
.ped .hd{display:flex;align-items:center;gap:8px;font-weight:800}.ped .hd small{color:#6b7a99;font-weight:700}
.ped .st{margin-left:auto;font-size:.74rem;border-radius:99px;padding:3px 9px;background:#e1e8f5;color:#33466e}
.ped .li{font-size:.94rem}.ped .li i{font-style:normal;color:#6b7a99;font-size:.84rem}
.picker{position:fixed;inset:0;background:#eef3fb;z-index:30;display:flex;flex-direction:column}
.picker .bar{display:flex;gap:8px;padding:12px 14px;background:#fff;border-bottom:1px solid #dbe5f6}
.picker .bar input{flex:1;border:1px solid #cfd9ec;border-radius:12px;padding:11px 13px;font-size:1rem}
.picker .list{flex:1;overflow:auto;padding:10px 14px}
.it{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #dbe5f6;border-radius:14px;padding:11px 13px;margin-bottom:8px}
.it .nm{flex:1;font-weight:800}.it .nm small{display:block;color:#6b7a99;font-weight:600}
.it.off{opacity:.5}
.qty{display:flex;align-items:center;gap:8px}.qty b{min-width:20px;text-align:center}
.qty button{border:0;background:#e1e8f5;width:34px;height:34px;border-radius:50%;font-size:1.2rem;font-weight:900}
.qty button.pl{background:#0264f4;color:#fff}
.cartbar{padding:12px 14px;background:#fff;border-top:1px solid #dbe5f6}
.opt{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #eef3fb}.opt span{flex:1}
textarea{width:100%;border:1px solid #cfd9ec;border-radius:12px;padding:10px;resize:vertical;min-height:60px}
.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#06286a;color:#fff;padding:12px 18px;border-radius:12px;z-index:60;font-weight:700;max-width:90vw}
`;

function garcomRuntime(app, CFG) {
  var d = document, api = CFG.api, token = CFG.token, stopped = false;
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
  function money(n) { return Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function fail(e) { if (/sessao_invalida|restaurante_bloqueado/.test(e.message)) { CFG.expired(); return; } toast(e.status ? e.message : 'Sem conexão. Tente de novo.'); }
  var tt = null;
  function toast(m) { var t = d.querySelector('.toast'); if (t) t.remove(); t = el('div', { class: 'toast', text: m }); d.body.appendChild(t); clearTimeout(tt); tt = setTimeout(function () { t.remove(); }, 2600); }

  var sound = ls('gc-garcom-sound') === '1', ctx = null, sndEl = null;
  var S = { mesas: [], offset: 0, online: true, sig: '', seen: null, filter: 'todas', itens: null, itensEm: 0, lastBeep: 0 };
  var timer = null, body = null, dot = null, baseTitle = d.title;
  function sndLabel() { return !sound ? '🔕 Som' : (ctx && ctx.state === 'running' ? '🔔 Som' : '🔇 Liberar som'); }
  function audio() { try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); } catch (e) {} }
  function unlock() { if (sound) audio(); }
  function beep() {
    if (!sound) return;
    S.lastBeep = Date.now();
    try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) {}
    try {
      audio(); var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = 880; g.gain.value = 0.2; o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.25);
    } catch (e) {}
  }
  function mins(iso) { var m = Math.max(0, Math.floor((Date.now() + S.offset - new Date(iso).getTime()) / 60000)); return m < 60 ? m + ' min' : Math.floor(m / 60) + 'h' + (m % 60 < 10 ? '0' : '') + (m % 60); }

  /* ---------- mesas ---------- */
  function est(m) {
    var c = m.comanda;
    return { chama: !!(c && c.chamado_em), pronto: c ? Number(c.prontos) : 0, conta: !!(c && c.conta_pedida), pend: c ? Number(c.pendentes) : 0 };
  }
  function shell() {
    app.textContent = '';
    dot = el('span', { class: 'dot' + (S.online ? '' : ' off') });
    var snd = sndEl = el('button', { class: 'btn sec sm', type: 'button', id: 'snd', text: sndLabel(), onclick: function () { sound = !sound; ls('gc-garcom-sound', sound ? '1' : '0'); audio(); beep(); snd.textContent = sndLabel(); } });
    app.appendChild(el('div', { class: 'top' }, [el('h1', { text: '🛎 Garçom · ' + CFG.nome }), dot, el('span', { class: 'sp' }), snd, el('button', { class: 'btn sec sm', type: 'button', text: 'Sair', onclick: function () { CFG.logout(); } })]));
    app.appendChild(el('div', { class: 'chips', id: 'chips' }));
    body = el('div'); app.appendChild(body);
  }
  function paint() {
    if (!body) return;
    var cnt = { chama: 0, pronto: 0, conta: 0 };
    S.mesas.forEach(function (m) { var e = est(m); if (e.chama) cnt.chama++; if (e.pronto) cnt.pronto++; if (e.conta) cnt.conta++; });
    var chips = d.getElementById('chips'); chips.textContent = '';
    [['todas', 'Todas'], ['chama', '🔔 Chamando (' + cnt.chama + ')'], ['pronto', '✅ Prontos (' + cnt.pronto + ')'], ['conta', '💰 Conta (' + cnt.conta + ')']].forEach(function (f) {
      chips.appendChild(el('button', { type: 'button', class: S.filter === f[0] ? 'on' : '', 'data-f': f[0], text: f[1], onclick: function () { S.filter = f[0]; paint(); } }));
    });
    var list = S.mesas.filter(function (m) { return S.filter === 'todas' || est(m)[S.filter]; });
    body.textContent = '';
    if (!list.length) { body.appendChild(el('div', { class: 'empty', text: S.mesas.length ? 'Nada por aqui agora. 👌' : 'Nenhuma mesa cadastrada.' })); return; }
    body.appendChild(el('div', { class: 'grid' }, list.map(function (m) {
      var c = m.comanda, e = est(m), kids = [el('div', { class: 'nm', text: 'Mesa ' + m.numero })];
      if (!c) kids.push(el('div', { class: 'mt', text: 'Livre' }));
      else {
        kids.push(el('div', { class: 'mt', text: c.clientes + ' pessoa' + (c.clientes == 1 ? '' : 's') + ' · ' + mins(c.aberta_em) }));
        var b = [];
        if (e.chama) b.push(el('span', { class: 'b-chama', text: '🔔 ' + (c.chamado_por || 'Chamou') }));
        if (e.pronto) b.push(el('span', { class: 'b-pronto', text: '✅ ' + e.pronto + ' pronto' + (e.pronto > 1 ? 's' : '') }));
        if (e.conta) b.push(el('span', { class: 'b-conta', text: '💰 Conta' }));
        if (e.pend) b.push(el('span', { class: 'b-pend', text: e.pend + ' na cozinha' }));
        kids.push(el('div', { class: 'bdg' }, b));
      }
      var cls = !c ? 'livre' : e.chama ? 'chama' : e.pronto ? 'pronto' : e.conta ? 'conta' : 'aberta';
      return el('button', { type: 'button', class: 'mesa ' + cls, 'data-mesa': m.numero, onclick: function () { openMesa(m); } }, kids);
    })));
  }

  /* ---------- mesa (gaveta) ---------- */
  var DR = null;
  function closeDrawer() { if (DR) { DR.ov.remove(); DR = null; } }
  function openMesa(m) { closeDrawer(); var cur = DR = { id: m.id, ov: el('div', { class: 'ov' }), data: null, sig: '' }; d.body.appendChild(cur.ov); cur.ov.addEventListener('click', function (e) { if (e.target === cur.ov) closeDrawer(); }); drawerLoad(); }
  function drawerLoad() {
    if (!DR) return Promise.resolve();
    var cur = DR;
    return api('garcom_mesa', { p_token: token, p_mesa: cur.id }).then(function (r) { if (DR !== cur) return; S.offset = new Date(r.agora).getTime() - Date.now(); var sg = JSON.stringify([r.comanda, r.pedidos]); if (sg === cur.sig) return; cur.sig = sg; cur.data = r; drawerRender(); }, fail);
  }
  function ped(p, pronto) {
    var li = p.itens.map(function (i) {
      var ex = (i.adicionais || []).map(function (a) { return a.l; }).concat(i.obs ? ['⚠ ' + i.obs] : []);
      return el('div', { class: 'li' }, [i.qtd + '× ' + i.nome + (i.variante ? ' · ' + i.variante : ''), ex.length ? el('i', { text: ' — ' + ex.join(', ') }) : null]);
    });
    var ST = { novo: 'Novo', preparando: 'Preparando', pronto: 'Pronto', entregue: 'Entregue' };
    return el('div', { class: 'ped' + (pronto ? ' pronto' : ''), 'data-ped': p.numero }, [
      el('div', { class: 'hd' }, [el('span', { text: '#' + p.numero }), p.cliente ? el('small', { text: p.cliente }) : null, el('span', { class: 'st', text: ST[p.status] || p.status })]),
      el('div', {}, li), p.obs ? el('div', { class: 'li', text: '📝 ' + p.obs }) : null,
      pronto ? el('button', { class: 'btn ok', type: 'button', 'data-entregar': p.numero, text: '✅ Entregue na mesa', onclick: function () {
        api('garcom_entregar', { p_token: token, p_pedido: p.id }).then(function () { toast('Entregue ✓'); drawerLoad(); refresh(); }, function (e) { fail(e); drawerLoad(); });
      } }) : null]);
  }
  function drawerRender() {
    if (!DR || !DR.data) return;
    var r = DR.data, c = r.comanda, ps = r.pedidos.filter(function (p) { return p.status !== 'cancelado'; });
    var prontos = ps.filter(function (p) { return p.status === 'pronto'; }), coz = ps.filter(function (p) { return p.status === 'novo' || p.status === 'preparando'; }), ent = ps.filter(function (p) { return p.status === 'entregue'; });
    var k = [el('div', { class: 'sh' }, [el('h2', { text: 'Mesa ' + r.mesa.numero }), el('button', { class: 'x', type: 'button', text: '✕', onclick: closeDrawer })])];
    if (c && c.chamado_em) k.push(el('div', { class: 'alert chama' }, [el('span', { text: '🔔 ' + (c.chamado_por || 'Cliente') + ' chamou o garçom' }), el('button', { class: 'btn sm', type: 'button', 'data-atender': '1', text: 'Atender', onclick: function () {
      api('garcom_atender', { p_token: token, p_comanda: c.id }).then(function () { drawerLoad(); refresh(); }, fail); } })]));
    if (c && c.conta_pedida) k.push(el('div', { class: 'alert conta' }, [el('span', { text: '💰 A mesa pediu a conta — avise o caixa.' })]));
    if (prontos.length) { k.push(el('h3', { text: 'Prontos para entregar (' + prontos.length + ')' })); prontos.forEach(function (p) { k.push(ped(p, true)); }); }
    if (coz.length) { k.push(el('h3', { text: 'Na cozinha (' + coz.length + ')' })); coz.forEach(function (p) { k.push(ped(p, false)); }); }
    if (ent.length) { k.push(el('h3', { text: 'Já entregues' })); ent.slice(-3).forEach(function (p) { k.push(ped(p, false)); }); }
    if (!ps.length) k.push(el('div', { class: 'empty', text: c ? 'Nenhum pedido ainda.' : 'Mesa livre. O primeiro pedido abre a conta.' }));
    k.push(el('button', { class: 'btn big', type: 'button', id: 'novo-pedido', text: '＋ Novo pedido', onclick: function () { openPicker(r.mesa); } }));
    DR.ov.textContent = ''; DR.ov.appendChild(el('div', { class: 'sheet' }, k));
  }

  /* ---------- novo pedido ---------- */
  var PK = null;
  function loadItens() {
    if (S.itens && Date.now() - S.itensEm < 60000) return Promise.resolve(S.itens);
    return api('garcom_itens', { p_token: token }).then(function (r) { S.itens = r; S.itensEm = Date.now(); return r; });
  }
  function unit(it, v, ads) {
    var p = Number(it.preco || 0);
    if ((it.variantes || []).length) { var f = it.variantes.filter(function (x) { return x.l === v; })[0]; p = f ? Number(f.p) : 0; }
    ads.forEach(function (l) { var a = (it.adicionais || []).filter(function (x) { return x.l === l; })[0]; if (a) p += Number(a.p || 0); });
    return p;
  }
  function cartTotal() { return PK.cart.reduce(function (s, l) { return s + l.u * l.q; }, 0); }
  function cartQty() { return PK.cart.reduce(function (s, l) { return s + l.q; }, 0); }
  function addLine(it, v, ads, q, o) {
    var key = it.id + '|' + v + '|' + ads.join(',') + '|' + (o || ''), f = PK.cart.filter(function (l) { return l.key === key; })[0];
    if (f) f.q += q; else PK.cart.push({ key: key, id: it.id, nome: it.nome, v: v, a: ads, q: q, o: o || '', u: unit(it, v, ads) });
    PK.cart = PK.cart.filter(function (l) { return l.q > 0; });
  }
  function openPicker(mesa) {
    PK = { mesa: mesa, cart: [], q: '', ov: el('div', { class: 'picker' }) }; d.body.appendChild(PK.ov);
    loadItens().then(pickerRender, function (e) { closePicker(); fail(e); });
  }
  function closePicker() { if (PK) { PK.ov.remove(); PK = null; } }
  function simple(it) { return !(it.variantes || []).length && !(it.adicionais || []).length; }
  function pickerRender() {
    if (!PK) return;
    var keep = PK.ov.querySelector('.list'), top = keep ? keep.scrollTop : 0, hadFocus = d.activeElement && d.activeElement.id === 'pk-q';
    var q = PK.q.trim().toLowerCase(), lista = S.itens.filter(function (it) { return !q || it.nome.toLowerCase().indexOf(q) >= 0; });
    var inp = el('input', { id: 'pk-q', type: 'search', placeholder: 'Buscar item…', value: PK.q, oninput: function (e) { PK.q = e.target.value; pickerRender(); } });
    var rows = lista.map(function (it) {
      var qtd = PK.cart.filter(function (l) { return l.id === it.id; }).reduce(function (s, l) { return s + l.q; }, 0);
      var preco = (it.variantes || []).length ? 'a partir de ' + money(Math.min.apply(null, it.variantes.map(function (v) { return Number(v.p); }))) : money(it.preco);
      var act;
      if (it.esgotado) act = el('span', { class: 'mt', text: 'Esgotado' });
      else if (simple(it)) act = el('div', { class: 'qty' }, [
        qtd ? el('button', { type: 'button', text: '−', onclick: function () { addLine(it, '', [], -1, ''); pickerRender(); } }) : null,
        qtd ? el('b', { text: String(qtd) }) : null,
        el('button', { type: 'button', class: 'pl', 'data-add': it.nome, text: '+', onclick: function () { addLine(it, '', [], 1, ''); pickerRender(); } })]);
      else act = el('button', { class: 'btn sm', type: 'button', 'data-opt': it.nome, text: qtd ? 'Adicionar (' + qtd + ')' : 'Escolher', onclick: function () { optSheet(it); } });
      return el('div', { class: 'it' + (it.esgotado ? ' off' : '') }, [el('div', { class: 'nm' }, [it.nome, el('small', { text: preco })]), act]);
    });
    var n = cartQty();
    PK.ov.textContent = '';
    PK.ov.appendChild(el('div', { class: 'bar' }, [el('button', { class: 'x', type: 'button', text: '✕', onclick: closePicker }), inp]));
    PK.ov.appendChild(el('div', { class: 'list' }, rows.length ? rows : [el('div', { class: 'empty', text: 'Nenhum item encontrado.' })]));
    PK.ov.appendChild(el('div', { class: 'cartbar' }, [el('button', { class: 'btn big', type: 'button', id: 'rever', disabled: !n, text: n ? 'Revisar e enviar · ' + n + ' item(ns) · ' + money(cartTotal()) : 'Escolha os itens', onclick: reviewSheet })]));
    var nl = PK.ov.querySelector('.list'); nl.scrollTop = top;
    if (hadFocus) { var ni = d.getElementById('pk-q'); ni.focus(); ni.setSelectionRange(ni.value.length, ni.value.length); }
  }
  function sheetOver(kids) {
    var ov = el('div', { class: 'ov', style: 'z-index:40' }, [el('div', { class: 'sheet' }, kids)]);
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); }); d.body.appendChild(ov); return ov;
  }
  function optSheet(it) {
    var v = (it.variantes || [])[0] ? it.variantes[0].l : '', ads = [], q = 1, o = '';
    var ov, kids = el('div', { style: 'display:flex;flex-direction:column;gap:10px' });
    function redraw() {
      kids.textContent = '';
      kids.appendChild(el('div', { class: 'sh' }, [el('h2', { text: it.nome }), el('button', { class: 'x', type: 'button', text: '✕', onclick: function () { ov.remove(); } })]));
      if ((it.variantes || []).length) { kids.appendChild(el('h3', { text: 'Opção' })); it.variantes.forEach(function (x) {
        kids.appendChild(el('label', { class: 'opt' }, [el('input', { type: 'radio', name: 'var', checked: x.l === v, onchange: function () { v = x.l; redraw(); } }), el('span', { text: x.l }), el('b', { text: money(x.p) })])); }); }
      if ((it.adicionais || []).length) { kids.appendChild(el('h3', { text: 'Adicionais' })); it.adicionais.forEach(function (x) {
        kids.appendChild(el('label', { class: 'opt' }, [el('input', { type: 'checkbox', checked: ads.indexOf(x.l) >= 0, onchange: function () { var i = ads.indexOf(x.l); if (i >= 0) ads.splice(i, 1); else ads.push(x.l); redraw(); } }), el('span', { text: x.l }), el('b', { text: '+ ' + money(x.p) })])); }); }
      kids.appendChild(el('textarea', { id: 'opt-obs', placeholder: 'Observação (ex.: sem cebola)', oninput: function (e) { o = e.target.value; }, text: o }));
      kids.appendChild(el('div', { class: 'qty', style: 'justify-content:center' }, [el('button', { type: 'button', text: '−', onclick: function () { q = Math.max(1, q - 1); redraw(); } }), el('b', { text: String(q) }), el('button', { type: 'button', class: 'pl', text: '+', onclick: function () { q++; redraw(); } })]));
      kids.appendChild(el('button', { class: 'btn big', type: 'button', id: 'opt-ok', text: 'Adicionar · ' + money(unit(it, v, ads) * q), onclick: function () { addLine(it, v, ads.slice(), q, o.trim()); ov.remove(); pickerRender(); } }));
    }
    ov = sheetOver([kids]); redraw();
  }
  function reviewSheet() {
    if (!PK || !PK.cart.length) return;
    var obs = '', ov, kids = el('div', { style: 'display:flex;flex-direction:column;gap:10px' });
    function redraw() {
      kids.textContent = '';
      kids.appendChild(el('div', { class: 'sh' }, [el('h2', { text: 'Mesa ' + PK.mesa.numero + ' · revisar' }), el('button', { class: 'x', type: 'button', text: '✕', onclick: function () { ov.remove(); } })]));
      PK.cart.forEach(function (l, i) {
        kids.appendChild(el('div', { class: 'opt' }, [el('span', { text: l.q + '× ' + l.nome + (l.v ? ' · ' + l.v : '') + (l.a.length ? ' (+ ' + l.a.join(', ') + ')' : '') + (l.o ? ' — ' + l.o : '') }), el('b', { text: money(l.u * l.q) }),
          el('button', { class: 'btn sec sm', type: 'button', text: '✕', onclick: function () { PK.cart.splice(i, 1); if (!PK.cart.length) { ov.remove(); pickerRender(); } else redraw(); } })]));
      });
      kids.appendChild(el('textarea', { id: 'ped-obs', placeholder: 'Observação do pedido (opcional)', oninput: function (e) { obs = e.target.value; }, text: obs }));
      kids.appendChild(el('button', { class: 'btn big ok', type: 'button', id: 'enviar', text: 'Enviar para a cozinha · ' + money(cartTotal()), onclick: function (e) {
        var b = e.currentTarget; b.disabled = true; b.textContent = 'Enviando…';
        api('garcom_pedir', { p_token: token, p_mesa: PK.mesa.id, p_itens: PK.cart.map(function (l) { return { id: l.id, q: l.q, v: l.v || undefined, a: l.a.length ? l.a : undefined, o: l.o || undefined }; }), p_obs: obs.trim() || null }).then(function (r) {
          ov.remove(); closePicker(); toast('Pedido #' + r.numero + ' enviado para a cozinha ✓'); drawerLoad(); refresh();
        }, function (er) { b.disabled = false; b.textContent = 'Enviar para a cozinha'; fail(er); });
      } }));
    }
    ov = sheetOver([kids]); redraw();
  }

  /* ---------- atualização ---------- */
  function refresh() {
    return api('garcom_mesas', { p_token: token }).then(function (r) {
      S.offset = new Date(r.agora).getTime() - Date.now();
      var wasOff = !S.online; S.online = true; if (dot) dot.className = 'dot';
      var seen = {}, alerta = false, n = 0;
      r.mesas.forEach(function (m) {
        var e = est(m); if (e.chama || e.pronto) n++;
        seen[m.id] = (e.chama ? m.comanda.chamado_em : '') + '|' + e.pronto;
        if (S.seen && S.seen[m.id] !== undefined && S.seen[m.id] !== seen[m.id] && (e.chama || e.pronto)) {
          var antes = S.seen[m.id].split('|'); if ((e.chama && antes[0] !== m.comanda.chamado_em) || e.pronto > Number(antes[1])) alerta = true;
        }
      });
      S.seen = seen; if (alerta) beep();
      d.title = (n ? '(' + n + ') ' : '') + baseTitle;
      if (n && sound && Date.now() - S.lastBeep > 30000) beep();
      var sig = JSON.stringify(r.mesas);
      if (sig !== S.sig || wasOff) { S.sig = sig; S.mesas = r.mesas; paint(); }
      if (DR) return drawerLoad();
    }, function (e) {
      if (/sessao_invalida|restaurante_bloqueado/.test(e.message)) { CFG.expired(); return; }
      S.online = false; if (dot) dot.className = 'dot off';
    });
  }
  function loop() { clearTimeout(timer); if (stopped) return; timer = setTimeout(function () { if (stopped) return; refresh().then(loop, loop); }, d.hidden ? 8000 : 3000); }
  function vis() { if (!d.hidden) refresh(); }
  d.addEventListener('visibilitychange', vis);
  d.addEventListener('pointerdown', unlock);
  var tk = setInterval(function () { if (sndEl) sndEl.textContent = sndLabel(); }, 1000);
  var tk2 = setInterval(function () { if (S.mesas.length) S.sig = ''; }, 60000); // atualiza os minutos das mesas
  shell(); refresh().then(loop, loop);
  return function stop() { stopped = true; clearTimeout(timer); clearInterval(tk); clearInterval(tk2); d.removeEventListener('visibilitychange', vis); d.removeEventListener('pointerdown', unlock); d.title = baseTitle; closeDrawer(); closePicker(); };
}
