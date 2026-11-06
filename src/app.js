/* ===== Gerador de Cardápios — editor ===== */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);

  /* ---------- DOM helper ---------- */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k in el) el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    kids.flat(Infinity).forEach(c => { if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c)); });
    return el;
  }
  const getp = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const setp = (o, p, v) => { const ks = p.split('.'); const l = ks.pop(); ks.reduce((a, k) => a[k], o)[l] = v; };
  const move = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return false; [arr[i], arr[j]] = [arr[j], arr[i]]; return true; };
  const clone = o => JSON.parse(JSON.stringify(o));
  const hash = s => { let x = 5381; for (let i = 0; i < s.length; i++) x = ((x << 5) + x + s.charCodeAt(i)) | 0; return x + ':' + s.length; };

  /* ---------- estado ---------- */
  const HOST = window.MA_HOST || null; // definido pelo painel do restaurante (editor embutido): {url, key, token, slug, nome, site}
  let cur = null;
  const ui = { tab: 'marca', expanded: new Set(), closed: new Set(), device: 'mobile', focusId: null };

  /* ---------- armazenamento (IndexedDB, com fallback em memória) ---------- */
  const mem = new Map(), memH = {};
  const DB = {
    _db: null, broken: false,
    open() {
      if (this._db) return Promise.resolve(this._db);
      return new Promise((res, rej) => {
        try {
          const r = indexedDB.open('gerador-cardapios', 2);
          r.onupgradeneeded = () => {
            const db = r.result;
            if (!db.objectStoreNames.contains('restaurants')) db.createObjectStore('restaurants', { keyPath: 'id' });
            if (!db.objectStoreNames.contains('handles')) db.createObjectStore('handles');
          };
          r.onsuccess = () => { this._db = r.result; res(r.result); };
          r.onerror = () => rej(r.error);
        } catch (e) { rej(e); }
      });
    },
    async tx(store, mode, fn) {
      if (this.broken) { const q = fn(null); return q && q.result; }
      let db;
      try { db = await this.open(); } catch (e) { this.broken = true; toast('⚠ Sem armazenamento local — use o Backup .json'); const q = fn(null); return q && q.result; }
      return new Promise((res, rej) => {
        const t = db.transaction(store, mode);
        const rq = fn(t.objectStore(store));
        t.oncomplete = () => res(rq && rq.result);
        t.onerror = t.onabort = () => rej(t.error);
      });
    },
    all() { return this.tx('restaurants', 'readonly', s => s ? s.getAll() : { result: [...mem.values()] }); },
    get(id) { return this.tx('restaurants', 'readonly', s => s ? s.get(id) : { result: mem.get(id) }); },
    put(o) { return this.tx('restaurants', 'readwrite', s => { if (s) return s.put(o); mem.set(o.id, o); return {}; }); },
    del(id) { return this.tx('restaurants', 'readwrite', s => { if (s) return s.delete(id); mem.delete(id); return {}; }); },
    clearRestaurants() { return this.tx('restaurants', 'readwrite', s => { if (s) return s.clear(); mem.clear(); return {}; }); },
    getHandle() { return this.tx('handles', 'readonly', s => s ? s.get('root') : { result: memH.root }); },
    putHandle(hd) { return this.tx('handles', 'readwrite', s => { if (s) return s.put(hd, 'root'); memH.root = hd; return {}; }); },
    delHandle() { return this.tx('handles', 'readwrite', s => { if (s) return s.delete('root'); delete memH.root; return {}; }); }
  };

  /* ---------- feedback ---------- */
  let toastT;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3600);
  }
  const setStatus = s => { $('#status').textContent = s; };

  /* ---------- arquivos do site (ZIP e pasta usam o mesmo conjunto) ---------- */
  const EXT = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/svg+xml': 'svg', 'image/gif': 'gif' };
  const MIME = { webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', svg: 'image/svg+xml', gif: 'image/gif' };

  function makeResolver() {
    const map = new Map(), used = new Set();
    const fn = (dataUrl, name) => {
      if (!/^data:/.test(dataUrl)) return dataUrl; // já é um endereço (foto que está online)
      if (map.has(dataUrl)) return map.get(dataUrl).path;
      const m = /^data:([^;,]+)[;,]/.exec(dataUrl) || [];
      const ext = EXT[m[1]] || 'img';
      let p = 'assets/' + name + '.' + ext, n = 2;
      while (used.has(p)) p = 'assets/' + name + '-' + (n++) + '.' + ext;
      used.add(p); map.set(dataUrl, { path: p, b64: dataUrl.split(',')[1] });
      return p;
    };
    fn.files = () => [...map.values()];
    return fn;
  }
  function liteClone(data, resolve) {
    const c = clone(data);
    if (c.logo) c.logo = resolve(c.logo, 'logo');
    if (c.hero) c.hero = resolve(c.hero, 'hero');
    c.categories.forEach(cat => cat.items.forEach(it => { if (it.image) it.image = resolve(it.image, 'produtos/' + MenuGen.slugify(it.name)); }));
    return c;
  }
  function readme(r) {
    return 'Cardápio digital — ' + r.name + '\n' + '='.repeat(30) + '\n\n' +
      'Esta pasta é um site estático pronto para publicar.\n\n' +
      'GitHub Pages:\n' +
      '  1. Coloque estes arquivos na raiz do repositório (index.html fica na raiz)\n' +
      '  2. git add . && git commit -m "Atualiza cardápio" && git push\n' +
      '  3. Settings > Pages > Deploy from a branch > main / (root)\n\n' +
      'Também funciona em Netlify, Vercel e Cloudflare Pages (arraste a pasta).\n\n' +
      'Para editar depois: no Gerador de Cardápios conecte a pasta (ou use "Importar" no ZIP).\n' +
      'O arquivo cardapio.json guarda todos os dados do projeto — não apague.\n';
  }
  function collectFiles(r) {
    const resolve = makeResolver();
    const html = MenuGen.buildSite(r, { resolveImg: resolve });
    const lite = liteClone(r, resolve);
    const files = [
      { path: 'index.html', text: html },
      { path: 'cardapio.json', text: JSON.stringify(lite, null, 2) },
      { path: 'README.txt', text: readme(r) },
      { path: '.nojekyll', text: '' }
    ];
    if (r.options.domain && r.options.domain.trim()) files.push({ path: 'CNAME', text: r.options.domain.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '') + '\n' });
    resolve.files().forEach(f => files.push({ path: f.path, b64: f.b64 }));
    return files;
  }
  async function makeZip(r) {
    const zip = new JSZip();
    collectFiles(r || cur).forEach(f => f.b64 != null ? zip.file(f.path, f.b64, { base64: true }) : zip.file(f.path, f.text));
    return zip;
  }
  function download(blob, name) {
    const a = h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  async function hydrate(data, readB64) {
    const load = async p => {
      if (!p || /^data:/.test(p)) return p || null;
      const b = await readB64(p); if (!b) return null;
      return 'data:' + (MIME[p.split('.').pop().toLowerCase()] || 'image/jpeg') + ';base64,' + b;
    };
    data.logo = await load(data.logo); data.hero = await load(data.hero);
    for (const c of data.categories || []) for (const i of c.items || []) i.image = await load(i.image);
    return data;
  }

  /* ---------- pasta do computador (File System Access API) ---------- */
  const FS = { supported: typeof window.showDirectoryPicker === 'function', root: null, name: '', state: 'off', sig: new Map() };

  function updateFsUi() {
    const b = $('#btn-folder');
    b.hidden = !FS.supported;
    b.classList.toggle('warn', FS.state === 'need' || FS.state === 'err');
    b.textContent = { off: '📁 Conectar pasta', on: '📁 ' + FS.name, need: '📁 Reconectar pasta', err: '⚠ Pasta sem acesso' }[FS.state];
    b.title = { off: 'Salvar cada restaurante numa pasta do computador', on: 'Pasta conectada — clique para opções', need: 'Clique para autorizar o acesso à pasta de novo', err: 'Não foi possível gravar na pasta — clique para reconectar' }[FS.state];
  }
  async function fsPerm(ask) {
    const root = FS.root;
    if (!root || !root.queryPermission) return !!root;
    const o = { mode: 'readwrite' };
    let p = await root.queryPermission(o);
    if (p !== 'granted' && ask) p = await root.requestPermission(o);
    return p === 'granted';
  }
  async function fsCheck(ask) {
    FS.state = (await fsPerm(ask)) ? 'on' : 'need';
    updateFsUi();
    return FS.state === 'on';
  }
  async function fsInit() {
    updateFsUi();
    if (!FS.supported) return;
    try {
      const hd = await DB.getHandle();
      if (!hd) return;
      FS.root = hd; FS.name = hd.name;
      await fsCheck(false);
    } catch (e) { /* sem pasta */ }
  }
  async function dirAt(root, parts, create) {
    let d = root;
    for (const p of parts) d = await d.getDirectoryHandle(p, { create: !!create });
    return d;
  }
  async function writeFileIn(dir, path, content) {
    const parts = path.split('/'), file = parts.pop();
    const d = await dirAt(dir, parts, true);
    const fh = await d.getFileHandle(file, { create: true });
    const w = await fh.createWritable();
    await w.write(content); await w.close();
  }
  function b64ToBytes(b64) {
    const bin = atob(b64), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  }
  async function readFromDir(dir, path) {
    try {
      const parts = path.split('/'), file = parts.pop();
      const fh = await (await dirAt(dir, parts)).getFileHandle(file);
      const blob = await fh.getFile();
      return await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = () => res(null); fr.readAsDataURL(blob); });
    } catch (e) { return null; }
  }
  async function pickFolder(r) {
    const base = MenuGen.slugify(r.name);
    for (let n = 1; n < 200; n++) {
      const name = n === 1 ? base : base + '-' + n;
      let dh;
      try { dh = await FS.root.getDirectoryHandle(name); } catch (e) { if (e.name === 'NotFoundError') return name; continue; }
      try { const j = JSON.parse(await (await (await dh.getFileHandle('cardapio.json')).getFile()).text()); if (j.id === r.id) return name; } catch (e) { /* ocupada */ }
    }
    return base + '-' + Date.now();
  }
  async function cleanAssets(dir, keep, prefix) {
    const stale = [];
    for await (const [name, hd] of dir.entries()) {
      const p = prefix + name;
      if (hd.kind === 'directory') await cleanAssets(hd, keep, p + '/');
      else if (!keep.has(p)) stale.push(name);
    }
    for (const n of stale) await dir.removeEntry(n);
  }
  async function fsWriteSnap(snap) {
    if (FS.state !== 'on' || !snap.folder) return;
    const dir = await FS.root.getDirectoryHandle(snap.folder, { create: true });
    const files = collectFiles(snap);
    for (const f of files) {
      const sk = snap.folder + '/' + f.path, sg = hash(f.b64 != null ? f.b64 : f.text);
      if (FS.sig.get(sk) === sg) continue;
      await writeFileIn(dir, f.path, f.b64 != null ? b64ToBytes(f.b64) : f.text);
      FS.sig.set(sk, sg);
    }
    try {
      const assets = await dir.getDirectoryHandle('assets');
      await cleanAssets(assets, new Set(files.filter(f => f.b64 != null).map(f => f.path.slice(7))), '');
    } catch (e) { /* sem assets */ }
  }
  let fsPending = null, fsChain = Promise.resolve();
  function fsQueue(snap) {
    fsPending = snap;
    fsChain = fsChain.then(async () => {
      const s = fsPending; if (!s) return; fsPending = null;
      try { await fsWriteSnap(s); }
      catch (e) { FS.state = 'err'; updateFsUi(); toast('⚠ Não consegui gravar na pasta: ' + (e && e.message)); }
    });
    return fsChain;
  }
  async function fsScan() {
    const out = [];
    for await (const [name, hd] of FS.root.entries()) {
      if (hd.kind !== 'directory' || name.startsWith('.')) continue;
      try {
        const data = JSON.parse(await (await (await hd.getFileHandle('cardapio.json')).getFile()).text());
        if (data && data.id && Array.isArray(data.categories)) out.push({ name, dir: hd, data });
      } catch (e) { /* não é um projeto */ }
    }
    return out;
  }
  async function fsSyncAll() {
    const res = { pulled: 0, pushed: 0 };
    if (FS.state !== 'on') return res;
    FS.sig.clear();
    const found = await fsScan();
    const local = new Map((await DB.all()).map(r => [r.id, r]));
    const byId = new Map(found.map(f => [f.data.id, f]));
    for (const f of found) {
      const l = local.get(f.data.id);
      if (cur && cur.id === f.data.id) continue;
      if (!l || (f.data.updatedAt || 0) > (l.updatedAt || 0)) {
        const r = MenuGen.normalize(await hydrate(f.data, p => readFromDir(f.dir, p)));
        r.folder = f.name; await DB.put(r); local.set(r.id, r); res.pulled++;
      }
    }
    for (const r of local.values()) {
      const f = byId.get(r.id);
      if (f && (r.updatedAt || 0) <= (f.data.updatedAt || 0)) { if (r.folder !== f.name) { r.folder = f.name; await DB.put(r); } continue; }
      if (cur && cur.id === r.id) continue;
      r.folder = f ? f.name : (r.folder && !f ? r.folder : '');
      if (!r.folder) r.folder = await pickFolder(r);
      await DB.put(r);
      await fsQueue(clone(r)); res.pushed++;
    }
    return res;
  }
  async function afterFsReady(verb) {
    try {
      const r = await fsSyncAll();
      toast((verb || 'Pasta pronta') + ' · ' + r.pulled + ' carregado(s) da pasta, ' + r.pushed + ' salvo(s) nela');
    } catch (e) { toast('Erro ao sincronizar: ' + e.message); }
    if (!$('#view-home').hidden) showHome();
  }
  async function fsConnect() {
    const hd = await window.showDirectoryPicker({ mode: 'readwrite', id: 'gerador-cardapios' });
    FS.root = hd; FS.name = hd.name; FS.sig.clear();
    await DB.putHandle(hd);
    FS.state = 'on'; updateFsUi();
    await afterFsReady('Pasta conectada');
  }
  async function fsDisconnect() {
    await DB.delHandle(); FS.root = null; FS.name = ''; FS.state = 'off'; FS.sig.clear(); updateFsUi();
    toast('Pasta desconectada (os arquivos continuam lá)');
  }
  function folderMenu() {
    dialog(close => [
      h('h2', {}, '📁 Pasta conectada'),
      h('p', { class: 'muted' }, 'Pasta: ' + FS.name + '. Cada restaurante é salvo em uma subpasta pronta para publicar (index.html, assets/ e cardapio.json). Ao reabrir o editor, os projetos são lidos de lá.'),
      h('div', { class: 'bar' },
        h('button', { class: 'btn', type: 'button', onclick: () => close(null) }, 'Fechar'),
        h('button', { class: 'btn danger', type: 'button', onclick: async () => { close(null); await fsDisconnect(); } }, 'Desconectar'),
        h('button', { class: 'btn', type: 'button', onclick: async () => { close(null); try { await fsConnect(); } catch (e) { if (e.name !== 'AbortError') toast('Pasta: ' + e.message); } } }, 'Trocar pasta'),
        h('button', { class: 'btn primary', type: 'button', onclick: async () => { close(null); await afterFsReady('Sincronizado'); } }, 'Sincronizar agora'))
    ]);
  }
  async function onFolderClick() {
    try {
      if (FS.state === 'off') return await fsConnect();
      if (FS.state === 'need' || FS.state === 'err') {
        if (await fsCheck(true)) return await afterFsReady('Pasta reconectada');
        return await fsConnect();
      }
      folderMenu();
    } catch (e) { if (e.name !== 'AbortError') toast('Pasta: ' + (e.message || e)); }
  }

  /* ---------- salvar / preview ---------- */
  let saveT, prevT;
  function changed() {
    if (!cur) return;
    cur.updatedAt = Date.now();
    setStatus('Salvando…');
    clearTimeout(prevT); prevT = setTimeout(updatePreview, 180);
    clearTimeout(saveT); saveT = setTimeout(saveNow, 500);
  }
  async function saveNow() {
    if (!cur) return;
    clearTimeout(saveT);
    try {
      if (FS.state === 'on' && !cur.folder) cur.folder = await pickFolder(cur);
      const snap = clone(cur);
      await DB.put(snap);
      const hora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      if (FS.state === 'on') { await fsQueue(snap); setStatus('Salvo às ' + hora + (FS.state === 'on' ? ' · 📁 pasta' : ' · ⚠ pasta')); }
      else setStatus('Salvo às ' + hora);
      if (HOST) { hostStatus(); setStatus($('#status').textContent + (hostDirty() ? ' · não publicado' : ' · publicado')); }
    } catch (e) { setStatus('⚠ Erro ao salvar'); toast('Erro ao salvar: ' + (e && e.message)); }
  }
  function updatePreview() {
    if (!cur) return;
    const f = $('#preview');
    let sy = 0; try { sy = f.contentWindow.scrollY; } catch (e) {}
    f.onload = () => { try { f.contentWindow.scrollTo(0, sy); } catch (e) {} };
    f.srcdoc = MenuGen.buildSite(cur, {});
  }

  /* ---------- imagens ---------- */
  const canWebp = (() => { try { return document.createElement('canvas').toDataURL('image/webp').indexOf('data:image/webp') === 0; } catch (e) { return false; } })();
  async function fileToDataURL(file, o) {
    const { max = 800, quality = 0.82, alpha = false } = o || {};
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Não consegui abrir essa imagem')); i.src = url; });
      let w = img.naturalWidth, hh = img.naturalHeight;
      if (!w || !hh) { w = hh = 512; }
      const s = Math.min(1, max / Math.max(w, hh));
      w = Math.max(1, Math.round(w * s)); hh = Math.max(1, Math.round(hh * s));
      const c = document.createElement('canvas'); c.width = w; c.height = hh;
      const ctx = c.getContext('2d');
      if (!alpha) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, hh); }
      ctx.drawImage(img, 0, 0, w, hh);
      const type = canWebp ? 'image/webp' : (alpha ? 'image/png' : 'image/jpeg');
      return c.toDataURL(type, quality);
    } finally { URL.revokeObjectURL(url); }
  }
  function dropTarget(el, take) {
    ['dragenter', 'dragover'].forEach(ev => el.addEventListener(ev, e => { e.preventDefault(); el.classList.add('drag'); }));
    ['dragleave', 'drop'].forEach(ev => el.addEventListener(ev, e => { e.preventDefault(); el.classList.remove('drag'); }));
    el.addEventListener('drop', e => take(e.dataTransfer.files && e.dataTransfer.files[0]));
  }

  /* ---------- componentes de formulário ---------- */
  const section = t => h('div', { class: 'h' }, t);

  function textField(label, path, o) {
    o = o || {};
    const input = o.multiline ? h('textarea', { rows: o.rows || 3, placeholder: o.placeholder || '' }) : h('input', { type: 'text', placeholder: o.placeholder || '', inputMode: o.inputMode || '' });
    input.value = getp(cur, path) || '';
    input.addEventListener('input', () => { setp(cur, path, input.value); if (o.onInput) o.onInput(); changed(); });
    return h('label', { class: 'f' }, h('span', { class: 'f-l' }, label), input, o.hint && h('small', {}, o.hint));
  }
  function checkField(label, path, hint) {
    const c = h('input', { type: 'checkbox', checked: !!getp(cur, path) });
    c.addEventListener('change', () => { setp(cur, path, c.checked); changed(); });
    return h('label', { class: 'chk' }, c, h('span', {}, label, hint && h('small', {}, hint)));
  }
  function selectField(label, path, opts) {
    const s = h('select', {}, opts.map(([v, l]) => h('option', { value: v, selected: getp(cur, path) === v }, l)));
    s.addEventListener('change', () => { setp(cur, path, s.value); changed(); });
    return h('label', { class: 'f' }, h('span', { class: 'f-l' }, label), s);
  }
  function choiceField(label, path, choices) {
    const box = h('div', { class: 'layouts' });
    choices.forEach(([k, l, s]) => {
      box.append(h('button', {
        type: 'button', class: 'lay' + (getp(cur, path) === k ? ' on' : ''),
        onclick: () => { setp(cur, path, k); [...box.children].forEach((x, i) => x.classList.toggle('on', choices[i][0] === k)); changed(); }
      }, l, s && h('small', {}, s)));
    });
    return h('div', { class: 'f' }, h('span', { class: 'f-l' }, label), box);
  }
  function rangeField(label, path, min, max, unit) {
    const out = h('output', {}, getp(cur, path) + unit);
    const r = h('input', { type: 'range', min, max, step: 1, value: getp(cur, path) });
    r.addEventListener('input', () => { setp(cur, path, +r.value); out.textContent = r.value + unit; changed(); });
    return h('label', { class: 'f' }, h('span', { class: 'f-l' }, label), h('div', { class: 'range' }, r, out));
  }
  function colorField(label, path) {
    const i = h('input', { type: 'color', value: getp(cur, path) });
    i.addEventListener('input', () => { setp(cur, path, i.value); changed(); });
    return h('label', {}, label, i);
  }
  function imageField(label, get, set, o) {
    o = o || {};
    const box = h('div', {});
    const input = h('input', { type: 'file', accept: 'image/*', hidden: true });
    input.addEventListener('click', e => e.stopPropagation());
    async function take(file) {
      if (!file || !/^image\//.test(file.type)) return;
      try { set(await fileToDataURL(file, o)); draw(); changed(); } catch (e) { toast(e.message); }
      input.value = '';
    }
    input.addEventListener('change', () => take(input.files[0]));
    function draw() {
      const v = get();
      const prev = h('div', { class: 'imgf-prev' + (o.round ? ' round' : ''), title: 'Clique ou arraste uma imagem', onclick: () => input.click() }, v ? h('img', { src: v, alt: '' }) : h('span', {}, '+ imagem'));
      dropTarget(prev, take);
      box.replaceChildren(prev, h('div', { class: 'imgf-act' },
        h('button', { class: 'btn sm', onclick: () => input.click() }, v ? 'Trocar' : 'Escolher'),
        v && h('button', { class: 'btn sm ghost', onclick: () => { set(null); draw(); changed(); } }, 'Remover')), input);
    }
    draw();
    return h('div', { class: 'f' }, h('span', { class: 'f-l' }, label), box);
  }
  function bindInput(obj, key, attrs) {
    const i = h('input', Object.assign({ type: 'text' }, attrs));
    i.value = obj[key] == null ? '' : obj[key];
    i.addEventListener('input', () => { obj[key] = i.value; changed(); });
    return i;
  }

  /* ---------- painel: Marca ---------- */
  function panelBrand() {
    const themes = h('div', { class: 'themes' }, MenuGen.THEMES.map(th => h('button', {
      type: 'button', class: 'theme', title: th.desc,
      onclick: () => { Object.assign(cur.theme, th.t); changed(); renderPanel(true); }
    }, h('i', {}, [th.t.primary, th.t.bg, th.t.surface, th.t.text].map(c => h('b', { style: 'background:' + c }))), h('span', {}, h('b', {}, th.name), h('small', {}, th.desc)))));

    const presets = h('div', { class: 'presets' }, MenuGen.PRESETS.map(p => h('button', {
      type: 'button', class: 'preset', title: 'Aplicar paleta ' + p.name, onclick: () => { Object.assign(cur.theme, p.t); changed(); renderPanel(true); }
    }, h('i', {}, [p.t.primary, p.t.bg, p.t.surface, p.t.text].map(c => h('b', { style: 'background:' + c }))), p.name)));

    const fonts = MenuGen.FONTS.map(f => [f, f]);
    return h('div', { class: 'pin' },
      textField('Nome do restaurante', 'name', { onInput: () => { $('#cur-name').textContent = cur.name; } }),
      textField('Slogan / subtítulo', 'slogan', { placeholder: 'Ex.: Hambúrguer artesanal desde 2015' }),
      h('div', { class: 'two' },
        imageField('Logo', () => cur.logo, v => { cur.logo = v; }, { max: 400, alpha: true, round: true }),
        imageField('Capa (hero)', () => cur.hero, v => { cur.hero = v; }, { max: 1600 })),
      rangeField('Escurecer a capa', 'theme.heroOverlay', 0, 80, '%'),
      section('Temas prontos'), themes,
      section('Estilo'),
      choiceField('Cabeçalho', 'theme.header', [['center', 'Centralizado', 'logo sobre a capa'], ['left', 'À esquerda', 'logo e texto'], ['overlay', 'Capa cheia', 'nome sobre a foto'], ['compact', 'Compacto', 'faixa baixa']]),
      choiceField('Produtos', 'theme.layout', [['list', 'Lista', 'foto ao lado'], ['grid', 'Grade', 'cards com foto'], ['text', 'Só texto', 'sem fotos']]),
      choiceField('Cartões', 'theme.cardStyle', [['border', 'Contorno'], ['shadow', 'Sombra'], ['flat', 'Chapado']]),
      choiceField('Títulos de categoria', 'theme.catStyle', [['plain', 'Simples'], ['bar', 'Barra'], ['center', 'Centralizado']]),
      rangeField('Arredondamento dos cantos', 'theme.radius', 0, 28, 'px'),
      section('Cores'), presets,
      h('div', { class: 'colors' }, colorField('Destaque', 'theme.primary'), colorField('Fundo', 'theme.bg'), colorField('Cartões', 'theme.surface'), colorField('Texto', 'theme.text')),
      section('Tipografia'),
      h('div', { class: 'two' }, selectField('Títulos', 'theme.fontHeading', fonts), selectField('Textos', 'theme.fontBody', fonts)));
  }

  /* ---------- painel: Contato ---------- */
  function scheduleEditor() {
    const names = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const sch = cur.contact.schedule;
    const box = h('div', { class: 'sched' });
    [1, 2, 3, 4, 5, 6, 0].forEach(d => {
      const s = sch[d];
      const chk = h('input', { type: 'checkbox', checked: !!s.open });
      const from = h('input', { type: 'time', value: s.from, disabled: !s.open });
      const to = h('input', { type: 'time', value: s.to, disabled: !s.open });
      chk.addEventListener('change', () => { s.open = chk.checked; from.disabled = to.disabled = !s.open; changed(); });
      from.addEventListener('input', () => { s.from = from.value; changed(); });
      to.addEventListener('input', () => { s.to = to.value; changed(); });
      box.append(h('div', { class: 'srow' }, h('label', { class: 'sday' }, chk, names[d]), from, h('span', { class: 'muted' }, 'às'), to));
    });
    const quick = h('div', { class: 'tools' },
      h('button', { class: 'btn sm', type: 'button', onclick: () => { sch.forEach(s => { s.open = true; }); changed(); renderPanel(true); } }, 'Todos os dias'),
      h('button', { class: 'btn sm', type: 'button', onclick: () => { sch.forEach((s, i) => { s.open = i >= 1 && i <= 5; }); changed(); renderPanel(true); } }, 'Seg a Sex'),
      h('button', { class: 'btn sm', type: 'button', title: 'Usa o horário do primeiro dia marcado em todos os outros', onclick: () => {
        const first = [1, 2, 3, 4, 5, 6, 0].map(d => sch[d]).find(s => s.open);
        if (!first) return;
        sch.forEach(s => { s.from = first.from; s.to = first.to; }); changed(); renderPanel(true);
      } }, 'Copiar 1º horário'));
    return h('div', { class: 'f' }, h('span', { class: 'f-l' }, 'Horário de funcionamento'), quick, box,
      h('small', {}, 'Se o fechamento for antes da abertura (ex.: 18:00 às 02:00), conta como virada de dia.'));
  }
  function panelContact() {
    return h('div', { class: 'pin' },
      textField('WhatsApp', 'contact.whatsapp', { placeholder: '(47) 99999-9999', inputMode: 'tel', hint: 'Com DDD. Recebe os pedidos do carrinho.' }),
      textField('Instagram', 'contact.instagram', { placeholder: '@restaurante' }),
      textField('Telefone fixo (opcional)', 'contact.phone', { placeholder: '(47) 3333-3333', inputMode: 'tel' }),
      textField('Endereço', 'contact.address', { placeholder: 'Rua Exemplo, 123 — Centro' }),
      textField('Link do Google Maps (opcional)', 'contact.mapsUrl', { placeholder: 'https://maps.app.goo.gl/…', hint: 'Se vazio, o endereço vira uma busca no Maps.' }),
      section('Horários'),
      scheduleEditor(),
      checkField('Mostrar "Aberto agora / Fechado" no site', 'options.showOpenStatus', 'Calculado na hora, no fuso abaixo.'),
      selectField('Fuso horário do restaurante', 'contact.tz', MenuGen.TZS),
      textField('Horário em texto (opcional)', 'contact.hours', { multiline: true, rows: 2, placeholder: 'Ter a Dom: 18h às 23h', hint: 'Só aparece se nenhum dia estiver marcado acima.' }));
  }

  /* ---------- painel: Opções ---------- */
  function panelOptions() {
    return h('div', { class: 'pin' },
      textField('Aviso no topo (opcional)', 'options.notice', { multiline: true, rows: 2, placeholder: 'Ex.: Entregas somente após as 18h' }),
      checkField('Campo de busca no cardápio', 'options.showSearch'),
      section('Carrinho de pedidos'),
      checkField('Ativar carrinho', 'options.cartEnabled', 'O cliente monta o pedido e envia pronto pelo WhatsApp. Precisa do WhatsApp preenchido.'),
      h('div', { class: 'f' }, h('span', { class: 'f-l' }, 'Como o cliente recebe'),
        checkField('Entrega', 'options.typeDelivery'), checkField('Retirada no local', 'options.typePickup'), checkField('Consumo no local (mesa)', 'options.typeDinein')),
      h('div', { class: 'two' },
        textField('Taxa de entrega', 'options.deliveryFee', { placeholder: '5,00', inputMode: 'decimal' }),
        textField('Pedido mínimo', 'options.minOrder', { placeholder: '20,00', inputMode: 'decimal' })),
      textField('Formas de pagamento', 'options.payments', { placeholder: 'Pix, Cartão, Dinheiro', hint: 'Separe por vírgula. "Dinheiro" pergunta o troco.' }),
      textField('Mensagem inicial do pedido', 'options.orderMessage'),
      h('div', { class: 'f' }, h('span', { class: 'f-l' }, 'Sem carrinho'),
        checkField('Botão flutuante "Fazer pedido"', 'options.orderButton', 'Abre o WhatsApp direto.'),
        checkField('Botão "Pedir" em cada produto', 'options.itemOrderButton', 'Abre o WhatsApp com o nome do produto.')),
      section('Rodapé'),
      textField('Texto do rodapé', 'options.footerText', { multiline: true, rows: 2 }),
      h('div', { class: 'two' }, textField('Crédito (texto)', 'options.creditText', { placeholder: 'Site por …' }), textField('Crédito (link)', 'options.creditUrl', { placeholder: 'https://…' })),
      h('div', {}, h('button', { class: 'btn sm', onclick: () => {
        try { localStorage.setItem('gc.defaults', JSON.stringify({ creditText: cur.options.creditText, creditUrl: cur.options.creditUrl })); toast('Crédito salvo como padrão dos novos restaurantes'); } catch (e) { toast('Não foi possível salvar o padrão'); }
      } }, 'Usar como padrão nos novos')),
      section('Publicação'),
      textField('Descrição para buscadores / WhatsApp', 'options.seoDescription', { multiline: true, rows: 2 }),
      textField('URL final do site (opcional)', 'options.siteUrl', { placeholder: 'https://usuario.github.io/restaurante', hint: 'Necessária para a imagem aparecer na prévia do link no WhatsApp.' }),
      textField('Domínio próprio (opcional)', 'options.domain', { placeholder: 'cardapio.meurestaurante.com.br', hint: 'Gera o arquivo CNAME para o GitHub Pages.' }));
  }


  /* ---------- painel: Plataforma (publicar o cardápio no sistema online) ---------- */
  /* URL/chave pública/e-mail ficam neste navegador; a senha e a sessão só na memória. */
  const PLAT = { jwt: null, refresh: null, exp: 0, rests: null, msg: '' };
  const platCfg = () => { try { return JSON.parse(localStorage.getItem('gc.plat') || '{}'); } catch (e) { return {}; } };
  const platSet = c => { try { localStorage.setItem('gc.plat', JSON.stringify(c)); } catch (e) { /* sem storage */ } };
  const platBase = () => String(platCfg().url || '').trim().replace(/\/+$/, '');
  function keyIsSecret(k) {
    if (/^sb_secret_/.test(k)) return true;
    try { return JSON.parse(atob(k.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'service_role'; } catch (e) { return false; }
  }
  async function platAuth(grant, body) {
    const c = platCfg();
    const r = await fetch(platBase() + '/auth/v1/token?grant_type=' + grant, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: c.key }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(/Invalid login/i.test(j.error_description || j.msg || '') ? 'E-mail ou senha incorretos' : (j.error_description || j.msg || 'Falha no login'));
    PLAT.jwt = j.access_token; PLAT.refresh = j.refresh_token; PLAT.exp = Date.now() + (j.expires_in || 3600) * 1000;
  }
  async function platRpc(name, args) {
    if (!PLAT.jwt) throw new Error('Entre com seu e-mail e senha primeiro.');
    if (PLAT.exp - Date.now() < 60000) await platAuth('refresh_token', { refresh_token: PLAT.refresh });
    return makeApi(platBase(), platCfg().key, () => PLAT.jwt)(name, args || {});
  }
  const hostRpc = (n, a) => makeApi(HOST.url, HOST.key)(n, Object.assign({ p_token: HOST.token }, a || {}));
  const sha12 = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), x => x.toString(16).padStart(2, '0')).join('').slice(0, 12);
  const IMG_MIME = { webp: 'image/webp', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', svg: 'image/svg+xml', avif: 'image/avif' };

  async function publicar() {
    const slug = HOST ? HOST.slug : cur.options.plataforma.slug, r = HOST ? {} : (PLAT.rests || []).find(x => x.slug === slug);
    if (!r) throw new Error('Escolha o restaurante.');
    if (HOST) cur.options.plataforma.slug = slug;
    const resolve = makeResolver(), lite = liteClone(cur, resolve), urlOf = {}, base = HOST ? HOST.url.replace(/\/+$/, '') : platBase(), c = HOST ? { key: HOST.key } : platCfg();
    for (const f of resolve.files()) {            // fotos: nome = hash do conteúdo (cache eterno, sem foto velha)
      const bytes = b64ToBytes(f.b64), ext = f.path.split('.').pop(), key = slug + '/' + await sha12(bytes) + '.' + ext;
      if (HOST && ext === 'svg') { urlOf[f.path] = 'data:image/svg+xml;base64,' + f.b64; continue; } // SVG pequeno fica embutido (o envio do painel só aceita fotos raster)
      const pub = base + '/storage/v1/object/public/cardapios/' + key;
      const have = await fetch(pub, { method: 'HEAD' }).then(x => x.ok, () => false);
      if (!have) {
        const up = await fetch(base + '/storage/v1/object/cardapios/' + key, { method: 'POST', headers: Object.assign(HOST ? Object.assign({ apikey: c.key }, /^eyJ/.test(c.key) ? { Authorization: 'Bearer ' + c.key } : {}) : { apikey: c.key, Authorization: 'Bearer ' + PLAT.jwt, 'x-upsert': 'true' }, { 'Content-Type': IMG_MIME[ext] || 'application/octet-stream' }), body: bytes });
        if (!up.ok && !(HOST && /Duplicate|already exists/i.test(await up.text().catch(() => '')))) throw new Error('Falha ao enviar a foto ' + f.path + ' (' + up.status + ')');
      }
      urlOf[f.path] = pub;
    }
    const sub = p => (p && urlOf[p]) || p;
    lite.logo = sub(lite.logo); lite.hero = sub(lite.hero);
    lite.categories.forEach(cat => cat.items.forEach(it => { it.image = sub(it.image); }));
    lite.options.siteUrl = ''; lite.options.domain = ''; lite.folder = '';
    const itens = MenuGen.systemMenu(cur);
    if (HOST) await hostRpc('admin_publicar', { p_modelo: lite, p_itens: itens });
    else await platRpc('plataforma_publicar', { p_rest: r.id, p_modelo: lite, p_itens: itens });
    return itens.length;
  }

  /* painel do restaurante: publicar com a própria sessão do administrador (sem login de dono) */
  const hostDirty = () => !!cur && (cur.hostPub || 0) < cur.updatedAt;
  function hostStatus() { const e = $('#host-status'); if (e) e.textContent = cur ? (hostDirty() ? '● Alterações ainda não publicadas' : '✓ Online está igual a este cardápio') : ''; }
  async function hostPublish(btn) {
    const old = btn && btn.textContent; if (btn) { btn.disabled = true; btn.textContent = 'Publicando…'; }
    try {
      await saveNow();
      const stamp = cur.updatedAt, n = await publicar();
      cur.hostPub = stamp; cur.hostSeen = ((await hostRpc('admin_cardapio_get')) || {}).publicado_em || null;
      await saveNow(); hostStatus(); toast('✅ Publicado: o cardápio online já foi atualizado (' + n + ' itens)');
    } catch (e) { toast(/sessao_invalida|restaurante_bloqueado/.test(e.message) ? 'Sessão expirada. Saia e entre de novo no painel.' : '⚠ ' + (e.message || 'Erro ao publicar')); }
    if (btn) { btn.disabled = false; btn.textContent = old; }
  }
  function panelHost() {
    const wrap = h('div', { class: 'pin sysp' }), site = HOST.site || '';
    wrap.append(h('p', { class: 'muted' }, 'Clique em "Salvar e publicar" (ou Ctrl+S) para atualizar o cardápio online dos seus clientes. As edições são guardadas neste navegador enquanto você trabalha.'),
      h('div', { class: 'sys-status', id: 'host-status' }), h('div', { class: 'btnrow' }, h('button', { class: 'btn primary', onclick: e => hostPublish(e.currentTarget) }, '☁ Salvar e publicar')),
      site && h('p', { class: 'muted' }, 'Cardápio: ' + site + '/' + HOST.slug + '/menu'));
    setTimeout(hostStatus, 0); return wrap;
  }
  async function hostOpen() {
    const id = 'host-' + HOST.slug; let local = await DB.get(id), online = null;
    try { online = await hostRpc('admin_cardapio_get'); } catch (e) { toast(/sessao_invalida|restaurante_bloqueado/.test(e.message) ? 'Sessão expirada. Saia e entre de novo no painel.' : '⚠ Não foi possível consultar o cardápio online'); if (!local) return false; }
    const at = online ? online.publicado_em || null : undefined, fromOnline = at !== undefined && online.cardapio;
    const load = async () => {
      const m = clone(online.cardapio);
      await hydrate(m, async u => { const r = await fetch(u); if (!r.ok) throw new Error('Não foi possível baixar uma foto do cardápio online (' + r.status + ')'); const blob = await r.blob(); return await new Promise((ok, no) => { const f = new FileReader(); f.onload = () => ok(String(f.result).split(',')[1]); f.onerror = no; f.readAsDataURL(blob); }); });
      return m;
    };
    try {
      if (!local || (fromOnline && local.hostSeen !== at && confirm('O cardápio online foi alterado desde a última vez que você o abriu aqui (talvez em outro aparelho).\n\nOK = carregar a versão online (descarta as alterações deste navegador)\nCancelar = continuar com a versão deste navegador'))) {
        const m = fromOnline ? await load() : newRestaurant(HOST.nome);
        local = Object.assign(MenuGen.normalize(m), { id, folder: '', hostSeen: at || null, hostPub: Date.now() });
        local.updatedAt = local.hostPub; await DB.put(local);
      } else if (at !== undefined && local.hostSeen !== at) { local.hostSeen = at; await DB.put(local); }
    } catch (e) { toast('⚠ ' + (e.message || 'Erro ao carregar o cardápio online')); if (!local) return false; }
    await openRestaurant(id); return true;
  }
  function panelPlatform() {
    if (HOST) return panelHost();
    const c = platCfg(), wrap = h('div', { class: 'pin sysp' });
    const inp = (id, label, key, ph, type) => { const i = h('input', { id, type: type || 'text', placeholder: ph || '', autocapitalize: 'none' }); i.value = c[key] || ''; i.addEventListener('input', () => { const n = platCfg(); n[key] = i.value.trim(); platSet(n); }); return h('label', { class: 'f' }, h('span', { class: 'f-l' }, label), i); };
    const status = h('div', { class: 'sys-status', id: 'plat-status' }, PLAT.msg);
    const set = m => { PLAT.msg = m; status.textContent = m; };
    wrap.append(
      h('p', { class: 'muted' }, 'Publica o cardápio deste restaurante no sistema online (pedido por mesa, caixa e cozinha). O ZIP continua servindo para sites estáticos simples.'),
      section('1. Conexão com a plataforma'),
      inp('pl-url', 'URL do projeto Supabase', 'url', 'https://xxxx.supabase.co'),
      inp('pl-key', 'Chave pública (anon / publishable)', 'key', 'sb_publishable_… ou eyJ…'),
      inp('pl-site', 'Endereço do site da plataforma', 'site', 'https://menuazul.igorcabral.dev.br'),
      inp('pl-email', 'Seu e-mail (dono da plataforma)', 'email', 'voce@exemplo.com'));
    if (c.key && keyIsSecret(c.key)) { wrap.append(h('div', { class: 'warnbox' }, '⚠ Esta é uma chave SECRETA. Use a chave anon / publishable.')); return wrap; }
    const pw = h('input', { id: 'pl-senha', type: 'password', autocomplete: 'current-password', placeholder: 'Senha' });
    wrap.append(h('label', { class: 'f' }, h('span', { class: 'f-l' }, 'Senha (não fica salva)'), pw),
      h('div', { class: 'btnrow' }, h('button', { class: 'btn sm primary', id: 'pl-entrar', onclick: async () => {
        const k = platCfg(); if (!/^https?:\/\//.test(k.url || '') || !k.key || !k.email) return set('Preencha URL, chave e e-mail.');
        set('Entrando…');
        try { await platAuth('password', { email: k.email, password: pw.value }); PLAT.rests = await platRpc('plataforma_restaurantes'); set('✅ Conectado.'); renderPanel(true); }
        catch (e) { PLAT.jwt = null; set(/sem_permissao/.test(e.message) ? '❌ Esta conta não é administradora da plataforma.' : '❌ ' + (e.message || 'Sem conexão')); }
      } }, PLAT.jwt ? 'Entrar de novo' : 'Entrar')), status);
    if (!PLAT.jwt || !PLAT.rests) return wrap;

    const sel = h('select', { id: 'pl-rest' }, h('option', { value: '' }, 'Escolha…'), PLAT.rests.map(r => h('option', { value: r.slug, selected: r.slug === cur.options.plataforma.slug }, r.nome + ' (/' + r.slug + ')' + (r.ativo ? '' : ' — bloqueado'))));
    sel.addEventListener('change', () => { cur.options.plataforma.slug = sel.value; changed(); renderPanel(true); });
    const slug = cur.options.plataforma.slug, r = PLAT.rests.find(x => x.slug === slug), site = String(c.site || '').trim().replace(/\/+$/, '');
    wrap.append(section('2. Restaurante'), h('label', { class: 'f' }, h('span', { class: 'f-l' }, 'Publicar em'), sel),
      h('p', { class: 'muted' }, 'Restaurantes novos são criados em ' + (site || 'seu-site') + '/admin.'));
    if (r) wrap.append(section('3. Publicar'),
      h('p', { class: 'muted' }, r.publicado_em ? 'Última publicação: ' + new Date(r.publicado_em).toLocaleString('pt-BR') : 'Ainda não publicado.'),
      h('div', { class: 'btnrow' }, h('button', { class: 'btn primary', id: 'pl-publicar', onclick: async e => {
        const b = e.currentTarget; b.disabled = true; b.textContent = 'Publicando…';
        try { const n = await publicar(); PLAT.rests = await platRpc('plataforma_restaurantes'); toast('Publicado: ' + n + ' itens'); renderPanel(true); }
        catch (x) { toast(x.message || 'Erro ao publicar'); b.disabled = false; b.textContent = '☁ Publicar cardápio'; }
      } }, '☁ Publicar cardápio')),
      h('p', { class: 'muted' }, 'Mudou itens, preços ou fotos? Publique de novo. Itens marcados como "esgotado" aqui valem na publicação; o restaurante também pode marcar pelo painel dele.'),
      site && h('p', { class: 'muted' }, 'Cardápio: ' + site + '/' + slug + '/menu · Equipe: ' + site + '/' + slug));
    return wrap;
  }

  /* ---------- painel: Cardápio ---------- */
  function newItem() { return { id: MenuGen.uid(), name: '', description: '', price: '', image: null, featured: false, soldOut: false, hidden: false, variants: [], addons: [], tags: [] }; }

  function miniImage(it) {
    const input = h('input', { type: 'file', accept: 'image/*', hidden: true });
    input.addEventListener('click', e => e.stopPropagation());
    const box = h('div', { class: 'mini', title: 'Foto do produto (clique ou arraste)', onclick: () => input.click() });
    const draw = () => box.replaceChildren(it.image ? h('img', { src: it.image, alt: '' }) : '+', input);
    async function take(file) {
      if (!file || !/^image\//.test(file.type)) return;
      try { it.image = await fileToDataURL(file, { max: 700, quality: 0.8 }); draw(); changed(); } catch (e) { toast(e.message); }
      input.value = '';
    }
    input.addEventListener('change', () => take(input.files[0]));
    dropTarget(box, take);
    draw();
    return box;
  }

  function rowsEditor(it, key, title, add, ph, note) {
    const list = it[key];
    const rows = h('div', { class: 'vars' });
    list.forEach((v, vi) => rows.append(h('div', { class: 'vrow', dataset: { kind: key } },
      bindInput(v, 'label', { placeholder: ph }), bindInput(v, 'price', { placeholder: 'Preço', inputMode: 'decimal' }),
      h('button', { class: 'icon', title: 'Remover', onclick: () => { list.splice(vi, 1); changed(); renderPanel(true); } }, '✕'))));
    return h('div', { class: 'f' }, h('span', { class: 'f-l' }, title), rows,
      h('div', {}, h('button', { class: 'btn sm', onclick: () => { list.push({ label: '', price: '' }); ui.expanded.add(it.id); changed(); renderPanel(true); } }, add)),
      list.length && note ? h('small', { class: 'muted' }, note) : null);
  }

  function itemBlock(cat, it, ii) {
    const open = ui.expanded.has(it.id);
    const toggle = h('button', { class: 'icon', title: 'Detalhes', onclick: () => {
      const o = more.hidden; more.hidden = !o; toggle.textContent = o ? '▴' : '▾';
      o ? ui.expanded.add(it.id) : ui.expanded.delete(it.id);
    } }, open ? '▴' : '▾');
    const row = h('div', { class: 'irow' }, miniImage(it),
      h('div', { class: 'ifields' },
        bindInput(it, 'name', { class: 'i-name', placeholder: 'Nome do produto' }),
        bindInput(it, 'price', { placeholder: 'Preço', inputMode: 'decimal' })),
      toggle);

    const desc = h('textarea', { rows: 2, placeholder: 'Descrição / ingredientes (opcional)' });
    desc.value = it.description || '';
    desc.addEventListener('input', () => { it.description = desc.value; changed(); });

    const varsWrap = rowsEditor(it, 'variants', 'Variações de preço (tamanhos)', '+ Adicionar variação', 'Ex.: Pequena', 'Com variações, o campo "Preço" acima é ignorado.');
    const addonsWrap = rowsEditor(it, 'addons', 'Adicionais (opcionais, com preço extra)', '+ Adicionar adicional', 'Ex.: Bacon', 'No carrinho o cliente escolhe quais quer. Deixe o preço vazio para grátis.');

    const tags = h('div', { class: 'f' }, h('span', { class: 'f-l' }, 'Etiquetas'), h('div', { class: 'tagsel' }, Object.entries(MenuGen.TAGS).map(([k, [emoji, label]]) => {
      const b = h('button', { type: 'button', class: 'tagb' + (it.tags.includes(k) ? ' on' : ''), onclick: () => {
        const i = it.tags.indexOf(k); i < 0 ? it.tags.push(k) : it.tags.splice(i, 1);
        b.classList.toggle('on'); changed();
      } }, emoji + ' ' + label);
      return b;
    })));

    const flag = (k, l) => { const c = h('input', { type: 'checkbox', checked: !!it[k] }); c.addEventListener('change', () => { it[k] = c.checked; changed(); }); return h('label', {}, c, l); };
    const catSel = h('select', { title: 'Mover para outra categoria' }, cur.categories.map(c => h('option', { value: c.id, selected: c.id === cat.id }, c.name || '(sem nome)')));
    catSel.addEventListener('change', () => {
      const dest = cur.categories.find(c => c.id === catSel.value);
      cat.items.splice(ii, 1); dest.items.push(it); changed(); renderPanel(true);
    });
    const acts = h('div', { class: 'iacts' },
      h('button', { class: 'icon', title: 'Subir', disabled: ii === 0, onclick: () => { move(cat.items, ii, -1); changed(); renderPanel(true); } }, '↑'),
      h('button', { class: 'icon', title: 'Descer', disabled: ii === cat.items.length - 1, onclick: () => { move(cat.items, ii, 1); changed(); renderPanel(true); } }, '↓'),
      h('button', { class: 'icon', title: 'Duplicar', onclick: () => { const c = clone(it); c.id = MenuGen.uid(); c.name += ' (cópia)'; cat.items.splice(ii + 1, 0, c); changed(); renderPanel(true); } }, '⧉'),
      catSel,
      it.image && h('button', { class: 'btn sm ghost', onclick: () => { it.image = null; changed(); renderPanel(true); } }, 'Remover foto'),
      h('span', { style: 'flex:1' }),
      h('button', { class: 'icon', title: 'Excluir produto', onclick: () => { cat.items.splice(ii, 1); changed(); renderPanel(true); } }, '🗑'));

    const more = h('div', { class: 'imore', hidden: !open }, desc, varsWrap, addonsWrap, tags, h('div', { class: 'flags' }, flag('featured', '★ Destaque'), flag('soldOut', 'Esgotado'), flag('hidden', 'Ocultar do cardápio')), acts);
    return h('div', { class: 'item', dataset: { id: it.id } }, row, more);
  }

  function catBlock(cat, ci) {
    const closed = ui.closed.has(cat.id);
    const body = h('div', { class: 'cbody', hidden: closed });
    const chev = h('button', { class: 'icon', title: 'Recolher / expandir', onclick: () => {
      const c = !body.hidden; body.hidden = c; chev.textContent = c ? '▸' : '▾'; c ? ui.closed.add(cat.id) : ui.closed.delete(cat.id);
    } }, closed ? '▸' : '▾');
    const head = h('div', { class: 'chead' }, chev,
      bindInput(cat, 'name', { class: 'c-name', placeholder: 'Nome da categoria' }),
      h('span', { class: 'cnt' }, String(cat.items.length)),
      h('button', { class: 'icon', title: 'Subir', disabled: ci === 0, onclick: () => { move(cur.categories, ci, -1); changed(); renderPanel(true); } }, '↑'),
      h('button', { class: 'icon', title: 'Descer', disabled: ci === cur.categories.length - 1, onclick: () => { move(cur.categories, ci, 1); changed(); renderPanel(true); } }, '↓'),
      h('button', { class: 'icon', title: 'Excluir categoria', onclick: () => {
        if (cat.items.length && !confirm('Excluir "' + (cat.name || 'categoria') + '" e seus ' + cat.items.length + ' produtos?')) return;
        cur.categories.splice(ci, 1); changed(); renderPanel(true);
      } }, '🗑'));
    body.append(bindInput(cat, 'description', { placeholder: 'Descrição da categoria (opcional)' }));
    cat.items.forEach((it, ii) => body.append(itemBlock(cat, it, ii)));
    body.append(h('div', {}, h('button', { class: 'btn sm', onclick: () => {
      const it = newItem(); cat.items.push(it); ui.focusId = it.id; ui.closed.delete(cat.id); changed(); renderPanel(true);
    } }, '+ Produto')));
    return h('div', { class: 'cat' }, head, body);
  }

  function panelMenu() {
    const wrap = h('div', {});
    wrap.append(h('div', { class: 'tools' },
      h('button', { class: 'btn', onclick: () => { const c = { id: MenuGen.uid(), name: '', description: '', items: [] }; cur.categories.push(c); changed(); renderPanel(true); setTimeout(() => { const els = wrap.querySelectorAll('.c-name'); const l = els[els.length - 1]; if (l) l.focus(); }, 0); } }, '+ Categoria'),
      h('button', { class: 'btn', onclick: openBulk }, '📋 Colar lista em texto')));
    if (!cur.categories.length) wrap.append(h('p', { class: 'muted' }, 'Nenhuma categoria ainda. Crie uma ou cole a lista de produtos em texto.'));
    cur.categories.forEach((c, i) => wrap.append(catBlock(c, i)));
    return wrap;
  }

  function renderPanel(keepScroll) {
    const tabs = [['marca', 'Marca'], ['contato', 'Contato'], ['cardapio', 'Cardápio'], ['opcoes', 'Opções'], ['sistema', HOST ? 'Publicar' : 'Plataforma']];
    $('#tabsbar').replaceChildren(...tabs.map(([k, l]) => h('button', { class: 'tab' + (ui.tab === k ? ' on' : ''), onclick: () => { ui.tab = k; renderPanel(false); } }, l)));
    const fn = { marca: panelBrand, contato: panelContact, cardapio: panelMenu, opcoes: panelOptions, sistema: panelPlatform }[ui.tab];
    const p = $('#panel'); const st = p.scrollTop;
    p.replaceChildren(fn());
    p.scrollTop = keepScroll ? st : 0;
    if (ui.focusId) { const el = p.querySelector('[data-id="' + ui.focusId + '"] .i-name'); if (el) el.focus(); ui.focusId = null; }
  }

  /* ---------- diálogos ---------- */
  function dialog(build) {
    return new Promise(resolve => {
      const dlg = $('#dlg'), form = $('#dlg-form');
      const close = v => { dlg.close(); resolve(v); };
      form.replaceChildren(...build(close));
      dlg.onclose = () => resolve(null);
      dlg.showModal();
    });
  }
  function askName(title, def, okLabel) {
    return dialog(close => {
      const i = h('input', { type: 'text', value: def || '', placeholder: 'Nome do restaurante' });
      setTimeout(() => { i.focus(); i.select(); }, 30);
      return [h('h2', {}, title), i, h('div', { class: 'bar' },
        h('button', { class: 'btn', type: 'button', onclick: () => close(null) }, 'Cancelar'),
        h('button', { class: 'btn primary', type: 'submit', onclick: e => { e.preventDefault(); close(i.value.trim() || null); } }, okLabel || 'Criar'))];
    });
  }
  function openBulk() {
    dialog(close => {
      const ta = h('textarea', { rows: 12, placeholder: '# Lanches\nX-Burger | Pão, carne 160g, queijo | 24,90\nX-Salada | Com alface e tomate | 27,00\n\n# Bebidas\nCoca-Cola Lata - 6,50\nSuco natural | Laranja ou limão | 9' });
      const mode = h('select', {}, h('option', { value: 'add' }, 'Adicionar ao cardápio atual'), h('option', { value: 'replace' }, 'Substituir todo o cardápio'));
      return [h('h2', {}, 'Colar lista de produtos'),
        h('pre', {}, '# Nome da categoria\nProduto | descrição | preço\nProduto | preço\nProduto - preço'),
        ta, mode,
        h('div', { class: 'bar' },
          h('button', { class: 'btn', type: 'button', onclick: () => close(null) }, 'Cancelar'),
          h('button', { class: 'btn primary', type: 'submit', onclick: e => {
            e.preventDefault();
            const parsed = MenuGen.parseBulk(ta.value);
            if (!parsed.length) { toast('Nada para importar'); return; }
            if (mode.value === 'replace') cur.categories = [];
            let n = 0;
            parsed.forEach(pc => {
              let cat = cur.categories.find(c => MenuGen.slugify(c.name) === MenuGen.slugify(pc.name));
              if (!cat) { cat = { id: MenuGen.uid(), name: pc.name, description: '', items: [] }; cur.categories.push(cat); }
              pc.items.forEach(i => { cat.items.push(Object.assign(newItem(), i)); n++; });
            });
            close(true); changed(); renderPanel(true); toast(n + ' produto(s) importado(s)');
          } }, 'Importar'))];
    });
  }

  /* ---------- restaurantes ---------- */
  function loadDefaults() { try { return JSON.parse(localStorage.getItem('gc.defaults') || '{}'); } catch (e) { return {}; } }
  function newRestaurant(name) {
    const r = MenuGen.defaults();
    r.name = name;
    const d = loadDefaults();
    r.options.creditText = d.creditText || ''; r.options.creditUrl = d.creditUrl || '';
    r.categories = [{ id: MenuGen.uid(), name: 'Lanches', description: '', items: [] }];
    return r;
  }
  async function showHome() {
    await saveNow(); cur = null;
    $('#view-home').hidden = false; $('#view-editor').hidden = true;
    ['#btn-home', '#btn-save', '#btn-backup', '#btn-export'].forEach(s => { $(s).hidden = true; });
    $('#cur-name').textContent = ''; setStatus('');
    $('#folder-hint').hidden = !FS.supported || FS.state === 'on';
    const list = (await DB.all()).sort((a, b) => b.updatedAt - a.updatedAt);
    const box = $('#home-list');
    if (!list.length) { box.replaceChildren(h('div', { class: 'emptyhome', style: 'grid-column:1/-1' }, 'Nenhum restaurante ainda. Clique em "+ Novo restaurante" para começar.')); return; }
    box.replaceChildren(...list.map(r => {
      const n = (r.categories || []).reduce((a, c) => a + c.items.length, 0);
      const bg = r.hero || r.logo;
      return h('div', { class: 'rcard' },
        h('div', { class: 'cv', style: bg ? 'background-image:url(' + bg + ')' : 'background:' + ((r.theme && r.theme.primary) || '#ccc') }),
        h('div', { class: 'bd' }, h('h3', {}, r.name || 'Sem nome'),
          h('p', {}, n + ' produtos · editado ' + new Date(r.updatedAt).toLocaleDateString('pt-BR')),
          r.folder && FS.state === 'on' ? h('p', {}, '📁 ' + FS.name + '/' + r.folder) : null),
        h('div', { class: 'ft' },
          h('button', { class: 'btn primary sm', onclick: () => openRestaurant(r.id) }, 'Abrir'),
          h('button', { class: 'btn sm', title: 'Duplicar', onclick: async () => { const c = clone(r); c.id = MenuGen.uid(); c.name += ' (cópia)'; c.folder = ''; c.createdAt = c.updatedAt = Date.now(); await DB.put(c); showHome(); } }, 'Duplicar'),
          h('button', { class: 'btn sm danger', title: 'Excluir', onclick: async () => {
            if (confirm('Excluir "' + r.name + '"? Isso não pode ser desfeito (faça backup antes).' + (r.folder ? '\nA pasta no computador NÃO é apagada.' : ''))) { await DB.del(r.id); showHome(); }
          } }, 'Excluir')));
    }));
  }
  async function openRestaurant(id) {
    const r = await DB.get(id);
    if (!r) return;
    cur = MenuGen.normalize(r);
    ui.tab = 'marca'; ui.expanded.clear(); ui.closed.clear();
    $('#view-home').hidden = true; $('#view-editor').hidden = false;
    ['#btn-home', '#btn-save', '#btn-backup', '#btn-export'].forEach(s => { $(s).hidden = false; });
    $('#cur-name').textContent = cur.name; setStatus('');
    if (HOST) { $('#btn-home').hidden = true; $('#btn-save').textContent = '☁ Salvar e publicar'; $('#btn-save').classList.add('primary'); ui.tab = 'cardapio'; }
    renderPanel(false); updatePreview();
  }

  /* ---------- exportar / backup ---------- */
  async function exportZip() {
    await saveNow();
    try {
      const zip = await makeZip(cur);
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 9 } });
      const name = MenuGen.slugify(cur.name) + '.zip';
      download(blob, name);
      toast('ZIP gerado: ' + name + ' (' + (blob.size / 1024).toFixed(0) + ' KB)');
    } catch (e) { toast('Erro ao gerar o ZIP: ' + e.message); }
  }
  function backupOne() {
    saveNow();
    download(new Blob([JSON.stringify(cur)], { type: 'application/json' }), 'backup-' + MenuGen.slugify(cur.name) + '.json');
  }
  async function backupAll() {
    const list = await DB.all();
    if (!list.length) { toast('Nada para salvar ainda'); return; }
    download(new Blob([JSON.stringify({ restaurants: list })], { type: 'application/json' }), 'backup-cardapios-' + new Date().toISOString().slice(0, 10) + '.json');
  }

  /* ---------- importar ---------- */
  async function readImport(file) {
    if (/\.zip$/i.test(file.name)) {
      const zip = await JSZip.loadAsync(file);
      const f = zip.file('cardapio.json');
      if (!f) throw new Error('cardapio.json não encontrado em ' + file.name);
      const data = JSON.parse(await f.async('string'));
      return [await hydrate(data, async p => { const zf = zip.file(p); return zf ? zf.async('base64') : null; })];
    }
    const data = JSON.parse(await file.text());
    return Array.isArray(data) ? data : (data.restaurants || [data]);
  }
  async function doImport(files) {
    let n = 0;
    for (const f of files) {
      try {
        const existing = new Set((await DB.all()).map(r => r.id));
        for (const raw of await readImport(f)) {
          const r = MenuGen.normalize(raw);
          if (existing.has(r.id)) { r.id = MenuGen.uid(); r.name += ' (importado)'; r.folder = ''; }
          await DB.put(r); n++;
        }
      } catch (e) { toast('Erro ao importar ' + f.name + ': ' + e.message); }
    }
    if (n) toast(n + ' restaurante(s) importado(s)');
    showHome();
  }

  /* ---------- eventos globais ---------- */
  $('#btn-new').onclick = async () => {
    const name = await askName('Novo restaurante', '', 'Criar');
    if (!name) return;
    const r = newRestaurant(name); await DB.put(r); openRestaurant(r.id);
  };
  $('#btn-import').onclick = () => $('#file-import').click();
  $('#file-import').onchange = e => { const fs = [...e.target.files]; e.target.value = ''; if (fs.length) doImport(fs); };
  $('#btn-backup-all').onclick = backupAll;
  $('#btn-home').onclick = showHome;
  $('#btn-folder').onclick = onFolderClick;
  $('#btn-save').onclick = async () => { if (HOST) return hostPublish($('#btn-save')); await saveNow(); toast('Salvo ✓'); };
  $('#btn-backup').onclick = backupOne;
  $('#btn-export').onclick = exportZip;
  $('#btn-newtab').onclick = () => {
    const url = URL.createObjectURL(new Blob([MenuGen.buildSite(cur, {})], { type: 'text/html' }));
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };
  $('#device').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    ui.device = b.dataset.d;
    [...$('#device').children].forEach(x => x.classList.toggle('on', x === b));
    $('#frame').className = 'frame ' + ui.device;
  });
  document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (cur) { if (HOST) hostPublish($('#btn-save')); else saveNow().then(() => toast('Salvo ✓')); } } });
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); });
  window.addEventListener('pagehide', () => { saveNow(); });

  /* gancho de teste/depuração */
  window.GC = { state: () => cur, saveNow, makeZip, openRestaurant, showHome, DB, FS, fsSyncAll };

  (async () => {
    await fsInit();
    if (FS.state === 'on') { try { await fsSyncAll(); } catch (e) { /* segue */ } }
    if (HOST) { // painel do restaurante: um único cardápio (o do restaurante logado); a lista local de restaurantes não aparece
      ['#btn-new', '#btn-import', '#btn-backup-all'].forEach(x => { const e = $(x); if (e) e.hidden = true; });
      let ok = false; try { ok = await hostOpen(); } catch (e) { toast('⚠ ' + e.message); }
      if (!ok) $('#home-list').replaceChildren(h('div', { class: 'emptyhome', style: 'grid-column:1/-1' }, 'Não foi possível abrir o cardápio. Volte ao painel e abra o editor de novo.'));
      return;
    }
    showHome();
  })();
})();
