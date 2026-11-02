# Menu Azul — publicar a plataforma

Uma instalação serve todos os restaurantes:

| Endereço | O que é |
|---|---|
| `menuazul.igorcabral.dev.br/admin` | Seu painel: criar/bloquear restaurantes, equipe de cada um |
| `.../nome-do-restaurante` | Login da equipe (admin do restaurante, caixa, cozinha) |
| `.../nome-do-restaurante/codigo-da-mesa` | Cardápio da mesa (QR Code) |
| `.../nome-do-restaurante/menu` | Cardápio público, sem pedido por mesa |

## 1. Supabase (uma vez)
1. Crie um projeto em supabase.com.
2. **Authentication > Users > Add user**: seu e-mail + senha, marque *Auto Confirm User*.
3. **SQL Editor**: cole o conteúdo de `sql/schema.sql` e rode.
4. No mesmo editor, rode (com o seu e-mail):
   `insert into plataforma_admins (user_id) select id from auth.users where email = 'voce@exemplo.com';`
5. **Project Settings > API**: copie *Project URL* e a chave *anon/publishable* (nunca a service_role).
6. Authentication > Sign In / Providers: desligue *Allow new users to sign up* (ninguém além de você cria conta).

## 2. GitHub + Cloudflare Workers (uma vez)
O site é um **Worker só com arquivos estáticos** (Workers Static Assets), configurado em `wrangler.jsonc`. Não é Cloudflare Pages.

1. `web/config.js` com a URL e a chave pública do Supabase (já preenchido). Faça commit e push.
2. Cloudflare > Workers & Pages > o Worker `menuazul` > **Settings > Build** (Workers Builds, ligado ao GitHub):
   - **Build command:** `npm run build:web`  ← gera a pasta `dist/` (sem isso o site fica em branco)
   - **Deploy command:** `npx wrangler deploy`  (padrão)
   - **Root directory:** `/`
   - O diretório de saída **não** se configura no painel: vem do `wrangler.jsonc` (`assets.directory = ./dist`).
3. Custom domain: Worker > Settings > Domains & Routes > `menuazul.igorcabral.dev.br`.
4. Cada push na branch principal faz build + deploy sozinho.

Como as rotas funcionam: `/admin`, `/restaurante`, `/restaurante/menu` e `/restaurante/codigo` não são arquivos. O `wrangler.jsonc` usa `not_found_handling: "single-page-application"`, então **navegações** (barra de endereço, QR Code) recebem o `index.html`. Pedidos sem arquivo que não são navegação (script, imagem, favicon) caem em `worker/index.js` e recebem **404 de verdade**.

Se o site aparecer em branco ou der 404: confira se o build command acima está preenchido e se o log mostra `dist/ gerado`. O log de deploy deve dizer `Read 3 files from the assets directory .../dist` (e não `web`).

Teste local (mesmo runtime do Cloudflare): `npm run build:web && npx wrangler dev`, depois abra http://127.0.0.1:8787/admin.

## 3. Cada novo restaurante
1. `/admin` → **Novo restaurante** (nome, endereço, login e senha do responsável).
2. No editor local (`editor.html`): monte o cardápio → aba **Plataforma** → entre com seu e-mail/senha → escolha o restaurante → **Publicar cardápio**.
3. O responsável entra em `/nome-do-restaurante`, cria as mesas, cadastra caixa e cozinha e imprime os QR Codes.

Mudou preço/foto? Edite no editor e publique de novo. O restaurante marca "esgotado" sozinho no painel dele.

## Operação
- **Bloquear**: `/admin` → Bloquear. Todos perdem acesso na hora (equipe, cardápio e clientes) e nada é apagado.
- **Esqueceu a senha**: `/admin` → Equipe → Nova senha.
- **Trocar o endereço** de um restaurante invalida os QR Codes já impressos.
- Identidade visual: cores em `web/portal.css` (`:root`), nome/logo em `web/config.js` (`brand`).

## Testes
`npm test` (banco, plataforma, publicação e editor) e `npm run test:worker` (build + rotas servidas pelo Worker local). Não cobrem o Supabase/Cloudflare reais: no primeiro uso confira login em `/admin`, publicar uma foto e um pedido de ponta a ponta.
