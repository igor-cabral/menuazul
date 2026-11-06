// Teste de ponta a ponta no Chrome real.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import sharp from 'sharp';
import { launchBrowser, tmpDir, fileUrl } from './_env.mjs';

const JSZip = createRequire(import.meta.url)('jszip');

const here = path.dirname(fileURLToPath(import.meta.url));
const editorUrl = fileUrl(path.resolve(here, '../editor.html'));
const OUT = process.env.OUT || tmpDir('gc-');
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
let fails = 0;
const ok = (c, msg) => { console.log((c ? '  ✓ ' : '  ✗ ') + msg); if (!c) fails++; };
const nb = s => String(s).replace(/ /g, ' ');

const mk = async (w, h, rgb, name) => { const p = path.join(OUT, name); await sharp({ create: { width: w, height: h, channels: 3, background: rgb } }).jpeg().toFile(p); return p; };
const logoF = await mk(600, 600, { r: 214, g: 40, b: 40 }, 'logo.jpg');
const heroF = await mk(2000, 1000, { r: 60, g: 90, b: 140 }, 'hero.jpg');
const prodF = await mk(1200, 900, { r: 240, g: 170, b: 60 }, 'prod.jpg');

const browser = await launchBrowser();
const watch = p => {
  p.on('pageerror', e => errors.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) errors.push('console: ' + m.text()); });
};

/* =============== A) editor + site exportado =============== */
const ctx = await browser.newContext({ viewport: { width: 1400, height: 860 }, acceptDownloads: true });
const page = await ctx.newPage(); watch(page);
const pv = () => page.frameLocator('#preview');

console.log('1) criar restaurante');
await page.goto(editorUrl);
await page.click('#btn-new');
await page.fill('#dlg input', 'Burger Bom');
await page.click('#dlg button[type=submit]');
await page.waitForSelector('#view-editor:not([hidden])');
await pv().locator('h1').waitFor();
ok((await pv().locator('h1').innerText()) === 'Burger Bom', 'preview mostra o nome');

console.log('2) marca (logo, hero, cores)');
const files = page.locator('#panel input[type=file]');
await files.nth(0).setInputFiles(logoF);
await files.nth(1).setInputFiles(heroF);
await page.click('.preset:has-text("Café")');
await page.waitForTimeout(500);
ok(await pv().locator('img.logo').count() === 1, 'logo aparece no preview');
await page.fill('#panel label:has(.f-l:text("Slogan")) input', 'Hambúrguer artesanal');

console.log('3) contato + horários estruturados');
await page.click('.tab:has-text("Contato")');
await page.fill('#panel label:has(.f-l:text("WhatsApp")) input', '(47) 99999-1234');
await page.fill('#panel label:has(.f-l:text("Instagram")) input', '@burgerbom');
await page.fill('#panel label:has(.f-l:text("Endereço")) input', 'Rua das Flores, 100 - Centro');
await page.click('button:has-text("Seg a Sex")');
await page.locator('.srow').nth(5).locator('input[type=checkbox]').check();
await page.locator('.srow').nth(6).locator('input[type=checkbox]').check();
for (const i of [5, 6]) {
  await page.locator('.srow').nth(i).locator('input[type=time]').nth(0).fill('12:00');
  await page.locator('.srow').nth(i).locator('input[type=time]').nth(1).fill('00:00');
}
await page.waitForTimeout(500);
const chipsTxt = await pv().locator('.chips').innerText();
ok(chipsTxt.includes('Seg a Sex: 18h às 23h') && chipsTxt.includes('Sáb e Dom: 12h às 00h'), 'horários agrupados no preview');
ok((await pv().locator('a.fab').count()) === 0 && (await pv().locator('#st').count()) === 1, 'sem botão flutuante (carrinho ativo) e com selo aberto/fechado');

console.log('4) cardápio (colar lista, foto, adicionais, etiquetas)');
await page.click('.tab:has-text("Cardápio")');
await page.click('button:has-text("Colar lista")');
await page.fill('#dlg textarea', '# Lanches\nX-Burger | Pão, carne 160g, queijo | 24,90\nX-Salada | Com alface e tomate | 27\n\n# Bebidas\nCoca-Cola Lata - 6,50\nSuco natural | Laranja ou limão | 9,00');
await page.click('#dlg button[type=submit]');
await page.waitForTimeout(500);
ok(await page.locator('.cat').count() === 2 && await page.locator('.item').count() === 4, '2 categorias, 4 produtos');
await page.locator('.item').first().locator('input[type=file]').setInputFiles(prodF);
// X-Burger: adicional + etiqueta
const it0 = page.locator('.item').nth(0);
await it0.locator('.icon[title=Detalhes]').click();
await it0.locator('button:has-text("Adicionar adicional")').click();
await page.locator('.item').nth(0).locator('.vrow[data-kind=addons] input').nth(0).fill('Queijo extra');
await page.locator('.item').nth(0).locator('.vrow[data-kind=addons] input').nth(1).fill('2,00');
await page.locator('.item').nth(0).locator('.tagb:has-text("Picante")').click();
// X-Salada: variação + destaque
const it1 = page.locator('.item').nth(1);
await it1.locator('.icon[title=Detalhes]').click();
await it1.locator('button:has-text("Adicionar variação")').click();
await page.locator('.item').nth(1).locator('.vrow[data-kind=variants] input').nth(0).fill('Grande');
await page.locator('.item').nth(1).locator('.vrow[data-kind=variants] input').nth(1).fill('32,00');
await page.locator('.item').nth(1).locator('.flags label:has-text("Destaque") input').check();
await page.waitForTimeout(500);
const body = await pv().locator('body').innerText();
ok(/24,90/.test(body) && /32,00/.test(body) && /destaque/i.test(body), 'preços, variação e destaque');
ok(/Picante/.test(body) && /Queijo extra/.test(body), 'etiqueta e adicional aparecem');
ok(await pv().locator('.add').count() === 4, 'botão "+ Adicionar" em cada produto (carrinho)');

console.log('5) opções do carrinho');
await page.click('.tab:has-text("Opções")');
await page.fill('#panel label:has(.f-l:text("Taxa de entrega")) input', '5,00');
await page.waitForTimeout(400);

console.log('6) temas e estilos');
await page.click('.tab:has-text("Marca")');
const themeCheck = { 'Hamburgueria': ['hd-overlay', 'cs-flat', 'ct-bar', 'layout-grid'], 'Cafeteria': ['hd-left', 'cs-shadow'], 'Minimalista': ['hd-compact', 'layout-text'], 'Bistrô': ['ct-center', 'layout-text'] };
for (const [name, classes] of Object.entries(themeCheck)) {
  await page.click('.theme:has(b:text-is("' + name + '"))');
  await page.waitForTimeout(450);
  const cls = await pv().locator('body').getAttribute('class');
  ok(classes.every(c => cls.includes(c)), 'tema ' + name + ' → ' + cls);
  await page.locator('.frame').screenshot({ path: path.join(OUT, 'tema-' + name.toLowerCase().replace(/[^a-z]/g, '') + '.png') });
}
await page.click('.theme:has(b:text-is("Clássico"))');
await page.click('.preset:has-text("Café")');
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(OUT, 'editor.png') });

console.log('7) persistência');
await page.waitForTimeout(800);
await page.reload();
await page.waitForSelector('.rcard');
ok(await page.locator('.rcard h3:text("Burger Bom")').count() === 1, 'restaurante sobrevive ao reload');
await page.click('.rcard button:has-text("Abrir")');
await pv().locator('h1').waitFor();
await page.waitForTimeout(300);
ok(await pv().locator('.item').count() === 4, 'produtos sobrevivem ao reload');

console.log('8) exportar ZIP');
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btn-export')]);
const zipPath = path.join(OUT, dl.suggestedFilename());
await dl.saveAs(zipPath);
const zip = await JSZip.loadAsync(fs.readFileSync(zipPath));
const names = Object.keys(zip.files);
console.log('   ', dl.suggestedFilename(), '→', names.join(', '));
ok(zip.file('index.html') && zip.file('cardapio.json') && zip.file('.nojekyll'), 'index.html, cardapio.json, .nojekyll');
ok(names.some(n => /^assets\/logo\./.test(n)) && names.some(n => /^assets\/hero\./.test(n)) && names.some(n => /^assets\/produtos\/x-burger/.test(n)), 'imagens em assets/');
const exported = await zip.file('index.html').async('string');
ok(!/data:image/.test(exported) && exported.includes('id="menu-data"'), 'HTML sem imagens embutidas e com menu-data');
const siteDir = path.join(OUT, 'site');
fs.rmSync(siteDir, { recursive: true, force: true });
for (const n of names) { if (zip.files[n].dir) continue; const f = path.join(siteDir, n); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, await zip.file(n).async('nodebuffer')); }
const siteUrl = fileUrl(path.join(siteDir, 'index.html'));

console.log('9) site exportado: aberto/fechado');
const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
async function sitePage(iso) {
  const p = await mob.newPage(); watch(p);
  await p.addInitScript(() => { window.open = u => { window.__opened = u; return {}; }; });
  if (iso) await p.clock.install({ time: new Date(iso) });
  await p.goto(siteUrl);
  await p.waitForTimeout(400);
  return p;
}
const stText = p => p.locator('#st').innerText();
let sp = await sitePage('2026-11-02T20:00:00-03:00'); // segunda 20h
let t = await stText(sp);
ok(/Aberto agora/.test(t) && /fecha às 23h/.test(t), 'segunda 20h: ' + t);
await sp.close();
sp = await sitePage('2026-11-02T10:00:00-03:00'); // segunda 10h
t = await stText(sp);
ok(/Fechado/.test(t) && /abre hoje às 18h/.test(t), 'segunda 10h: ' + t);
await sp.close();
sp = await sitePage('2026-11-07T23:30:00-03:00'); // sábado 23:30 (12h–00h)
t = await stText(sp);
ok(/Aberto agora/.test(t) && /fecha às 00h/.test(t), 'sábado 23h30: ' + t);
await sp.close();
sp = await sitePage('2026-11-08T00:30:00-03:00'); // domingo 00:30 -> sábado fechou à meia-noite; domingo abre 12h
t = await stText(sp);
ok(/Fechado/.test(t) && /abre hoje às 12h/.test(t), 'domingo 00h30: ' + t);
await sp.close();

console.log('10) site exportado: navegação, busca e carrinho');
sp = await sitePage('2026-11-02T20:00:00-03:00');
ok(await sp.evaluate(() => [...document.images].every(i => i.complete && i.naturalWidth > 0)), 'todas as imagens carregam');
await sp.click('.tabs a:has-text("Bebidas")');
await sp.waitForTimeout(900);
ok(await sp.evaluate(() => document.querySelector('.tabs a.on').textContent) === 'Bebidas', 'aba ativa ao rolar');
await sp.fill('#q', 'picante');
ok(await sp.evaluate(() => [...document.querySelectorAll('.item')].filter(i => !i.hidden).length) === 1, 'busca acha pela etiqueta "Picante"');
await sp.fill('#q', 'xyz');
ok(await sp.evaluate(() => !document.getElementById('none').hidden), 'mensagem de "nenhum item"');
await sp.fill('#q', '');
// carrinho
await sp.click('.item:has-text("Coca-Cola") .add');
ok((await sp.locator('.cartbar .n').innerText()) === '1', 'adicionar item simples (sem janela)');
await sp.click('.item:has-text("X-Burger") .add');
await sp.waitForSelector('.sheet');
ok(await sp.locator('.sheet .opt:has-text("Queijo extra")').count() === 1, 'item com adicional abre a folha de opções');
await sp.locator('.sheet .opt:has-text("Queijo extra") input').check();
ok(nb(await sp.locator('.sheet .go').innerText()).includes('R$ 26,90'), 'preço da folha soma o adicional (26,90)');
await sp.click('.sheet .go');
ok((await sp.locator('.cartbar .n').innerText()) === '2' && nb(await sp.locator('.cartbar .t').innerText()) === 'R$ 33,40', 'barra: 2 itens, R$ 33,40');
await sp.click('.cartbar button');
await sp.waitForSelector('.sheet .line');
ok(await sp.locator('.sheet .line').count() === 2, 'carrinho lista 2 linhas');
await sp.click('.send');
ok(/Preencha/.test(await sp.locator('.sheet .warn').last().innerText()), 'valida campos obrigatórios');
await sp.fill('#cf-name', 'Maria');
await sp.click('.types label:has-text("Entrega")');
await sp.fill('#cf-addr', 'Rua das Palmeiras, 55');
await sp.selectOption('#cf-pay', 'Dinheiro');
await sp.fill('#cf-change', '50,00');
ok(nb(await sp.locator('.tot').innerText()).includes('R$ 38,40'), 'total com taxa de entrega (R$ 38,40)');
await sp.screenshot({ path: path.join(OUT, 'carrinho.png') });
await sp.click('.send');
const opened = await sp.evaluate(() => window.__opened);
const msg = nb(decodeURIComponent((opened || '').split('text=')[1] || ''));
console.log(msg.split('\n').map(l => '      | ' + l).join('\n'));
ok((opened || '').startsWith('https://wa.me/5547999991234?text='), 'abre wa.me com o número certo');
ok(/1x X-Burger/.test(msg) && /\+ Queijo extra/.test(msg) && /1x Coca-Cola Lata/.test(msg), 'mensagem lista os itens e adicionais');
ok(/Taxa de entrega: R\$ 5,00/.test(msg) && /\*Total: R\$ 38,40\*/.test(msg), 'mensagem com taxa e total');
ok(/\*Tipo:\* Entrega/.test(msg) && /Rua das Palmeiras/.test(msg) && /Dinheiro \(troco para 50,00\)/.test(msg) && /Maria/.test(msg), 'mensagem com cliente, tipo, endereço e pagamento');
await sp.keyboard.press('Escape');
await sp.reload(); await sp.waitForTimeout(300);
ok((await sp.locator('.cartbar .n').innerText()) === '2', 'carrinho persiste ao recarregar a página');
await sp.evaluate(() => window.scrollTo(0, 0));
await sp.screenshot({ path: path.join(OUT, 'site-mobile-full.png'), fullPage: true });
await sp.close();

console.log('11) reimportar o ZIP');
await page.click('#btn-home');
await page.waitForSelector('.rcard');
await page.setInputFiles('#file-import', zipPath);
await page.waitForFunction(() => document.querySelectorAll('.rcard').length === 2);
const imp = page.locator('.rcard', { hasText: '(importado)' });
await imp.locator('button:has-text("Abrir")').click();
await pv().locator('h1').waitFor();
await page.waitForTimeout(400);
ok(await pv().locator('img.thumb').count() === 1 && await pv().locator('img.logo').count() === 1, 'imagens voltaram do ZIP');
await page.click('.tab:has-text("Cardápio")');
const it0b = page.locator('.item').nth(0);
await it0b.locator('.icon[title=Detalhes]').click();
ok(await page.locator('.item').nth(0).locator('.vrow[data-kind=addons]').count() === 1 && await page.locator('.item').nth(0).locator('.tagb.on').count() === 1, 'adicionais e etiquetas voltaram do ZIP');

await ctx.close();

/* =============== B) pasta do computador (simulada com OPFS) =============== */
console.log('12) pasta do computador');
// OPFS (usado para simular a pasta) não existe em file://, então servimos o editor por http://localhost
const server = http.createServer((q, r) => { r.setHeader('content-type', 'text/html; charset=utf-8'); r.end(fs.readFileSync(path.resolve(here, '../editor.html'))); });
await new Promise(res => server.listen(0, '127.0.0.1', res));
const httpUrl = 'http://127.0.0.1:' + server.address().port + '/';
const ctx2 = await browser.newContext({ viewport: { width: 1400, height: 860 } });
const pg = await ctx2.newPage(); watch(pg);
await pg.addInitScript(() => { window.showDirectoryPicker = async () => navigator.storage.getDirectory(); });
await pg.goto(httpUrl);
await pg.waitForSelector('#btn-folder:not([hidden])');
ok((await pg.locator('#btn-folder').innerText()).includes('Conectar pasta'), 'botão "Conectar pasta" visível');
await pg.click('#btn-folder');
await pg.waitForFunction(() => window.GC.FS.state === 'on');
ok(true, 'pasta conectada');
await pg.click('#btn-new');
await pg.fill('#dlg input', 'Pizza Já');
await pg.click('#dlg button[type=submit]');
await pg.waitForSelector('#view-editor:not([hidden])');
await pg.locator('#panel input[type=file]').nth(0).setInputFiles(logoF);
await pg.click('.tab:has-text("Cardápio")');
await pg.click('button:has-text("Colar lista")');
await pg.fill('#dlg textarea', '# Pizzas\nMargherita | Molho, mussarela, manjericão | 42,00\nCalabresa - 45');
await pg.click('#dlg button[type=submit]');
await pg.waitForTimeout(1800);
const listOpfs = () => pg.evaluate(async () => {
  const out = [];
  const walk = async (d, p) => { for await (const [n, h] of d.entries()) { if (h.kind === 'directory') await walk(h, p + n + '/'); else out.push(p + n); } };
  await walk(await navigator.storage.getDirectory(), '');
  return out.sort();
});
let fl = await listOpfs();
console.log('   ', fl.join(', '));
ok(fl.includes('pizza-ja/index.html') && fl.includes('pizza-ja/cardapio.json') && fl.includes('pizza-ja/.nojekyll'), 'site gravado em pizza-ja/');
ok(fl.some(f => /^pizza-ja\/assets\/logo\./.test(f)), 'logo gravada em assets/');
const idx = await pg.evaluate(async () => { const d = await (await navigator.storage.getDirectory()).getDirectoryHandle('pizza-ja'); return (await (await d.getFileHandle('index.html')).getFile()).text(); });
ok(idx.includes('Margherita') && !/data:image/.test(idx), 'index.html da pasta tem o cardápio e referencia imagens por arquivo');
// remover a logo apaga o arquivo órfão
await pg.click('.tab:has-text("Marca")');
await pg.locator('#panel .imgf-act button:has-text("Remover")').first().click();
await pg.waitForTimeout(1800);
fl = await listOpfs();
ok(!fl.some(f => /assets\/logo\./.test(f)), 'arquivo órfão da logo foi removido da pasta');
// perder os dados do navegador: os projetos voltam da pasta
await pg.click('#btn-home');
await pg.waitForSelector('.rcard');
await pg.evaluate(() => window.GC.DB.clearRestaurants());
// (não recarregamos a página: o Chrome headless fecha a aba ao ler um handle de OPFS salvo no IndexedDB;
//  o handle do seletor de pasta real não tem esse problema)
await pg.evaluate(async () => { await window.GC.fsSyncAll(); await window.GC.showHome(); });
await pg.waitForSelector('.rcard h3', { timeout: 8000 });
ok(await pg.locator('.rcard h3:text("Pizza Já")').count() === 1, 'projeto recarregado da pasta após limpar o navegador');
await pg.locator('.rcard button:has-text("Abrir")').click();
await pg.click('.tab:has-text("Cardápio")');
ok(await pg.locator('.item').count() === 2, 'produtos recarregados da pasta');

console.log('\nErros de console/página:', errors.length ? '\n  ' + errors.join('\n  ') : 'nenhum');
server.close();
await browser.close();
console.log('\nSaídas em', OUT);
process.exit(fails || errors.length ? 1 : 0);
