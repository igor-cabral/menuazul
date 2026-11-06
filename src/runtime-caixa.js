/* Caixa — abre mesa, acompanha consumo, registra pagamento e encerra (serializado com toString). */
const CAIXA_CSS = `
*{box-sizing:border-box;margin:0}
[hidden]{display:none!important}
body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#f3f4f6;color:#1a1d21;-webkit-font-smoothing:antialiased}
button{font:inherit;color:inherit;cursor:pointer}
input,select{font:inherit;color:inherit}
.login{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.login form{background:#fff;border-radius:18px;padding:28px;width:100%;max-width:360px;display:flex;flex-direction:column;gap:14px;text-align:center;box-shadow:0 6px 30px rgba(0,0,0,.1)}
.login input{font-size:1.6rem;letter-spacing:.4em;text-align:center;padding:12px;border-radius:12px;border:1px solid #cdd1d7;width:100%}
.login .err{color:#c0392b;font-size:.9rem;min-height:1.2em}
.login p{color:#6b7280;font-size:.9rem}
.btn{border:0;border-radius:11px;padding:11px 16px;font-weight:700;background:var(--primary);color:var(--on-primary)}
.btn.sec{background:#e5e7eb;color:#1a1d21}
.btn.dg{background:#fde8e6;color:#b3261e}
.btn.sm{padding:6px 11px;font-size:.84rem;border-radius:8px}
.btn:disabled{opacity:.45;cursor:not-allowed}
.top{display:flex;align-items:center;gap:10px;padding:12px 18px;background:#fff;border-bottom:1px solid #e1e4e8;position:sticky;top:0;z-index:5;flex-wrap:wrap}
.top h1{font-size:1.1rem}
.top .sp{flex:1}
.tabs{display:flex;gap:6px}
.tabs button{border:0;background:none;padding:8px 14px;border-radius:9px;font-weight:600;color:#555}
.tabs button.on{background:var(--primary);color:var(--on-primary)}
.dot{width:10px;height:10px;border-radius:50%;background:#2ecc71;display:inline-block}
.dot.off{background:#e74c3c}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:12px;padding:16px}
.mesa{background:#fff;border:2px solid #e1e4e8;border-radius:16px;padding:14px;text-align:left;display:flex;flex-direction:column;gap:6px;min-height:118px;position:relative}
.mesa.livre{border-style:dashed;color:#6b7280}
.mesa.aberta{border-color:var(--primary)}
.mesa.conta{border-color:#e0a030;background:#fff8e8}
.mesa .nm{font-size:1.3rem;font-weight:800}
.mesa .vl{font-size:1.05rem;font-weight:700}
.mesa .mt{font-size:.82rem;color:#6b7280}
.bdg{display:flex;gap:5px;flex-wrap:wrap;margin-top:auto}
.bdg span{font-size:.74rem;font-weight:700;border-radius:99px;padding:2px 8px;background:#eef0f3}
.bdg .b-conta{background:#f6d38a;color:#5c4000}
.bdg .b-pronto{background:#bfeccf;color:#0b5a2b}
.bdg .b-pend{background:#ffd9d4;color:#8a1f14}
.sum{max-width:560px;margin:20px auto;padding:0 16px;display:flex;flex-direction:column;gap:12px}
.sum .card{background:#fff;border-radius:14px;padding:16px}
.sum h2{font-size:.8rem;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:6px}
.sum .big{font-size:1.8rem;font-weight:800}
.row{display:flex;justify-content:space-between;gap:10px;padding:5px 0}
.ov{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;justify-content:flex-end;z-index:20}
.drawer{background:#fff;width:100%;max-width:480px;height:100%;overflow:auto;padding:18px;display:flex;flex-direction:column;gap:14px}
.dh{display:flex;align-items:center;gap:10px}
.dh h2{font-size:1.4rem;flex:1}
.x{border:0;background:#e5e7eb;width:34px;height:34px;border-radius:50%}
.warn{background:#fff3d6;color:#6b4a00;border-radius:10px;padding:10px 12px;font-weight:600;display:flex;justify-content:space-between;align-items:center;gap:8px}
.sec h3{font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:6px}
.ped{border:1px solid #e1e4e8;border-radius:12px;padding:10px 12px;margin-bottom:8px}
.ped.cx{opacity:.5}
.ped .pt{display:flex;justify-content:space-between;gap:8px;font-weight:700;align-items:center}
.pill{font-size:.72rem;border-radius:99px;padding:2px 9px;font-weight:700;background:#eef0f3}
.pill.novo{background:#ffd9d4}.pill.preparando{background:#fbe6b5}.pill.pronto{background:#bfeccf}.pill.entregue{background:#d9e6ff}
.ped .it{display:flex;justify-content:space-between;gap:8px;font-size:.93rem;padding:2px 0}
.ped small{color:#6b7280;display:block}
.ped .pa{display:flex;gap:6px;margin-top:6px}
.tot{background:#f6f7f9;border-radius:12px;padding:10px 14px}
.tot .row.g{font-weight:800;font-size:1.15rem;border-top:1px solid #dcdfe4;margin-top:4px;padding-top:8px}
.adj{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.adj>*{min-width:0}
label.f input,label.f select{width:100%}
label.f{display:flex;flex-direction:column;gap:4px;font-size:.82rem;color:#555;font-weight:600}
label.f input,label.f select{padding:9px 10px;border:1px solid #cdd1d7;border-radius:9px;font-weight:400}
.pay{border:1px solid #e1e4e8;border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:10px}
.chips{display:flex;gap:6px;flex-wrap:wrap}
.chips button{border:1px solid #cdd1d7;background:#fff;border-radius:99px;padding:4px 11px;font-size:.82rem}
.pg{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 0;border-bottom:1px dashed #dcdfe4;font-size:.93rem}
.err{color:#c0392b;font-size:.88rem;font-weight:600}
.foot{display:flex;gap:8px;flex-wrap:wrap;margin-top:auto;padding-top:8px}
.foot .btn{flex:1}
`;

/* CFG = {api, token, nome, expired(), logout()} — devolve stop() */
function caixaRuntime(app, CFG) {
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
  function money(n) { return Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function num(s) { return parseFloat(String(s).replace(/\./g, '').replace(',', '.')); }
  function inp(n) { return (Math.round(Number(n) * 100) / 100).toFixed(2).replace('.', ','); }
  var METODOS = [['dinheiro', 'Dinheiro'], ['pix', 'Pix'], ['credito', 'Crédito'], ['debito', 'Débito'], ['outro', 'Outro']];
  var token = CFG.token, sound = ls('gc-caixa-sound') === '1';
  var S = { tab: 'mesas', mesas: [], cfg: {}, offset: 0, online: true, sig: '', seen: null, resumo: null, open: null };
  var timer = null, ctx = null, view = null;

  function beep() {
    if (!sound) return;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume();
      var o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 660; o.connect(g); g.connect(ctx.destination);
      var t = ctx.currentTime; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      o.start(t); o.stop(t + 0.42);
    } catch (e) {}
  }
  function mins(iso) { var m = Math.max(0, Math.floor((Date.now() + S.offset - new Date(iso).getTime()) / 60000)); return m < 60 ? m + ' min' : Math.floor(m / 60) + 'h' + (m % 60 < 10 ? '0' : '') + (m % 60); }
  function fail(e) { if (/sessao_invalida|restaurante_bloqueado/.test(e.message)) { CFG.expired(); return; } alert(e.status ? e.message : 'Sem conexão. Tente de novo.'); }

  /* ---------- telas ---------- */
  var body = null, dot = null;
  function shell() {
    app.textContent = '';
    dot = el('span', { class: 'dot' + (S.online ? '' : ' off') });
    var snd = el('button', { class: 'btn sec sm', type: 'button', id: 'snd', text: sound ? '🔔 Som' : '🔕 Som', onclick: function () { sound = !sound; ls('gc-caixa-sound', sound ? '1' : '0'); snd.textContent = sound ? '🔔 Som' : '🔕 Som'; beep(); } });
    var tabs = el('div', { class: 'tabs' }, [['mesas', 'Mesas'], ['resumo', 'Resumo do dia']].map(function (t) {
      return el('button', { type: 'button', class: S.tab === t[0] ? 'on' : '', 'data-tab': t[0], text: t[1], onclick: function () { S.tab = t[0]; shell(); if (t[0] === 'resumo') loadResumo(); else paint(); } });
    }));
    app.appendChild(el('div', { class: 'top' }, [el('h1', { text: '💳 ' + CFG.nome }), dot, tabs, el('span', { class: 'sp' }), snd, el('button', { class: 'btn sec sm', type: 'button', text: 'Sair', onclick: function () { CFG.logout(); } })]));
    body = el('div'); app.appendChild(body);
    if (S.open) { var o = S.open; S.open = null; openDrawer(o); }
  }
  function paint() {
    if (S.tab !== 'mesas' || !body) return;
    body.textContent = '';
    body.appendChild(el('div', { class: 'grid' }, S.mesas.map(function (m) {
      var c = m.comanda, kids;
      if (!c) kids = [el('div', { class: 'nm', text: 'Mesa ' + m.numero }), el('div', { class: 'mt', text: 'Livre' }), el('div', { class: 'bdg' }, [el('span', { text: '＋ Abrir mesa' })])];
      else {
        var b = [];
        if (c.conta_pedida) b.push(el('span', { class: 'b-conta', text: '🔔 Conta pedida' }));
        if (Number(c.prontos)) b.push(el('span', { class: 'b-pronto', text: c.prontos + ' pronto' + (c.prontos > 1 ? 's' : '') }));
        if (Number(c.pendentes)) b.push(el('span', { class: 'b-pend', text: c.pendentes + ' na cozinha' }));
        kids = [el('div', { class: 'nm', text: 'Mesa ' + m.numero }), el('div', { class: 'vl', text: money(c.totais.total) }),
          el('div', { class: 'mt', text: c.clientes + ' pessoa' + (c.clientes == 1 ? '' : 's') + ' · ' + mins(c.aberta_em) }), el('div', { class: 'bdg' }, b)];
      }
      return el('button', { type: 'button', class: 'mesa ' + (!c ? 'livre' : c.conta_pedida ? 'conta' : 'aberta'), 'data-mesa': m.numero, onclick: function () { clickMesa(m); } }, kids);
    })));
    if (!S.mesas.length) body.appendChild(el('p', { class: 'mt', style: 'padding:30px;text-align:center', text: 'Nenhuma mesa cadastrada. Crie as mesas no editor (aba Sistema).' }));
  }
  function clickMesa(m) {
    if (m.comanda) { openDrawer(m.comanda.id); return; }
    api('caixa_abrir_mesa', { p_token: token, p_mesa: m.id }).then(function (r) { refresh().then(function () { openDrawer(r.comanda_id); }); }, fail);
  }
  function loadResumo() {
    api('caixa_resumo', { p_token: token, p_data: null }).then(function (r) {
      S.resumo = r; if (S.tab !== 'resumo' || !body) return; body.textContent = '';
      var por = r.por_metodo || {}, rows = METODOS.filter(function (m) { return por[m[0]] != null; }).map(function (m) { return el('div', { class: 'row' }, [el('span', { text: m[1] }), el('b', { text: money(por[m[0]]) })]); });
      var tk = r.mesas_encerradas ? Number(r.total) / r.mesas_encerradas : 0;
      body.appendChild(el('div', { class: 'sum' }, [
        el('div', { class: 'card' }, [el('h2', { text: 'Recebido hoje' }), el('div', { class: 'big', id: 'sum-total', text: money(r.total) })]),
        el('div', { class: 'card' }, [el('div', { class: 'row' }, [el('span', { text: 'Mesas encerradas' }), el('b', { text: String(r.mesas_encerradas) })]), el('div', { class: 'row' }, [el('span', { text: 'Pedidos' }), el('b', { text: String(r.pedidos) })]), el('div', { class: 'row' }, [el('span', { text: 'Ticket médio por mesa' }), el('b', { text: money(tk) })])]),
        el('div', { class: 'card' }, [el('h2', { text: 'Por forma de pagamento' })].concat(rows.length ? rows : [el('p', { text: 'Sem pagamentos ainda.' })]))
      ]));
    }, fail);
  }

  /* ---------- gaveta da conta ---------- */
  var DR = null;
  function closeDrawer() { if (DR) { DR.ov.remove(); DR = null; } S.open = null; }
  function openDrawer(id) {
    closeDrawer(); S.open = id;
    var ov = el('div', { class: 'ov', id: 'drawer' }), dr = el('div', { class: 'drawer' });
    ov.appendChild(dr); ov.addEventListener('click', function (e) { if (e.target === ov) closeDrawer(); }); d.body.appendChild(ov);
    DR = { ov: ov, dr: dr, id: id, data: null, sig: '', dirty: {} };
    drawerLoad(true);
  }
  function drawerLoad(first) {
    if (!DR) return Promise.resolve();
    var id = DR.id;
    return api('caixa_comanda', { p_token: token, p_comanda: id }).then(function (r) {
      if (!DR || DR.id !== id) return;
      var sig = JSON.stringify(r.comanda) + JSON.stringify(r.pedidos) + JSON.stringify(r.totais) + JSON.stringify(r.pagamentos);
      DR.data = r; S.offset = new Date(r.agora).getTime() - Date.now();
      if (sig !== DR.sig || first) { DR.sig = sig; drawerRender(); }
    }, function (e) { if (/sessao_invalida|restaurante_bloqueado/.test(e.message)) CFG.expired(); else if (/não encontrada/.test(e.message)) closeDrawer(); });
  }
  function reload() { return drawerLoad(true).then(refresh); }

  function drawerRender() {
    var r = DR.data, c = r.comanda, t = r.totais, dr = DR.dr, closed = c.status !== 'aberta';
    // preserva o que está sendo digitado
    var keep = {};
    [].forEach.call(dr.querySelectorAll('input,select'), function (i) { if (i.id) keep[i.id] = { v: i.value, f: d.activeElement === i }; });
    dr.textContent = '';
    dr.appendChild(el('div', { class: 'dh' }, [el('h2', { text: 'Mesa ' + c.mesa }), el('span', { class: 'mt', text: closed ? 'Encerrada' : 'Aberta há ' + mins(c.aberta_em) }), el('button', { class: 'x', type: 'button', 'aria-label': 'Fechar', text: '✕', onclick: closeDrawer })]));
    if (c.conta_pedida && !closed) dr.appendChild(el('div', { class: 'warn' }, [el('span', { text: '🔔 O cliente pediu a conta' }), el('button', { class: 'btn sec sm', type: 'button', text: 'Ok', onclick: function () { api('caixa_limpar_aviso', { p_token: token, p_comanda: c.id }).then(reload, fail); } })]));

    dr.appendChild(el('div', { class: 'sec' }, [el('h3', { text: 'Pessoas na mesa' }), el('div', { class: 'chips' }, r.clientes.length ? r.clientes.map(function (p) { return el('span', { class: 'pill', text: p.nome + ' · ' + money(p.subtotal) }); }) : [el('span', { class: 'mt', text: 'Ninguém entrou ainda' })])]));

    var ps = el('div', { class: 'sec' }, [el('h3', { text: 'Pedidos' })]);
    if (!r.pedidos.length) ps.appendChild(el('p', { class: 'mt', text: 'Nenhum pedido.' }));
    r.pedidos.slice().reverse().forEach(function (p) {
      var acts = [];
      if (!closed && p.status === 'pronto') acts.push(el('button', { class: 'btn sm', type: 'button', text: 'Marcar entregue', onclick: function () { api('pedido_status', { p_token: token, p_pedido: p.id, p_status: 'entregue' }).then(reload, fail); } }));
      if (!closed && (p.status === 'novo' || p.status === 'preparando' || p.status === 'pronto' || p.status === 'entregue') && p.status !== 'cancelado') acts.push(el('button', { class: 'btn dg sm', type: 'button', text: 'Cancelar', onclick: function () { if (confirm('Cancelar o pedido #' + p.numero + '?')) api('pedido_status', { p_token: token, p_pedido: p.id, p_status: 'cancelado' }).then(reload, fail); } }));
      if (!closed && p.status === 'cancelado') acts.push(el('button', { class: 'btn sec sm', type: 'button', text: 'Reabrir', onclick: function () { api('pedido_status', { p_token: token, p_pedido: p.id, p_status: 'novo' }).then(reload, fail); } }));
      ps.appendChild(el('div', { class: 'ped' + (p.status === 'cancelado' ? ' cx' : ''), 'data-ped': p.numero }, [
        el('div', { class: 'pt' }, [el('span', { text: '#' + p.numero + ' · ' + (p.cliente || '—') }), el('span', { class: 'pill ' + p.status, text: p.status })]),
        el('div', {}, p.itens.map(function (i) {
          return el('div', { class: 'it' }, [el('span', {}, [i.qtd + '× ' + i.nome + (i.variante ? ' (' + i.variante + ')' : ''), (i.adicionais && i.adicionais.length) ? el('small', { text: '+ ' + i.adicionais.map(function (a) { return a.l; }).join(', ') }) : null, i.obs ? el('small', { text: 'Obs: ' + i.obs }) : null]), el('span', { text: money(i.preco_unit * i.qtd) })]);
        })),
        p.obs ? el('small', { text: 'Obs: ' + p.obs }) : null, acts.length ? el('div', { class: 'pa' }, acts) : null]));
    });
    dr.appendChild(ps);

    var rows = [el('div', { class: 'row' }, [el('span', { text: 'Consumo' }), el('span', { text: money(t.subtotal) })])];
    if (Number(t.taxa)) rows.push(el('div', { class: 'row' }, [el('span', { text: 'Serviço (' + Number(t.taxa_pct) + '%)' }), el('span', { text: money(t.taxa) })]));
    if (Number(t.desconto)) rows.push(el('div', { class: 'row' }, [el('span', { text: 'Desconto' }), el('span', { text: '− ' + money(t.desconto) })]));
    rows.push(el('div', { class: 'row g' }, [el('span', { text: 'Total' }), el('span', { id: 'd-total', text: money(t.total) })]));
    if (Number(t.pago)) rows.push(el('div', { class: 'row' }, [el('span', { text: 'Pago' }), el('span', { text: money(t.pago) })]));
    rows.push(el('div', { class: 'row g' }, [el('span', { text: 'Falta pagar' }), el('span', { id: 'd-saldo', text: money(t.saldo) })]));
    dr.appendChild(el('div', { class: 'tot' }, rows));

    if (!closed) {
      var taxa = el('input', { id: 'f-taxa', inputmode: 'decimal', value: inp(t.taxa_pct) }), desc = el('input', { id: 'f-desc', inputmode: 'decimal', value: inp(t.desconto) });
      var adjBtn = el('button', { class: 'btn sec sm', id: 'f-adj', type: 'button', text: 'Aplicar', onclick: function () {
        var a = num(taxa.value), b = num(desc.value); if (isNaN(a) || a < 0 || a > 30) { alert('Serviço entre 0 e 30%.'); return; } if (isNaN(b) || b < 0) { alert('Desconto inválido.'); return; }
        delete DR.dirty['f-taxa']; delete DR.dirty['f-desc']; api('caixa_ajustar', { p_token: token, p_comanda: c.id, p_taxa: a, p_desconto: b }).then(reload, fail);
      } });
      dr.appendChild(el('div', { class: 'sec' }, [el('h3', { text: 'Ajustes' }), el('div', { class: 'adj' }, [el('label', { class: 'f' }, ['Serviço (%)', taxa]), el('label', { class: 'f' }, ['Desconto (R$)', desc])]), el('div', { style: 'margin-top:8px' }, [adjBtn])]));

      var metodo = el('select', { id: 'f-met' }, METODOS.map(function (m) { return el('option', { value: m[0], text: m[1] }); }));
      var valor = el('input', { id: 'f-val', inputmode: 'decimal', value: inp(Math.max(0, t.saldo)) });
      var quem = el('input', { id: 'f-quem', maxlength: '40', placeholder: 'Opcional' });
      var perr = el('div', { class: 'err', hidden: true });
      var chips = [];
      if (r.clientes.length > 1 && Number(t.saldo) > 0) {
        chips.push(el('button', { type: 'button', text: 'Dividir por ' + r.clientes.length, onclick: function () { valor.value = inp(Math.min(t.saldo, t.saldo / r.clientes.length)); } }));
        r.clientes.forEach(function (p) {
          chips.push(el('button', { type: 'button', text: 'Parte de ' + p.nome, onclick: function () {
            var share = Number(t.subtotal) ? Number(p.subtotal) / Number(t.subtotal) * Number(t.total) : 0;
            valor.value = inp(Math.min(t.saldo, share)); quem.value = p.nome;
          } }));
        });
      }
      chips.push(el('button', { type: 'button', text: 'Saldo todo', onclick: function () { valor.value = inp(t.saldo); } }));
      var pay = el('button', { class: 'btn', id: 'f-pay', type: 'button', text: 'Registrar pagamento', onclick: function () {
        var v = num(valor.value); perr.hidden = true;
        if (isNaN(v) || v <= 0) { perr.hidden = false; perr.textContent = 'Informe um valor.'; return; }
        pay.disabled = true;
        api('caixa_pagar', { p_token: token, p_comanda: c.id, p_metodo: metodo.value, p_valor: v, p_nome: quem.value }).then(function () { DR.sig = ''; quem.value = ''; delete DR.dirty['f-val']; return reload(); }, function (e) { pay.disabled = false; if (/sessao_invalida|restaurante_bloqueado/.test(e.message)) CFG.expired(); else { perr.hidden = false; perr.textContent = e.message; } });
      } });
      dr.appendChild(el('div', { class: 'sec' }, [el('h3', { text: 'Pagamento' }), el('div', { class: 'pay' }, [
        el('div', { class: 'chips' }, chips), el('div', { class: 'adj' }, [el('label', { class: 'f' }, ['Forma', metodo]), el('label', { class: 'f' }, ['Valor (R$)', valor])]),
        el('label', { class: 'f' }, ['Quem pagou', quem]), perr, pay])]));
    }
    if (r.pagamentos.length) dr.appendChild(el('div', { class: 'sec' }, [el('h3', { text: 'Pagamentos registrados' })].concat(r.pagamentos.map(function (g) {
      var mn = ''; METODOS.forEach(function (m) { if (m[0] === g.metodo) mn = m[1]; });
      return el('div', { class: 'pg' }, [el('span', { text: mn + (g.nome ? ' · ' + g.nome : '') }), el('span', {}, [el('b', { text: money(g.valor) + ' ' }), closed ? null : el('button', { class: 'btn dg sm', type: 'button', text: 'Desfazer', onclick: function () { if (confirm('Desfazer este pagamento?')) api('caixa_desfazer_pagamento', { p_token: token, p_pagamento: g.id }).then(reload, fail); } })])]);
    }))));

    var foot = el('div', { class: 'foot' }, [el('button', { class: 'btn sec', type: 'button', id: 'f-print', text: '🖨 Imprimir conta', onclick: function () { printBill(r); } })]);
    if (!closed) foot.appendChild(el('button', { class: 'btn', id: 'f-close', type: 'button', text: 'Encerrar mesa', disabled: Number(t.saldo) > 0.009, onclick: function () { encerrar(c, false); } }));
    dr.appendChild(foot);
    // restaura o que estava sendo digitado
    for (var k in keep) { var n = d.getElementById(k); if (n && DR.dirty[k]) { n.value = keep[k].v; if (keep[k].f) n.focus(); } }
    [].forEach.call(dr.querySelectorAll('input,select'), function (i) { i.addEventListener('input', function () { DR.dirty[i.id] = 1; }); });
  }
  function encerrar(c, force) {
    if (!force && !confirm('Encerrar a mesa ' + c.mesa + '? Os clientes serão desconectados.')) return;
    api('caixa_encerrar', { p_token: token, p_comanda: c.id, p_forcar: !!force }).then(function () { closeDrawer(); refresh(); }, function (e) {
      if (/pedidos_pendentes/.test(e.message)) { if (confirm('Ainda há pedidos na cozinha. Encerrar mesmo assim? Eles serão cancelados.')) encerrar(c, true); return; }
      fail(e);
    });
  }
  function printBill(r) {
    var t = r.totais, h = '<h2 style="margin:0">' + esc(CFG.nome) + '</h2><p style="margin:4px 0 12px">Mesa ' + esc(r.comanda.mesa) + '</p><hr>';
    r.pedidos.filter(function (p) { return p.status !== 'cancelado'; }).forEach(function (p) {
      p.itens.forEach(function (i) { h += '<div style="display:flex;justify-content:space-between"><span>' + i.qtd + '× ' + esc(i.nome + (i.variante ? ' (' + i.variante + ')' : '')) + '</span><span>' + money(i.preco_unit * i.qtd) + '</span></div>'; });
    });
    h += '<hr><div style="display:flex;justify-content:space-between"><span>Consumo</span><span>' + money(t.subtotal) + '</span></div>';
    if (Number(t.taxa)) h += '<div style="display:flex;justify-content:space-between"><span>Serviço (' + Number(t.taxa_pct) + '%)</span><span>' + money(t.taxa) + '</span></div>';
    if (Number(t.desconto)) h += '<div style="display:flex;justify-content:space-between"><span>Desconto</span><span>− ' + money(t.desconto) + '</span></div>';
    h += '<div style="display:flex;justify-content:space-between;font-weight:bold;font-size:1.2em;margin-top:6px"><span>Total</span><span>' + money(t.total) + '</span></div>';
    var f = d.createElement('iframe'); f.style.cssText = 'position:fixed;width:0;height:0;border:0'; d.body.appendChild(f);
    f.contentDocument.open(); f.contentDocument.write('<html><body style="font:14px monospace;max-width:300px">' + h + '</body></html>'); f.contentDocument.close();
    setTimeout(function () { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) {} setTimeout(function () { f.remove(); }, 1500); }, 100);
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------- polling ---------- */
  function refresh() {
    return api('caixa_mesas', { p_token: token }).then(function (r) {
      S.offset = new Date(r.agora).getTime() - Date.now(); S.cfg = r.config || {};
      var wasOff = !S.online; S.online = true; if (dot) { dot.className = 'dot'; }
      var seen = {}, alert_ = false;
      r.mesas.forEach(function (m) { if (m.comanda) { seen[m.id] = (m.comanda.conta_pedida ? 'c' : '') + m.comanda.prontos; if (S.seen && (S.seen[m.id] === undefined ? false : S.seen[m.id] !== seen[m.id]) && (m.comanda.conta_pedida || Number(m.comanda.prontos))) alert_ = true; } });
      S.seen = seen; if (alert_) beep();
      var sig = JSON.stringify(r.mesas);
      if (sig !== S.sig || wasOff) { S.sig = sig; S.mesas = r.mesas; paint(); }
      if (DR) return drawerLoad(false);
    }, function (e) {
      if (/sessao_invalida|restaurante_bloqueado/.test(e.message)) { CFG.expired(); return; }
      S.online = false; if (dot) dot.className = 'dot off';
    });
  }
  function loop() { clearTimeout(timer); if (stopped) return; timer = setTimeout(function () { if (stopped) return; refresh().then(loop, loop); }, d.hidden ? 8000 : 3000); }
  function start() { shell(); if (S.tab === 'resumo') loadResumo(); refresh().then(loop, loop); }
  function vis() { if (!d.hidden) refresh(); }
  d.addEventListener('visibilitychange', vis);
  var tk = setInterval(function () { if (S.tab === 'mesas' && S.mesas.length) S.sig = ''; }, 60000);
  start();
  return function stop() { stopped = true; clearTimeout(timer); clearInterval(tk); d.removeEventListener('visibilitychange', vis); closeDrawer(); };
}
