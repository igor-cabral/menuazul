/* ===== Gerador do site estático do cardápio (função pura) ===== */

const MenuGen = (function () {
  'use strict';

  const FONTS = ['Poppins', 'Inter', 'Montserrat', 'Nunito', 'DM Sans', 'Lora', 'Playfair Display', 'Roboto Slab', 'Oswald', 'Fredoka', 'Raleway', 'Rubik', 'Quicksand', 'Cormorant Garamond'];
  const SERIF = { 'Lora': 1, 'Playfair Display': 1, 'Roboto Slab': 1, 'Cormorant Garamond': 1 };
  const HEADERS = ['center', 'left', 'overlay', 'compact'];
  const CARDS = ['border', 'shadow', 'flat'];
  const CATS = ['plain', 'bar', 'center'];

  const PRESETS = [
    { name: 'Tomate',   t: { primary: '#d62828', bg: '#fff8f1', surface: '#ffffff', text: '#2b2118' } },
    { name: 'Floresta', t: { primary: '#2d6a4f', bg: '#f4f8f4', surface: '#ffffff', text: '#1b2a22' } },
    { name: 'Café',     t: { primary: '#7a4e2d', bg: '#faf5ef', surface: '#ffffff', text: '#2a1f18' } },
    { name: 'Noite',    t: { primary: '#f4a261', bg: '#14110f', surface: '#1f1b18', text: '#f5efe8' } },
    { name: 'Oceano',   t: { primary: '#1d4e89', bg: '#f3f7fb', surface: '#ffffff', text: '#14213d' } },
    { name: 'Rosa',     t: { primary: '#d6336c', bg: '#fff5f8', surface: '#ffffff', text: '#3a1d2a' } },
    { name: 'Sol',      t: { primary: '#e08e00', bg: '#fffbeb', surface: '#ffffff', text: '#3a2a05' } },
    { name: 'Grafite',  t: { primary: '#111827', bg: '#f6f7f9', surface: '#ffffff', text: '#111827' } },
    { name: 'Vinho',    t: { primary: '#7f1d3a', bg: '#fbf7f4', surface: '#ffffff', text: '#2a1a20' } },
    { name: 'Roxo',     t: { primary: '#7b2cbf', bg: '#faf5ff', surface: '#ffffff', text: '#2a1340' } },
    { name: 'Menta',    t: { primary: '#0f9d8a', bg: '#f1faf8', surface: '#ffffff', text: '#12302b' } },
    { name: 'Laranja',  t: { primary: '#e85d04', bg: '#fffaf3', surface: '#ffffff', text: '#2e1a0c' } }
  ];

  /* Temas prontos: cores + fontes + layout + cabeçalho + cartões + títulos */
  const THEMES = [
    { id: 'classico', name: 'Clássico', desc: 'Lista com foto, cabeçalho centralizado',
      t: { primary: '#d62828', bg: '#fff8f1', surface: '#ffffff', text: '#2b2118', fontHeading: 'Poppins', fontBody: 'Inter', layout: 'list', header: 'center', cardStyle: 'border', catStyle: 'plain', radius: 14, heroOverlay: 35 } },
    { id: 'burger', name: 'Hamburgueria', desc: 'Escuro, capa grande com o nome por cima',
      t: { primary: '#f4a261', bg: '#14110f', surface: '#1f1b18', text: '#f5efe8', fontHeading: 'Oswald', fontBody: 'Inter', layout: 'grid', header: 'overlay', cardStyle: 'flat', catStyle: 'bar', radius: 10, heroOverlay: 40 } },
    { id: 'cafe', name: 'Cafeteria', desc: 'Tons de café, serifada, cabeçalho à esquerda',
      t: { primary: '#7a4e2d', bg: '#faf5ef', surface: '#ffffff', text: '#2a1f18', fontHeading: 'Lora', fontBody: 'DM Sans', layout: 'list', header: 'left', cardStyle: 'shadow', catStyle: 'plain', radius: 12, heroOverlay: 25 } },
    { id: 'pizza', name: 'Pizzaria', desc: 'Vermelho e creme, capa cheia, títulos com filete',
      t: { primary: '#c1121f', bg: '#fdf6ec', surface: '#ffffff', text: '#2d1a12', fontHeading: 'Playfair Display', fontBody: 'Nunito', layout: 'list', header: 'overlay', cardStyle: 'border', catStyle: 'center', radius: 8, heroOverlay: 45 } },
    { id: 'acai', name: 'Açaí & Sorvetes', desc: 'Colorido, cantos bem redondos, grade',
      t: { primary: '#7b2cbf', bg: '#faf5ff', surface: '#ffffff', text: '#2a1340', fontHeading: 'Fredoka', fontBody: 'Nunito', layout: 'grid', header: 'center', cardStyle: 'shadow', catStyle: 'plain', radius: 24, heroOverlay: 20 } },
    { id: 'japa', name: 'Minimalista', desc: 'Limpo e discreto, só texto, faixa compacta',
      t: { primary: '#111827', bg: '#f6f7f9', surface: '#ffffff', text: '#111827', fontHeading: 'DM Sans', fontBody: 'DM Sans', layout: 'text', header: 'compact', cardStyle: 'flat', catStyle: 'plain', radius: 6, heroOverlay: 45 } },
    { id: 'bistro', name: 'Bistrô', desc: 'Elegante, serifada, tons de vinho',
      t: { primary: '#7f1d3a', bg: '#fbf7f4', surface: '#ffffff', text: '#2a1a20', fontHeading: 'Cormorant Garamond', fontBody: 'Inter', layout: 'text', header: 'center', cardStyle: 'border', catStyle: 'center', radius: 4, heroOverlay: 30 } },
    { id: 'natural', name: 'Natural & Saudável', desc: 'Verde, grade com fotos, cabeçalho à esquerda',
      t: { primary: '#2d6a4f', bg: '#f4f8f4', surface: '#ffffff', text: '#1b2a22', fontHeading: 'Quicksand', fontBody: 'Nunito', layout: 'grid', header: 'left', cardStyle: 'shadow', catStyle: 'bar', radius: 18, heroOverlay: 20 } },
    { id: 'bar', name: 'Bar & Noite', desc: 'Escuro, capa cheia, vermelho vivo',
      t: { primary: '#ff5a5f', bg: '#0d1117', surface: '#161b22', text: '#e6edf3', fontHeading: 'Montserrat', fontBody: 'Inter', layout: 'list', header: 'overlay', cardStyle: 'border', catStyle: 'center', radius: 12, heroOverlay: 50 } },
    { id: 'padaria', name: 'Padaria', desc: 'Amarelo quente, serifa robusta',
      t: { primary: '#e08e00', bg: '#fffbeb', surface: '#ffffff', text: '#3a2a05', fontHeading: 'Roboto Slab', fontBody: 'Nunito', layout: 'list', header: 'left', cardStyle: 'border', catStyle: 'bar', radius: 10, heroOverlay: 25 } },
    { id: 'marmita', name: 'Marmitaria', desc: 'Laranja, só texto, faixa compacta',
      t: { primary: '#e85d04', bg: '#fffaf3', surface: '#ffffff', text: '#2e1a0c', fontHeading: 'Rubik', fontBody: 'Inter', layout: 'text', header: 'compact', cardStyle: 'flat', catStyle: 'bar', radius: 8, heroOverlay: 40 } }
  ];

  const TAGS = {
    'vegetariano': ['🌱', 'Vegetariano'], 'vegano': ['🥬', 'Vegano'], 'sem-gluten': ['🌾', 'Sem glúten'],
    'sem-lactose': ['🥛', 'Sem lactose'], 'picante': ['🌶️', 'Picante'], 'novo': ['✨', 'Novo']
  };
  const TZS = [['America/Sao_Paulo', 'Brasília (BRT)'], ['America/Manaus', 'Manaus (AMT)'], ['America/Cuiaba', 'Cuiabá (AMT)'], ['America/Rio_Branco', 'Rio Branco (ACT)'], ['America/Noronha', 'Fernando de Noronha']];

  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const escBr = s => esc(s).replace(/\r?\n/g, '<br>');
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const slugify = s => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
  const pick = (v, list, def) => list.includes(v) ? v : def;

  /* ---------- preços ---------- */
  function parsePrice(v) {
    if (typeof v === 'number') return v;
    let s = String(v == null ? '' : v).trim().replace(/^R\$\s*/i, '').replace(/\s/g, '');
    if (!s || !/^\d[\d.,]*$/.test(s)) return NaN;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? NaN : n;
  }
  function fmtPrice(v) {
    const n = parsePrice(v);
    if (isNaN(n)) return String(v == null ? '' : v).trim();
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }
  const nz = n => isNaN(n) ? 0 : n;

  /* ---------- helpers ---------- */
  function lum(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return 0;
    const c = [0, 2, 4].map(i => parseInt(m[1].substr(i, 2), 16) / 255)
      .map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  const onColor = hex => lum(hex) > 0.4 ? '#111111' : '#ffffff';
  const fontStack = n => "'" + n + "', " + (SERIF[n] ? 'serif' : 'sans-serif');
  const fontHref = names => 'https://fonts.googleapis.com/css2?' +
    [...new Set(names)].map(n => 'family=' + n.replace(/ /g, '+') + ':wght@400;500;600;700').join('&') + '&display=swap';
  function waNumber(s) {
    let d = String(s || '').replace(/\D/g, '');
    if (!d) return '';
    if (d.length <= 11) d = '55' + d;
    return d;
  }
  const instaHandle = s => String(s || '').trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/[/?#].*$/, '');

  /* ---------- horários ---------- */
  const TIME = /^\d{1,2}:\d{2}$/;
  const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const ORDER = [1, 2, 3, 4, 5, 6, 0];
  const defaultSchedule = () => Array.from({ length: 7 }, () => ({ open: false, from: '18:00', to: '23:00' }));
  function normSchedule(s) {
    return defaultSchedule().map((d, i) => {
      const x = (s && s[i]) || {};
      return { open: !!x.open, from: TIME.test(x.from) ? x.from : d.from, to: TIME.test(x.to) ? x.to : d.to };
    });
  }
  function fh(t) {
    const [h, m] = String(t).split(':').map(Number);
    return (h < 10 ? '0' + h : h) + 'h' + (m ? String(m).padStart(2, '0') : '');
  }
  function scheduleSummary(sch) {
    const groups = [];
    ORDER.forEach((d, pos) => {
      const s = sch[d]; if (!s || !s.open) return;
      const key = s.from + '-' + s.to, last = groups[groups.length - 1];
      if (last && last.key === key && last.pos === pos - 1) { last.days.push(d); last.pos = pos; }
      else groups.push({ key, from: s.from, to: s.to, days: [d], pos });
    });
    return groups.map(g => {
      const n = g.days.length, names = g.days.map(d => DAYS[d]);
      const dl = n === 1 ? names[0] : n === 2 ? names.join(' e ') : names[0] + ' a ' + names[n - 1];
      return dl + ': ' + fh(g.from) + ' às ' + fh(g.to);
    });
  }

  /* ---------- modelo ---------- */
  function defaults() {
    return {
      id: uid(), v: 2, createdAt: Date.now(), updatedAt: Date.now(), folder: '',
      name: 'Meu Restaurante', slogan: '', logo: null, hero: null,
      theme: Object.assign({ fontHeading: 'Poppins', fontBody: 'Inter', layout: 'list', header: 'center', cardStyle: 'border', catStyle: 'plain', heroOverlay: 35, radius: 14 }, PRESETS[0].t),
      contact: { whatsapp: '', instagram: '', phone: '', address: '', mapsUrl: '', hours: '', tz: 'America/Sao_Paulo', schedule: defaultSchedule() },
      options: {
        showSearch: true, showOpenStatus: true,
        cartEnabled: true, typeDelivery: true, typePickup: true, typeDinein: false,
        deliveryFee: '', minOrder: '', payments: 'Pix, Cartão, Dinheiro',
        orderButton: true, itemOrderButton: false,
        orderMessage: 'Olá! Gostaria de fazer um pedido:',
        notice: '', footerText: '', creditText: '', creditUrl: '',
        seoDescription: '', siteUrl: '', domain: '',
        plataforma: { slug: '' }
      },
      categories: []
    };
  }
  function normalize(src) {
    const d = defaults();
    const o = Object.assign(d, src || {});
    o.theme = Object.assign(defaults().theme, (src && src.theme) || {});
    o.contact = Object.assign(defaults().contact, (src && src.contact) || {});
    o.contact.schedule = normSchedule(o.contact.schedule);
    o.options = Object.assign(defaults().options, (src && src.options) || {});
    o.options.plataforma = { slug: String((src && src.options && src.options.plataforma && src.options.plataforma.slug) || '').trim().toLowerCase() };
    delete o.options.system;
    o.categories = ((src && src.categories) || []).map(c => ({
      id: c.id || uid(), name: c.name || '', description: c.description || '',
      items: (c.items || []).map(i => ({
        id: i.id || uid(), name: i.name || '', description: i.description || '', price: i.price == null ? '' : i.price,
        image: i.image || null, featured: !!i.featured, soldOut: !!i.soldOut, hidden: !!i.hidden,
        variants: (i.variants || []).map(v => ({ label: v.label || '', price: v.price == null ? '' : v.price })),
        addons: (i.addons || []).map(a => ({ label: a.label || '', price: a.price == null ? '' : a.price })),
        tags: (i.tags || []).filter(t => TAGS[t])
      }))
    }));
    return o;
  }

  /* ---------- importação rápida em texto ---------- */
  function parseBulk(text) {
    const cats = []; let cur = null;
    const priceRe = /^(?:R\$\s*)?\d+(?:[.,]\d{1,2})?$/i;
    String(text || '').split(/\r?\n/).forEach(raw => {
      const line = raw.trim();
      if (!line) return;
      const hm = line.match(/^#{1,6}\s*(.+)$/);
      if (hm) { cur = { name: hm[1].trim(), items: [] }; cats.push(cur); return; }
      if (!cur) { cur = { name: 'Cardápio', items: [] }; cats.push(cur); }
      let name = '', description = '', price = '';
      if (line.includes('|')) {
        const p = line.split('|').map(s => s.trim());
        name = p[0];
        if (p.length === 2) { if (priceRe.test(p[1])) price = p[1]; else description = p[1]; }
        else { description = p[1]; price = p[2]; }
      } else {
        const m = line.match(/^(.*?)\s*[-–—:]\s*(?:R\$\s*)?(\d+(?:[.,]\d{1,2})?)$/i);
        if (m && m[1]) { name = m[1]; price = m[2]; } else name = line;
      }
      if (name) cur.items.push({ name, description, price });
    });
    return cats;
  }

  /* ---------- ícones ---------- */
  const S = '<svg viewBox="0 0 24 24" aria-hidden="true">';
  const ICON = {
    clock: S + '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    pin: S + '<path d="M12 21s-7-6.2-7-11a7 7 0 0114 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    insta: S + '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6"/></svg>',
    phone: S + '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/></svg>',
    wa: S + '<path d="M3 21l1.6-4.8A8.5 8.5 0 1112 20.5a8.5 8.5 0 01-4-1L3 21z"/><path d="M9.2 8.6c0 3 2.8 5.8 5.800 5.800l1-1.500-2-1-1 .8c-1-.4-1.800-1.200-2.200-2.200l.8-1-1-2z"/></svg>'
  };

  /* ---------- CSS do site ---------- */
  const SITE_CSS = `
:root{--on-primary:#fff;--oh:#fff;--muted:color-mix(in srgb,var(--text) 62%,transparent);--line:color-mix(in srgb,var(--text) 13%,transparent)}
*{box-sizing:border-box;margin:0}
[hidden]{display:none!important}
html{scroll-behavior:smooth}
body{font-family:var(--fb);background:var(--bg);color:var(--text);line-height:1.5;-webkit-font-smoothing:antialiased}
body.noscroll{overflow:hidden}
img{display:block;max-width:100%}
a{color:inherit}
button{font-family:inherit}
svg{fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.wrap{max-width:720px;margin:0 auto;padding:0 16px}
.hero{position:relative;height:clamp(170px,36vw,290px);background:linear-gradient(135deg,var(--primary),color-mix(in srgb,var(--primary) 50%,#000));overflow:hidden}
.hero>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.hero::after{content:"";position:absolute;inset:0;background:rgba(0,0,0,var(--ov))}
.brand{position:relative;z-index:2;text-align:center;margin-top:-54px}
.logo{width:108px;height:108px;border-radius:50%;object-fit:cover;background:var(--surface);border:4px solid var(--bg);margin:0 auto;box-shadow:0 6px 22px rgba(0,0,0,.2)}
.brand.nologo{margin-top:22px}
h1{font-family:var(--fh);font-size:1.75rem;line-height:1.15;margin-top:12px;letter-spacing:-.01em}
.slogan{color:var(--muted);margin-top:6px}
.chips{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:16px}
.chip,.st{display:inline-flex;align-items:center;gap:7px;font-size:.84rem;padding:7px 13px;border-radius:99px;background:var(--surface);border:1px solid var(--line);text-decoration:none;text-align:left}
.chip svg{width:16px;height:16px;flex:none;color:var(--primary)}
a.chip:hover{border-color:var(--primary)}
.st{font-weight:600}
.st::before{content:"";width:9px;height:9px;border-radius:50%;background:#1fb855;flex:none}
.st.off::before{background:#d64545}
.notice{margin-top:18px;background:color-mix(in srgb,var(--primary) 12%,var(--surface));border:1px solid color-mix(in srgb,var(--primary) 30%,transparent);border-radius:var(--radius);padding:11px 15px;font-size:.9rem;text-align:center}

/* cabeçalhos */
.hd-left .hero{height:clamp(120px,24vw,190px)}
.hd-left .brand{text-align:left;margin-top:-46px;display:flex;flex-direction:column;align-items:flex-start}
.hd-left .brand.nologo{margin-top:20px}
.hd-left .logo{width:92px;height:92px;margin:0;border-radius:calc(var(--radius) + 6px)}
.hd-left .chips{justify-content:flex-start}
.hd-left .notice{text-align:left}
.hero-in{position:absolute;z-index:2;left:0;right:0;bottom:0;padding-bottom:22px;color:var(--oh);display:flex;align-items:flex-end;gap:14px}
.hero-in h1{margin-top:0;color:var(--oh)}
.hero-in .slogan{color:var(--oh);opacity:.88;margin-top:2px}
.hero-in .logo{width:84px;height:84px;margin:0;border:3px solid rgba(255,255,255,.92);flex:none}
.hd-overlay .hero{height:clamp(250px,62vw,410px)}
.hd-overlay .hero::after{background:linear-gradient(to top,rgba(0,0,0,.8),rgba(0,0,0,calc(var(--ov) * .45)))}
.hd-overlay .hero-in h1{font-size:2rem}
.hd-compact .hero{height:auto;min-height:0}
.hd-compact .hero-in{position:relative;align-items:center;padding-top:26px;padding-bottom:26px}
.hd-compact .hero-in .logo{width:64px;height:64px}
.info{padding-top:16px}
.info .chips{margin-top:0;justify-content:flex-start}
.info .notice{text-align:left}

.tabs{position:sticky;top:0;z-index:20;margin-top:20px;background:color-mix(in srgb,var(--bg) 90%,transparent);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border-bottom:1px solid var(--line)}
.tabs-in{display:flex;gap:6px;overflow-x:auto;padding:10px 16px;max-width:720px;margin:0 auto;scrollbar-width:none}
.tabs-in::-webkit-scrollbar{display:none}
.tabs a{flex:none;text-decoration:none;font-weight:600;font-size:.88rem;padding:8px 15px;border-radius:99px;color:var(--muted);transition:background .2s,color .2s}
.tabs a.on{background:var(--primary);color:var(--on-primary)}
.search{margin-top:18px}
.search input{width:100%;padding:12px 18px;border-radius:99px;border:1px solid var(--line);background:var(--surface);color:var(--text);font:inherit;font-size:.95rem;outline:none}
.search input:focus{border-color:var(--primary)}
.cat{scroll-margin-top:62px;padding-top:28px}
.cat h2{font-family:var(--fh);font-size:1.35rem;line-height:1.2}
.cat-desc{color:var(--muted);font-size:.9rem;margin-top:3px}
.ct-bar .cat h2{border-left:4px solid var(--primary);padding-left:10px}
.ct-center .cat h2{display:flex;align-items:center;justify-content:center;gap:14px;text-align:center}
.ct-center .cat h2::before,.ct-center .cat h2::after{content:"";flex:1;height:1px;background:var(--line)}
.ct-center .cat-desc{text-align:center}
.items{display:grid;gap:12px;margin-top:14px}
.item{display:flex;gap:14px;justify-content:space-between;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);padding:14px}
.cs-shadow .item{border-color:transparent;box-shadow:0 2px 14px color-mix(in srgb,var(--text) 14%,transparent)}
.cs-flat .item{border-color:transparent;background:color-mix(in srgb,var(--text) 6%,var(--bg))}
.item.featured,.cs-shadow .item.featured,.cs-flat .item.featured{border-color:var(--primary);box-shadow:0 0 0 1px var(--primary)}
.item-body{flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start}
.item h3{font-family:var(--fh);font-size:1rem;line-height:1.3;font-weight:600}
.badge{display:inline-block;margin-left:6px;font-family:var(--fb);font-size:.64rem;font-weight:700;padding:2px 8px;border-radius:99px;background:var(--primary);color:var(--on-primary);vertical-align:middle;text-transform:uppercase;letter-spacing:.05em}
.tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:6px}
.tag{font-size:.7rem;padding:2px 8px;border-radius:99px;background:color-mix(in srgb,var(--primary) 12%,transparent);border:1px solid color-mix(in srgb,var(--primary) 25%,transparent)}
.desc{color:var(--muted);font-size:.86rem;margin-top:4px}
.adds{color:var(--muted);font-size:.8rem;margin-top:6px}
.price{font-weight:700;color:var(--primary);margin-top:auto;padding-top:10px}
.variants{list-style:none;padding:0;margin-top:10px;width:100%;display:grid;gap:5px}
.variants li{display:flex;justify-content:space-between;gap:12px;font-size:.9rem;border-bottom:1px dashed var(--line);padding-bottom:4px}
.variants b{color:var(--primary);white-space:nowrap}
.sold{margin-top:auto;padding-top:10px;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.item.soldout .item-body>*:not(.sold){opacity:.55}
.item.soldout .thumb{opacity:.45;filter:grayscale(1)}
.order,.add{margin-top:12px;display:inline-flex;align-items:center;gap:6px;font-size:.8rem;font-weight:700;text-decoration:none;padding:7px 14px;border-radius:99px;background:var(--primary);color:var(--on-primary);border:0;cursor:pointer}
.order svg{width:15px;height:15px}
.add{background:transparent;color:var(--primary);border:1.5px solid var(--primary);padding:6px 14px;transition:background .15s,color .15s}
.add:hover,.add.ok{background:var(--primary);color:var(--on-primary)}
.thumb{width:98px;height:98px;object-fit:cover;border-radius:calc(var(--radius) - 4px);flex:none;background:var(--line)}
.layout-grid .items{grid-template-columns:repeat(2,1fr)}
.layout-grid .item{flex-direction:column-reverse;justify-content:flex-end;padding:0;overflow:hidden;gap:0}
.layout-grid .thumb{width:100%;height:auto;aspect-ratio:4/3;border-radius:0}
.layout-grid .item-body{padding:12px 14px 14px}
.layout-text .items{gap:0}
.layout-text .item,.layout-text .item.featured{background:transparent;border:0;border-bottom:1px dashed var(--line);border-radius:0;padding:12px 0;box-shadow:none}
.none{text-align:center;color:var(--muted);padding:40px 0}
.empty{text-align:center;color:var(--muted);padding:56px 0}
footer{text-align:center;color:var(--muted);font-size:.82rem;padding:38px 16px 110px}
footer p+p{margin-top:6px}
footer a{text-decoration:underline;text-underline-offset:3px}
.fab{position:fixed;right:16px;bottom:16px;z-index:30;display:flex;align-items:center;gap:8px;background:#1fb855;color:#fff;font-weight:700;font-size:.95rem;text-decoration:none;padding:14px 20px;border-radius:99px;box-shadow:0 8px 26px rgba(0,0,0,.28)}
.fab svg{width:22px;height:22px}

/* carrinho */
.cartbar{position:fixed;left:0;right:0;bottom:0;z-index:30;padding:10px 16px calc(10px + env(safe-area-inset-bottom));pointer-events:none}
.cartbar button{pointer-events:auto;display:flex;align-items:center;justify-content:space-between;gap:12px;width:100%;max-width:720px;margin:0 auto;border:0;background:var(--primary);color:var(--on-primary);font-weight:700;font-size:.95rem;padding:14px 20px;border-radius:99px;box-shadow:0 8px 26px rgba(0,0,0,.28);cursor:pointer}
.cartbar .n{display:inline-flex;align-items:center;justify-content:center;min-width:26px;height:26px;padding:0 7px;margin-right:8px;border-radius:99px;background:var(--on-primary);color:var(--primary);font-size:.82rem}
.ov{position:fixed;inset:0;z-index:50;background:rgba(0,0,0,.52);display:flex;align-items:flex-end;justify-content:center}
.sheet{background:var(--bg);color:var(--text);width:100%;max-width:520px;max-height:92vh;overflow:auto;border-radius:22px 22px 0 0;padding:20px 18px calc(22px + env(safe-area-inset-bottom));animation:up .22s ease-out}
@keyframes up{from{transform:translateY(40px);opacity:0}}
@media(min-width:600px){.ov{align-items:center}.sheet{border-radius:22px}}
.sh-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:6px}
.sh-head h2{font-family:var(--fh);font-size:1.25rem;line-height:1.2}
.x{border:0;background:var(--line);color:var(--text);width:34px;height:34px;border-radius:50%;font-size:.95rem;cursor:pointer;flex:none}
.grp{font-size:.74rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);margin-top:16px}
.opt{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:11px 0;border-bottom:1px dashed var(--line);cursor:pointer;font-size:.95rem}
.opt input{accent-color:var(--primary);margin-right:9px;width:17px;height:17px;vertical-align:-3px}
.opt b{color:var(--primary);white-space:nowrap}
.qrow{display:flex;justify-content:space-between;align-items:center;margin-top:14px;font-weight:600}
.qty{display:inline-flex;align-items:center;gap:12px}
.qty button{width:32px;height:32px;border-radius:50%;border:1px solid var(--line);background:var(--surface);color:var(--text);font-size:1.15rem;line-height:1;cursor:pointer}
.qty b{min-width:18px;text-align:center}
.line{padding:13px 0;border-bottom:1px solid var(--line)}
.line-top{display:flex;justify-content:space-between;gap:10px;font-weight:600}
.line small{display:block;color:var(--muted);font-size:.82rem}
.line-bot{display:flex;gap:10px;align-items:center;margin-top:8px}
.line-bot input{flex:1;min-width:0;font:inherit;font-size:.85rem;padding:8px 11px;border-radius:10px;border:1px solid var(--line);background:var(--surface);color:var(--text)}
.fld{display:flex;flex-direction:column;gap:5px;margin-top:14px;font-size:.84rem;font-weight:600}
.fld input,.fld textarea,.fld select{font:inherit;font-weight:400;font-size:.95rem;padding:10px 12px;border-radius:10px;border:1px solid var(--line);background:var(--surface);color:var(--text);width:100%}
.fld input:focus,.fld textarea:focus,.fld select:focus,.line-bot input:focus{outline:2px solid color-mix(in srgb,var(--primary) 40%,transparent);border-color:var(--primary)}
.types{display:flex;gap:8px;flex-wrap:wrap}
.types label{flex:1;min-width:92px;text-align:center;padding:10px 8px;border:1px solid var(--line);border-radius:10px;background:var(--surface);cursor:pointer;font-weight:600;font-size:.88rem}
.types input{display:none}
.types label.on{border-color:var(--primary);background:color-mix(in srgb,var(--primary) 12%,var(--surface));color:var(--primary)}
.tot{margin-top:16px;display:grid;gap:4px;font-size:.95rem}
.tot div{display:flex;justify-content:space-between}
.tot .g{font-weight:800;font-size:1.12rem;padding-top:8px;margin-top:4px;border-top:1px solid var(--line)}
.warn{background:#fff3cd;color:#664d03;border-radius:10px;padding:10px 13px;font-size:.86rem;margin-top:12px}
.send{margin-top:16px;width:100%;border:0;border-radius:99px;background:#1fb855;color:#fff;font-weight:700;font-size:1rem;padding:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px}
.send.go{background:var(--primary);color:var(--on-primary)}
.send:disabled{opacity:.45;cursor:not-allowed}
.link{display:block;margin:12px auto 0;border:0;background:none;color:var(--muted);text-decoration:underline;font-size:.85rem;cursor:pointer}
@media(max-width:380px){.layout-grid .items{grid-template-columns:1fr}}

/* modo mesa */
.mesabar{position:sticky;top:0;z-index:25;background:var(--primary);color:var(--on-primary)}
.mb-in{max-width:720px;margin:0 auto;padding:10px 16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:.95rem}
.mb-in b{font-family:var(--fh)}
.mb-in .add{background:var(--on-primary);color:var(--primary);border:0;border-radius:99px;padding:6px 14px;font-weight:700;cursor:pointer;margin-left:auto}
.mb-in.warn{background:#b3261e;color:#fff}
.mb-in .off{margin-left:auto;background:rgba(0,0,0,.25);border-radius:99px;padding:2px 10px;font-size:.78rem}
.muted{color:var(--muted);font-size:.9rem}
.mb-in .muted{color:inherit;opacity:.85}
.cartbar{display:flex;gap:8px;justify-content:center}
.cartbar .cb-cart{flex:1;max-width:520px}
.cartbar .cb-ord{pointer-events:auto;position:relative;flex:none;width:auto;margin:0;padding:14px 18px;background:var(--surface);color:var(--text);border:1px solid var(--line)}
.cb-ord i{font-style:normal;position:absolute;top:-6px;right:-4px;background:#e0412f;color:#fff;border-radius:99px;font-size:.72rem;min-width:20px;height:20px;line-height:20px;text-align:center}
.toast{position:fixed;left:50%;bottom:88px;transform:translate(-50%,20px);z-index:80;background:#222;color:#fff;padding:11px 18px;border-radius:12px;font-size:.92rem;opacity:0;pointer-events:none;transition:.25s;max-width:90vw;text-align:center}
.toast.on{opacity:1;transform:translate(-50%,0)}
.ord{border:1px solid var(--line);border-radius:12px;padding:11px 13px;margin-top:10px;background:var(--surface)}
.ord.cx{opacity:.5}
.ord-top{display:flex;justify-content:space-between;align-items:center;gap:8px}
.ord-items{margin-top:6px}
.oi{display:flex;justify-content:space-between;gap:10px;font-size:.9rem;padding:2px 0}
.pill{font-size:.72rem;font-weight:700;border-radius:99px;padding:3px 10px;background:var(--line)}
.pill.novo{background:#ffd9d4;color:#7a1a10}.pill.preparando{background:#fbe6b5;color:#5c4000}.pill.pronto{background:#bfeccf;color:#0b5a2b}.pill.entregue{background:#d9e6ff;color:#12336b}
.warn{background:#fde8e6;color:#8a1f14;border-radius:10px;padding:10px 12px;font-size:.9rem;margin-top:10px}
.warn.ok{background:#dff5e6;color:#0b5a2b}
.tot .g{font-weight:800}
`;

  /* ---------- montagem do site ---------- */
  function buildSite(src, opts) {
    opts = opts || {};
    const d = normalize(src);
    const img = (data, name) => data ? (opts.resolveImg ? opts.resolveImg(data, name) : data) : '';
    const t = d.theme, c = d.contact, o = d.options;
    const wa = waNumber(c.whatsapp);
    const insta = instaHandle(c.instagram);
    const layout = pick(t.layout, ['list', 'grid', 'text'], 'list');
    const header = pick(t.header, HEADERS, 'center');
    const cardStyle = pick(t.cardStyle, CARDS, 'border');
    const catStyle = pick(t.catStyle, CATS, 'plain');
    const mesa = opts.mesa && opts.mesa.url && opts.mesa.codigo ? opts.mesa : null; // modo mesa (só no site da plataforma)
    const cartOn = !!(o.cartEnabled && (wa || mesa));

    const name = d.name || 'Cardápio';
    const title = name + (d.slogan ? ' — ' + d.slogan : ' — Cardápio');
    const desc = o.seoDescription || d.slogan || ('Cardápio digital de ' + name);

    const logoSrc = img(d.logo, 'logo');
    const heroSrc = img(d.hero, 'hero');
    const base = String(o.siteUrl || '').trim().replace(/\/+$/, '');
    const abs = p => (base && p && !/^data:/.test(p)) ? base + '/' + p.replace(/^\/+/, '') : '';
    const ogImage = abs(heroSrc || logoSrc);
    const orderLink = text => 'https://wa.me/' + wa + '?text=' + encodeURIComponent(text);

    /* dados para o runtime */
    const sumLines = scheduleSummary(c.schedule);
    const hasSched = sumLines.length > 0;
    const menuData = {
      tz: c.tz,
      sched: (hasSched && o.showOpenStatus) ? c.schedule.map(s => ({ o: s.open ? 1 : 0, f: s.from, t: s.to })) : [],
      items: {},
      cart: null,
      sys: mesa ? { url: String(mesa.url).replace(/\/+$/, ''), key: mesa.key, slug: mesa.slug, codigo: mesa.codigo } : null
    };
    if (cartOn) {
      const types = [];
      if (o.typeDelivery) types.push({ k: 'delivery', l: 'Entrega' });
      if (o.typePickup) types.push({ k: 'pickup', l: 'Retirada' });
      if (o.typeDinein) types.push({ k: 'dinein', l: 'Consumo no local' });
      if (!types.length) types.push({ k: 'pickup', l: 'Retirada' });
      menuData.cart = {
        wa, msg: o.orderMessage, fee: nz(parsePrice(o.deliveryFee)), min: nz(parsePrice(o.minOrder)), types,
        pays: String(o.payments || '').split(',').map(s => s.trim()).filter(Boolean)
      };
    }

    /* chips de contato */
    const chips = [];
    if (hasSched && o.showOpenStatus) chips.push('<span class="st" id="st" hidden><span></span></span>');
    const hoursText = String(c.hours || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean).join(' · ');
    if (hasSched) chips.push('<span class="chip">' + ICON.clock + '<span>' + sumLines.map(esc).join('<br>') + '</span></span>');
    else if (hoursText) chips.push('<span class="chip">' + ICON.clock + '<span>' + esc(hoursText) + '</span></span>');
    if (c.address) {
      const href = c.mapsUrl || ('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(c.address));
      chips.push('<a class="chip" href="' + esc(href) + '" target="_blank" rel="noopener">' + ICON.pin + '<span>' + esc(c.address) + '</span></a>');
    }
    if (insta) chips.push('<a class="chip" href="https://instagram.com/' + esc(insta) + '" target="_blank" rel="noopener">' + ICON.insta + '<span>@' + esc(insta) + '</span></a>');
    if (c.phone) chips.push('<a class="chip" href="tel:' + esc(String(c.phone).replace(/[^\d+]/g, '')) + '">' + ICON.phone + '<span>' + esc(c.phone) + '</span></a>');
    if (wa) chips.push('<a class="chip" href="' + orderLink('Olá!') + '" target="_blank" rel="noopener">' + ICON.wa + '<span>WhatsApp</span></a>');

    /* categorias e produtos */
    const cats = d.categories
      .map(cat => Object.assign({}, cat, { items: cat.items.filter(i => !i.hidden && String(i.name).trim()) }))
      .filter(cat => cat.items.length && String(cat.name).trim());
    const catId = (cat, k) => 'c-' + slugify(cat.name) + '-' + (k + 1);

    const itemHtml = it => {
      const vars = it.variants.filter(v => String(v.label).trim() || String(v.price).trim());
      const adds = it.addons.filter(a => String(a.label).trim());
      let priceHtml = '';
      if (it.soldOut) priceHtml = '<div class="sold">Esgotado</div>';
      else if (vars.length) priceHtml = '<ul class="variants">' + vars.map(v => '<li><span>' + esc(v.label) + '</span><b>' + esc(fmtPrice(v.price)) + '</b></li>').join('') + '</ul>';
      else if (String(it.price).trim()) priceHtml = '<div class="price">' + esc(fmtPrice(it.price)) + '</div>';

      /* carrinho */
      let btn = '';
      if (cartOn && !it.soldOut) {
        const cv = vars.map(v => ({ l: String(v.label).trim() || 'Padrão', p: parsePrice(v.price) })).filter(v => !isNaN(v.p));
        const bp = parsePrice(it.price);
        if (vars.length ? cv.length > 0 : !isNaN(bp)) {
          menuData.items[it.id] = {
            n: it.name, p: vars.length ? null : bp, v: cv,
            a: adds.map(a => ({ l: String(a.label).trim(), p: nz(parsePrice(a.price)) }))
          };
          btn = '<button type="button" class="add" data-add="' + esc(it.id) + '">+ Adicionar</button>';
        }
      } else if (!cartOn && o.itemOrderButton && wa && !it.soldOut) {
        btn = '<a class="order" href="' + orderLink(o.orderMessage + ' 1x ' + it.name) + '" target="_blank" rel="noopener">' + ICON.wa + 'Pedir</a>';
      }

      const tagsHtml = it.tags.length ? '<div class="tags">' + it.tags.map(k => '<span class="tag">' + TAGS[k][0] + ' ' + TAGS[k][1] + '</span>').join('') + '</div>' : '';
      const addsHtml = adds.length ? '<p class="adds">Adicionais: ' + adds.map(a => {
        const p = parsePrice(a.price);
        return esc(String(a.label).trim()) + (isNaN(p) || !p ? '' : ' +' + esc(fmtPrice(p)));
      }).join(' · ') + '</p>' : '';
      const im = (layout !== 'text' && it.image)
        ? '<img class="thumb" loading="lazy" alt="' + esc(it.name) + '" src="' + esc(img(it.image, 'produtos/' + slugify(it.name))) + '">' : '';
      const search = norm(it.name + ' ' + it.description + ' ' + it.tags.map(k => TAGS[k][1]).join(' '));
      return '<article class="item' + (it.featured ? ' featured' : '') + (it.soldOut ? ' soldout' : '') + '" data-s="' + esc(search) + '">' +
        '<div class="item-body"><h3>' + esc(it.name) + (it.featured ? '<span class="badge">Destaque</span>' : '') + '</h3>' +
        tagsHtml + (it.description ? '<p class="desc">' + escBr(it.description) + '</p>' : '') + addsHtml + priceHtml + btn + '</div>' + im + '</article>';
    };

    const tabsHtml = cats.length > 1
      ? '<nav class="tabs" aria-label="Categorias"><div class="tabs-in">' + cats.map((cat, k) => '<a href="#' + catId(cat, k) + '">' + esc(cat.name) + '</a>').join('') + '</div></nav>' : '';
    const sections = cats.map((cat, k) =>
      '<section class="cat" id="' + catId(cat, k) + '"><h2>' + esc(cat.name) + '</h2>' +
      (cat.description ? '<p class="cat-desc">' + escBr(cat.description) + '</p>' : '') +
      '<div class="items">' + cat.items.map(itemHtml).join('') + '</div></section>').join('');

    const credit = o.creditText
      ? '<p>' + (o.creditUrl ? '<a href="' + esc(o.creditUrl) + '" target="_blank" rel="noopener">' + esc(o.creditText) + '</a>' : esc(o.creditText)) + '</p>' : '';

    /* cabeçalho */
    const logoHtml = logoSrc ? '<img class="logo" src="' + esc(logoSrc) + '" alt="Logo ' + esc(name) + '">' : '';
    const titleHtml = '<h1>' + esc(name) + '</h1>' + (d.slogan ? '<p class="slogan">' + esc(d.slogan) + '</p>' : '');
    const chipsHtml = chips.length ? '<div class="chips">' + chips.join('') + '</div>' : '';
    const noticeHtml = o.notice ? '<div class="notice">' + escBr(o.notice) + '</div>' : '';
    const heroImg = heroSrc ? '<img src="' + esc(heroSrc) + '" alt="">' : '';
    let headerHtml;
    if (header === 'overlay' || header === 'compact') {
      headerHtml = '<header><div class="hero">' + heroImg + '<div class="wrap hero-in">' + logoHtml + '<div class="hero-tx">' + titleHtml + '</div></div></div>' +
        '<div class="wrap info">' + chipsHtml + noticeHtml + '</div></header>';
    } else {
      headerHtml = '<header><div class="hero">' + heroImg + '</div><div class="wrap"><div class="brand' + (logoSrc ? '' : ' nologo') + '">' +
        logoHtml + titleHtml + chipsHtml + '</div>' + noticeHtml + '</div></header>';
    }

    const fonts = [t.fontHeading, t.fontBody].filter(f => FONTS.includes(f));
    const dataJson = JSON.stringify(menuData).replace(/</g, '\\u003c').replace(new RegExp('\\u2028', 'g'), '\\u2028').replace(new RegExp('\\u2029', 'g'), '\\u2029');

    return '<!doctype html>\n<html lang="pt-BR"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + esc(title) + '</title>' +
      '<meta name="description" content="' + esc(desc) + '">' +
      '<meta name="theme-color" content="' + esc(t.primary) + '">' +
      '<meta property="og:type" content="website"><meta property="og:title" content="' + esc(title) + '"><meta property="og:description" content="' + esc(desc) + '">' +
      (base ? '<meta property="og:url" content="' + esc(base + '/') + '">' : '') +
      (ogImage ? '<meta property="og:image" content="' + esc(ogImage) + '"><meta name="twitter:card" content="summary_large_image">' : '') +
      (logoSrc ? '<link rel="icon" href="' + esc(logoSrc) + '">' : '') +
      '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
      '<link rel="stylesheet" href="' + fontHref(fonts) + '">' +
      '<style>:root{--primary:' + esc(t.primary) + ';--on-primary:' + onColor(t.primary) + ';--oh:' + (heroSrc ? '#ffffff' : onColor(t.primary)) +
      ';--bg:' + esc(t.bg) + ';--surface:' + esc(t.surface) + ';--text:' + esc(t.text) +
      ';--radius:' + (parseInt(t.radius, 10) || 0) + 'px;--ov:' + ((parseInt(t.heroOverlay, 10) || 0) / 100).toFixed(2) +
      ';--fh:' + fontStack(t.fontHeading) + ';--fb:' + fontStack(t.fontBody) + '}' + SITE_CSS + '</style></head>\n' +
      '<body class="layout-' + layout + ' hd-' + header + ' cs-' + cardStyle + ' ct-' + catStyle + '">' +
      headerHtml + '\n' + tabsHtml +
      '<main class="wrap">' +
      (o.showSearch && cats.length ? '<div class="search"><input id="q" type="search" placeholder="Buscar no cardápio…" aria-label="Buscar no cardápio" autocomplete="off"></div>' : '') +
      (cats.length ? sections + '<p class="none" id="none" hidden>Nenhum item encontrado.</p>' : '<p class="empty">Cardápio em breve.</p>') +
      '</main>\n' +
      '<footer>' + (o.footerText ? '<p>' + escBr(o.footerText) + '</p>' : '') + credit + '</footer>' +
      ((!cartOn && o.orderButton && wa) ? '<a class="fab" href="' + orderLink(o.orderMessage) + '" target="_blank" rel="noopener">' + ICON.wa + 'Fazer pedido</a>' : '') +
      '<script type="application/json" id="menu-data">' + dataJson + '<\/script>' +
      '<script>' + (mesa ? 'var makeApi=' + makeApi.toString() + ';' : '') + '(' + siteRuntime.toString() + ')();<\/script></body></html>';
  }


  /* ---------- plataforma ---------- */
  /* itens do cardápio no formato que o banco usa para calcular preços */
  function systemMenu(src) {
    const d = normalize(src), out = [];
    d.categories.forEach(c => c.items.forEach(it => {
      if (it.hidden) return;
      const vs = it.variants.map(v => ({ l: String(v.label).trim() || 'Padrão', p: parsePrice(v.price) })).filter(v => !isNaN(v.p));
      const bp = parsePrice(it.price);
      if (it.variants.length ? !vs.length : isNaN(bp)) return;
      out.push({
        id: it.id, nome: it.name, preco: it.variants.length ? 0 : bp, variantes: vs,
        adicionais: it.addons.map(a => ({ l: String(a.label).trim(), p: nz(parsePrice(a.price)) })).filter(a => a.l),
        esgotado: !!it.soldOut
      });
    }));
    return out;
  }

  /* folha imprimível com um QR por mesa. info = {nome, cor}; urlOf(mesa) = endereço; qrSvg(url) = SVG do QR */
  function buildQrSheet(info, mesas, urlOf, qrSvg) {
    const cor = /^#[0-9a-f]{6}$/i.test(info.cor || '') ? info.cor : '#1d4ed8';
    const cards = mesas.map(m => '<div class="c"><div class="nm">' + esc(info.nome) + '</div><div class="q">' + qrSvg(urlOf(m)) + '</div><div class="mn">Mesa ' + esc(m.numero) + '</div><div class="h">Aponte a câmera, digite seu nome e peça pelo celular</div></div>').join('');
    return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>QR Codes — ' + esc(info.nome) + '</title><style>' +
      '*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif;color:#111}.bar{padding:12px 16px;background:#f3f4f6;display:flex;gap:12px;align-items:center}.bar button{padding:8px 16px;border:0;border-radius:8px;background:' + cor + ';color:' + onColor(cor) + ';font-weight:700;cursor:pointer}' +
      '.g{display:grid;grid-template-columns:repeat(2,1fr);gap:0}.c{border:1px dashed #999;padding:22px;text-align:center;break-inside:avoid;height:50vh;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:8px}' +
      '.nm{font-weight:700;font-size:1.1rem}.q svg{width:200px;height:200px}.mn{font-size:2rem;font-weight:800}.h{font-size:.85rem;color:#555;max-width:240px}' +
      '@media print{.bar{display:none}.c{height:48vh}}</style></head><body><div class="bar"><button onclick="print()">Imprimir</button><span>' + mesas.length + ' QR Code(s)</span></div><div class="g">' + cards + '</div></body></html>';
  }

  return { buildSite, buildQrSheet, systemMenu, normalize, defaults, parseBulk, slugify, parsePrice, fmtPrice, uid, scheduleSummary, FONTS, PRESETS, THEMES, TAGS, TZS };
})();
