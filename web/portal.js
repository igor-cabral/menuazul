/* Aplicação única da plataforma (Cloudflare Workers). Rotas:
   /                 → página inicial
   /admin            → painel do dono da plataforma
   /<slug>           → login e painéis do restaurante (admin, caixa, cozinha)
   /<slug>/<código>  → cardápio da mesa (pedido para a cozinha)
   /<slug>/menu      → cardápio público (sem mesa) */
(function () {
  'use strict';
  const CFG = window.GC_CONFIG || {};
  const BRAND = Object.assign({ name: 'Menu Azul' }, CFG.brand), customLogo = !!BRAND.logo;
  BRAND.logo = BRAND.logo || '/brand/menuazul.png'; BRAND.logoLight = BRAND.logoLight || '/brand/menuazul-claro.png'; BRAND.symbol = BRAND.symbol || '/brand/simbolo-claro.png';
  const root = document.getElementById('root');
  const rpc = makeApi(CFG.supabaseUrl, CFG.supabaseKey);
  const cssPortal = document.getElementById('css-portal'), cssScreen = document.getElementById('css-screen');

  /* ---------- utilidades ---------- */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k in el) el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    kids.flat(Infinity).forEach(c => { if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c)); });
    return el;
  }
  let toastT;
  function toast(msg) {
    let t = document.getElementById('toast');
    if (!t) { t = h('div', { id: 'toast' }); document.body.append(t); }
    t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3500);
  }
  const lsGet = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sem storage */ } };
  const fmtDate = x => x ? new Date(x).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
  const slugify = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  function lum(hex) { const n = parseInt(hex.slice(1), 16), f = c => { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); }; return .2126 * f(n >> 16) + .7152 * f((n >> 8) & 255) + .0722 * f(n & 255); }
  function setColor(cor) {
    if (!/^#[0-9a-f]{6}$/i.test(cor || '')) return;
    const s = document.documentElement.style; s.setProperty('--primary', cor); s.setProperty('--on-primary', lum(cor) > .4 ? '#111' : '#fff');
  }
  function useCss(screen) { cssPortal.disabled = !!screen; cssScreen.textContent = screen || ''; }
  const brandEl = () => h('div', { class: 'brand plat' }, h('img', { src: BRAND.logo, alt: BRAND.name }), customLogo && BRAND.name);
  const topBrand = () => h('a', { class: 'tbrand', href: '/', title: BRAND.name }, h('img', { src: BRAND.logoLight, alt: BRAND.name }));
  const creditEl = () => h('a', { class: 'credit', href: 'https://igorcabral.dev.br', target: '_blank', rel: 'noopener', title: 'igor cabral. design & web' }, h('span', {}, 'Desenvolvido por'), h('img', { src: '/brand/igorcabral-claro.png', alt: 'igor cabral. design & web' }));
  const footEl = () => h('footer', { class: 'foot' }, h('span', { class: 'fb' }, h('img', { src: BRAND.symbol, alt: '' }), BRAND.name + ' · cardápio digital e pedidos por mesa'), creditEl());
  const authWrap = (card, powered) => h('div', { class: 'center' }, h('div', { class: 'stack' }, card, powered && h('div', { class: 'powered' }, 'Plataforma ', h('img', { src: BRAND.logoLight, alt: BRAND.name }))), creditEl());
  function msgPage(title, text) {
    useCss(null); document.title = title + ' — ' + BRAND.name;
    root.replaceChildren(authWrap(h('div', { class: 'card' }, brandEl(), h('h1', {}, title), text && h('p', {}, text))));
  }
  function modal(title, build) {
    const dlg = h('dialog', {});
    const close = () => { dlg.close(); dlg.remove(); };
    dlg.append(h('div', {}, h('div', { class: 'row sb' }, h('h2', {}, title), h('button', { class: 'btn sec sm', onclick: close }, '✕')), build(close)));
    document.body.append(dlg); dlg.showModal(); dlg.addEventListener('cancel', () => dlg.remove());
    return close;
  }
  const field = (label, input) => h('label', { class: 'f' }, label, input);
  const qrSvg = url => { const q = qrcode(0, 'M'); q.addData(url); q.make(); return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); };
  async function copy(text) { try { await navigator.clipboard.writeText(text); toast('Copiado!'); } catch (e) { prompt('Copie o endereço:', text); } }

  /* ---------- roteador ---------- */
  function route() {
    const seg = location.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    if (!/^https?:\/\//.test(CFG.supabaseUrl || '') || /SEU-PROJETO/.test(CFG.supabaseUrl)) return msgPage('Configuração pendente', 'Preencha supabaseUrl e supabaseKey em config.js.');
    if (!seg.length) return home();
    if (seg[0].toLowerCase() === 'admin' && seg.length === 1) return plataforma();
    if (seg.length === 1) return restaurante(seg[0].toLowerCase());
    if (seg.length === 2) return menuPage(seg[0].toLowerCase(), seg[1].toLowerCase() === 'menu' ? null : seg[1].toLowerCase());
    msgPage('Página não encontrada');
  }

  /* ---------- página inicial da plataforma ---------- */
  function home() {
    useCss(null); document.title = BRAND.name + ' — cardápio digital e pedidos por mesa';
    const inp = h('input', { id: 'go-slug', placeholder: 'seu-restaurante', autocapitalize: 'none', autocomplete: 'off', spellcheck: false, 'aria-label': 'Endereço do seu restaurante' });
    const feat = (ico, t, d) => h('div', { class: 'fcard' }, h('div', { class: 'fico' }, ico), h('h3', {}, t), h('p', {}, d));
    root.replaceChildren(
      h('div', { class: 'center hero' }, h('div', { class: 'stack wide' },
        h('img', { class: 'herologo', src: BRAND.logoLight, alt: BRAND.name }),
        h('h1', {}, 'Cardápio digital, pedidos por mesa e caixa em um só lugar'),
        h('p', {}, 'O cliente pede pelo celular, a cozinha recebe e o caixa fecha a conta. Simples assim.'),
        h('form', { class: 'gofrm', onsubmit: e => { e.preventDefault(); const s = slugify(inp.value); if (s) location.href = '/' + s; } },
          h('span', { class: 'pre' }, location.host + '/'), inp, h('button', { class: 'btn', type: 'submit' }, 'Entrar')),
        h('small', {}, 'Digite o endereço do seu restaurante para acessar o painel da equipe.')), creditEl()),
      h('section', { class: 'feat' },
        feat('📱', 'Cardápio por QR Code', 'Cada mesa tem o seu QR. O cliente abre o cardápio no celular e faz o pedido, sem baixar nada.'),
        feat('👨‍🍳', 'Pedido direto na cozinha', 'Os pedidos aparecem na tela da cozinha, organizados por mesa.'),
        feat('💳', 'Caixa e contas por mesa', 'Abra e feche comandas, registre pagamentos e acompanhe o resumo do dia.'),
        feat('✏️', 'Editor de cardápio', 'Edite itens, preços e fotos e publique para os clientes com um clique.')),
      footEl());
  }

  /* ---------- cardápio (mesa ou público) ---------- */
  async function menuPage(slug, codigo) {
    useCss(null); root.replaceChildren(h('div', { class: 'center' }, h('div', { class: 'spin' }), h('p', {}, 'Carregando cardápio…')));
    let r;
    try { r = await rpc('publico_cardapio', { p_slug: slug }); } catch (e) {
      if (/restaurante_inexistente/.test(e.message)) return msgPage('Restaurante não encontrado', 'Confira o endereço ou o QR Code.');
      if (/restaurante_bloqueado/.test(e.message)) return msgPage('Cardápio indisponível', 'Este serviço está temporariamente indisponível.');
      if (/cardapio_nao_publicado/.test(e.message)) return msgPage('Cardápio em breve');
      return msgPage('Sem conexão', 'Não foi possível carregar. Tente de novo.');
    }
    const model = r.modelo, esg = new Set(r.esgotados || []);
    (model.categories || []).forEach(c => (c.items || []).forEach(i => { if (esg.has(i.id)) i.soldOut = true; }));
    if (codigo) { model.options = Object.assign({}, model.options, { cartEnabled: true }); }
    const html = MenuGen.buildSite(model, codigo ? { mesa: { url: CFG.supabaseUrl, key: CFG.supabaseKey, slug: r.slug, codigo } } : {});
    document.open(); document.write(html); document.close();
  }

  /* ---------- restaurante: login + painéis ---------- */
  async function restaurante(slug) {
    let info;
    try { info = await rpc('publico_restaurante', { p_slug: slug }); } catch (e) {
      return e.status ? msgPage('Restaurante não encontrado', 'Confira o endereço.') : msgPage('Sem conexão', 'Tente de novo em instantes.');
    }
    setColor(info.cor);
    if (!info.ativo) return msgPage('Acesso indisponível', info.nome + ' está temporariamente indisponível. Fale com o suporte.');
    const KEY = 'gc-sess:' + info.slug;
    const sess = lsGet(KEY);
    if (sess && new Date(sess.expira_em) > new Date()) return entrar(info, sess, KEY);
    loginView(info, KEY, '');
  }

  function loginView(info, KEY, msg) {
    useCss(null); document.title = 'Entrar — ' + info.nome;
    const user = h('input', { id: 'login', autocomplete: 'username', autocapitalize: 'none', required: true });
    const pass = h('input', { id: 'senha', type: 'password', autocomplete: 'current-password', required: true });
    const err = h('div', { class: 'err' }, msg || ''), go = h('button', { class: 'btn', type: 'submit' }, 'Entrar');
    const form = h('form', { class: 'card', onsubmit: async e => {
      e.preventDefault(); go.disabled = true; err.textContent = '';
      try {
        const r = await rpc('staff_login', { p_slug: info.slug, p_login: user.value, p_senha: pass.value });
        if (!r.ok) { err.textContent = r.erro; go.disabled = false; pass.value = ''; return; }
        const s = { token: r.token, papel: r.papel, usuario: r.usuario, expira_em: r.expira_em };
        lsSet(KEY, s); entrar(info, s, KEY);
      } catch (x) { err.textContent = x.status ? x.message : 'Sem conexão'; go.disabled = false; }
    } },
      h('div', { class: 'brand' }, info.logo && h('img', { src: info.logo, alt: '' }), info.nome),
      h('p', {}, 'Acesso da equipe'), field('Usuário', user), field('Senha', pass), err, go);
    root.replaceChildren(authWrap(form, true)); user.focus();
  }

  let current = null; // tela ativa {stop}
  const unmount = () => { const r = current && current.stop && current.stop(); current = null; document.querySelectorAll('.backpill').forEach(e => e.remove()); return r; }; // stop() pode devolver uma Promise (o editor grava antes de sair)

  function entrar(info, sess, KEY) {
    const sair = async (msg) => { await unmount(); try { await rpc('staff_logout', { p_token: sess.token }); } catch (e) { /* ok */ } lsSet(KEY, null); loginView(info, KEY, msg || ''); };
    const expirou = async () => { await unmount(); lsSet(KEY, null); loginView(info, KEY, 'Sessão expirada ou acesso removido. Entre de novo.'); };
    const call = (n, a) => rpc(n, Object.assign({ p_token: sess.token }, a || {})).catch(e => { if (/sessao_invalida|restaurante_bloqueado/.test(e.message)) expirou(); throw e; });
    const kcfg = { api: rpc, token: sess.token, nome: info.nome, expired: expirou, logout: () => sair() };
    const admin = sess.papel === 'admin';
    const TELAS = admin ? ['mesas', 'caixa', 'cozinha', 'equipe', 'esgotados', 'editor', 'config'] : [sess.papel];

    let seq = 0;
    async function show() {
      const my = ++seq;
      await unmount();
      if (my !== seq) return; // outra navegação chegou enquanto o editor gravava
      let t = location.hash.replace('#/', '');
      if (!TELAS.includes(t)) t = admin ? 'mesas' : sess.papel;
      document.title = info.nome;
      if (t === 'caixa' || t === 'cozinha') {
        useCss(t === 'caixa' ? CAIXA_CSS : KDS_CSS);
        root.replaceChildren(h('div', { id: 'app' }));
        current = { stop: (t === 'caixa' ? caixaRuntime : kdsRuntime)(document.getElementById('app'), kcfg) };
        if (admin) document.body.append(h('a', { class: 'backpill', href: '#/mesas' }, '← Painel'));
        return;
      }
      useCss(null);
      const nav = h('nav', { class: 'nav' }, [['mesas', 'Mesas e QR'], ['caixa', 'Caixa'], ['cozinha', 'Cozinha'], ['equipe', 'Equipe'], ['esgotados', 'Esgotados'], ['editor', 'Editor de cardápio'], ['config', 'Configurações']]
        .map(([k, l]) => h('a', { href: '#/' + k, class: k === t ? 'on' : '' }, l)));
      const body = h('div', { class: t === 'editor' ? 'edwrap' : 'main' });
      root.replaceChildren(h('div', { class: 'top' }, h('img', { class: 'sym', src: BRAND.symbol, alt: BRAND.name }), h('b', {}, info.nome), nav, h('span', { class: 'sp' }), h('span', { class: 'mut' }, sess.usuario.nome), h('button', { class: 'btn sec sm', id: 'sair', onclick: () => sair() }, 'Sair')), body, t !== 'editor' && footEl());
      ({ mesas: pMesas, equipe: pEquipe, config: pConfig, esgotados: pEsgotados, editor: pEditor }[t])(body, call, info, sess);
    }
    window.onhashchange = show; show();
  }

  /* ----- painel: mesas e QR ----- */
  async function pMesas(box, call, info) {
    const draw = async () => {
      let ms; try { ms = await call('admin_mesas'); } catch (e) { return toast(e.message); }
      const urlOf = m => location.origin + '/' + info.slug + '/' + m.codigo;
      const qtd = h('input', { type: 'number', min: 1, max: 100, value: 10, id: 'mesas-qtd', style: 'width:90px' });
      box.replaceChildren(h('div', { class: 'sec' }, h('h2', {}, 'Mesas e QR Codes'),
        h('p', { class: 'mut' }, 'Cada mesa tem um endereço próprio: ' + location.origin + '/' + info.slug + '/código'),
        h('div', { class: 'row' }, qtd, h('button', { class: 'btn', id: 'add-mesas', onclick: async () => { try { await call('admin_criar_mesas', { p_qtd: parseInt(qtd.value, 10) || 1 }); draw(); } catch (e) { toast(e.message); } } }, '+ Criar mesas'),
          h('button', { class: 'btn sec', id: 'print-qr', onclick: () => {
            const ativas = ms.filter(m => m.ativa); if (!ativas.length) return toast('Crie pelo menos uma mesa.');
            const html = MenuGen.buildQrSheet({ nome: info.nome, cor: info.cor }, ativas, urlOf, qrSvg);
            window.open(URL.createObjectURL(new Blob([html], { type: 'text/html' })), '_blank');
          } }, '🖨 Imprimir QR Codes')),
        ms.length ? ms.map(m => {
          const nm = h('input', { type: 'text', value: m.numero, 'aria-label': 'Nome da mesa', onchange: async () => { try { await call('admin_salvar_mesa', { p_id: m.id, p_numero: nm.value.trim(), p_ativa: m.ativa }); draw(); } catch (e) { toast(e.message); nm.value = m.numero; } } });
          const at = h('input', { type: 'checkbox', checked: m.ativa, onchange: async () => { try { await call('admin_salvar_mesa', { p_id: m.id, p_numero: m.numero, p_ativa: at.checked }); draw(); } catch (e) { toast(e.message); at.checked = !at.checked; } } });
          return h('div', { class: 'line', 'data-mesa': m.numero }, h('b', {}, 'Mesa'), nm, h('label', { class: 'row' }, at, 'ativa'), m.aberta && h('span', { class: 'tag ok' }, 'aberta'), h('span', { class: 'g mut' }, '/' + m.codigo),
            h('button', { class: 'btn sec sm', onclick: () => copy(urlOf(m)) }, 'Copiar link'),
            h('button', { class: 'btn sec sm', title: 'O QR impresso deixa de funcionar', onclick: async () => { if (confirm('Gerar um novo código para a mesa ' + m.numero + '? O QR impresso atual deixará de funcionar.')) { try { await call('admin_novo_codigo_mesa', { p_id: m.id }); draw(); } catch (e) { toast(e.message); } } } }, 'Novo código'),
            h('button', { class: 'btn dg sm', onclick: async () => { if (confirm('Apagar a mesa ' + m.numero + '?')) { try { await call('admin_apagar_mesa', { p_id: m.id }); draw(); } catch (e) { toast(e.message); } } } }, 'Apagar'));
        }) : h('p', { class: 'mut' }, 'Nenhuma mesa ainda.')));
    };
    draw();
  }

  /* ----- painel: equipe (reutilizado pelo /admin da plataforma) ----- */
  function equipeUI(listFn, saveFn) {
    const box = h('div', { class: 'sec' });
    const draw = async () => {
      let us; try { us = await listFn(); } catch (e) { return toast(e.message); }
      const login = h('input', { id: 'u-login', placeholder: 'login (minúsculas)', autocapitalize: 'none' }), nome = h('input', { id: 'u-nome', placeholder: 'Nome' }), senha = h('input', { id: 'u-senha', type: 'text', placeholder: 'Senha (6+)' });
      const papel = h('select', { id: 'u-papel' }, [['caixa', 'Caixa'], ['cozinha', 'Cozinha'], ['admin', 'Administrador']].map(([v, l]) => h('option', { value: v }, l)));
      const save = async (u, patch, ok) => { try { await saveFn(Object.assign({ p_id: u.id, p_login: '', p_nome: u.nome, p_papel: u.papel, p_senha: '', p_ativo: u.ativo }, patch)); if (ok) toast(ok); draw(); } catch (e) { toast(e.message); draw(); } };
      box.replaceChildren(h('h2', {}, 'Equipe'),
        ...us.map(u => {
          const pp = h('select', { onchange: () => save(u, { p_papel: pp.value }) }, [['caixa', 'Caixa'], ['cozinha', 'Cozinha'], ['admin', 'Administrador']].map(([v, l]) => h('option', { value: v, selected: v === u.papel }, l)));
          const at = h('input', { type: 'checkbox', checked: u.ativo, onchange: () => save(u, { p_ativo: at.checked }) });
          return h('div', { class: 'line', 'data-login': u.login }, h('span', { class: 'g' }, h('b', {}, u.nome), ' ', h('span', { class: 'mut' }, '@' + u.login)), pp, h('label', { class: 'row' }, at, 'ativo'),
            h('button', { class: 'btn sec sm', onclick: () => { const s = prompt('Nova senha para ' + u.nome + ' (6 a 72 caracteres):'); if (s) save(u, { p_senha: s }, 'Senha alterada'); } }, 'Nova senha'));
        }),
        h('h2', { style: 'margin-top:8px' }, 'Novo usuário'),
        h('div', { class: 'grid3' }, field('Login', login), field('Nome', nome), field('Papel', papel), field('Senha', senha)),
        h('div', {}, h('button', { class: 'btn', id: 'u-add', onclick: async () => {
          try { await saveFn({ p_id: null, p_login: login.value, p_nome: nome.value, p_papel: papel.value, p_senha: senha.value, p_ativo: true }); toast('Usuário criado'); draw(); } catch (e) { toast(e.message); }
        } }, 'Criar usuário')));
    };
    draw(); return box;
  }
  function pEquipe(box, call) { box.replaceChildren(equipeUI(() => call('admin_usuarios'), a => call('admin_usuario_salvar', a))); }

  /* ----- painel: configurações ----- */
  async function pConfig(box, call, info) {
    let c; try { c = await call('admin_config_get'); } catch (e) { return toast(e.message); }
    const taxa = h('input', { id: 'cfg-taxa', value: String(c.taxa_servico).replace('.', ',') }), auto = h('input', { id: 'cfg-auto', type: 'checkbox', checked: c.abertura_automatica });
    const link = (l, p) => h('div', { class: 'line' }, h('span', { class: 'g' }, h('b', {}, l), ' ', h('span', { class: 'mut' }, location.origin + p)), h('button', { class: 'btn sec sm', onclick: () => copy(location.origin + p) }, 'Copiar'));
    box.replaceChildren(
      h('div', { class: 'sec' }, h('h2', {}, 'Configurações'),
        field('Taxa de serviço (%)', taxa),
        h('label', { class: 'row' }, auto, 'Abrir a mesa automaticamente quando o cliente escanear (sem esperar o caixa)'),
        h('div', {}, h('button', { class: 'btn', id: 'cfg-save', onclick: async () => {
          const t = parseFloat(taxa.value.replace(',', '.')); if (isNaN(t) || t < 0 || t > 30) return toast('Taxa entre 0 e 30.');
          try { await call('admin_config_set', { p_taxa: t, p_auto: auto.checked }); toast('Salvo'); } catch (e) { toast(e.message); }
        } }, 'Salvar'))),
      h('div', { class: 'sec' }, h('h2', {}, 'Endereços'), link('Entrada da equipe', '/' + info.slug), link('Cardápio público (sem pedido por mesa)', '/' + info.slug + '/menu'),
        h('p', { class: 'mut' }, 'Cardápio publicado em: ' + fmtDate(c.publicado_em) + '. Para alterar itens e preços, fale com o suporte.')));
  }

  /* ----- painel: itens esgotados ----- */
  async function pEsgotados(box, call) {
    let its; try { its = await call('admin_itens'); } catch (e) { return toast(e.message); }
    box.replaceChildren(h('div', { class: 'sec' }, h('h2', {}, 'Itens esgotados'), h('p', { class: 'mut' }, 'Marque o que acabou: some do pedido na hora.'),
      its.length ? its.map(i => {
        const c = h('input', { type: 'checkbox', checked: i.esgotado, onchange: async () => { try { await call('admin_item_esgotado', { p_item: i.id, p_esgotado: c.checked }); } catch (e) { toast(e.message); c.checked = !c.checked; } } });
        return h('label', { class: 'line', 'data-item': i.id }, c, h('span', { class: 'g' }, i.nome), ' esgotado');
      }) : h('p', { class: 'mut' }, 'Cardápio ainda não publicado.')));
  }

  /* ----- painel: editor de cardápio (editor.html existente, só administradores) ----- */
  async function pEditor(box, call, info, sess) {
    try { await call('admin_usuarios'); } catch (e) { // confirma no servidor que a sessão é de administrador
      if (/sessao_invalida|restaurante_bloqueado/.test(e.message)) return; // call() já levou ao login
      return box.replaceChildren(h('div', { class: 'main' }, h('div', { class: 'sec' }, h('p', { class: 'mut' }, 'Não foi possível verificar o acesso. Tente de novo.'))));
    }
    let html;
    try { const r = await fetch('/editor.html'); html = r.ok ? await r.text() : ''; } catch (e) { html = ''; }
    if (!box.isConnected) return; // o usuário já saiu desta aba durante o carregamento
    if (!/id="view-editor"/.test(html)) return box.replaceChildren(h('div', { class: 'main' }, h('div', { class: 'sec' }, h('p', { class: 'mut' }, 'Não foi possível carregar o editor. Tente de novo.'))));
    const host = { url: CFG.supabaseUrl, key: CFG.supabaseKey, token: sess.token, slug: info.slug, nome: info.nome, site: location.origin }; // o editor publica com a sessão do admin
    html = html.replace('<head>', () => '<head><script>window.MA_HOST=' + JSON.stringify(host).replace(/</g, '\\u003c') + '<\/script>');
    const ifr = h('iframe', { title: 'Editor de cardápio' });
    ifr.srcdoc = html; box.replaceChildren(ifr);
    current = { stop() { // grava o que estiver pendente no editor antes de removê-lo (no máximo 3 s de espera)
      const w = ifr.contentWindow, save = w && w.GC && w.GC.saveNow ? Promise.resolve(w.GC.saveNow()).catch(() => {}) : Promise.resolve();
      return Promise.race([save, new Promise(r => setTimeout(r, 3000))]);
    } };
  }

  /* ---------- /admin: dono da plataforma (Supabase Auth) ---------- */
  function plataforma() {
    useCss(null); document.title = 'Administração — ' + BRAND.name;
    const KEY = 'gc-plat';
    let P = lsGet(KEY);
    const authReq = async (grant, body) => {
      const r = await fetch(CFG.supabaseUrl.replace(/\/+$/, '') + '/auth/v1/token?grant_type=' + grant, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CFG.supabaseKey }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error_description || j.msg || 'Falha no login');
      return { access: j.access_token, refresh: j.refresh_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
    };
    async function fresh() {
      if (!P) throw new Error('sem_sessao');
      if (P.exp - Date.now() < 60000) { try { P = await authReq('refresh_token', { refresh_token: P.refresh }); lsSet(KEY, P); } catch (e) { P = null; lsSet(KEY, null); throw new Error('sem_sessao'); } }
    }
    const papi = makeApi(CFG.supabaseUrl, CFG.supabaseKey, () => P && P.access);
    const call = async (n, a) => {
      try { await fresh(); return await papi(n, a || {}); } catch (e) {
        if (e.message === 'sem_sessao' || e.status === 401) { P = null; lsSet(KEY, null); loginP('Sessão expirada. Entre de novo.'); }
        throw e;
      }
    };
    function loginP(msg) {
      const em = h('input', { id: 'email', type: 'email', autocomplete: 'username', required: true }), pw = h('input', { id: 'senha', type: 'password', autocomplete: 'current-password', required: true });
      const err = h('div', { class: 'err' }, msg || ''), go = h('button', { class: 'btn', type: 'submit' }, 'Entrar');
      root.replaceChildren(authWrap(h('form', { class: 'card', onsubmit: async e => {
        e.preventDefault(); go.disabled = true; err.textContent = '';
        try { P = await authReq('password', { email: em.value.trim(), password: pw.value }); lsSet(KEY, P); inicio(); } catch (x) { err.textContent = /Invalid login/i.test(x.message) ? 'E-mail ou senha incorretos' : x.message; go.disabled = false; }
      } }, brandEl(), h('p', {}, 'Administração da plataforma'), field('E-mail', em), field('Senha', pw), err, go)));
    }
    async function inicio() {
      try { await call('plataforma_eu'); } catch (e) {
        if (/sem_permissao/.test(e.message)) { P = null; lsSet(KEY, null); return loginP('Esta conta não é administradora da plataforma.'); }
        return toast(e.status ? e.message : 'Sem conexão');
      }
      painel();
    }
    async function painel() {
      let rs; try { rs = await call('plataforma_restaurantes'); } catch (e) { return toast(e.message); }
      const nome = h('input', { id: 'r-nome', placeholder: 'Pizzaria Boa' }), slug = h('input', { id: 'r-slug', placeholder: 'pizzaria-boa' }), al = h('input', { id: 'r-alogin', placeholder: 'dono' }), an = h('input', { id: 'r-anome', placeholder: 'Nome do responsável' }), as = h('input', { id: 'r-asenha', placeholder: 'Senha inicial (6+)' });
      let tocou = false; slug.addEventListener('input', () => { tocou = true; }); nome.addEventListener('input', () => { if (!tocou) slug.value = slugify(nome.value); });
      const linha = r => h('tr', { 'data-slug': r.slug },
        h('td', {}, h('b', {}, r.nome), h('br'), h('a', { href: '/' + r.slug, target: '_blank', rel: 'noopener' }, '/' + r.slug)),
        h('td', {}, r.ativo ? h('span', { class: 'tag ok' }, 'Ativo') : h('span', { class: 'tag off', title: r.motivo || '' }, 'Bloqueado')),
        h('td', {}, r.mesas + ' mesas · ' + r.usuarios + ' usuários'), h('td', {}, r.abertas + ' abertas'), h('td', {}, r.pedidos_30d + ' pedidos/30d'), h('td', {}, fmtDate(r.publicado_em)),
        h('td', {}, h('div', { class: 'row' },
          h('button', { class: 'btn sec sm', onclick: () => equipe(r) }, 'Equipe'),
          h('button', { class: 'btn sec sm', onclick: () => editar(r) }, 'Editar'),
          h('button', { class: r.ativo ? 'btn dg sm' : 'btn sm', 'data-acao': 'bloq', onclick: async () => {
            let motivo = '';
            if (r.ativo) { motivo = prompt('Bloquear ' + r.nome + '? Todos perdem o acesso na hora.\nMotivo (opcional):'); if (motivo === null) return; }
            try { await call('plataforma_salvar_restaurante', { p_id: r.id, p_nome: r.nome, p_slug: r.slug, p_ativo: !r.ativo, p_motivo: motivo }); toast(r.ativo ? 'Bloqueado' : 'Desbloqueado'); painel(); } catch (e) { toast(e.message); }
          } }, r.ativo ? 'Bloquear' : 'Desbloquear'))));
      root.replaceChildren(
        h('div', { class: 'top' }, topBrand(), h('b', { class: 'tag-adm' }, 'Administração'), h('span', { class: 'sp' }), h('button', { class: 'btn sec sm', id: 'sair', onclick: () => { P = null; lsSet(KEY, null); loginP(''); } }, 'Sair')),
        h('div', { class: 'main' },
          h('div', { class: 'sec' }, h('h2', {}, 'Novo restaurante'),
            h('div', { class: 'grid3' }, field('Nome', nome), field('Endereço (slug)', slug), field('Login do responsável', al), field('Nome do responsável', an), field('Senha inicial', as)),
            h('p', { class: 'mut' }, 'Ficará em ' + location.origin + '/' + (slug.value || 'endereço')), 
            h('div', {}, h('button', { class: 'btn', id: 'r-criar', onclick: async () => {
              try { await call('plataforma_criar_restaurante', { p_slug: slug.value, p_nome: nome.value, p_admin_login: al.value, p_admin_nome: an.value, p_admin_senha: as.value }); toast('Restaurante criado'); painel(); } catch (e) { toast(e.message); }
            } }, 'Criar restaurante'))),
          h('div', { class: 'sec' }, h('h2', {}, 'Restaurantes (' + rs.length + ')'),
            rs.length ? h('div', { class: 'tscroll' }, h('table', {}, h('thead', {}, h('tr', {}, ['Restaurante', 'Status', 'Estrutura', 'Agora', 'Uso', 'Cardápio publicado', ''].map(x => h('th', {}, x)))), h('tbody', {}, rs.map(linha)))) : h('p', { class: 'mut' }, 'Nenhum restaurante ainda.'))));
      root.append(footEl());
    }
    function editar(r) {
      const nome = h('input', { id: 'e-nome', value: r.nome }), slug = h('input', { id: 'e-slug', value: r.slug });
      modal('Editar ' + r.nome, close => h('div', { class: 'main', style: 'margin:0;padding:0' },
        field('Nome', nome), field('Endereço (slug)', slug), h('p', { class: 'mut' }, '⚠ Mudar o endereço invalida os QR Codes já impressos.'),
        h('div', {}, h('button', { class: 'btn', id: 'e-save', onclick: async () => {
          try { await call('plataforma_salvar_restaurante', { p_id: r.id, p_nome: nome.value, p_slug: slug.value, p_ativo: r.ativo, p_motivo: r.motivo || '' }); close(); toast('Salvo'); painel(); } catch (e) { toast(e.message); }
        } }, 'Salvar'))));
    }
    function equipe(r) {
      modal('Equipe — ' + r.nome, () => equipeUI(() => call('plataforma_usuarios', { p_rest: r.id }), a => call('plataforma_usuario_salvar', Object.assign({ p_rest: r.id }, a))));
    }
    if (P) inicio(); else loginP('');
  }

  route();
})();
