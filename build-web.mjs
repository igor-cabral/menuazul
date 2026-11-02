// Gera dist/ (site da plataforma para o Cloudflare Pages): index.html + _redirects + config.js
import fs from 'node:fs';
const read = p => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const safe = s => s.replace(/<\/script/gi, '<\\/script');
const bundle = ['api', 'runtime-site', 'runtime-kds', 'runtime-caixa', 'generator'].map(n => read('./src/' + n + '.js')).concat(read('./web/portal.js')).join('\n');
const html = read('./web/index.html')
  .replace('/*{{CSS}}*/', () => read('./web/portal.css'))
  .replace('/*{{QR}}*/', () => safe(read('./node_modules/qrcode-generator/dist/qrcode.js')))
  .replace('/*{{BUNDLE}}*/', () => safe(bundle));
const out = process.env.WEB_OUT ? new URL('file://' + process.env.WEB_OUT.replace(/\/?$/, '/')) : new URL('./dist/', import.meta.url);
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(new URL('index.html', out), html);
fs.writeFileSync(new URL('_redirects', out), '/*  /index.html  200\n');
fs.writeFileSync(new URL('_headers', out), '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  X-Frame-Options: DENY\n/config.js\n  Cache-Control: no-cache\n');
fs.copyFileSync(new URL(process.env.CONFIG_FILE ? 'file://' + process.env.CONFIG_FILE : './web/config.js', import.meta.url), new URL('config.js', out));
console.log((process.env.WEB_OUT || 'dist') + '/ gerado —', (html.length / 1024).toFixed(0), 'KB');
