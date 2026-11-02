// Segurança do dono da plataforma (plataforma_admins), num Postgres local descartável (PGlite).
// Garante: ninguém se promove a administrador, não há caminho por função, criar uma conta no Auth não dá acesso
// e o isolamento entre restaurantes continua valendo. Não acessa o Supabase real.
import { createDb } from './fake-backend.mjs';

let fails = 0; const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };
const be = await createDb();
const dono = await be.criarUsuarioAuth('dono@menuazul.com', 'senha-do-dono', true);
const intruso = await be.criarUsuarioAuth('intruso@x.com', 'abc', false);
const rows = async sql => (await be.query(sql)).rows;

// Executa SQL "como" anon ou authenticated (com o uid do JWT) e devolve 'permitido' ou a mensagem do erro.
const como = async (role, sub, sql) => {
  try { await be.db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${sub || ''}', false)`); await be.db.query(sql); return 'permitido'; }
  catch (e) { return e.message; } finally { await be.db.exec('reset role'); }
};

console.log('1) ninguém se promove pela tabela');
for (const [role, sub, quem] of [['anon', '', 'anon'], ['authenticated', intruso, 'usuário comum'], ['authenticated', dono, 'o próprio admin (via API)']]) {
  for (const [op, sql] of [
    ['INSERT', `insert into plataforma_admins values ('${intruso}')`],
    ['UPDATE', `update plataforma_admins set user_id = '${intruso}'`],
    ['DELETE', 'delete from plataforma_admins'],
    ['SELECT', 'select * from plataforma_admins'],
    ['TRUNCATE', 'truncate plataforma_admins']]) {
    ok(/permission denied/.test(await como(role, sub, sql)), `${quem}: ${op} em plataforma_admins negado`);
  }
}
ok((await rows('select count(*)::int n from plataforma_admins'))[0].n === 1, 'continua existindo só 1 administrador');
const priv = (await rows(`select
  has_table_privilege('anon', 'plataforma_admins', 'select,insert,update,delete,truncate,references,trigger') a,
  has_table_privilege('authenticated', 'plataforma_admins', 'select,insert,update,delete,truncate,references,trigger') b,
  (select relrowsecurity from pg_class where oid = 'plataforma_admins'::regclass) rls`))[0];
ok(!priv.a && !priv.b, 'anon e authenticated sem nenhum privilégio na tabela');
ok(priv.rls === true, 'RLS ligado em plataforma_admins');

console.log('2) não existe caminho por função');
const refs = (await rows(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosrc ilike '%plataforma_admins%' order by 1`)).map(r => r.proname);
ok(refs.length === 1 && refs[0] === '_plataforma', 'só _plataforma() menciona plataforma_admins (leitura): ' + refs.join(', '));
ok((await rows(`select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
  and p.prosrc ~* '(insert\\s+into|update|delete\\s+from|truncate)\\s+(table\\s+)?(public\\.)?plataforma_admins'`)).length === 0,
  'nenhuma função altera plataforma_admins');
ok(/permission denied/.test(await como('authenticated', intruso, 'select _plataforma()')), 'authenticated não chama _plataforma() direto');
ok(/permission denied/.test(await como('anon', '', 'select _plataforma()')), 'anon não chama _plataforma() direto');

console.log('3) toda função plataforma_* recusa quem não é administrador');
const fns = await rows(`select p.proname, p.pronargs from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname like 'plataforma\\_%' order by 1`);
ok(fns.length >= 7, fns.length + ' funções plataforma_* encontradas');
for (const f of fns) {
  const chamada = `select public.${f.proname}(${Array(f.pronargs).fill('null').join(', ')})`;
  const comum = await como('authenticated', intruso, chamada), anon = await como('anon', '', chamada);
  ok(/sem_permissao/.test(comum), `${f.proname}: usuário comum recusado`);
  ok(/permission denied/.test(anon), `${f.proname}: anon recusado`);
}
ok(await como('authenticated', dono, 'select public.plataforma_eu()') === 'permitido', 'controle positivo: o administrador entra');

console.log('4) criar uma conta no Auth não dá acesso');
const novo = await be.criarUsuarioAuth('novo@x.com', 'x', false);
ok(/sem_permissao/.test(await como('authenticated', novo, 'select public.plataforma_eu()')), 'conta recém-criada: sem_permissao');
ok((await rows(`select count(*)::int n from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace s on s.oid = c.relnamespace
  where s.nspname = 'auth' and c.relname = 'users' and not t.tgisinternal`))[0].n === 0, 'o schema não cria trigger em auth.users');
ok((await rows(`select count(*)::int n from information_schema.tables where table_schema = 'public' and table_name in ('profiles', 'perfis')`))[0].n === 0, 'o schema não cria tabela de perfil');
// Procedimento do DEPLOY.md (passo de promoção): por UUID e só com e-mail confirmado. O Auth real tem email_confirmed_at;
// o banco de teste não, então a coluna é criada aqui (só neste banco descartável).
await be.exec('alter table auth.users add column email_confirmed_at timestamptz');
const naoConf = await be.criarUsuarioAuth('naoconf@x.com', 'x', false);
const conf = await be.criarUsuarioAuth('conf@x.com', 'x', false);
await be.query(`update auth.users set email_confirmed_at = now() where id = '${conf}'`);
const promover = id => be.query(`insert into public.plataforma_admins (user_id)
  select id from auth.users where id = '${id}' and email_confirmed_at is not null returning user_id`);
ok((await promover(naoConf)).rows.length === 0, 'promoção por UUID: e-mail NÃO confirmado não é promovido');
ok((await promover('00000000-0000-0000-0000-000000000000')).rows.length === 0, 'promoção por UUID: UUID inexistente não é promovido (0 linhas)');
ok((await promover(conf)).rows.length === 1, 'promoção por UUID: e-mail confirmado é promovido (exatamente 1 linha)');
ok(await como('authenticated', conf, 'select public.plataforma_eu()') === 'permitido', 'a conta promovida entra no /admin');
await be.query(`delete from plataforma_admins where user_id = '${conf}'`);   // limpa para não afetar os testes seguintes
ok((await rows('select count(*)::int n from plataforma_admins'))[0].n === 1, 'de volta a 1 administrador');

console.log('5) isolamento entre restaurantes preservado');
await be.rpc('plataforma_criar_restaurante', { p_slug: 'loja-a', p_nome: 'Loja A', p_admin_login: 'adm', p_admin_nome: 'A', p_admin_senha: 'senha123' }, dono);
const login = await be.rpc('staff_login', { p_slug: 'loja-a', p_login: 'adm', p_senha: 'senha123' });
ok(login.json?.ok === true && login.json.papel === 'admin', 'administrador DO RESTAURANTE entra no restaurante');
ok((await be.rpc('plataforma_restaurantes', {}, undefined)).status === 403, 'quem só tem token de equipe (anon) não acessa funções da plataforma');
ok((await be.rpc('plataforma_eu', {}, intruso)).json?.message?.includes('sem_permissao'), 'conta Auth que não é administradora segue fora do /admin');

console.log(fails ? `\n${fails} falha(s) em segurança do administrador\n` : '\nSegurança do administrador OK');
process.exit(fails ? 1 : 0);
