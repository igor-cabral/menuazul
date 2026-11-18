// Gera dist/ (publicado pelo Cloudflare Workers com Static Assets, ver wrangler.jsonc): index.html + _headers + config.js
// O fallback de SPA (/admin, /restaurante...) é feito pelo wrangler.jsonc (not_found_handling), não por _redirects.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import crypto from 'node:crypto';
const read = p => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const safe = s => s.replace(/<\/script/gi, '<\\/script');
// As telas da equipe (cozinha, caixa, garçom) vão num arquivo à parte, carregado só quando alguém da equipe abre uma delas:
// o cliente que só escaneia o QR não baixa esse código.
const staffJs = '(function () {\n' + ['runtime-kds', 'runtime-caixa', 'runtime-garcom'].map(n => read('./src/' + n + '.js')).join('\n') +
  '\nwindow.GCStaff = { kdsRuntime: kdsRuntime, caixaRuntime: caixaRuntime, garcomRuntime: garcomRuntime, KDS_CSS: KDS_CSS, CAIXA_CSS: CAIXA_CSS, GARCOM_CSS: GARCOM_CSS };\n})();\n';
const staffUrl = '/app/staff.' + crypto.createHash('sha256').update(staffJs).digest('hex').slice(0, 10) + '.js';   // nome com hash: o navegador guarda para sempre
const bundle = ['api', 'runtime-site', 'generator'].map(n => read('./src/' + n + '.js')).concat(read('./web/portal.js').replace('__APP_VERSION__', JSON.parse(read('./package.json')).version).replace('__STAFF_URL__', staffUrl)).join('\n');
const html = read('./web/index.html')
  .replace('/*{{CSS}}*/', () => read('./web/portal.css'))
  .replace('/*{{QR}}*/', () => safe(read('./node_modules/qrcode-generator/dist/qrcode.js')))
  .replace('/*{{BUNDLE}}*/', () => safe(bundle));
const out = process.env.WEB_OUT ? pathToFileURL(path.resolve(process.env.WEB_OUT) + path.sep) : new URL('./dist/', import.meta.url);
if (/\/\*\{\{/.test(html)) throw new Error('Marcador de template não preenchido em index.html');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(new URL('index.html', out), html);
fs.mkdirSync(new URL('app/', out), { recursive: true });
fs.writeFileSync(new URL('.' + staffUrl, out), staffJs);
await import('./build.mjs'); // gera editor.html (o mesmo de `npm run build`); o painel do restaurante o carrega para administradores
fs.copyFileSync(new URL('./editor.html', import.meta.url), new URL('editor.html', out));
fs.cpSync(new URL('./web/brand/', import.meta.url), new URL('brand/', out), { recursive: true }); // logos e ícones da marca
for (const f of fs.readdirSync(new URL('./web/legal/', import.meta.url))) fs.copyFileSync(new URL('./web/legal/' + f, import.meta.url), new URL(f, out)); // /termos e /privacidade
fs.writeFileSync(new URL('_headers', out), '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  X-Frame-Options: DENY\n/config.js\n  Cache-Control: no-cache\n/brand/*\n  Cache-Control: public, max-age=86400\n/app/*\n  Cache-Control: public, max-age=31536000, immutable\n');
fs.copyFileSync(new URL(process.env.CONFIG_FILE ? pathToFileURL(path.resolve(process.env.CONFIG_FILE)).href : './web/config.js', import.meta.url), new URL('config.js', out));
if (/SEU-PROJETO|SUA-CHAVE/.test(read('./web/config.js')) && !process.env.CONFIG_FILE) console.warn('AVISO: web/config.js ainda tem a URL/chave de exemplo.');
console.log((process.env.WEB_OUT || 'dist') + '/ gerado —', (html.length / 1024).toFixed(0), 'KB');
