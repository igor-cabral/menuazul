// Junta template + CSS + JSZip + gerador + app em um único editor.html (funciona offline).
import fs from 'node:fs';

const read = p => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const safe = s => s.replace(/<\/script/gi, '<\\/script');

let html = read('./src/editor.template.html');
html = html
  .replace('/*{{CSS}}*/', () => read('./src/editor.css'))
  .replace('/*{{JSZIP}}*/', () => safe(read('./node_modules/jszip/dist/jszip.min.js')))
  .replace('/*{{GENERATOR}}*/', () => safe(['api', 'runtime-site', 'generator'].map(n => read('./src/' + n + '.js')).join('\n')))
  .replace('/*{{APP}}*/', () => safe(read('./src/app.js')));

fs.writeFileSync(new URL('./editor.html', import.meta.url), html);
console.log('editor.html gerado —', (html.length / 1024).toFixed(0), 'KB');
