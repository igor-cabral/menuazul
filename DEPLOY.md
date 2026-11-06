# Menu Azul — publicar a plataforma

Uma instalação serve todos os restaurantes:

| Endereço | O que é |
|---|---|
| `menuazul.igorcabral.dev.br/admin` | Seu painel: criar/bloquear restaurantes, equipe de cada um |
| `.../nome-do-restaurante` | Login da equipe (admin do restaurante, caixa, cozinha) |
| `.../nome-do-restaurante/codigo-da-mesa` | Cardápio da mesa (QR Code) |
| `.../nome-do-restaurante/menu` | Cardápio público, sem pedido por mesa |

## 1. Supabase (uma vez)
A ordem importa: o cadastro público é desligado **antes** de existir qualquer conta, e a conta de administrador é criada por você no painel (nunca pela internet).

1. Crie um projeto em supabase.com.
2. **Desligue o cadastro público.** Authentication > Sign In / Providers: desmarque *Allow new users to sign up*. Confira também que *Allow anonymous sign-ins* está desligado. (A chave pública do `web/config.js` é visível para qualquer pessoa; com o cadastro ligado, qualquer um poderia criar contas no seu projeto.)
3. **SQL Editor**: cole o conteúdo de `sql/schema.sql` e rode (deve responder `Success. No rows returned`). É seguro rodar de novo.
4. **Crie a conta do administrador.** Authentication > Users > Add user > *Create new user*: seu e-mail e uma senha longa (20 caracteres ou mais, de um gerenciador de senhas). Marque *Auto Confirm User*. Não use convite nem link mágico. Essa conta ainda **não** é administradora: criar uma conta não dá acesso a nada.
5. **Confira o estado antes de promover** (só leitura). No SQL Editor:
   ```sql
   select
     (select count(*) from public.plataforma_admins) as admins,
     has_table_privilege('anon', 'public.plataforma_admins', 'select,insert,update,delete') as anon_acessa,
     has_table_privilege('authenticated', 'public.plataforma_admins', 'select,insert,update,delete') as auth_acessa,
     (select relrowsecurity from pg_class where oid = 'public.plataforma_admins'::regclass) as rls,
     (select count(*) from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'auth' and c.relname = 'users' and not t.tgisinternal) as triggers_em_auth_users,
     (select count(*) from auth.users) as contas_no_auth;
   ```
   O resultado esperado é `0 | false | false | true | 0 | 1`. Se vier diferente, **pare** e investigue antes de continuar (por exemplo, `contas_no_auth` maior que 1 significa que existe outra conta além da sua).
6. **Pegue o UUID da sua conta** e confira que o e-mail está confirmado:
   ```sql
   select id, email, email_confirmed_at from auth.users;
   ```
   Deve aparecer só a sua conta, com `email_confirmed_at` preenchido. Copie o valor de `id`.
7. **Promova a conta a administradora da plataforma**, pelo UUID (troque `COLE-O-UUID-AQUI`):
   ```sql
   insert into public.plataforma_admins (user_id)
   select id from auth.users
   where id = 'COLE-O-UUID-AQUI' and email_confirmed_at is not null
   returning user_id;
   ```
   Tem que voltar **exatamente 1 linha**. Se voltar 0 linhas, o UUID está errado ou o e-mail não está confirmado: não force, corrija a causa e repita. Este é o único jeito de criar um administrador da plataforma: não existe tela nem função que faça isso.
8. **Confira o resultado:**
   ```sql
   select a.user_id, u.email, u.email_confirmed_at
   from public.plataforma_admins a join auth.users u on u.id = a.user_id;
   ```
   Deve listar uma única linha, com o seu e-mail.
9. **Project Settings > API**: copie *Project URL* e a chave *anon/publishable* para o `web/config.js` (nunca a `service_role` nem a `secret`: elas dão acesso total ao banco e jamais entram no projeto).
10. **Teste o acesso** (depois do deploy da seção 2): abra `/admin`, tente entrar com uma senha errada (deve aparecer *E-mail ou senha incorretos*) e depois com a senha certa (deve abrir o painel).

Se aparecer *Esta conta não é administradora da plataforma*, o passo 7 não foi feito para essa conta. Para **remover** um administrador: `delete from public.plataforma_admins where user_id = 'UUID';` (mantenha sempre ao menos um).

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
