\set ON_ERROR_STOP 0
insert into auth.users (id,email,senha) values ('11111111-1111-1111-1111-111111111111','d@x.com','x') on conflict do nothing;
insert into plataforma_admins values ('11111111-1111-1111-1111-111111111111') on conflict do nothing;
set role authenticated; select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select (plataforma_criar_restaurante('pizza-boa','Pizza Boa','dono','Dono','secreta1')->>'id') as rid \gset
select plataforma_publicar(:'rid'::uuid, '{"name":"Pizza","options":{"entregaSistema":true,"typeDelivery":true,"typePickup":true,"deliveryFee":"5,00","minOrder":"20,00","payments":"Pix, Dinheiro"}}'::jsonb,
 '[{"id":"p1","nome":"Pizza","preco":30,"variantes":[],"adicionais":[],"esgotado":false},{"id":"p2","nome":"Suco","preco":8,"variantes":[],"adicionais":[],"esgotado":false},{"id":"p3","nome":"Acabou","preco":9,"variantes":[],"adicionais":[],"esgotado":true}]'::jsonb) is not null as publicou;
reset role;
select _preco_txt('5,00') a, _preco_txt('R$ 5.50') b, _preco_txt('1.200,00') c, _preco_txt('abc') d, _preco_txt(null) e;
set role anon;
\echo '--- 1 delivery ok (esperado: numero, total 35)'
select publico_pedir_delivery('pizza-boa','delivery','Ana','(47) 99999-1111','Rua A 100, centro','Pix','',  '[{"id":"p1","q":1}]'::jsonb,'sem cebola') as r \gset
select :'r'::jsonb ->> 'numero' numero, :'r'::jsonb #>> '{totais,total}' total, :'r'::jsonb #>> '{totais,taxa_entrega}' fee, :'r'::jsonb ->> 'canal';
select (:'r'::jsonb ->> 'cliente_token') as ctok \gset
\echo '--- 2 erros (esperado 8 mensagens)'
select publico_pedir_delivery('pizza-boa','delivery','','47999991111','Rua A 100, centro','Pix','','[{"id":"p1","q":1}]'::jsonb);
select publico_pedir_delivery('pizza-boa','delivery','Ana','123','Rua A 100, centro','Pix','','[{"id":"p1","q":1}]'::jsonb);
select publico_pedir_delivery('pizza-boa','delivery','Ana','47999992222','Rua','Pix','','[{"id":"p1","q":1}]'::jsonb);
select publico_pedir_delivery('pizza-boa','delivery','Ana','47999992222','Rua A 100, centro','Cheque','','[{"id":"p1","q":1}]'::jsonb);
select publico_pedir_delivery('pizza-boa','delivery','Ana','47999992222','Rua A 100, centro','Pix','','[{"id":"p2","q":1}]'::jsonb);
select publico_pedir_delivery('pizza-boa','delivery','Ana','47999992222','Rua A 100, centro','Pix','','[{"id":"p3","q":3}]'::jsonb);
select publico_pedir_delivery('pizza-boa','mesa','Ana','47999992222','Rua A 100, centro','Pix','','[{"id":"p1","q":1}]'::jsonb);
select publico_pedir_delivery('nao-existe','delivery','Ana','47999992222','Rua A 100, centro','Pix','','[{"id":"p1","q":1}]'::jsonb);
reset role;
select count(*) as "comandas_apos_erros (esperado 1)" from comandas where canal <> 'mesa';
set role anon;
\echo '--- 3 retirada sem endereco/taxa (total 30)'
select publico_pedir_delivery('pizza-boa','retirada','Beto','47988887777',null,'Dinheiro','50','[{"id":"p1","q":1}]'::jsonb) #>> '{totais,total}';
\echo '--- 4 rate limit: 3o ok, 4o barrado'
select publico_pedir_delivery('pizza-boa','retirada','Beto','47988887777',null,'Pix','','[{"id":"p1","q":1}]'::jsonb) ->> 'numero';
select publico_pedir_delivery('pizza-boa','retirada','Beto','47988887777',null,'Pix','','[{"id":"p1","q":1}]'::jsonb);
\echo '--- 5 acompanhamento do cliente'
select jsonb_pretty(publico_estado(:'ctok'::uuid) #- '{pedidos,0,itens}');
reset role;
\echo '--- 6 staff'
select staff_login('pizza-boa','dono','secreta1') ->> 'token' as tok \gset
set role anon;
select jsonb_array_length(kds_listar(:'tok'::uuid) -> 'pedidos') kds_pedidos;
select (kds_listar(:'tok'::uuid) -> 'pedidos' -> 0) - 'itens' as primeiro;
select jsonb_array_length(caixa_delivery(:'tok'::uuid) -> 'pedidos') as "delivery_abertos (3)";
select jsonb_array_length(caixa_mesas(:'tok'::uuid) -> 'mesas') as "caixa_mesas (0)";
select jsonb_array_length(garcom_mesas(:'tok'::uuid) -> 'mesas') as "garcom_mesas (0)";
select jsonb_array_length(admin_mesas(:'tok'::uuid)) as "admin_mesas (0)";
select (caixa_delivery(:'tok'::uuid) -> 'pedidos' -> 0 ->> 'id') as cid \gset
select caixa_comanda(:'tok'::uuid, :'cid'::uuid) -> 'comanda' as com, caixa_comanda(:'tok'::uuid, :'cid'::uuid) -> 'totais' as tot;
\echo '--- 7 pagar e encerrar'
select caixa_pagar(:'tok'::uuid, :'cid'::uuid, 'pix', 35, null) ->> 'saldo' as saldo;
select caixa_encerrar(:'tok'::uuid, :'cid'::uuid, true) ->> 'ok';
select jsonb_array_length(caixa_delivery(:'tok'::uuid) -> 'pedidos') as "delivery_abertos (2)";
select publico_estado(:'ctok'::uuid) #>> '{comanda,status}' as "cliente ve";
select caixa_resumo(:'tok'::uuid, null) - 'data' as resumo;
\echo '--- 8 mesa normal ainda funciona e mantem unicidade'
reset role;
insert into mesas (restaurante_id, numero, codigo) select id,'1','m1' from restaurantes where slug='pizza-boa';
insert into comandas (mesa_id, taxa_servico) select id,10 from mesas where numero='1';
insert into comandas (mesa_id, taxa_servico) select id,10 from mesas where numero='1';
\echo '--- 9 entregaSistema desligado'
set role authenticated; select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false);
select plataforma_publicar(:'rid'::uuid, '{"name":"Pizza","options":{"typeDelivery":true}}'::jsonb, '[{"id":"p1","nome":"Pizza","preco":30,"variantes":[],"adicionais":[],"esgotado":false}]'::jsonb) is not null;
reset role; set role anon;
select publico_pedir_delivery('pizza-boa','delivery','Zé','47977776666','Rua B 200, bairro','','','[{"id":"p1","q":1}]'::jsonb);
