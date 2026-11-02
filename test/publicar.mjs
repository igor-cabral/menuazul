// E2E: editor local publica o cardápio (com fotos) na plataforma; o site da plataforma o exibe.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { startFakeBackend } from './fake-backend.mjs';

const root = execSync('npm root -g').toString().trim();
const require = createRequire(path.join(root, 'x.js'));
const { chromium } = require('playwright');
const sharp = require('sharp');
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.OUT || fs.mkdtempSync('/tmp/gcq-');
const WEB = path.join(OUT, 'web'); fs.mkdirSync(WEB, { recursive: true });
const errors = []; let fails = 0;
const ok = (c, msg) => { console.log((c ? '  ✓ ' : '  ✗ ') + msg); if (!c) fails++; };
const watch = (p, tag) => {
  p.on('pageerror', e => errors.push(tag + ' pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource|status of 4\d\d/.test(m.text())) errors.push(tag + ' console: ' + m.text()); });
  p.on('dialog', d => d.accept());
};

const be = await startFakeBackend();
await be.criarUsuarioAuth('dono@menuazul.com', 'senha-do-dono', true);
await be.criarUsuarioAuth('intruso@x.com', 'abc', false);
const dono = (await be.query("select id from auth.users where email = 'dono@menuazul.com'")).rows[0].id;
await be.rpc('plataforma_criar_restaurante', { p_slug: 'burger-bom', p_nome: 'Burger Bom', p_admin_login: 'dono', p_admin_nome: 'Ana', p_admin_senha: 'senha123' }, dono);
await be.rpc('plataforma_criar_restaurante', { p_slug: 'outro', p_nome: 'Outro', p_admin_login: 'dono', p_admin_nome: 'Z', p_admin_senha: 'senha123' }, dono);

fs.writeFileSync(path.join(OUT, 'config.js'), `window.GC_CONFIG={supabaseUrl:${JSON.stringify(be.url)},supabaseKey:'sb_publishable_teste'};`);
execSync('node build-web.mjs', { cwd: path.resolve(here, '..'), env: { ...process.env, WEB_OUT: WEB, CONFIG_FILE: path.join(OUT, 'config.js') } });
const web = http.createServer((req, res) => { const f = path.join(WEB, req.url.startsWith('/config.js') ? 'config.js' : 'index.html'); res.setHeader('Content-Type', f.endsWith('.js') ? 'text/javascript' : 'text/html; charset=utf-8'); res.end(fs.readFileSync(f)); });
await new Promise(r => web.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + web.address().port;

const logo = path.join(OUT, 'logo.jpg'); await sharp({ create: { width: 600, height: 600, channels: 3, background: { r: 214, g: 40, b: 40 } } }).jpeg().toFile(logo);
const prod = path.join(OUT, 'prod.jpg'); await sharp({ create: { width: 800, height: 600, channels: 3, background: { r: 240, g: 170, b: 60 } } }).jpeg().toFile(prod);

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage(); watch(page, 'editor');
await page.goto('file://' + path.resolve(here, '../editor.html'));
await page.click('#btn-new'); await page.fill('#dlg input', 'Burger Bom'); await page.click('#dlg button[type=submit]');
await page.waitForSelector('#view-editor:not([hidden])');
await page.locator('#panel input[type=file]').nth(0).setInputFiles(logo);
await page.waitForTimeout(500);
await page.click('.tab:has-text("Cardápio")');
await page.evaluate(() => {
  const c = GC.state();
  c.categories = [{ id: 'c1', name: 'Lanches', description: '', items: [
    { id: 'x1', name: 'X-Burger', description: 'Pão e carne', price: '20,00', image: null, featured: false, soldOut: false, hidden: false, variants: [], addons: [{ label: 'Bacon', price: '5,00' }], tags: [] },
    { id: 'sold', name: 'Acabou', description: '', price: '9,00', image: null, featured: false, soldOut: true, hidden: false, variants: [], addons: [], tags: [] }] }];
});
await page.click('.tab:has-text("Marca")'); await page.click('.tab:has-text("Plataforma")');

console.log('1) conexão');
await page.fill('#pl-url', be.url); await page.fill('#pl-key', 'sb_publishable_teste'); await page.fill('#pl-site', BASE); await page.fill('#pl-email', 'dono@menuazul.com');
await page.fill('#pl-senha', 'errada'); await page.click('#pl-entrar');
await page.waitForFunction(() => /incorretos/.test(document.querySelector('#plat-status').textContent));
ok(true, 'senha errada recusada');
await page.fill('#pl-email', 'intruso@x.com'); await page.fill('#pl-senha', 'abc'); await page.click('#pl-entrar');
await page.waitForFunction(() => /não é administradora/.test(document.querySelector('#plat-status').textContent));
ok(true, 'conta comum não publica');
await page.fill('#pl-email', 'dono@menuazul.com'); await page.fill('#pl-senha', 'senha-do-dono'); await page.click('#pl-entrar');
await page.waitForSelector('#pl-rest');
ok(await page.locator('#pl-rest option').count() === 3, 'lista os restaurantes da plataforma');
await page.selectOption('#pl-rest', 'burger-bom');
await page.waitForSelector('#pl-publicar');

console.log('2) publicar');
await page.click('#pl-publicar');
await page.waitForSelector('#toast.on:has-text("Publicado")');
const row = (await be.query("select cardapio, publicado_em from restaurantes where slug = 'burger-bom'")).rows[0];
ok(row.cardapio && row.cardapio.name === 'Burger Bom' && row.publicado_em, 'modelo salvo no restaurante certo');
ok(/\/storage\/v1\/object\/public\/cardapios\/burger-bom\/[0-9a-f]{12}\.\w+$/.test(row.cardapio.logo), 'logo virou URL do Storage: ' + row.cardapio.logo.replace(be.url, ''));
ok(be.files.size === 1, 'foto enviada ao Storage (1 arquivo)');
const itens = (await be.query("select id, esgotado from cardapio where restaurante_id = (select id from restaurantes where slug = 'burger-bom') order by id")).rows;
ok(itens.length === 2 && itens.find(i => i.id === 'sold').esgotado, 'tabela de preços criada; item esgotado do editor respeitado');
ok((await be.query("select count(*)::int n from cardapio where restaurante_id = (select id from restaurantes where slug = 'outro')")).rows[0].n === 0, 'outro restaurante intocado');
ok(!JSON.stringify(row.cardapio).includes('data:image'), 'nenhuma imagem embutida no modelo');
await page.click('#pl-publicar'); await page.waitForSelector('#toast.on:has-text("Publicado")'); await page.waitForTimeout(300);
ok(be.files.size === 1, 'republicar não reenvia foto igual');

console.log('3) site da plataforma exibe');
const v = await (await browser.newContext({ viewport: { width: 390, height: 800 }, isMobile: true })).newPage(); watch(v, 'cliente');
await v.goto(BASE + '/burger-bom/menu'); await v.waitForSelector('h1');
ok(/Burger Bom/.test(await v.textContent('h1')) && /X-Burger/.test(await v.textContent('body')), 'cardápio publicado aparece em /burger-bom/menu');
await v.waitForFunction(() => { const i = document.querySelector('img.logo'); return i && i.complete && i.naturalWidth > 0; });
ok(true, 'logo carrega do Storage');
ok(/Esgotado/.test(await v.textContent('body')), 'item esgotado marcado');
await v.screenshot({ path: path.join(OUT, 'menu-publicado.png') });
await page.screenshot({ path: path.join(OUT, 'editor-plataforma.png') });

console.log('\nErros de console/página: ' + (errors.length ? '\n  ' + errors.join('\n  ') : 'nenhum'));
console.log('Saídas em ' + OUT);
await browser.close(); web.close(); await be.stop();
process.exit(fails || errors.length ? 1 : 0);
