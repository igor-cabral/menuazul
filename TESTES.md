# Menu Azul — como rodar os testes (Windows, macOS e Linux)

```
npm ci
npx playwright install chromium    # uma vez só (atalho: npm run setup:tests)
npm run test:sql                   # regras do banco + segurança do administrador (PGlite), sem navegador
npm run test:e2e                   # interface no Chromium: plataforma, publicar, editor
npm run test:worker                # dist/ servido pelo wrangler dev (porta 8799)
npm test                           # test:sql + test:e2e
```

- Os testes usam banco, servidor e pastas **locais e temporários**. Não acessam o Supabase real nem o Cloudflare.
- `test:e2e` e `test:worker` precisam do Chromium. Para usar um Chrome/Chromium que você já tem, defina `CHROME_PATH`
  com o caminho do executável (PowerShell: `$env:CHROME_PATH = "C:\Program Files\Google\Chrome\Application\chrome.exe"`).
- Os scripts de instalação do `esbuild` e do `workerd` **não** são necessários para build, deploy ou testes.
- `playwright` e `sharp` são só de desenvolvimento (testes); não entram no site publicado.
