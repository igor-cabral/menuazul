-- =====================================================================
--  Plataforma de cardápios + pedidos por mesa — schema multi-restaurante (Supabase)
--  Cole no SQL Editor do Supabase e clique em Run. É seguro rodar de novo.
--
--  Segurança: tabelas FECHADAS para o navegador (RLS ligado, sem permissões).
--  Tudo passa por funções (RPC) que validam quem chama:
--    - cliente da mesa  : token da comanda (sem login)
--    - equipe           : usuário + senha do restaurante -> sessão de 12h
--    - dono da plataforma: Supabase Auth (e-mail+senha) listado em plataforma_admins
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- tabelas ----------
create table if not exists plataforma_admins (user_id uuid primary key);

create table if not exists restaurantes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nome text not null,
  ativo boolean not null default true,
  motivo_bloqueio text,
  taxa_servico numeric(5,2) not null default 10 check (taxa_servico between 0 and 100),
  abertura_automatica boolean not null default false,
  fuso text not null default 'America/Sao_Paulo',
  seq_pedido int not null default 0,
  cardapio jsonb,
  publicado_em timestamptz,
  criado_em timestamptz not null default now()
);

create table if not exists usuarios (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references restaurantes(id) on delete cascade,
  login text not null,
  nome text not null,
  papel text not null check (papel in ('admin','caixa','cozinha','garcom')),
  senha_hash text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  unique (restaurante_id, login)
);

create table if not exists staff_sessoes (
  token uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios(id) on delete cascade,
  restaurante_id uuid not null references restaurantes(id) on delete cascade,
  papel text not null,
  expira_em timestamptz not null
);

create table if not exists login_falhas (
  id bigserial primary key,
  chave text not null,
  em timestamptz not null default now()
);
create index if not exists login_falhas_chave on login_falhas (chave, em);

create table if not exists mesas (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references restaurantes(id) on delete cascade,
  numero text not null,
  codigo text not null,
  ativa boolean not null default true,
  criada_em timestamptz not null default now(),
  unique (restaurante_id, numero),
  unique (restaurante_id, codigo)
);

create table if not exists cardapio (
  restaurante_id uuid not null references restaurantes(id) on delete cascade,
  id text not null,
  nome text not null,
  preco numeric(10,2),
  variantes jsonb not null default '[]',
  adicionais jsonb not null default '[]',
  esgotado boolean not null default false,
  primary key (restaurante_id, id)
);

-- cada vez que um item é marcado/desmarcado como esgotado (alimenta o relatório "itens que mais esgotam")
create table if not exists esgotado_log (
  id bigserial primary key,
  restaurante_id uuid not null references restaurantes(id) on delete cascade,
  item_id text not null,
  esgotado boolean not null,
  em timestamptz not null default now()
);
create index if not exists esgotado_log_rest on esgotado_log (restaurante_id, em);

create table if not exists comandas (
  id uuid primary key default gen_random_uuid(),
  mesa_id uuid not null references mesas(id),
  status text not null default 'aberta' check (status in ('aberta','encerrada')),
  aberta_em timestamptz not null default now(),
  encerrada_em timestamptz,
  taxa_servico numeric(5,2) not null default 0,
  desconto numeric(10,2) not null default 0 check (desconto >= 0),
  conta_pedida boolean not null default false
);
create unique index if not exists comanda_aberta_unica on comandas (mesa_id) where status = 'aberta';
-- cliente chamou o garçom (fica até o garçom atender)
alter table comandas add column if not exists chamado_em timestamptz;
alter table comandas add column if not exists chamado_por text;
-- bancos criados antes do papel "garcom": troca a regra do papel
alter table usuarios drop constraint if exists usuarios_papel_check;
alter table usuarios add constraint usuarios_papel_check check (papel in ('admin','caixa','cozinha','garcom'));

create table if not exists clientes (
  id uuid primary key default gen_random_uuid(),
  comanda_id uuid not null references comandas(id) on delete cascade,
  nome text not null,
  token uuid not null unique default gen_random_uuid(),
  criado_em timestamptz not null default now()
);
create index if not exists clientes_comanda on clientes (comanda_id);

create table if not exists pedidos (
  id uuid primary key default gen_random_uuid(),
  numero int not null,
  comanda_id uuid not null references comandas(id) on delete cascade,
  cliente_id uuid references clientes(id) on delete set null,
  status text not null default 'novo' check (status in ('novo','preparando','pronto','entregue','cancelado')),
  obs text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists pedidos_comanda on pedidos (comanda_id);
create index if not exists pedidos_status on pedidos (status) where status in ('novo','preparando','pronto');
-- horários do preparo (alimentam o relatório de tempo médio; pedidos antigos ficam sem esses dados)
alter table pedidos add column if not exists preparando_em timestamptz;
alter table pedidos add column if not exists pronto_em timestamptz;

create table if not exists pedido_itens (
  id uuid primary key default gen_random_uuid(),
  ordem bigserial,
  pedido_id uuid not null references pedidos(id) on delete cascade,
  item_id text not null,
  nome text not null,
  variante text,
  adicionais jsonb not null default '[]',
  qtd int not null check (qtd between 1 and 50),
  preco_unit numeric(10,2) not null check (preco_unit >= 0),
  obs text
);
create index if not exists itens_pedido on pedido_itens (pedido_id);

create table if not exists pagamentos (
  id uuid primary key default gen_random_uuid(),
  comanda_id uuid not null references comandas(id) on delete cascade,
  metodo text not null check (metodo in ('dinheiro','credito','debito','pix','outro')),
  valor numeric(10,2) not null check (valor > 0),
  nome text,
  em timestamptz not null default now()
);
create index if not exists pagamentos_comanda on pagamentos (comanda_id);

-- ---------- internas (nunca expostas) ----------
-- ---------- setores de KDS (cozinha, bar, ...) ----------
-- O admin cria os setores, escolhe para qual setor vai cada item do cardápio e cria os usuários de cada KDS.
create table if not exists setores (
  id uuid primary key default gen_random_uuid(),
  restaurante_id uuid not null references restaurantes(id) on delete cascade,
  nome text not null,
  padrao boolean not null default false,   -- recebe os itens sem setor definido
  criado_em timestamptz not null default now(),
  unique (restaurante_id, nome)
);
create unique index if not exists setor_padrao_unico on setores (restaurante_id) where padrao;
alter table setores enable row level security;
alter table cardapio add column if not exists setor_id uuid references setores(id) on delete set null;
alter table usuarios add column if not exists setor_id uuid references setores(id) on delete set null;   -- KDS: só vê os pedidos do seu setor (vazio = vê todos)
alter table pedidos add column if not exists setor_id uuid references setores(id) on delete set null;
alter table pedidos add column if not exists lote uuid;                    -- pedidos criados juntos (um por setor)
alter table pedido_itens add column if not exists origem text;             -- 'sugestao' = veio da sugestão do carrinho
alter table restaurantes add column if not exists populares jsonb;         -- cache dos itens mais pedidos (1 h)
alter table restaurantes add column if not exists populares_em timestamptz;

-- ---------- cobrança da plataforma (mensalidade, implantação, comissão do vendedor) ----------
alter table restaurantes add column if not exists mensalidade numeric(10,2) not null default 159.90 check (mensalidade >= 0);
alter table restaurantes add column if not exists implantacao numeric(10,2) not null default 100 check (implantacao >= 0);
alter table restaurantes add column if not exists implantacao_paga_em date;
alter table restaurantes add column if not exists proximo_vencimento date;     -- vazio = sem cobrança configurada (nunca limita nem suspende)
alter table restaurantes add column if not exists vendedor text;
alter table restaurantes add column if not exists comissao_pct numeric(5,2) not null default 35 check (comissao_pct between 0 and 100);
alter table restaurantes add column if not exists cancelado_em date;
create table if not exists pagamentos_plano (
  id bigserial primary key,
  restaurante_id uuid not null references restaurantes(id) on delete cascade,
  tipo text not null check (tipo in ('mensalidade','implantacao')),
  valor numeric(10,2) not null check (valor > 0),
  tarifa numeric(10,2) not null default 0 check (tarifa >= 0),   -- tarifa do meio de pagamento (a comissão é sobre valor - tarifa)
  comissao_pct numeric(5,2) not null default 0,                 -- % do vendedor na data do recebimento
  recebido_em date not null,
  obs text,
  estornado boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists pagamentos_plano_rest on pagamentos_plano (restaurante_id, recebido_em);
alter table pagamentos_plano enable row level security;

-- Situação da mensalidade pelos dias sem pagamento registrado após o vencimento:
-- 1–7 tolerância · 8–14 aviso · 15–29 recursos premium desativados · 30+ acesso suspenso (os dados ficam guardados).
create or replace function _cobranca_estado(p_venc date, p_fuso text, p_cancelado date, p_ativo boolean) returns jsonb
language plpgsql stable set search_path = public, pg_temp as $$
declare v_dias int := 0; v_sit text;
begin
  if p_venc is not null then v_dias := greatest(0, (now() at time zone coalesce(p_fuso, 'America/Sao_Paulo'))::date - p_venc); end if;
  v_sit := case
    when p_cancelado is not null then 'cancelado'
    when not coalesce(p_ativo, true) then 'bloqueado'
    when p_venc is null then 'sem_cobranca'
    when v_dias = 0 then 'em_dia'
    when v_dias <= 7 then 'tolerancia'
    when v_dias <= 14 then 'aviso'
    when v_dias <= 29 then 'limitado'
    else 'suspenso' end;
  return jsonb_build_object('dias', v_dias, 'situacao', v_sit);
end $$;

-- 0 = normal · 1 = recursos premium desativados · 2 = acesso suspenso
create or replace function _cobranca_nivel(p_venc date, p_fuso text) returns int
language sql stable set search_path = public, pg_temp as $$
  select case when p_venc is null then 0
              when (now() at time zone coalesce(p_fuso, 'America/Sao_Paulo'))::date - p_venc >= 30 then 2
              when (now() at time zone coalesce(p_fuso, 'America/Sao_Paulo'))::date - p_venc >= 15 then 1
              else 0 end
$$;

create or replace function _premium(p_rest uuid) returns void
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare r restaurantes;
begin
  select * into r from restaurantes where id = p_rest;
  if _cobranca_nivel(r.proximo_vencimento, r.fuso) >= 1 then
    raise exception 'Recurso indisponível: mensalidade em atraso. Fale com o suporte.';
  end if;
end $$;

create or replace function _sessao(p_token uuid, p_papeis text[]) returns staff_sessoes
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare s staff_sessoes; v_rest_ativo boolean; v_user_ativo boolean;
begin
  select * into s from staff_sessoes where token = p_token and expira_em > now();
  if not found then raise exception 'sessao_invalida'; end if;
  select r.ativo and _cobranca_nivel(r.proximo_vencimento, r.fuso) < 2, u.ativo into v_rest_ativo, v_user_ativo
    from restaurantes r, usuarios u where r.id = s.restaurante_id and u.id = s.usuario_id;
  if not coalesce(v_user_ativo, false) then raise exception 'sessao_invalida'; end if;
  if not v_rest_ativo then raise exception 'restaurante_bloqueado'; end if;
  if not (s.papel = any (p_papeis)) then raise exception 'sessao_invalida'; end if;
  return s;
end $$;

create or replace function _plataforma() returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or not exists (select 1 from plataforma_admins where user_id = auth.uid()) then
    raise exception 'sem_permissao';
  end if;
end $$;

create or replace function _rest_publico(p_slug text) returns restaurantes
language plpgsql security definer set search_path = public, pg_temp as $$
declare r restaurantes;
begin
  select * into r from restaurantes where slug = lower(coalesce(p_slug, ''));
  if not found then raise exception 'restaurante_inexistente'; end if;
  if not r.ativo or _cobranca_nivel(r.proximo_vencimento, r.fuso) >= 2 then raise exception 'restaurante_bloqueado'; end if;
  return r;
end $$;

create or replace function _cliente(p_token uuid) returns clientes
language plpgsql security definer set search_path = public, pg_temp as $$
declare cl clientes; v_ativo boolean;
begin
  select * into cl from clientes where token = p_token;
  if not found then raise exception 'sessao_invalida'; end if;
  select r.ativo and _cobranca_nivel(r.proximo_vencimento, r.fuso) < 2 into v_ativo from comandas c join mesas m on m.id = c.mesa_id join restaurantes r on r.id = m.restaurante_id where c.id = cl.comanda_id;
  if not v_ativo then raise exception 'restaurante_bloqueado'; end if;
  return cl;
end $$;

-- confere que a comanda pertence ao restaurante da sessão
create or replace function _comanda_do(p_comanda uuid, p_rest uuid) returns comandas
language plpgsql security definer set search_path = public, pg_temp as $$
declare c comandas;
begin
  select c2.* into c from comandas c2 join mesas m on m.id = c2.mesa_id where c2.id = p_comanda and m.restaurante_id = p_rest;
  if not found then raise exception 'Conta não encontrada'; end if;
  return c;
end $$;

create or replace function _novo_codigo() returns text
language sql volatile set search_path = public, extensions, pg_temp as $$
  select lower(substr(translate(encode(gen_random_bytes(9), 'base64'), '+/=lIO01', 'abcdefgh'), 1, 8))
$$;

create or replace function _totais(p_comanda uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with c as (select * from comandas where id = p_comanda),
  s as (
    select coalesce(sum(i.preco_unit * i.qtd), 0)::numeric(12,2) as sub
    from pedidos p join pedido_itens i on i.pedido_id = p.id
    where p.comanda_id = p_comanda and p.status <> 'cancelado'
  ),
  pg as (select coalesce(sum(valor), 0)::numeric(12,2) as pago from pagamentos where comanda_id = p_comanda),
  t as (
    select s.sub, c.taxa_servico, c.desconto, pg.pago, round(s.sub * c.taxa_servico / 100, 2) as taxa
    from c, s, pg
  )
  select jsonb_build_object(
    'subtotal', sub, 'taxa_pct', taxa_servico, 'taxa', taxa, 'desconto', desconto,
    'total', greatest(sub + taxa - desconto, 0), 'pago', pago,
    'saldo', greatest(sub + taxa - desconto, 0) - pago
  ) from t
$$;

create or replace function _pedidos_json(p_comanda uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'numero', p.numero, 'status', p.status, 'criado_em', p.criado_em, 'obs', p.obs,
    'cliente_id', p.cliente_id, 'cliente', cl.nome, 'setor', st.nome,
    'itens', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', i.id, 'nome', i.nome, 'variante', i.variante, 'adicionais', i.adicionais,
        'qtd', i.qtd, 'preco_unit', i.preco_unit, 'obs', i.obs) order by i.ordem), '[]'::jsonb)
      from pedido_itens i where i.pedido_id = p.id)
  ) order by p.criado_em, p.numero), '[]'::jsonb)
  from pedidos p left join clientes cl on cl.id = p.cliente_id left join setores st on st.id = p.setor_id
  where p.comanda_id = p_comanda
$$;

create or replace function _clientes_json(p_comanda uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'nome', c.nome,
    'subtotal', (select coalesce(sum(i.preco_unit * i.qtd), 0)
                 from pedidos p join pedido_itens i on i.pedido_id = p.id
                 where p.cliente_id = c.id and p.status <> 'cancelado')
  ) order by c.criado_em), '[]'::jsonb)
  from clientes c where c.comanda_id = p_comanda
$$;

-- cria ou edita usuário de um restaurante (usado pelo admin do restaurante e pela plataforma)
create or replace function _usuario_salvar(p_rest uuid, p_id uuid, p_login text, p_nome text, p_papel text,
                                           p_senha text, p_ativo boolean, p_ator uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_login text := lower(trim(coalesce(p_login, ''))); v_nome text := left(trim(coalesce(p_nome, '')), 60); u usuarios;
begin
  if p_papel not in ('admin','caixa','cozinha','garcom') then raise exception 'Papel inválido'; end if;
  if v_nome = '' then raise exception 'Informe o nome'; end if;
  if p_senha is not null and p_senha <> '' and (length(p_senha) < 6 or length(p_senha) > 72) then
    raise exception 'A senha deve ter de 6 a 72 caracteres';
  end if;
  if p_id is null then
    if v_login !~ '^[a-z0-9._-]{3,30}$' then raise exception 'Login: 3 a 30 letras minúsculas, números, ponto, hífen ou _'; end if;
    if p_senha is null or p_senha = '' then raise exception 'Informe a senha'; end if;
    if (select count(*) from usuarios where restaurante_id = p_rest) >= 50 then raise exception 'Limite de 50 usuários'; end if;
    insert into usuarios (restaurante_id, login, nome, papel, senha_hash, ativo)
    values (p_rest, v_login, v_nome, p_papel, crypt(p_senha, gen_salt('bf', 10)), coalesce(p_ativo, true));
  else
    select * into u from usuarios where id = p_id and restaurante_id = p_rest;
    if not found then raise exception 'Usuário não encontrado'; end if;
    if p_ator = p_id and (p_papel <> u.papel or not coalesce(p_ativo, true)) then
      raise exception 'Você não pode rebaixar ou desativar o seu próprio usuário';
    end if;
    update usuarios set nome = v_nome, papel = p_papel, ativo = coalesce(p_ativo, ativo),
           senha_hash = case when p_senha is null or p_senha = '' then senha_hash else crypt(p_senha, gen_salt('bf', 10)) end
     where id = p_id;
    if not exists (select 1 from usuarios where restaurante_id = p_rest and papel = 'admin' and ativo) then
      raise exception 'O restaurante precisa ter pelo menos um administrador ativo';
    end if;
    if p_papel <> u.papel or not coalesce(p_ativo, true) or (p_senha is not null and p_senha <> '') then
      delete from staff_sessoes where usuario_id = p_id;
    end if;
  end if;
  return jsonb_build_object('ok', true);
exception when unique_violation then
  raise exception 'Já existe um usuário com esse login';
end $$;

create or replace function _usuarios_json(p_rest uuid) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', u.id, 'login', u.login, 'nome', u.nome, 'papel', u.papel, 'ativo', u.ativo,
                                               'setor_id', u.setor_id, 'setor', st.nome)
         order by u.papel, u.login), '[]'::jsonb)
    from usuarios u left join setores st on st.id = u.setor_id where u.restaurante_id = p_rest
$$;

-- ---------- público ----------
create or replace function publico_restaurante(p_slug text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare r restaurantes;
begin
  select * into r from restaurantes where slug = lower(coalesce(p_slug, ''));
  if not found then raise exception 'restaurante_inexistente'; end if;
  return jsonb_build_object('nome', r.nome, 'slug', r.slug, 'ativo', r.ativo and _cobranca_nivel(r.proximo_vencimento, r.fuso) < 2,
    'cor', r.cardapio #>> '{theme,primary}', 'logo', r.cardapio ->> 'logo');
end $$;

create or replace function publico_cardapio(p_slug text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare r restaurantes;
begin
  r := _rest_publico(p_slug);
  if r.cardapio is null then raise exception 'cardapio_nao_publicado'; end if;
  return jsonb_build_object('nome', r.nome, 'slug', r.slug, 'modelo', r.cardapio,
    'esgotados', coalesce((select jsonb_agg(id) from cardapio where restaurante_id = r.id and esgotado), '[]'::jsonb));
end $$;

create or replace function publico_info(p_slug text, p_codigo text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare r restaurantes; m mesas; c comandas;
begin
  r := _rest_publico(p_slug);
  select * into m from mesas where restaurante_id = r.id and codigo = p_codigo and ativa;
  if not found then raise exception 'mesa_invalida'; end if;
  select * into c from comandas where mesa_id = m.id and status = 'aberta';
  return jsonb_build_object('mesa', jsonb_build_object('numero', m.numero), 'aberta', c.id is not null,
                            'abertura_automatica', r.abertura_automatica, 'nome', r.nome);
end $$;

create or replace function publico_entrar(p_slug text, p_codigo text, p_nome text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare r restaurantes; m mesas; c comandas; v_nome text := left(trim(coalesce(p_nome, '')), 40); cl clientes;
begin
  if v_nome = '' then raise exception 'Informe seu nome'; end if;
  r := _rest_publico(p_slug);
  select * into m from mesas where restaurante_id = r.id and codigo = p_codigo and ativa;
  if not found then raise exception 'mesa_invalida'; end if;
  select * into c from comandas where mesa_id = m.id and status = 'aberta';
  if not found then
    if not r.abertura_automatica then raise exception 'mesa_fechada'; end if;
    insert into comandas (mesa_id, taxa_servico) values (m.id, r.taxa_servico) returning * into c;
  end if;
  if (select count(*) from clientes where comanda_id = c.id) >= 30 then
    raise exception 'Muitas pessoas nesta mesa. Chame o atendente.';
  end if;
  insert into clientes (comanda_id, nome) values (c.id, v_nome) returning * into cl;
  return jsonb_build_object('cliente_token', cl.token, 'cliente_id', cl.id, 'comanda_id', c.id, 'nome', cl.nome);
end $$;

create or replace function publico_estado(p_cliente_token uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare cl clientes; c comandas; m mesas;
begin
  cl := _cliente(p_cliente_token);
  select * into c from comandas where id = cl.comanda_id;
  select * into m from mesas where id = c.mesa_id;
  if c.status <> 'aberta' then
    return jsonb_build_object('mesa', jsonb_build_object('numero', m.numero), 'comanda', jsonb_build_object('status', c.status));
  end if;
  return jsonb_build_object(
    'mesa', jsonb_build_object('numero', m.numero),
    'comanda', jsonb_build_object('id', c.id, 'status', c.status, 'conta_pedida', c.conta_pedida, 'chamado', c.chamado_em is not null),
    'eu', jsonb_build_object('id', cl.id, 'nome', cl.nome),
    'clientes', _clientes_json(c.id), 'pedidos', _pedidos_json(c.id), 'totais', _totais(c.id));
end $$;

create or replace function publico_pedir(p_cliente_token uuid, p_itens jsonb, p_obs text default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare cl clientes; c comandas;
begin
  cl := _cliente(p_cliente_token);
  select * into c from comandas where id = cl.comanda_id;
  if c.status <> 'aberta' then raise exception 'conta_encerrada'; end if;
  if (select count(distinct coalesce(lote, id)) from pedidos where cliente_id = cl.id and criado_em > now() - interval '1 minute') >= 6 then
    raise exception 'Muitos pedidos seguidos. Aguarde um instante.';
  end if;
  return _criar_pedido(c.id, cl.id, p_itens, p_obs);
end $$;

create or replace function publico_cancelar(p_cliente_token uuid, p_pedido uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare cl clientes;
begin
  cl := _cliente(p_cliente_token);
  update pedidos set status = 'cancelado', atualizado_em = now()
   where id = p_pedido and cliente_id = cl.id and status = 'novo';
  if not found then raise exception 'Este pedido não pode mais ser cancelado (a cozinha já começou).'; end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function publico_pedir_conta(p_cliente_token uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare cl clientes;
begin
  cl := _cliente(p_cliente_token);
  update comandas set conta_pedida = true where id = cl.comanda_id and status = 'aberta';
  return jsonb_build_object('ok', true);
end $$;

-- ---------- equipe: login ----------
create or replace function staff_login(p_slug text, p_login text, p_senha text) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare r restaurantes; u usuarios; v_chave text; v_login text := lower(trim(coalesce(p_login, ''))); v_token uuid; v_exp timestamptz := now() + interval '12 hours';
begin
  delete from login_falhas where em < now() - interval '1 day';
  delete from staff_sessoes where expira_em < now();
  select * into r from restaurantes where slug = lower(coalesce(p_slug, ''));
  if not found then return jsonb_build_object('ok', false, 'erro', 'Restaurante não encontrado'); end if;
  if not r.ativo or _cobranca_nivel(r.proximo_vencimento, r.fuso) >= 2 then
    return jsonb_build_object('ok', false, 'erro', 'Acesso indisponível. Fale com o suporte.', 'bloqueado', true);
  end if;
  v_chave := r.id::text || ':' || v_login;
  if (select count(*) from login_falhas where chave = v_chave and em > now() - interval '10 minutes') >= 5
     or (select count(*) from login_falhas where chave like r.id::text || ':%' and em > now() - interval '10 minutes') >= 40 then
    return jsonb_build_object('ok', false, 'erro', 'Muitas tentativas. Aguarde alguns minutos.');
  end if;
  select * into u from usuarios where restaurante_id = r.id and login = v_login and ativo;
  if not found or u.senha_hash <> crypt(coalesce(p_senha, ''), u.senha_hash) then
    insert into login_falhas (chave) values (v_chave);
    return jsonb_build_object('ok', false, 'erro', 'Usuário ou senha incorretos');
  end if;
  insert into staff_sessoes (usuario_id, restaurante_id, papel, expira_em) values (u.id, r.id, u.papel, v_exp) returning token into v_token;
  return jsonb_build_object('ok', true, 'token', v_token, 'papel', u.papel, 'expira_em', v_exp,
                            'usuario', jsonb_build_object('id', u.id, 'nome', u.nome),
                            'restaurante', jsonb_build_object('nome', r.nome, 'slug', r.slug));
end $$;

create or replace function staff_logout(p_token uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from staff_sessoes where token = p_token;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- cozinha ----------
create or replace function kds_listar(p_token uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare s staff_sessoes; v_setor uuid; v_nome text; v_padrao uuid;
begin
  s := _sessao(p_token, array['cozinha','admin']);
  select id into v_padrao from setores where restaurante_id = s.restaurante_id and padrao;
  if s.papel = 'cozinha' then
    select u.setor_id, st.nome into v_setor, v_nome from usuarios u left join setores st on st.id = u.setor_id where u.id = s.usuario_id;
  end if;
  return jsonb_build_object('agora', now(),
    'setor', case when v_setor is null then null else jsonb_build_object('id', v_setor, 'nome', v_nome) end,
    'setores', (select count(*) from setores where restaurante_id = s.restaurante_id),
    'limitado', (select _cobranca_nivel(proximo_vencimento, fuso) >= 1 from restaurantes where id = s.restaurante_id),
    'pedidos', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'numero', p.numero, 'status', p.status, 'criado_em', p.criado_em, 'obs', p.obs,
      'mesa', m.numero, 'cliente', cl.nome, 'setor', st.nome,
      'itens', (select coalesce(jsonb_agg(jsonb_build_object(
                  'nome', i.nome, 'variante', i.variante, 'adicionais', i.adicionais, 'qtd', i.qtd, 'obs', i.obs
                ) order by i.ordem), '[]'::jsonb) from pedido_itens i where i.pedido_id = p.id)
    ) order by p.criado_em, p.numero)
    from pedidos p
    join comandas c on c.id = p.comanda_id and c.status = 'aberta'
    join mesas m on m.id = c.mesa_id and m.restaurante_id = s.restaurante_id
    left join clientes cl on cl.id = p.cliente_id
    left join setores st on st.id = p.setor_id
    where p.status in ('novo','preparando','pronto')
      and (v_setor is null or p.setor_id = v_setor or (p.setor_id is null and v_setor = v_padrao))
  ), '[]'::jsonb));
end $$;

create or replace function pedido_status(p_token uuid, p_pedido uuid, p_status text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare s staff_sessoes; v_setor uuid; v_padrao uuid;
begin
  s := _sessao(p_token, array['cozinha','caixa','admin']);
  if p_status not in ('novo','preparando','pronto','entregue','cancelado') then raise exception 'Status inválido'; end if;
  if s.papel = 'cozinha' then
    select setor_id into v_setor from usuarios where id = s.usuario_id;
    select id into v_padrao from setores where restaurante_id = s.restaurante_id and padrao;
  end if;
  update pedidos p set status = p_status, atualizado_em = now(),
         preparando_em = case when p_status = 'novo' then null when p_status = 'preparando' and p.preparando_em is null then now() else p.preparando_em end,
         pronto_em = case when p_status = 'pronto' then now() when p_status in ('novo', 'preparando') then null else p.pronto_em end
   where p.id = p_pedido
     and (v_setor is null or p.setor_id = v_setor or (p.setor_id is null and v_setor = v_padrao))
     and exists (
     select 1 from comandas c join mesas m on m.id = c.mesa_id
      where c.id = p.comanda_id and c.status = 'aberta' and m.restaurante_id = s.restaurante_id);
  if not found then raise exception 'Pedido não encontrado ou conta já encerrada'; end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- caixa ----------
create or replace function caixa_mesas(p_token uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare s staff_sessoes;
begin
  s := _sessao(p_token, array['caixa','admin']);
  return jsonb_build_object(
    'agora', now(),
    'config', (select jsonb_build_object('nome', nome, 'taxa_servico', taxa_servico) from restaurantes where id = s.restaurante_id),
    'mesas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'numero', m.numero,
        'comanda', case when c.id is null then null else jsonb_build_object(
          'id', c.id, 'aberta_em', c.aberta_em, 'conta_pedida', c.conta_pedida,
          'clientes', (select count(*) from clientes where comanda_id = c.id),
          'pendentes', (select count(*) from pedidos p where p.comanda_id = c.id and p.status in ('novo','preparando')),
          'prontos', (select count(*) from pedidos p where p.comanda_id = c.id and p.status = 'pronto'),
          'totais', _totais(c.id)) end
      ) order by nullif(regexp_replace(m.numero, '\D', '', 'g'), '')::int nulls last, m.numero)
      from mesas m left join comandas c on c.mesa_id = m.id and c.status = 'aberta'
      where m.ativa and m.restaurante_id = s.restaurante_id
    ), '[]'::jsonb));
end $$;

create or replace function caixa_abrir_mesa(p_token uuid, p_mesa uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare s staff_sessoes; c comandas;
begin
  s := _sessao(p_token, array['caixa','admin']);
  if not exists (select 1 from mesas where id = p_mesa and ativa and restaurante_id = s.restaurante_id) then raise exception 'Mesa não encontrada'; end if;
  select * into c from comandas where mesa_id = p_mesa and status = 'aberta';
  if not found then
    insert into comandas (mesa_id, taxa_servico) values (p_mesa, (select taxa_servico from restaurantes where id = s.restaurante_id)) returning * into c;
  end if;
  return jsonb_build_object('comanda_id', c.id);
end $$;

create or replace function caixa_comanda(p_token uuid, p_comanda uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare s staff_sessoes; c comandas; m mesas;
begin
  s := _sessao(p_token, array['caixa','admin']);
  c := _comanda_do(p_comanda, s.restaurante_id);
  select * into m from mesas where id = c.mesa_id;
  return jsonb_build_object(
    'agora', now(),
    'comanda', jsonb_build_object('id', c.id, 'status', c.status, 'aberta_em', c.aberta_em, 'encerrada_em', c.encerrada_em,
                                  'conta_pedida', c.conta_pedida, 'mesa', m.numero),
    'clientes', _clientes_json(c.id), 'pedidos', _pedidos_json(c.id), 'totais', _totais(c.id),
    'pagamentos', (select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'metodo', g.metodo, 'valor', g.valor, 'nome', g.nome, 'em', g.em)
                   order by g.em), '[]'::jsonb) from pagamentos g where g.comanda_id = c.id));
end $$;

create or replace function caixa_ajustar(p_token uuid, p_comanda uuid, p_taxa numeric, p_desconto numeric) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare s staff_sessoes; c comandas;
begin
  s := _sessao(p_token, array['caixa','admin']);
  c := _comanda_do(p_comanda, s.restaurante_id);
  if p_taxa < 0 or p_taxa > 100 then raise exception 'Taxa inválida'; end if;
  if p_desconto < 0 then raise exception 'Desconto inválido'; end if;
  update comandas set taxa_servico = p_taxa, desconto = p_desconto where id = c.id and status = 'aberta';
  if not found then raise exception 'Conta não encontrada ou já encerrada'; end if;
  return _totais(c.id);
end $$;

create or replace function caixa_limpar_aviso(p_token uuid, p_comanda uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare s staff_sessoes; c comandas;
begin
  s := _sessao(p_token, array['caixa','admin']);
  c := _comanda_do(p_comanda, s.restaurante_id);
  update comandas set conta_pedida = false where id = c.id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function caixa_pagar(p_token uuid, p_comanda uuid, p_metodo text, p_valor numeric, p_nome text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare s staff_sessoes; c comandas; v_t jsonb;
begin
  s := _sessao(p_token, array['caixa','admin']);
  c := _comanda_do(p_comanda, s.restaurante_id);
  if p_metodo not in ('dinheiro','credito','debito','pix','outro') then raise exception 'Forma de pagamento inválida'; end if;
  if p_valor is null or p_valor <= 0 then raise exception 'Valor inválido'; end if;
  if c.status <> 'aberta' then raise exception 'Conta não encontrada ou já encerrada'; end if;
  v_t := _totais(c.id);
  if p_valor > (v_t->>'saldo')::numeric + 0.009 then raise exception 'O valor é maior que o saldo da conta'; end if;
  insert into pagamentos (comanda_id, metodo, valor, nome) values (c.id, p_metodo, round(p_valor, 2), nullif(left(trim(coalesce(p_nome, '')), 40), ''));
  return _totais(c.id);
end $$;

create or replace function caixa_desfazer_pagamento(p_token uuid, p_pagamento uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare s staff_sessoes; v_c uuid;
begin
  s := _sessao(p_token, array['caixa','admin']);
  delete from pagamentos g using comandas c, mesas m
   where g.id = p_pagamento and c.id = g.comanda_id and c.status = 'aberta' and m.id = c.mesa_id and m.restaurante_id = s.restaurante_id
   returning g.comanda_id into v_c;
  if v_c is null then raise exception 'Pagamento não encontrado ou conta já encerrada'; end if;
  return _totais(v_c);
end $$;

create or replace function caixa_encerrar(p_token uuid, p_comanda uuid, p_forcar boolean) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare s staff_sessoes; c comandas; v_t jsonb;
begin
  s := _sessao(p_token, array['caixa','admin']);
  c := _comanda_do(p_comanda, s.restaurante_id);
  if c.status <> 'aberta' then raise exception 'Conta não encontrada ou já encerrada'; end if;
  v_t := _totais(c.id);
  if (v_t->>'saldo')::numeric > 0.009 then raise exception 'Ainda há saldo a pagar'; end if;
  if exists (select 1 from pedidos where comanda_id = c.id and status in ('novo','preparando','pronto')) then
    if not coalesce(p_forcar, false) then raise exception 'pedidos_pendentes'; end if;
    update pedidos set status = 'entregue', atualizado_em = now() where comanda_id = c.id and status in ('novo','preparando','pronto');
  end if;
  update comandas set status = 'encerrada', encerrada_em = now(), conta_pedida = false where id = c.id;
  return jsonb_build_object('ok', true, 'totais', v_t);
end $$;

create or replace function caixa_resumo(p_token uuid, p_data date) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare s staff_sessoes; v_fuso text; d date; v_total numeric; v_mesas int;
begin
  s := _sessao(p_token, array['caixa','admin']);
  select fuso into v_fuso from restaurantes where id = s.restaurante_id;
  d := coalesce(p_data, (now() at time zone v_fuso)::date);
  select coalesce(sum(g.valor), 0) into v_total from pagamentos g join comandas c on c.id = g.comanda_id join mesas m on m.id = c.mesa_id
   where m.restaurante_id = s.restaurante_id and (g.em at time zone v_fuso)::date = d;
  select count(*) into v_mesas from comandas c join mesas m on m.id = c.mesa_id
   where m.restaurante_id = s.restaurante_id and c.status = 'encerrada' and (c.encerrada_em at time zone v_fuso)::date = d;
  return jsonb_build_object(
    'data', d, 'total', v_total, 'mesas_encerradas', v_mesas,
    'pedidos', (select count(*) from pedidos p join comandas c on c.id = p.comanda_id join mesas m on m.id = c.mesa_id
                 where m.restaurante_id = s.restaurante_id and p.status <> 'cancelado' and (p.criado_em at time zone v_fuso)::date = d),
    'por_metodo', (select coalesce(jsonb_object_agg(metodo, t), '{}'::jsonb) from (
        select g.metodo, sum(g.valor) t from pagamentos g join comandas c on c.id = g.comanda_id join mesas m on m.id = c.mesa_id
         where m.restaurante_id = s.restaurante_id and (g.em at time zone v_fuso)::date = d group by g.metodo) q));
end $$;

-- ---------- admin do restaurante ----------
create or replace function admin_mesas(p_token uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare s staff_sessoes;
begin
  s := _sessao(p_token, array['admin']);
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', m.id, 'numero', m.numero, 'codigo', m.codigo, 'ativa', m.ativa,
      'aberta', exists (select 1 from comandas c where c.mesa_id = m.id and c.status = 'aberta'))
      order by nullif(regexp_replace(m.numero, '\D', '', 'g'), '')::int nulls last, m.numero)
    from mesas m where m.restaurante_id = s.restaurante_id), '[]'::jsonb);
end $$;

create or replace function admin_criar_mesas(p_token uuid, p_qtd int) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare s staff_sessoes; v_n int;
begin
  s := _sessao(p_token, array['admin']);
  if p_qtd is null or p_qtd < 1 or p_qtd > 100 then raise exception 'Informe de 1 a 100 mesas'; end if;
  if (select count(*) from mesas where restaurante_id = s.restaurante_id) + p_qtd > 300 then raise exception 'Limite de 300 mesas'; end if;
  select coalesce(max(nullif(regexp_replace(numero, '\D', '', 'g'), '')::int), 0) into v_n from mesas where restaurante_id = s.restaurante_id;
  for i in 1..p_qtd loop
    insert into mesas (restaurante_id, numero, codigo) values (s.restaurante_id, (v_n + i)::text, _novo_codigo());
  end loop;
  return jsonb_build_object('criadas', p_qtd);
end $$;

create or replace function admin_salvar_mesa(p_token uuid, p_id uuid, p_numero text, p_ativa boolean) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare s staff_sessoes; v_num text := left(trim(coalesce(p_numero, '')), 20);
begin
  s := _sessao(p_token, array['admin']);
  if v_num = '' then raise exception 'Informe o número ou nome da mesa'; end if;
  if p_id is null then
    insert into mesas (restaurante_id, numero, codigo, ativa) values (s.restaurante_id, v_num, _novo_codigo(), coalesce(p_ativa, true));
  else
    update mesas set numero = v_num, ativa = coalesce(p_ativa, ativa) where id = p_id and restaurante_id = s.restaurante_id;
    if not found then raise exception 'Mesa não encontrada'; end if;
  end if;
  return jsonb_build_object('ok', true);
exception when unique_violation then
  raise exception 'Já existe uma mesa com esse número';
end $$;

create or replace function admin_apagar_mesa(p_token uuid, p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare s staff_sessoes;
begin
  s := _sessao(p_token, array['admin']);
  if exists (select 1 from comandas where mesa_id = p_id) then raise exception 'Esta mesa tem histórico. Desative em vez de apagar.'; end if;
  delete from mesas where id = p_id and restaurante_id = s.restaurante_id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function admin_novo_codigo_mesa(p_token uuid, p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare s staff_sessoes; v_cd text := _novo_codigo();
begin
  s := _sessao(p_token, array['admin']);
  update mesas set codigo = v_cd where id = p_id and restaurante_id = s.restaurante_id;
  if not found then raise exception 'Mesa não encontrada'; end if;
  return jsonb_build_object('codigo', v_cd);
end $$;

create or replace function admin_config_get(p_token uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare s staff_sessoes;
begin
  s := _sessao(p_token, array['admin']);
  return (select jsonb_build_object('slug', slug, 'nome', nome, 'taxa_servico', taxa_servico,
          'abertura_automatica', abertura_automatica, 'fuso', fuso, 'publicado_em', publicado_em) from restaurantes where id = s.restaurante_id);
end $$;

create or replace function admin_config_set(p_token uuid, p_taxa numeric, p_auto boolean) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare s staff_sessoes;
begin
  s := _sessao(p_token, array['admin']);
  if p_taxa is null or p_taxa < 0 or p_taxa > 30 then raise exception 'Taxa de serviço entre 0 e 30'; end if;
  update restaurantes set taxa_servico = p_taxa, abertura_automatica = coalesce(p_auto, false) where id = s.restaurante_id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function admin_usuarios(p_token uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare s staff_sessoes;
begin
  s := _sessao(p_token, array['admin']);
  return _usuarios_json(s.restaurante_id);
end $$;

create or replace function admin_usuario_salvar(p_token uuid, p_id uuid, p_login text, p_nome text, p_papel text, p_senha text, p_ativo boolean) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare s staff_sessoes;
begin
  s := _sessao(p_token, array['admin']);
  return _usuario_salvar(s.restaurante_id, p_id, p_login, p_nome, p_papel, p_senha, p_ativo, s.usuario_id);
end $$;

create or replace function admin_itens(p_token uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare s staff_sessoes;
begin
  s := _sessao(p_token, array['admin','caixa']);
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'esgotado', esgotado, 'setor_id', setor_id) order by nome)
                   from cardapio where restaurante_id = s.restaurante_id), '[]'::jsonb);
end $$;

create or replace function admin_item_esgotado(p_token uuid, p_item text, p_esgotado boolean) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare s staff_sessoes; v_old boolean; v_new boolean := coalesce(p_esgotado, false);
begin
  s := _sessao(p_token, array['admin','caixa']);
  select esgotado into v_old from cardapio where restaurante_id = s.restaurante_id and id = p_item;
  if not found then raise exception 'Item não encontrado'; end if;
  update cardapio set esgotado = v_new where restaurante_id = s.restaurante_id and id = p_item;
  if v_old is distinct from v_new then
    insert into esgotado_log (restaurante_id, item_id, esgotado) values (s.restaurante_id, p_item, v_new);
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- dono da plataforma (Supabase Auth) ----------
create or replace function plataforma_eu() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform _plataforma();
  return jsonb_build_object('ok', true);
end $$;

create or replace function plataforma_restaurantes() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform _plataforma();
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id', r.id, 'slug', r.slug, 'nome', r.nome, 'ativo', r.ativo, 'motivo', r.motivo_bloqueio,
    'criado_em', r.criado_em, 'publicado_em', r.publicado_em,
    'mesas', (select count(*) from mesas where restaurante_id = r.id),
    'usuarios', (select count(*) from usuarios where restaurante_id = r.id),
    'abertas', (select count(*) from comandas c join mesas m on m.id = c.mesa_id where m.restaurante_id = r.id and c.status = 'aberta'),
    'pedidos_30d', (select count(*) from pedidos p join comandas c on c.id = p.comanda_id join mesas m on m.id = c.mesa_id
                     where m.restaurante_id = r.id and p.criado_em > now() - interval '30 days' and p.status <> 'cancelado')
  ) order by r.criado_em desc) from restaurantes r), '[]'::jsonb);
end $$;

create or replace function plataforma_criar_restaurante(p_slug text, p_nome text, p_admin_login text, p_admin_nome text, p_admin_senha text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_slug text := lower(trim(coalesce(p_slug, ''))); v_id uuid;
begin
  perform _plataforma();
  if v_slug !~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])$' then raise exception 'Endereço: 2 a 40 letras minúsculas, números e hífen'; end if;
  if v_slug = any (array['admin','api','assets','static','login','www','app','cardapio','suporte','config','favicon','robots','sitemap']) then
    raise exception 'Este endereço é reservado';
  end if;
  if trim(coalesce(p_nome, '')) = '' then raise exception 'Informe o nome do restaurante'; end if;
  insert into restaurantes (slug, nome) values (v_slug, left(trim(p_nome), 80)) returning id into v_id;
  perform _usuario_salvar(v_id, null, p_admin_login, coalesce(nullif(trim(p_admin_nome), ''), 'Administrador'), 'admin', p_admin_senha, true, null);
  return jsonb_build_object('id', v_id, 'slug', v_slug);
exception when unique_violation then
  raise exception 'Já existe um restaurante com esse endereço';
end $$;

create or replace function plataforma_salvar_restaurante(p_id uuid, p_nome text, p_slug text, p_ativo boolean, p_motivo text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_slug text := lower(trim(coalesce(p_slug, '')));
begin
  perform _plataforma();
  if v_slug !~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])$' or v_slug = any (array['admin','api','assets','static','login','www','app','cardapio','suporte','config','favicon','robots','sitemap']) then
    raise exception 'Endereço inválido ou reservado';
  end if;
  update restaurantes set nome = left(coalesce(nullif(trim(p_nome), ''), nome), 80), slug = v_slug, ativo = coalesce(p_ativo, ativo),
         motivo_bloqueio = case when coalesce(p_ativo, ativo) then null else nullif(left(trim(coalesce(p_motivo, '')), 200), '') end
   where id = p_id;
  if not found then raise exception 'Restaurante não encontrado'; end if;
  if not coalesce(p_ativo, true) then delete from staff_sessoes where restaurante_id = p_id; end if;
  return jsonb_build_object('ok', true);
exception when unique_violation then
  raise exception 'Já existe um restaurante com esse endereço';
end $$;

create or replace function plataforma_usuarios(p_rest uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform _plataforma();
  return _usuarios_json(p_rest);
end $$;

create or replace function plataforma_usuario_salvar(p_rest uuid, p_id uuid, p_login text, p_nome text, p_papel text, p_senha text, p_ativo boolean) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform _plataforma();
  if not exists (select 1 from restaurantes where id = p_rest) then raise exception 'Restaurante não encontrado'; end if;
  return _usuario_salvar(p_rest, p_id, p_login, p_nome, p_papel, p_senha, p_ativo, null);
end $$;

-- Publica o cardápio (modelo do editor + tabela de preços usada para validar pedidos)
create or replace function plataforma_publicar(p_rest uuid, p_modelo jsonb, p_itens jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_n int; v_old jsonb;
begin
  perform _plataforma();
  if p_modelo is null or jsonb_typeof(p_modelo) <> 'object' or p_itens is null or jsonb_typeof(p_itens) <> 'array' then raise exception 'Cardápio inválido'; end if;
  update restaurantes set cardapio = p_modelo, publicado_em = now() where id = p_rest;
  if not found then raise exception 'Restaurante não encontrado'; end if;
  v_old := (select coalesce(jsonb_object_agg(id, setor_id), '{}'::jsonb) from cardapio where restaurante_id = p_rest and setor_id is not null);
  delete from cardapio where restaurante_id = p_rest;
  insert into cardapio (restaurante_id, id, nome, preco, variantes, adicionais, esgotado, setor_id)
  select p_rest, x.id, x.nome, x.preco, coalesce(x.variantes, '[]'::jsonb), coalesce(x.adicionais, '[]'::jsonb), coalesce(x.esgotado, false), (v_old ->> x.id)::uuid
  from jsonb_to_recordset(p_itens) as x(id text, nome text, preco numeric, variantes jsonb, adicionais jsonb, esgotado boolean);
  get diagnostics v_n = row_count;
  return jsonb_build_object('itens', v_n);
end $$;

-- ---------- editor de cardápio no painel do restaurante (só admin) ----------
-- O admin lê e publica o cardápio do PRÓPRIO restaurante (vem da sessão, nunca do parâmetro).
create or replace function admin_cardapio_get(p_token uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare s staff_sessoes;
begin
  s := _sessao(p_token, array['admin']);
  return (select jsonb_build_object('cardapio', r.cardapio, 'publicado_em', r.publicado_em) from restaurantes r where r.id = s.restaurante_id);
end $$;

create or replace function admin_publicar(p_token uuid, p_modelo jsonb, p_itens jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare s staff_sessoes; v_n int; v_old jsonb;
begin
  s := _sessao(p_token, array['admin']);
  if p_modelo is null or jsonb_typeof(p_modelo) <> 'object' or p_itens is null or jsonb_typeof(p_itens) <> 'array' then raise exception 'Cardápio inválido'; end if;
  update restaurantes set cardapio = p_modelo, publicado_em = now() where id = s.restaurante_id;
  v_old := (select coalesce(jsonb_object_agg(id, setor_id), '{}'::jsonb) from cardapio where restaurante_id = s.restaurante_id and setor_id is not null);
  delete from cardapio where restaurante_id = s.restaurante_id;
  insert into cardapio (restaurante_id, id, nome, preco, variantes, adicionais, esgotado, setor_id)
  select s.restaurante_id, x.id, x.nome, x.preco, coalesce(x.variantes, '[]'::jsonb), coalesce(x.adicionais, '[]'::jsonb), coalesce(x.esgotado, false), (v_old ->> x.id)::uuid
  from jsonb_to_recordset(p_itens) as x(id text, nome text, preco numeric, variantes jsonb, adicionais jsonb, esgotado boolean);
  get diagnostics v_n = row_count;
  return jsonb_build_object('itens', v_n);
end $$;

-- ---------- garçom: atende as mesas (pedidos, entregas e chamados) ----------
-- Cria os pedidos de uma comanda aberta (mesma regra de preço/variante/adicional para cliente e garçom).
-- Itens de setores diferentes (cozinha, bar...) viram um pedido para cada setor, criados juntos (mesmo "lote").
create or replace function _criar_pedido(p_comanda uuid, p_cliente uuid, p_itens jsonb, p_obs text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare c comandas; v_rest uuid; v_lote uuid := gen_random_uuid(); v_padrao uuid; v_setor uuid; v_key text;
  v_ped uuid; v_num int; v_map jsonb := '{}'::jsonb; v_lista jsonb := '[]'::jsonb; v_obs text;
  v_it jsonb; v_row cardapio; v_pre numeric; v_var text; v_q int; v_adlist jsonb; v_lbl text; v_found jsonb;
begin
  select * into c from comandas where id = p_comanda;
  if c.status <> 'aberta' then raise exception 'conta_encerrada'; end if;
  select m.restaurante_id into v_rest from mesas m where m.id = c.mesa_id;
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then raise exception 'Pedido vazio'; end if;
  if jsonb_array_length(p_itens) > 40 then raise exception 'Pedido muito grande'; end if;
  v_obs := nullif(left(trim(coalesce(p_obs, '')), 200), '');
  select id into v_padrao from setores where restaurante_id = v_rest and padrao;

  for v_it in select * from jsonb_array_elements(p_itens) loop
    v_q := coalesce(nullif(v_it->>'q', '')::int, 1);
    if v_q < 1 or v_q > 50 then raise exception 'Quantidade inválida'; end if;
    select * into v_row from cardapio where restaurante_id = v_rest and id = v_it->>'id';
    if not found then raise exception 'Item indisponível. Atualize a página e tente de novo.'; end if;
    if v_row.esgotado then raise exception 'Esgotado: %', v_row.nome; end if;

    v_var := coalesce(v_it->>'v', '');
    if jsonb_array_length(v_row.variantes) > 0 then
      v_pre := null;
      select (x->>'p')::numeric, x->>'l' into v_pre, v_var
        from jsonb_array_elements(v_row.variantes) x where x->>'l' = v_var limit 1;
      if v_pre is null then raise exception 'Opção inválida para %', v_row.nome; end if;
    else
      v_pre := v_row.preco; v_var := null;
    end if;
    if v_pre is null then raise exception 'Item sem preço: %', v_row.nome; end if;

    v_adlist := '[]'::jsonb;
    for v_lbl in select jsonb_array_elements_text(coalesce(v_it->'a', '[]'::jsonb)) loop
      v_found := null;
      select x into v_found from jsonb_array_elements(v_row.adicionais) x where x->>'l' = v_lbl limit 1;
      if v_found is null then raise exception 'Adicional inválido: %', v_lbl; end if;
      v_pre := v_pre + coalesce((v_found->>'p')::numeric, 0);
      v_adlist := v_adlist || jsonb_build_array(v_found);
    end loop;

    -- pedido do setor deste item (cria na primeira vez)
    v_setor := coalesce(v_row.setor_id, v_padrao);
    v_key := coalesce(v_setor::text, 'sem');
    v_ped := (v_map ->> v_key)::uuid;
    if v_ped is null then
      update restaurantes set seq_pedido = seq_pedido + 1 where id = v_rest returning seq_pedido into v_num;
      insert into pedidos (numero, comanda_id, cliente_id, obs, setor_id, lote)
      values (v_num, c.id, p_cliente, v_obs, v_setor, v_lote) returning id into v_ped;
      v_map := v_map || jsonb_build_object(v_key, v_ped);
      v_lista := v_lista || jsonb_build_array(jsonb_build_object('pedido_id', v_ped, 'numero', v_num,
                   'setor', (select nome from setores where id = v_setor)));
    end if;

    insert into pedido_itens (pedido_id, item_id, nome, variante, adicionais, qtd, preco_unit, obs, origem)
    values (v_ped, v_row.id, v_row.nome, v_var, v_adlist, v_q, v_pre, nullif(left(trim(coalesce(v_it->>'o', '')), 140), ''),
            case when v_it->>'src' = 'sugestao' then 'sugestao' end);
  end loop;
  return jsonb_build_object('pedido_id', (v_lista->0->>'pedido_id')::uuid, 'numero', (v_lista->0->>'numero')::int, 'pedidos', v_lista);
end $$;

create or replace function publico_chamar_garcom(p_cliente_token uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare cl clientes;
begin
  cl := _cliente(p_cliente_token);
  update comandas set chamado_em = coalesce(chamado_em, now()), chamado_por = coalesce(chamado_por, cl.nome)
   where id = cl.comanda_id and status = 'aberta';
  return jsonb_build_object('ok', true);
end $$;

create or replace function garcom_mesas(p_token uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare s staff_sessoes;
begin
  s := _sessao(p_token, array['garcom','admin']);
  perform _premium(s.restaurante_id);
  return jsonb_build_object(
    'agora', now(),
    'config', (select jsonb_build_object('nome', nome) from restaurantes where id = s.restaurante_id),
    'mesas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'numero', m.numero,
        'comanda', case when c.id is null then null else jsonb_build_object(
          'id', c.id, 'aberta_em', c.aberta_em, 'conta_pedida', c.conta_pedida,
          'chamado_em', c.chamado_em, 'chamado_por', c.chamado_por,
          'clientes', (select count(*) from clientes where comanda_id = c.id),
          'pendentes', (select count(*) from pedidos p where p.comanda_id = c.id and p.status in ('novo','preparando')),
          'prontos', (select count(*) from pedidos p where p.comanda_id = c.id and p.status = 'pronto')) end
      ) order by nullif(regexp_replace(m.numero, '\D', '', 'g'), '')::int nulls last, m.numero)
      from mesas m left join comandas c on c.mesa_id = m.id and c.status = 'aberta'
      where m.ativa and m.restaurante_id = s.restaurante_id
    ), '[]'::jsonb));
end $$;

create or replace function garcom_mesa(p_token uuid, p_mesa uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare s staff_sessoes; m mesas; c comandas;
begin
  s := _sessao(p_token, array['garcom','admin']);
  perform _premium(s.restaurante_id);
  select * into m from mesas where id = p_mesa and ativa and restaurante_id = s.restaurante_id;
  if not found then raise exception 'Mesa não encontrada'; end if;
  select * into c from comandas where mesa_id = m.id and status = 'aberta';
  return jsonb_build_object(
    'agora', now(),
    'mesa', jsonb_build_object('id', m.id, 'numero', m.numero),
    'comanda', case when c.id is null then null else jsonb_build_object(
      'id', c.id, 'aberta_em', c.aberta_em, 'conta_pedida', c.conta_pedida, 'chamado_em', c.chamado_em, 'chamado_por', c.chamado_por) end,
    'pedidos', case when c.id is null then '[]'::jsonb else _pedidos_json(c.id) end);
end $$;

create or replace function garcom_itens(p_token uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare s staff_sessoes;
begin
  s := _sessao(p_token, array['garcom','admin']);
  perform _premium(s.restaurante_id);
  return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'preco', preco, 'variantes', variantes,
                                                       'adicionais', adicionais, 'esgotado', esgotado) order by nome)
                     from cardapio where restaurante_id = s.restaurante_id), '[]'::jsonb);
end $$;

create or replace function garcom_pedir(p_token uuid, p_mesa uuid, p_itens jsonb, p_obs text default null) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare s staff_sessoes; c comandas; cl clientes; v_nome text; v_res jsonb;
begin
  s := _sessao(p_token, array['garcom','admin']);
  perform _premium(s.restaurante_id);
  if not exists (select 1 from mesas where id = p_mesa and ativa and restaurante_id = s.restaurante_id) then raise exception 'Mesa não encontrada'; end if;
  select * into c from comandas where mesa_id = p_mesa and status = 'aberta';
  if not found then
    insert into comandas (mesa_id, taxa_servico) values (p_mesa, (select taxa_servico from restaurantes where id = s.restaurante_id)) returning * into c;
  end if;
  v_nome := left('Garçom ' || split_part((select nome from usuarios where id = s.usuario_id), ' ', 1), 40);
  select * into cl from clientes where comanda_id = c.id and nome = v_nome order by criado_em limit 1;
  if not found then insert into clientes (comanda_id, nome) values (c.id, v_nome) returning * into cl; end if;
  v_res := _criar_pedido(c.id, cl.id, p_itens, p_obs);
  return v_res || jsonb_build_object('comanda_id', c.id);
end $$;

create or replace function garcom_entregar(p_token uuid, p_pedido uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare s staff_sessoes;
begin
  s := _sessao(p_token, array['garcom','admin']);
  perform _premium(s.restaurante_id);
  update pedidos p set status = 'entregue', atualizado_em = now()
   where p.id = p_pedido and p.status = 'pronto' and exists (
     select 1 from comandas c join mesas m on m.id = c.mesa_id
      where c.id = p.comanda_id and c.status = 'aberta' and m.restaurante_id = s.restaurante_id);
  if not found then raise exception 'Pedido não encontrado, já entregue ou conta encerrada'; end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function garcom_atender(p_token uuid, p_comanda uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare s staff_sessoes; c comandas;
begin
  s := _sessao(p_token, array['garcom','admin']);
  perform _premium(s.restaurante_id);
  c := _comanda_do(p_comanda, s.restaurante_id);
  update comandas set chamado_em = null, chamado_por = null where id = c.id;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- relatórios do dono (só admin) ----------
-- Números de um período (datas no fuso do restaurante): faturamento = pagamentos recebidos; contas = comandas encerradas.
create or replace function _rel_resumo(p_rest uuid, p_fuso text, p_de date, p_ate date) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_fat numeric; v_contas int; v_perm numeric; v_ped int; v_itens int; v_prep numeric;
begin
  select coalesce(sum(g.valor), 0) into v_fat
    from pagamentos g join comandas c on c.id = g.comanda_id join mesas m on m.id = c.mesa_id
   where m.restaurante_id = p_rest and (g.em at time zone p_fuso)::date between p_de and p_ate;
  select count(*), avg(extract(epoch from (c.encerrada_em - c.aberta_em)) / 60) into v_contas, v_perm
    from comandas c join mesas m on m.id = c.mesa_id
   where m.restaurante_id = p_rest and c.status = 'encerrada' and (c.encerrada_em at time zone p_fuso)::date between p_de and p_ate;
  select count(distinct coalesce(p.lote, p.id)) into v_ped
    from pedidos p join comandas c on c.id = p.comanda_id join mesas m on m.id = c.mesa_id
   where m.restaurante_id = p_rest and p.status <> 'cancelado' and (p.criado_em at time zone p_fuso)::date between p_de and p_ate;
  select coalesce(sum(i.qtd), 0) into v_itens
    from pedido_itens i join pedidos p on p.id = i.pedido_id join comandas c on c.id = p.comanda_id join mesas m on m.id = c.mesa_id
   where m.restaurante_id = p_rest and p.status <> 'cancelado' and (p.criado_em at time zone p_fuso)::date between p_de and p_ate;
  select avg(extract(epoch from (p.pronto_em - p.criado_em)) / 60) into v_prep
    from pedidos p join comandas c on c.id = p.comanda_id join mesas m on m.id = c.mesa_id
   where m.restaurante_id = p_rest and p.status <> 'cancelado' and p.pronto_em is not null and (p.criado_em at time zone p_fuso)::date between p_de and p_ate;
  return jsonb_build_object(
    'faturamento', v_fat, 'contas', v_contas, 'pedidos', v_ped, 'itens', v_itens,
    'sug_itens', (select coalesce(sum(i.qtd), 0) from pedido_itens i join pedidos p on p.id = i.pedido_id join comandas c on c.id = p.comanda_id join mesas m on m.id = c.mesa_id
                   where i.origem = 'sugestao' and m.restaurante_id = p_rest and p.status <> 'cancelado' and (p.criado_em at time zone p_fuso)::date between p_de and p_ate),
    'sug_receita', (select coalesce(sum(i.qtd * i.preco_unit), 0) from pedido_itens i join pedidos p on p.id = i.pedido_id join comandas c on c.id = p.comanda_id join mesas m on m.id = c.mesa_id
                   where i.origem = 'sugestao' and m.restaurante_id = p_rest and p.status <> 'cancelado' and (p.criado_em at time zone p_fuso)::date between p_de and p_ate),
    'ticket_medio', case when v_contas > 0 then round(v_fat / v_contas, 2) else null end,
    'permanencia_min', round(v_perm, 0), 'preparo_min', round(v_prep, 1),
    'por_metodo', (select coalesce(jsonb_object_agg(q.metodo, q.t), '{}'::jsonb) from (
        select g.metodo, sum(g.valor) as t
          from pagamentos g join comandas c on c.id = g.comanda_id join mesas m on m.id = c.mesa_id
         where m.restaurante_id = p_rest and (g.em at time zone p_fuso)::date between p_de and p_ate group by g.metodo) q));
end $$;

create or replace function admin_relatorio(p_token uuid, p_de date, p_ate date) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare s staff_sessoes; v_fuso text; v_de date; v_ate date; v_dias int; v_pde date; v_pate date; v_mesas int;
begin
  s := _sessao(p_token, array['admin']);
  perform _premium(s.restaurante_id);
  select fuso into v_fuso from restaurantes where id = s.restaurante_id;
  v_ate := coalesce(p_ate, (now() at time zone v_fuso)::date);
  v_de := coalesce(p_de, v_ate);
  if v_de > v_ate then raise exception 'Período inválido'; end if;
  if v_ate - v_de > 366 then raise exception 'Período muito longo (máximo 1 ano)'; end if;
  v_dias := v_ate - v_de + 1; v_pate := v_de - 1; v_pde := v_pate - (v_dias - 1);
  select count(*) into v_mesas from mesas where restaurante_id = s.restaurante_id and ativa;
  return jsonb_build_object(
    'de', v_de, 'ate', v_ate, 'dias', v_dias, 'anterior_de', v_pde, 'anterior_ate', v_pate, 'mesas_ativas', v_mesas,
    'atual', _rel_resumo(s.restaurante_id, v_fuso, v_de, v_ate),
    'anterior', _rel_resumo(s.restaurante_id, v_fuso, v_pde, v_pate),
    'mais_vendidos', (select coalesce(jsonb_agg(r), '[]'::jsonb) from (
        select i.nome, sum(i.qtd)::int as qtd, sum(i.qtd * i.preco_unit) as receita
          from pedido_itens i join pedidos p on p.id = i.pedido_id join comandas c on c.id = p.comanda_id join mesas m on m.id = c.mesa_id
         where m.restaurante_id = s.restaurante_id and p.status <> 'cancelado' and (p.criado_em at time zone v_fuso)::date between v_de and v_ate
         group by i.item_id, i.nome order by 2 desc, 1 limit 10) r),
    'menos_vendidos', (select coalesce(jsonb_agg(r), '[]'::jsonb) from (
        select x.nome, coalesce(v.qtd, 0)::int as qtd
          from cardapio x left join (
            select i.item_id, sum(i.qtd) as qtd
              from pedido_itens i join pedidos p on p.id = i.pedido_id join comandas c on c.id = p.comanda_id join mesas m on m.id = c.mesa_id
             where m.restaurante_id = s.restaurante_id and p.status <> 'cancelado' and (p.criado_em at time zone v_fuso)::date between v_de and v_ate
             group by i.item_id) v on v.item_id = x.id
         where x.restaurante_id = s.restaurante_id order by 2, 1 limit 10) r),
    'por_hora', (select coalesce(jsonb_agg(coalesce(q.n, 0) order by h.h), '[]'::jsonb) from generate_series(0, 23) as h(h) left join (
        select extract(hour from (p.criado_em at time zone v_fuso))::int as hr, count(distinct coalesce(p.lote, p.id)) as n
          from pedidos p join comandas c on c.id = p.comanda_id join mesas m on m.id = c.mesa_id
         where m.restaurante_id = s.restaurante_id and p.status <> 'cancelado' and (p.criado_em at time zone v_fuso)::date between v_de and v_ate
         group by 1) q on q.hr = h.h),
    'esgotados', (select coalesce(jsonb_agg(r), '[]'::jsonb) from (
        select coalesce(ca.nome, l.item_id) as nome, count(*)::int as vezes
          from esgotado_log l left join cardapio ca on ca.restaurante_id = l.restaurante_id and ca.id = l.item_id
         where l.restaurante_id = s.restaurante_id and l.esgotado and (l.em at time zone v_fuso)::date between v_de and v_ate
         group by 1 order by 2 desc, 1 limit 10) r));
end $$;

-- ---------- setores de KDS (admin) ----------
create or replace function admin_setores(p_token uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare s staff_sessoes;
begin
  s := _sessao(p_token, array['admin']);
  perform _premium(s.restaurante_id);
  return coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'nome', x.nome, 'padrao', x.padrao,
            'itens', (select count(*) from cardapio c where c.setor_id = x.id),
            'usuarios', (select count(*) from usuarios u where u.setor_id = x.id and u.ativo)) order by x.padrao desc, x.nome)
          from setores x where x.restaurante_id = s.restaurante_id), '[]'::jsonb);
end $$;

create or replace function admin_setor_salvar(p_token uuid, p_id uuid, p_nome text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare s staff_sessoes; v_nome text := left(trim(coalesce(p_nome, '')), 30);
begin
  s := _sessao(p_token, array['admin']);
  perform _premium(s.restaurante_id);
  if v_nome = '' then raise exception 'Informe o nome do setor'; end if;
  if p_id is null then
    if (select count(*) from setores where restaurante_id = s.restaurante_id) >= 10 then raise exception 'Limite de 10 setores'; end if;
    insert into setores (restaurante_id, nome, padrao)
    values (s.restaurante_id, v_nome, not exists (select 1 from setores where restaurante_id = s.restaurante_id));
  else
    update setores set nome = v_nome where id = p_id and restaurante_id = s.restaurante_id;
    if not found then raise exception 'Setor não encontrado'; end if;
  end if;
  return jsonb_build_object('ok', true);
exception when unique_violation then
  raise exception 'Já existe um setor com esse nome';
end $$;

create or replace function admin_setor_padrao(p_token uuid, p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare s staff_sessoes;
begin
  s := _sessao(p_token, array['admin']);
  perform _premium(s.restaurante_id);
  if not exists (select 1 from setores where id = p_id and restaurante_id = s.restaurante_id) then raise exception 'Setor não encontrado'; end if;
  update setores set padrao = false where restaurante_id = s.restaurante_id and padrao;
  update setores set padrao = true where id = p_id;
  return jsonb_build_object('ok', true);
end $$;

create or replace function admin_setor_excluir(p_token uuid, p_id uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare s staff_sessoes; x setores;
begin
  s := _sessao(p_token, array['admin']);
  perform _premium(s.restaurante_id);
  select * into x from setores where id = p_id and restaurante_id = s.restaurante_id;
  if not found then raise exception 'Setor não encontrado'; end if;
  if x.padrao and exists (select 1 from setores where restaurante_id = s.restaurante_id and id <> x.id) then
    raise exception 'Escolha outro setor como padrão antes de excluir este';
  end if;
  delete from setores where id = x.id;   -- itens e usuários do setor ficam sem setor (itens vão para o padrão; usuários passam a ver tudo)
  return jsonb_build_object('ok', true);
end $$;

-- atribui itens do cardápio a setores: [{"id":"item","setor":"uuid" | null}]
create or replace function admin_setor_itens(p_token uuid, p_atribuicoes jsonb) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare s staff_sessoes; a jsonb; v_setor uuid; v_n int := 0;
begin
  s := _sessao(p_token, array['admin']);
  perform _premium(s.restaurante_id);
  if p_atribuicoes is null or jsonb_typeof(p_atribuicoes) <> 'array' then raise exception 'Dados inválidos'; end if;
  for a in select * from jsonb_array_elements(p_atribuicoes) loop
    v_setor := nullif(a->>'setor', '')::uuid;
    if v_setor is not null and not exists (select 1 from setores where id = v_setor and restaurante_id = s.restaurante_id) then
      raise exception 'Setor não encontrado';
    end if;
    update cardapio set setor_id = v_setor where restaurante_id = s.restaurante_id and id = a->>'id';
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('ok', true, 'itens', v_n);
end $$;

-- define o setor de um usuário de KDS (papel "cozinha"); para os outros papéis o setor é limpo
create or replace function admin_usuario_setor(p_token uuid, p_login text, p_setor uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare s staff_sessoes;
begin
  s := _sessao(p_token, array['admin']);
  perform _premium(s.restaurante_id);
  if p_setor is not null and not exists (select 1 from setores where id = p_setor and restaurante_id = s.restaurante_id) then
    raise exception 'Setor não encontrado';
  end if;
  update usuarios set setor_id = case when papel = 'cozinha' then p_setor else null end
   where restaurante_id = s.restaurante_id and login = lower(trim(coalesce(p_login, '')));
  if not found then raise exception 'Usuário não encontrado'; end if;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- mais pedidos e sugestões (público, só números agregados) ----------
create or replace function _calc_populares(p_rest uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_total int; v_qtd jsonb; v_juntos jsonb; v_ad jsonb;
begin
  select coalesce(sum(i.qtd), 0) into v_total
    from pedido_itens i join pedidos p on p.id = i.pedido_id join comandas c on c.id = p.comanda_id join mesas m on m.id = c.mesa_id
   where m.restaurante_id = p_rest and p.status <> 'cancelado' and p.criado_em > now() - interval '30 days';
  if v_total < 30 then   -- pouco histórico: não inventa destaque
    return jsonb_build_object('total', v_total, 'qtd', '{}'::jsonb, 'juntos', '{}'::jsonb, 'adicionais', '{}'::jsonb);
  end if;
  with base as (
    select i.item_id, i.qtd, i.adicionais, p.comanda_id
      from pedido_itens i join pedidos p on p.id = i.pedido_id join comandas c on c.id = p.comanda_id join mesas m on m.id = c.mesa_id
     where m.restaurante_id = p_rest and p.status <> 'cancelado' and p.criado_em > now() - interval '30 days'),
  q as (select item_id, sum(qtd)::int as n from base group by item_id order by 2 desc limit 80),
  pr as (select x.item_id as a, y.item_id as b, count(distinct x.comanda_id) as cnt
           from base x join base y on y.comanda_id = x.comanda_id and y.item_id <> x.item_id
          group by x.item_id, y.item_id having count(distinct x.comanda_id) >= 3),
  rk as (select a, b, cnt, row_number() over (partition by a order by cnt desc, b) as rn from pr),
  j as (select a, jsonb_agg(b order by cnt desc, b) as arr from rk where rn <= 3 group by a),
  ad as (select t.item_id, (array_agg(t.lbl order by t.cnt desc, t.lbl))[1] as top
           from (select b.item_id, e->>'l' as lbl, count(*) as cnt
                   from base b cross join lateral jsonb_array_elements(b.adicionais) e group by b.item_id, e->>'l') t
          group by t.item_id)
  select (select coalesce(jsonb_object_agg(item_id, n), '{}'::jsonb) from q),
         (select coalesce(jsonb_object_agg(a, arr), '{}'::jsonb) from j),
         (select coalesce(jsonb_object_agg(item_id, top), '{}'::jsonb) from ad)
    into v_qtd, v_juntos, v_ad;
  return jsonb_build_object('total', v_total, 'qtd', v_qtd, 'juntos', v_juntos, 'adicionais', v_ad);
end $$;

create or replace function publico_populares(p_slug text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare r restaurantes; v jsonb;
begin
  select * into r from restaurantes where slug = lower(coalesce(p_slug, '')) and ativo;
  if not found or _cobranca_nivel(r.proximo_vencimento, r.fuso) >= 1 then return '{}'::jsonb; end if;
  if r.populares is not null and r.populares_em > now() - interval '1 hour' then return r.populares; end if;
  v := _calc_populares(r.id);
  update restaurantes set populares = v, populares_em = now() where id = r.id;
  return v;
end $$;

-- ---------- cobrança: painel do restaurante (aviso) ----------
create or replace function admin_cobranca(p_token uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare s staff_sessoes; r restaurantes; e jsonb;
begin
  s := _sessao(p_token, array['admin']);
  select * into r from restaurantes where id = s.restaurante_id;
  e := _cobranca_estado(r.proximo_vencimento, r.fuso, r.cancelado_em, r.ativo);
  return jsonb_build_object('situacao', e->>'situacao', 'dias', (e->>'dias')::int, 'vencimento', r.proximo_vencimento);
end $$;

-- ---------- cobrança: dono da plataforma ----------
create or replace function plataforma_cobranca() returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform _plataforma();
  return jsonb_build_object('agora', now(), 'restaurantes', coalesce((select jsonb_agg(jsonb_build_object(
    'id', r.id, 'slug', r.slug, 'nome', r.nome, 'ativo', r.ativo, 'criado_em', r.criado_em,
    'mensalidade', r.mensalidade, 'implantacao', r.implantacao, 'implantacao_paga_em', r.implantacao_paga_em,
    'vencimento', r.proximo_vencimento, 'vendedor', r.vendedor, 'comissao_pct', r.comissao_pct, 'cancelado_em', r.cancelado_em,
    'dias', (x.e->>'dias')::int, 'situacao', x.e->>'situacao',
    'ultimo_pagamento', (select max(g.recebido_em) from pagamentos_plano g where g.restaurante_id = r.id and g.tipo = 'mensalidade' and not g.estornado),
    'pedidos_30d', (select count(distinct coalesce(p.lote, p.id)) from pedidos p join comandas c on c.id = p.comanda_id join mesas m on m.id = c.mesa_id
                     where m.restaurante_id = r.id and p.criado_em > now() - interval '30 days' and p.status <> 'cancelado'),
    'vendas_30d', (select coalesce(sum(g.valor), 0) from pagamentos g join comandas c on c.id = g.comanda_id join mesas m on m.id = c.mesa_id
                    where m.restaurante_id = r.id and g.em > now() - interval '30 days'),
    'ultima_atividade', (select max(p.criado_em) from pedidos p join comandas c on c.id = p.comanda_id join mesas m on m.id = c.mesa_id where m.restaurante_id = r.id)
  ) order by r.criado_em)
  from restaurantes r cross join lateral (select _cobranca_estado(r.proximo_vencimento, r.fuso, r.cancelado_em, r.ativo) as e) x), '[]'::jsonb));
end $$;

create or replace function plataforma_cobranca_salvar(p_rest uuid, p_mensalidade numeric, p_implantacao numeric, p_vencimento date,
                                                     p_vendedor text, p_comissao numeric, p_cancelado date) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform _plataforma();
  if p_mensalidade is null or p_mensalidade < 0 or p_mensalidade > 100000 then raise exception 'Mensalidade inválida'; end if;
  if p_implantacao is null or p_implantacao < 0 or p_implantacao > 100000 then raise exception 'Implantação inválida'; end if;
  if p_comissao is null or p_comissao < 0 or p_comissao > 100 then raise exception 'Comissão inválida'; end if;
  update restaurantes set mensalidade = round(p_mensalidade, 2), implantacao = round(p_implantacao, 2), proximo_vencimento = p_vencimento,
         vendedor = nullif(left(trim(coalesce(p_vendedor, '')), 60), ''), comissao_pct = p_comissao, cancelado_em = p_cancelado
   where id = p_rest;
  if not found then raise exception 'Restaurante não encontrado'; end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function plataforma_pagamento_registrar(p_rest uuid, p_tipo text, p_valor numeric, p_tarifa numeric, p_recebido_em date, p_obs text) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare r restaurantes; v_data date; v_venc date;
begin
  perform _plataforma();
  if p_tipo not in ('mensalidade','implantacao') then raise exception 'Tipo inválido'; end if;
  if p_valor is null or p_valor <= 0 or p_valor > 100000 then raise exception 'Valor inválido'; end if;
  if p_tarifa is null or p_tarifa < 0 or p_tarifa > p_valor then raise exception 'Tarifa inválida'; end if;
  select * into r from restaurantes where id = p_rest;
  if not found then raise exception 'Restaurante não encontrado'; end if;
  v_data := coalesce(p_recebido_em, (now() at time zone r.fuso)::date);
  insert into pagamentos_plano (restaurante_id, tipo, valor, tarifa, comissao_pct, recebido_em, obs)
  values (r.id, p_tipo, round(p_valor, 2), round(p_tarifa, 2), case when p_tipo = 'mensalidade' then r.comissao_pct else 0 end, v_data,
          nullif(left(trim(coalesce(p_obs, '')), 200), ''));
  if p_tipo = 'mensalidade' then
    -- cada mensalidade paga adianta o vencimento em 1 mês; sem vencimento configurado, o ciclo começa na data do pagamento
    v_venc := (coalesce(r.proximo_vencimento, v_data) + interval '1 month')::date;
    update restaurantes set proximo_vencimento = v_venc where id = r.id;
  else
    update restaurantes set implantacao_paga_em = v_data where id = r.id;
    v_venc := r.proximo_vencimento;
  end if;
  return jsonb_build_object('ok', true, 'vencimento', v_venc);
end $$;

create or replace function plataforma_pagamentos(p_rest uuid) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform _plataforma();
  return coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'tipo', g.tipo, 'valor', g.valor, 'tarifa', g.tarifa, 'recebido_em', g.recebido_em,
                                                        'obs', g.obs, 'estornado', g.estornado) order by g.recebido_em desc, g.id desc)
                     from (select * from pagamentos_plano where restaurante_id = p_rest order by recebido_em desc, id desc limit 24) g), '[]'::jsonb);
end $$;

create or replace function plataforma_pagamento_estornar(p_id bigint) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare g pagamentos_plano;
begin
  perform _plataforma();
  select * into g from pagamentos_plano where id = p_id and not estornado;
  if not found then raise exception 'Pagamento não encontrado ou já estornado'; end if;
  update pagamentos_plano set estornado = true where id = g.id;
  if g.tipo = 'mensalidade' then
    update restaurantes set proximo_vencimento = (proximo_vencimento - interval '1 month')::date where id = g.restaurante_id and proximo_vencimento is not null;
  else
    update restaurantes set implantacao_paga_em = null where id = g.restaurante_id;
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- comissões de um mês (por data de recebimento): base = valor - tarifa; comissão = base x % do vendedor
create or replace function plataforma_comissoes(p_mes date) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_ini date := date_trunc('month', coalesce(p_mes, current_date))::date;
begin
  perform _plataforma();
  return jsonb_build_object('mes', v_ini,
    'linhas', coalesce((select jsonb_agg(l order by l->>'vendedor', l->>'nome') from (
      select jsonb_build_object('restaurante_id', r.id, 'nome', r.nome, 'vendedor', coalesce(r.vendedor, ''),
               'pagamentos', count(*), 'bruto', sum(g.valor), 'tarifas', sum(g.tarifa), 'base', sum(g.valor - g.tarifa),
               'comissao', sum(round((g.valor - g.tarifa) * g.comissao_pct / 100, 2))) as l
        from pagamentos_plano g join restaurantes r on r.id = g.restaurante_id
       where g.tipo = 'mensalidade' and not g.estornado and g.recebido_em >= v_ini and g.recebido_em < (v_ini + interval '1 month')::date
       group by r.id, r.nome, r.vendedor) q), '[]'::jsonb),
    'implantacoes', coalesce((select sum(g.valor - g.tarifa) from pagamentos_plano g
       where g.tipo = 'implantacao' and not g.estornado and g.recebido_em >= v_ini and g.recebido_em < (v_ini + interval '1 month')::date), 0));
end $$;

-- Caminho de foto aceito no envio pelo painel: <slug de restaurante ativo>/<hash 12 hex>.<imagem>
create or replace function _foto_ok(p_nome text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(p_nome ~ '^[a-z0-9][a-z0-9-]*/[0-9a-f]{12}\.(webp|jpe?g|png|gif|avif)$', false)
    and exists (select 1 from restaurantes r where r.ativo and r.slug = split_part(p_nome, '/', 1));
$$;

-- ---------- permissões ----------
alter table plataforma_admins enable row level security;
alter table restaurantes enable row level security;
alter table usuarios enable row level security;
alter table staff_sessoes enable row level security;
alter table login_falhas enable row level security;
alter table mesas enable row level security;
alter table cardapio enable row level security;
alter table esgotado_log enable row level security;
alter table comandas enable row level security;
alter table clientes enable row level security;
alter table pedidos enable row level security;
alter table pedido_itens enable row level security;
alter table pagamentos enable row level security;

revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

grant execute on function
  publico_restaurante(text), publico_cardapio(text), publico_info(text, text), publico_entrar(text, text, text),
  publico_estado(uuid), publico_pedir(uuid, jsonb, text), publico_cancelar(uuid, uuid), publico_pedir_conta(uuid),
  staff_login(text, text, text), staff_logout(uuid),
  kds_listar(uuid), pedido_status(uuid, uuid, text),
  caixa_mesas(uuid), caixa_abrir_mesa(uuid, uuid), caixa_comanda(uuid, uuid), caixa_ajustar(uuid, uuid, numeric, numeric),
  caixa_limpar_aviso(uuid, uuid), caixa_pagar(uuid, uuid, text, numeric, text), caixa_desfazer_pagamento(uuid, uuid),
  caixa_encerrar(uuid, uuid, boolean), caixa_resumo(uuid, date),
  admin_mesas(uuid), admin_criar_mesas(uuid, int), admin_salvar_mesa(uuid, uuid, text, boolean), admin_apagar_mesa(uuid, uuid),
  admin_novo_codigo_mesa(uuid, uuid), admin_config_get(uuid), admin_config_set(uuid, numeric, boolean),
  admin_usuarios(uuid), admin_usuario_salvar(uuid, uuid, text, text, text, text, boolean),
  admin_itens(uuid), admin_item_esgotado(uuid, text, boolean), admin_cardapio_get(uuid), admin_publicar(uuid, jsonb, jsonb), admin_relatorio(uuid, date, date), admin_cobranca(uuid), _foto_ok(text),
  publico_chamar_garcom(uuid), publico_populares(text), admin_setores(uuid), admin_setor_salvar(uuid, uuid, text), admin_setor_padrao(uuid, uuid), admin_setor_excluir(uuid, uuid), admin_setor_itens(uuid, jsonb), admin_usuario_setor(uuid, text, uuid), garcom_mesas(uuid), garcom_mesa(uuid, uuid), garcom_itens(uuid), garcom_pedir(uuid, uuid, jsonb, text), garcom_entregar(uuid, uuid), garcom_atender(uuid, uuid)
to anon, authenticated;

grant execute on function
  plataforma_eu(), plataforma_restaurantes(), plataforma_criar_restaurante(text, text, text, text, text),
  plataforma_salvar_restaurante(uuid, text, text, boolean, text), plataforma_usuarios(uuid),
  plataforma_usuario_salvar(uuid, uuid, text, text, text, text, boolean), plataforma_publicar(uuid, jsonb, jsonb),
  plataforma_cobranca(), plataforma_cobranca_salvar(uuid, numeric, numeric, date, text, numeric, date),
  plataforma_pagamento_registrar(uuid, text, numeric, numeric, date, text), plataforma_pagamentos(uuid),
  plataforma_pagamento_estornar(bigint), plataforma_comissoes(date)
to authenticated;

-- ---------- fotos (Supabase Storage): qualquer um lê; o dono envia/altera; o painel do restaurante só ENVIA fotos novas (nome = hash, sem sobrescrever) ----------
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    execute $q$insert into storage.buckets (id, name, public, file_size_limit) values ('cardapios', 'cardapios', true, 5242880) on conflict (id) do update set public = true, file_size_limit = 5242880$q$;
    execute 'drop policy if exists "cardapios_envio_painel" on storage.objects';
    execute $q$create policy "cardapios_envio_painel" on storage.objects for insert to anon, authenticated
      with check (bucket_id = 'cardapios' and public._foto_ok(name))$q$;
    execute 'drop policy if exists "cardapios_escrita" on storage.objects';
    execute $q$create policy "cardapios_escrita" on storage.objects for all to authenticated
      using (bucket_id = 'cardapios' and exists (select 1 from public.plataforma_admins where user_id = auth.uid()))
      with check (bucket_id = 'cardapios' and exists (select 1 from public.plataforma_admins where user_id = auth.uid()))$q$;
  end if;
end $$;

-- ---------- seu acesso de dono ----------
-- 1) Supabase > Authentication > Users > Add user (e-mail + senha, marque "Auto Confirm").
-- 2) Rode (troque o e-mail):
--    insert into plataforma_admins (user_id) select id from auth.users where email = 'voce@exemplo.com' on conflict do nothing;
