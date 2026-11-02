// Gera dist/ (publicado pelo Cloudflare Workers com Static Assets, ver wrangler.jsonc): index.html + _headers + config.js
// O fallback de SPA (/admin, /restaurante...) é feito pelo wrangler.jsonc (not_found_handling), não por _redirects.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const read = p => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const safe = s => s.replace(/<\/script/gi, '<\\/script');
const bundle = ['api', 'runtime-site', 'runtime-kds', 'runtime-caixa', 'generator'].map(n => read('./src/' + n + '.js')).concat(read('./web/portal.js')).join('\n');
const html = read('./web/index.html')
  .replace('/*{{CSS}}*/', () => read('./web/portal.css'))
  .replace('/*{{QR}}*/', () => safe(read('./node_modules/qrcode-generator/dist/qrcode.js')))
  .replace('/*{{BUNDLE}}*/', () => safe(bundle));
const out = process.env.WEB_OUT ? pathToFileURL(path.resolve(process.env.WEB_OUT) + path.sep) : new URL('./dist/', import.meta.url);
if (/\/\*\{\{/.test(html)) throw new Error('Marcador de template não preenchido em index.html');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(new URL('index.html', out), html);
fs.writeFileSync(new URL('_headers', out), '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  X-Frame-Options: DENY\n/config.js\n  Cache-Control: no-cache\n');
fs.copyFileSync(new URL(process.env.CONFIG_FILE ? pathToFileURL(path.resolve(process.env.CONFIG_FILE)).href : './web/config.js', import.meta.url), new URL('config.js', out));
if (/SEU-PROJETO|SUA-CHAVE/.test(read('./web/config.js')) && !process.env.CONFIG_FILE) console.warn('AVISO: web/config.js ainda tem a URL/chave de exemplo.');
console.log((process.env.WEB_OUT || 'dist') + '/ gerado —', (html.length / 1024).toFixed(0), 'KB');
