// Ajudantes de teste multiplataforma (Windows, macOS, Linux). Não faz parte do produto.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

// Pasta temporária no lugar certo de cada sistema (Windows: %TEMP%; Linux: /tmp).
export const tmpDir = prefix => fs.mkdtempSync(path.join(os.tmpdir(), prefix));

// Caminho de arquivo -> URL file:// válida (no Windows 'file://' + 'C:\x' fica errado).
export const fileUrl = p => pathToFileURL(p).href;

// Abre o Chromium do Playwright (instalado com `npx playwright install chromium`).
// Para usar outro Chrome/Chromium já instalado, defina CHROME_PATH com o caminho do executável.
export async function launchBrowser() {
  try {
    return await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
  } catch (e) {
    console.error('\nNão foi possível abrir o Chromium. Instale com:  npx playwright install chromium');
    console.error('(ou aponte para um Chrome já instalado com a variável CHROME_PATH)\n');
    throw e;
  }
}
