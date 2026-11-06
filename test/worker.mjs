// Verifica o dist/ servido pelo Worker (wrangler dev = mesmo runtime do Cloudflare) com o wrangler.jsonc real.
import { spawn, execSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { launchBrowser } from './_env.mjs';

const here = path.dirname(fileURLToPath(import.meta.url)), proj = path.resolve(here, '..');
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };
execSync('node build-web.mjs', { cwd: proj, stdio: 'ignore' });
const PORT = 8799, BASE = 'http://127.0.0.1:' + PORT;
// Executa o wrangler pelo Node (process.execPath + script JS): funciona igual no Windows e no Linux.
// node_modules/.bin/wrangler é um atalho de shell no Windows (wrangler.cmd) e não pode ser aberto por spawn().
const w = spawn(process.execPath, [path.join(proj, 'node_modules/wrangler/bin/wrangler.js'), 'dev', '--port', String(PORT), '--ip', '127.0.0.1'], { cwd: proj, detached: process.platform !== 'win32', env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false' } });
let log = '', exited = false; w.stdout.on('data', d => log += d); w.stderr.on('data', d => log += d);
w.on('error', e => { log += String(e); exited = true; }); w.on('exit', () => { exited = true; });
// O wrangler cria processos filhos (CLI real + workerd) que seguram a porta: encerra a árvore toda.
// Windows: taskkill /T. Linux/macOS: processo em grupo próprio (detached) e kill no grupo (-pid).
const stop = () => { try { if (process.platform === 'win32') execSync('taskkill /pid ' + w.pid + ' /T /F', { stdio: 'ignore' }); else process.kill(-w.pid, 'SIGKILL'); } catch (e) { /* já parou */ } };
process.on('exit', stop);
for (let i = 0; i < 90 && !exited; i++) { try { if ((await fetch(BASE + '/config.js')).ok) break; } catch (e) { /* ainda subindo */ } await new Promise(r => setTimeout(r, 1000)); }
if (exited) { console.error('O wrangler dev encerrou antes de responder:\n' + log.slice(-1500)); process.exit(1); }

const nav = { 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Dest': 'document', Accept: 'text/html' };
import http from 'node:http';
const get = (p, h) => new Promise((res, rej) => http.get(BASE + p, { headers: h || {} }, r => { let t = ''; r.on('data', d => t += d); r.on('end', () => res({ s: r.statusCode, t, h: { get: k => r.headers[k.toLowerCase()] } })); }).on('error', rej));
const idx = fs.readFileSync(path.join(proj, 'dist/index.html'), 'utf8');
console.log('1) arquivos servidos');
const cfg = await get('/config.js');
ok(cfg.s === 200 && /supabaseUrl: 'https:\/\/[a-z0-9]+\.supabase\.co'/.test(cfg.t), 'config.js publicado com a URL do Supabase');
const jwts = (cfg.t + idx).match(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g) || [];
ok(!/sb_secret_[\w-]{10,}/.test(cfg.t + idx) && !jwts.some(j => /service_role/.test(Buffer.from(j.split('.')[1], 'base64url').toString())), 'nenhuma chave secreta (sb_secret_/service_role) no que é publicado');
const root = await get('/', nav);
ok(root.s === 200 && root.t === idx && !root.t.includes('/*{{'), 'raiz serve o index.html já gerado (sem marcadores)');
console.log('2) rotas da SPA (navegação)');
for (const p of ['/admin', '/pizzaria-boa', '/pizzaria-boa/menu', '/pizzaria-boa/abc12345']) {
  const r = await get(p, nav); ok(r.s === 200 && r.t === idx, p + ' → index.html (200)');
}
console.log('3) arquivos inexistentes continuam 404');
for (const p of ['/nao-existe.js', '/assets/foto.webp', '/favicon.ico']) { const r = await get(p, { 'Sec-Fetch-Mode': 'no-cors', 'Sec-Fetch-Dest': 'script' }); ok(r.s === 404, p + ' (fora de navegação) → 404'); }
ok((await get('/_headers', { 'Sec-Fetch-Mode': 'cors' })).s === 404, '_headers não é exposto como arquivo');
ok((await get('/nao-existe.js')).s === 404, 'sem cabeçalhos Sec-Fetch (curl) → 404');
ok(/nosniff/i.test(root.h.get('x-content-type-options') || ''), 'cabeçalhos de segurança aplicados');

console.log('4) no navegador');
const b = await launchBrowser();
const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(BASE + '/admin'); await p.waitForSelector('#email');
ok(true, '/admin mostra o login do dono');
await p.goto(BASE + '/'); await p.waitForSelector('h1');
ok(/Menu Azul/.test(await p.textContent('h1')), '/ mostra a página inicial (não fica branca)');
await b.close(); stop();
ok(errs.length === 0, 'sem erros de JavaScript' + (errs.length ? ': ' + errs.join('; ') : ''));
console.log(fails ? `\n${fails} falha(s)\n` + log.slice(-1500) : '\nWorker OK');
process.exit(fails ? 1 : 0);
