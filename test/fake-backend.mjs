// Backend de teste: Postgres de verdade (PGlite) atrás de APIs que imitam o Supabase:
//  - /rest/v1/rpc/<fn>   (PostgREST; roda com o papel anon, ou authenticated se houver "JWT" de usuário)
//  - /auth/v1/token      (login por e-mail/senha, devolve um "JWT" fake)
//  - /storage/v1/object  (upload só para o dono da plataforma; leitura pública)
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SCHEMA = fs.readFileSync(path.resolve(here, '../sql/schema.sql'), 'utf8');

export async function createDb() {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema extensions; create schema auth;
    create extension pgcrypto schema extensions;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text unique, senha text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated; grant execute on function auth.uid() to anon, authenticated;`);
  await db.exec(SCHEMA);
  const { rows } = await db.query(`
    select p.proname as name, p.proargnames as names,
           (select array_agg(format_type(t, null)) from unnest(p.proargtypes::oid[]) t) as types
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname !~ '^_'`);
  const sigs = new Map(rows.map(r => [r.name, { names: r.names || [], types: r.types || [] }]));
  let q = Promise.resolve();
  const serial = fn => (q = q.then(fn, fn));

  async function rpc(name, body, sub) {
    const sig = sigs.get(name);
    if (!sig) return { status: 404, json: { message: 'Could not find the function ' + name } };
    const params = []; const parts = [];
    sig.names.forEach((n, i) => {
      if (!(n in (body || {}))) return;
      const t = sig.types[i]; const v = body[n];
      params.push(t === 'jsonb' ? JSON.stringify(v) : v === null ? null : String(v));
      parts.push(`${n} => $${params.length}::${t}`);
    });
    try {
      await db.exec(sub ? `set role authenticated; select set_config('request.jwt.claim.sub', '${sub}', false)` : `set role anon; select set_config('request.jwt.claim.sub', '', false)`);
      const r = await db.query(`select public.${name}(${parts.join(', ')}) as r`, params);
      return { status: 200, json: r.rows[0].r };
    } catch (e) {
      const denied = /permission denied/.test(e.message);
      return { status: denied ? 403 : 400, json: { message: e.message, code: e.code } };
    } finally { await db.exec('reset role'); }
  }
  /* cria um usuário no "Supabase Auth"; admin=true também o lista como dono da plataforma */
  async function criarUsuarioAuth(email, senha, admin) {
    const r = await db.query('insert into auth.users (email, senha) values ($1, $2) returning id', [email, senha]);
    if (admin) await db.query('insert into plataforma_admins (user_id) values ($1)', [r.rows[0].id]);
    return r.rows[0].id;
  }
  return { db, rpc: (n, b, s) => serial(() => rpc(n, b, s)), query: (s, p) => serial(() => db.query(s, p)), exec: s => serial(() => db.exec(s)), criarUsuarioAuth };
}

export async function startFakeBackend() {
  const be = await createDb();
  const files = new Map();
  const subOf = req => { const m = /^Bearer fake\.([0-9a-f-]{36})$/.exec(req.headers.authorization || ''); return m ? m[1] : null; };
  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'apikey, authorization, content-type, x-upsert');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, PUT, OPTIONS');
    if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }
    const send = (st, j) => { res.statusCode = st; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(j)); };
    const url = req.url || '';
    const pub = /^\/storage\/v1\/object\/public\/(.+)$/.exec(url);
    if ((req.method === 'GET' || req.method === 'HEAD') && pub) {
      const f = files.get(decodeURIComponent(pub[1]));
      if (!f) { res.statusCode = 404; return res.end('nf'); }
      res.setHeader('Content-Type', f.type); return res.end(req.method === 'HEAD' ? undefined : f.buf);
    }
    if (!req.headers.apikey) return send(401, { message: 'No API key found in request' });
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', async () => {
      const raw = Buffer.concat(chunks);
      const m = /^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(url);
      if (req.method === 'POST' && m) {
        let body = {}; try { body = raw.length ? JSON.parse(raw) : {}; } catch (e) { /* vazio */ }
        const r = await be.rpc(m[1], body, subOf(req));
        return send(r.status, r.json);
      }
      if (req.method === 'POST' && url.startsWith('/auth/v1/token')) {
        const b = JSON.parse(raw);
        const r = await be.query('select id from auth.users where email = $1 and senha = $2', [b.email, b.password]);
        if (!r.rows.length) return send(400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
        return send(200, { access_token: 'fake.' + r.rows[0].id, refresh_token: 'r.' + r.rows[0].id, expires_in: 3600, user: { id: r.rows[0].id, email: b.email } });
      }
      const up = /^\/storage\/v1\/object\/(.+)$/.exec(url);
      if (up && (req.method === 'POST' || req.method === 'PUT')) {
        const sub = subOf(req), k = decodeURIComponent(up[1]);
        const dono = sub && (await be.query('select 1 from plataforma_admins where user_id = $1', [sub])).rows.length;
        // política "cardapios_envio_painel": qualquer um envia foto nova com caminho válido (sem sobrescrever)
        const painel = (await be.query('select _foto_ok($1) as ok', [k.replace(/^cardapios\//, '')])).rows[0].ok && req.headers['x-upsert'] !== 'true';
        if (!dono && !painel) return send(403, { message: 'new row violates row-level security policy' });
        if (files.has(k) && req.headers['x-upsert'] !== 'true') return send(409, { message: 'The resource already exists' });
        files.set(k, { buf: raw, type: req.headers['content-type'] || 'application/octet-stream' });
        return send(200, { Key: k });
      }
      send(404, { message: 'not found' });
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = 'http://127.0.0.1:' + server.address().port;
  return { ...be, url, files, stop: () => new Promise(r => server.close(r)) };
}
