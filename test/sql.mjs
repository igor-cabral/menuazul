// Regras do banco (schema.sql) num Postgres real (PGlite). Foco: isolamento entre restaurantes e permissões.
import { createDb } from './fake-backend.mjs';

let fails = 0;
const ok = (c, msg) => { console.log((c ? '  ✓ ' : '  ✗ ') + msg); if (!c) fails++; };
const be = await createDb();
const good = async (n, b, sub) => { const r = await be.rpc(n, b, sub); if (r.status !== 200) throw new Error(n + ': ' + r.json.message); return r.json; };
const bad = async (n, b, sub) => { const r = await be.rpc(n, b, sub); return r.status !== 200 ? r.json.message : null; };
const near = (a, b) => Math.abs(Number(a) - b) < 0.005;

console.log('1) permissões');
const dono = await be.criarUsuarioAuth('dono@x.com', 'x', true);
const intruso = await be.criarUsuarioAuth('intruso@x.com', 'x', false);
{
  const direct = await be.db.exec('set role anon').then(() => be.db.query('select * from usuarios')).then(() => 'permitido', e => e.message);
  await be.db.exec('reset role');
  ok(/permission denied/.test(direct), 'anon NÃO lê tabelas (senhas) diretamente');
  const d2 = await be.db.exec('set role anon').then(() => be.db.query("select _sessao(gen_random_uuid(), array['admin'])")).then(() => 'permitido', e => e.message);
  await be.db.exec('reset role');
  ok(/permission denied/.test(d2), 'anon NÃO chama funções internas');
  ok(/permission denied/.test(await bad('plataforma_restaurantes', {})), 'visitante anônimo não chama plataforma_*');
  ok(/sem_permissao/.test(await bad('plataforma_restaurantes', {}, intruso)), 'usuário Auth que não é dono é recusado');
  ok(Array.isArray(await good('plataforma_restaurantes', {}, dono)), 'dono da plataforma lista restaurantes');
}

console.log('2) criar restaurantes');
const P = { p_admin_login: 'dono', p_admin_nome: 'Dono', p_admin_senha: 'secreta1' };
const A = (await good('plataforma_criar_restaurante', { p_slug: 'pizza-boa', p_nome: 'Pizza Boa', ...P }, dono)).id;
const B = (await good('plataforma_criar_restaurante', { p_slug: 'burger', p_nome: 'Burger', ...P, p_admin_senha: 'outra-senha' }, dono)).id;
ok(!!A && !!B, 'dois restaurantes criados (mesmo login "dono" em ambos)');
ok(/reservado/.test(await bad('plataforma_criar_restaurante', { p_slug: 'admin', p_nome: 'X', ...P }, dono)), 'slug "admin" é reservado');
ok(/Endereço/.test(await bad('plataforma_criar_restaurante', { p_slug: 'Ab c', p_nome: 'X', ...P }, dono)), 'slug inválido recusado');
ok(/Já existe/.test(await bad('plataforma_criar_restaurante', { p_slug: 'burger', p_nome: 'X', ...P }, dono)), 'slug repetido recusado');
ok(/senha/i.test(await bad('plataforma_criar_restaurante', { p_slug: 'curto', p_nome: 'X', ...P, p_admin_senha: '123' }, dono)), 'senha curta recusada');
const hash = (await be.query("select senha_hash from usuarios where restaurante_id = $1", [A])).rows[0].senha_hash;
ok(/^\$2[aby]\$/.test(hash) && !hash.includes('secreta1'), 'senha guardada com bcrypt');

console.log('3) login da equipe');
const login = (slug, l, s) => good('staff_login', { p_slug: slug, p_login: l, p_senha: s });
{
  ok((await login('pizza-boa', 'dono', 'errada')).ok === false, 'senha errada: ok=false');
  ok((await login('pizza-boa', 'dono', 'outra-senha')).ok === false, 'senha do restaurante B não entra no A');
  ok((await login('nao-existe', 'dono', 'x')).ok === false, 'restaurante inexistente');
  for (let i = 0; i < 5; i++) await login('burger', 'dono', 'xxxxxx');
  ok(/tentativas/i.test((await login('burger', 'dono', 'outra-senha')).erro), 'bloqueio após 5 erros (mesmo com a senha certa)');
  ok((await login('pizza-boa', 'dono', 'secreta1')).ok === true, 'bloqueio é só do restaurante/usuário atingido');
}
await be.exec('delete from login_falhas');
const tokA = (await login('pizza-boa', 'dono', 'secreta1')).token;
const tokB = (await login('burger', 'dono', 'outra-senha')).token;

console.log('4) admin do restaurante: equipe, mesas, config');
await good('admin_usuario_salvar', { p_token: tokA, p_id: null, p_login: 'caixa1', p_nome: 'Caixa', p_papel: 'caixa', p_senha: 'caixa123', p_ativo: true });
await good('admin_usuario_salvar', { p_token: tokA, p_id: null, p_login: 'coz1', p_nome: 'Cozinha', p_papel: 'cozinha', p_senha: 'cozinha1', p_ativo: true });
const cxA = (await login('pizza-boa', 'caixa1', 'caixa123')).token, kdA = (await login('pizza-boa', 'coz1', 'cozinha1')).token;
ok(!!cxA && !!kdA, 'caixa e cozinha entram');
ok(/sessao_invalida/.test(await bad('admin_mesas', { p_token: cxA })), 'caixa não é admin');
ok(/sessao_invalida/.test(await bad('caixa_mesas', { p_token: kdA })), 'cozinha não acessa o caixa');
ok(/Já existe/.test(await bad('admin_usuario_salvar', { p_token: tokA, p_id: null, p_login: 'caixa1', p_nome: 'X', p_papel: 'caixa', p_senha: 'abcdef', p_ativo: true })), 'login repetido no mesmo restaurante');
{
  const us = await good('admin_usuarios', { p_token: tokA });
  const eu = us.find(u => u.login === 'dono'), cx = us.find(u => u.login === 'caixa1');
  ok(/próprio/.test(await bad('admin_usuario_salvar', { p_token: tokA, p_id: eu.id, p_login: '', p_nome: 'Dono', p_papel: 'caixa', p_senha: '', p_ativo: true })), 'admin não rebaixa a si mesmo');
  const usB = await good('admin_usuarios', { p_token: tokB });
  ok(/não encontrado/.test(await bad('admin_usuario_salvar', { p_token: tokA, p_id: usB[0].id, p_login: '', p_nome: 'Hack', p_papel: 'admin', p_senha: 'hackeado1', p_ativo: true })), 'admin A não edita usuário do restaurante B');
  await good('admin_usuario_salvar', { p_token: tokA, p_id: cx.id, p_login: '', p_nome: 'Caixa', p_papel: 'caixa', p_senha: 'nova-senha1', p_ativo: true });
  ok(/sessao_invalida/.test(await bad('caixa_mesas', { p_token: cxA })), 'trocar a senha derruba a sessão antiga');
  ok((await login('pizza-boa', 'caixa1', 'nova-senha1')).ok === true, 'senha nova funciona');
  await good('admin_usuario_salvar', { p_token: tokA, p_id: cx.id, p_login: '', p_nome: 'Caixa', p_papel: 'caixa', p_senha: '', p_ativo: false });
  ok((await login('pizza-boa', 'caixa1', 'nova-senha1')).ok === false, 'usuário desativado não entra');
  await good('admin_usuario_salvar', { p_token: tokA, p_id: cx.id, p_login: '', p_nome: 'Caixa', p_papel: 'caixa', p_senha: '', p_ativo: true });
}
var cxTok = (await login('pizza-boa', 'caixa1', 'nova-senha1')).token;
await good('admin_criar_mesas', { p_token: tokA, p_qtd: 2 });
await good('admin_criar_mesas', { p_token: tokB, p_qtd: 2 });
const mesasA = await good('admin_mesas', { p_token: tokA }), mesasB = await good('admin_mesas', { p_token: tokB });
ok(mesasA.length === 2 && mesasB.length === 2 && /^[a-z0-9]{8}$/.test(mesasA[0].codigo), 'cada restaurante tem suas mesas; código com 8 caracteres: ' + mesasA[0].codigo);
ok(/não encontrada/.test(await bad('admin_salvar_mesa', { p_token: tokA, p_id: mesasB[0].id, p_numero: 'X', p_ativa: false })), 'admin A não edita mesa do B');
ok(/não encontrada/.test(await bad('admin_novo_codigo_mesa', { p_token: tokA, p_id: mesasB[0].id })), 'admin A não troca código da mesa do B');
await good('admin_config_set', { p_token: tokA, p_taxa: 10, p_auto: false });
await good('admin_config_set', { p_token: tokB, p_taxa: 0, p_auto: true });

console.log('5) publicar cardápio (mesmo id de item, preços diferentes por restaurante)');
const itA = [{ id: 'x1', nome: 'X-Burger', preco: 20, variantes: [], adicionais: [{ l: 'Bacon', p: 5 }], esgotado: false }, { id: 'suco', nome: 'Suco', preco: 9, variantes: [], adicionais: [], esgotado: false }];
const itB = [{ id: 'x1', nome: 'Super X', preco: 50, variantes: [], adicionais: [], esgotado: false }];
ok(/sem_permissao/.test(await bad('plataforma_publicar', { p_rest: A, p_modelo: {}, p_itens: itA }, intruso)), 'só o dono publica');
await good('plataforma_publicar', { p_rest: A, p_modelo: { name: 'Pizza Boa', theme: { primary: '#d00' } }, p_itens: itA }, dono);
await good('plataforma_publicar', { p_rest: B, p_modelo: { name: 'Burger' }, p_itens: itB }, dono);
ok((await good('publico_cardapio', { p_slug: 'pizza-boa' })).modelo.name === 'Pizza Boa', 'cardápio público do A');
ok((await good('publico_restaurante', { p_slug: 'pizza-boa' })).cor === '#d00', 'cor do tema exposta para a tela de login');
await good('admin_item_esgotado', { p_token: tokA, p_item: 'suco', p_esgotado: true });
ok(JSON.stringify((await good('publico_cardapio', { p_slug: 'pizza-boa' })).esgotados) === '["suco"]', 'item esgotado aparece na lista');
ok(/não encontrado/.test(await bad('admin_item_esgotado', { p_token: tokB, p_item: 'suco', p_esgotado: true })), 'B não mexe no item do A');

console.log('5b) editor no painel: admin lê e publica só o próprio cardápio');
{
  const itX = [{ id: 'novo', nome: 'Novo', preco: 12, variantes: [], adicionais: [], esgotado: false }];
  ok(/sessao_invalida/.test(await bad('admin_publicar', { p_token: cxA, p_modelo: {}, p_itens: itX })), 'caixa não publica');
  ok(/sessao_invalida/.test(await bad('admin_publicar', { p_token: kdA, p_modelo: {}, p_itens: itX })), 'cozinha não publica');
  ok(/sessao_invalida/.test(await bad('admin_cardapio_get', { p_token: cxA })), 'caixa não lê o cardápio do editor');
  ok(/Cardápio inválido/.test(await bad('admin_publicar', { p_token: tokA, p_modelo: [], p_itens: itX })), 'modelo inválido recusado');
  await good('admin_publicar', { p_token: tokA, p_modelo: { name: 'Pizza Nova' }, p_itens: itX });
  ok((await good('admin_cardapio_get', { p_token: tokA })).cardapio.name === 'Pizza Nova', 'admin lê o que publicou');
  ok((await good('publico_cardapio', { p_slug: 'pizza-boa' })).modelo.name === 'Pizza Nova', 'cardápio público do A mudou');
  ok((await good('publico_cardapio', { p_slug: 'burger' })).modelo.name === 'Burger', 'cardápio do B não foi tocado');
  ok((await be.query('select count(*)::int c from cardapio where restaurante_id = $1', [A])).rows[0].c === 1, 'tabela de preços do A trocada');
  ok((await be.query('select count(*)::int c from cardapio where restaurante_id = $1', [B])).rows[0].c === 1, 'tabela de preços do B intacta');
  await good('admin_publicar', { p_token: tokA, p_modelo: { name: 'Pizza Boa', theme: { primary: '#d00' } }, p_itens: itA }); // volta ao estado do teste
  const foto = async n => (await be.query('select _foto_ok($1) as ok', [n])).rows[0].ok;
  ok(await foto('pizza-boa/0123456789ab.webp'), 'caminho de foto válido');
  ok(!(await foto('inexistente/0123456789ab.webp')) && !(await foto('pizza-boa/foto.webp')) && !(await foto('pizza-boa/0123456789ab.svg')) && !(await foto('pizza-boa/a/0123456789ab.png')), 'caminhos inválidos recusados (slug, nome, svg, subpasta)');
}

console.log('6) fluxo de pedido e isolamento');
const codA = mesasA[0].codigo, codB = mesasB[0].codigo;
ok(/mesa_invalida/.test(await bad('publico_info', { p_slug: 'pizza-boa', p_codigo: codB })), 'código da mesa do B não abre no A');
ok(/mesa_invalida/.test(await bad('publico_info', { p_slug: 'pizza-boa', p_codigo: 'xxxxxxxx' })), 'código inventado');
ok(/mesa_fechada/.test(await bad('publico_entrar', { p_slug: 'pizza-boa', p_codigo: codA, p_nome: 'Ana' })), 'mesa fechada (sem abertura automática)');
const cA = (await good('caixa_abrir_mesa', { p_token: cxTok, p_mesa: mesasA[0].id })).comanda_id;
ok(/Mesa não encontrada/.test(await bad('caixa_abrir_mesa', { p_token: cxTok, p_mesa: mesasB[0].id })), 'caixa A não abre mesa do B');
const ana = await good('publico_entrar', { p_slug: 'pizza-boa', p_codigo: codA, p_nome: 'Ana' });
const bia = await good('publico_entrar', { p_slug: 'burger', p_codigo: codB, p_nome: 'Bia' });
ok(!!bia.cliente_token, 'B tem abertura automática: cliente entra sozinho');
const pa = await good('publico_pedir', { p_cliente_token: ana.cliente_token, p_itens: [{ id: 'x1', v: '', a: ['Bacon'], q: 2, o: 'sem cebola' }], p_obs: null });
const pb = await good('publico_pedir', { p_cliente_token: bia.cliente_token, p_itens: [{ id: 'x1', q: 1 }] });
ok(pa.numero === 1 && pb.numero === 1, 'numeração de pedidos é por restaurante (#1 em cada)');
ok(/Esgotado/.test(await bad('publico_pedir', { p_cliente_token: ana.cliente_token, p_itens: [{ id: 'suco', q: 1 }] })), 'item esgotado recusado');
ok(/Adicional inválido/.test(await bad('publico_pedir', { p_cliente_token: bia.cliente_token, p_itens: [{ id: 'x1', a: ['Bacon'], q: 1 }] })), 'adicional do A não vale no B');
const totA = (await good('publico_estado', { p_cliente_token: ana.cliente_token })).totais;
ok(near(totA.subtotal, 50) && near(totA.total, 55), 'preço calculado no servidor (2 × (20+5)) + 10% = 55');
const totB = (await good('publico_estado', { p_cliente_token: bia.cliente_token })).totais;
ok(near(totB.subtotal, 50) && near(totB.total, 50), 'mesmo id "x1" custa 50 no B (isolado)');

const kdsA = await good('kds_listar', { p_token: kdA }), kdsB = (await good('kds_listar', { p_token: (await login('burger', 'dono', 'outra-senha')).token }));
ok(kdsA.pedidos.length === 1 && kdsA.pedidos[0].mesa === mesasA[0].numero && kdsB.pedidos.length === 1, 'cada cozinha só vê os seus pedidos');
ok(/não encontrado/.test(await bad('pedido_status', { p_token: kdA, p_pedido: kdsB.pedidos[0].id, p_status: 'pronto' })), 'cozinha A não muda pedido do B');
await good('pedido_status', { p_token: kdA, p_pedido: kdsA.pedidos[0].id, p_status: 'pronto' });
const cB = (await good('caixa_mesas', { p_token: tokB })).mesas.find(m => m.comanda).comanda.id;
ok(/Conta não encontrada/.test(await bad('caixa_comanda', { p_token: cxTok, p_comanda: cB })), 'caixa A não lê comanda do B');
ok(/Conta não encontrada/.test(await bad('caixa_pagar', { p_token: cxTok, p_comanda: cB, p_metodo: 'pix', p_valor: 10, p_nome: '' })), 'caixa A não paga comanda do B');
ok(/Conta não encontrada/.test(await bad('caixa_encerrar', { p_token: cxTok, p_comanda: cB, p_forcar: true })), 'caixa A não encerra comanda do B');
ok(/Conta não encontrada/.test(await bad('caixa_ajustar', { p_token: cxTok, p_comanda: cB, p_taxa: 0, p_desconto: 40 })), 'caixa A não dá desconto no B');
await good('caixa_pagar', { p_token: tokB, p_comanda: cB, p_metodo: 'pix', p_valor: 20, p_nome: '' });
const pgB = (await good('caixa_comanda', { p_token: tokB, p_comanda: cB })).pagamentos[0].id;
ok(/não encontrado/.test(await bad('caixa_desfazer_pagamento', { p_token: cxTok, p_pagamento: pgB })), 'caixa A não desfaz pagamento do B');
ok(near((await good('caixa_resumo', { p_token: cxTok, p_data: null })).total, 0), 'resumo do A não soma pagamentos do B');
ok(near((await good('caixa_resumo', { p_token: tokB, p_data: null })).total, 20), 'resumo do B = 20');
await good('caixa_pagar', { p_token: cxTok, p_comanda: cA, p_metodo: 'dinheiro', p_valor: 55, p_nome: 'Ana' });
await good('caixa_encerrar', { p_token: cxTok, p_comanda: cA, p_forcar: true });
ok(/sessao_invalida|conta_encerrada/.test(await bad('publico_pedir', { p_cliente_token: ana.cliente_token, p_itens: [{ id: 'x1', q: 1 }] })), 'cliente não pede em conta encerrada');

console.log('6b) relatórios do dono');
{
  ok(/sessao_invalida/.test(await bad('admin_relatorio', { p_token: cxTok, p_de: null, p_ate: null })), 'caixa não vê relatórios');
  ok(/sessao_invalida/.test(await bad('admin_relatorio', { p_token: kdA, p_de: null, p_ate: null })), 'cozinha não vê relatórios');
  ok(/Período inválido/.test(await bad('admin_relatorio', { p_token: tokA, p_de: '2026-02-10', p_ate: '2026-02-01' })), 'período invertido recusado');
  ok(/muito longo/.test(await bad('admin_relatorio', { p_token: tokA, p_de: '2024-01-01', p_ate: '2026-01-01' })), 'período maior que 1 ano recusado');
  const rA = await good('admin_relatorio', { p_token: tokA, p_de: null, p_ate: null });
  ok(near(rA.atual.faturamento, 55) && near(rA.atual.por_metodo.dinheiro, 55) && rA.atual.por_metodo.pix === undefined, 'faturamento e forma de pagamento do A (sem o pix do B)');
  ok(rA.atual.contas >= 1 && rA.atual.ticket_medio > 0 && rA.atual.pedidos >= 1, 'contas, ticket médio e pedidos do A');
  ok(Array.isArray(rA.mais_vendidos) && rA.mais_vendidos.length > 0 && rA.por_hora.length === 24, 'mais vendidos e horário de pico');
  ok(rA.por_hora.reduce((x, y) => x + y, 0) === rA.atual.pedidos, 'pedidos por hora somam o total de pedidos');
  ok(rA.menos_vendidos.length > 0 && rA.dias === 1 && rA.anterior_ate < rA.de, 'menos vendidos e período anterior');
  ok(rA.atual.preparo_min !== null, 'tempo de preparo medido (pedido marcado como pronto)');
  ok(rA.esgotados.length >= 1 && rA.esgotados[0].vezes >= 1, 'log de itens esgotados');
  const rB = await good('admin_relatorio', { p_token: tokB, p_de: null, p_ate: null });
  ok(near(rB.atual.faturamento, 20) && near(rB.atual.por_metodo.pix, 20) && rB.atual.por_metodo.dinheiro === undefined, 'relatório do B só tem os dados do B');
  ok((await be.query('select count(*)::int c from pedidos where pronto_em is not null')).rows[0].c >= 1, 'pedido guarda o horário de pronto');
}

console.log('6c) garçom');
{
  await good('admin_usuario_salvar', { p_token: tokA, p_id: null, p_login: 'gar1', p_nome: 'Ana Souza', p_papel: 'garcom', p_senha: 'garcom123', p_ativo: true });
  const gar = (await login('pizza-boa', 'gar1', 'garcom123')).token, mesaG = mesasA[1];
  ok(!!gar && (await login('pizza-boa', 'gar1', 'garcom123')).papel === 'garcom', 'garçom entra com papel próprio');
  for (const [nome, t] of [['caixa', cxA], ['cozinha', kdA]]) ok(/sessao_invalida/.test(await bad('garcom_mesas', { p_token: t })), nome + ' não usa a tela do garçom');
  ok(/sessao_invalida/.test(await bad('caixa_mesas', { p_token: gar })) && /sessao_invalida/.test(await bad('kds_listar', { p_token: gar })), 'garçom não acessa caixa nem cozinha');
  ok(/sessao_invalida/.test(await bad('admin_relatorio', { p_token: gar, p_de: null, p_ate: null })) && /sessao_invalida/.test(await bad('admin_mesas', { p_token: gar })), 'garçom não é admin');
  const ms = await good('garcom_mesas', { p_token: gar });
  ok(ms.mesas.length === 2 && ms.mesas.every(m => m.id !== mesasB[0].id), 'garçom vê só as mesas do seu restaurante');
  const its = await good('garcom_itens', { p_token: gar });
  ok(its.some(i => i.id === 'x1') && !its.some(i => i.id === 'b1'), 'garçom vê o cardápio do seu restaurante');
  ok(/não encontrada/.test(await bad('garcom_pedir', { p_token: gar, p_mesa: mesasB[0].id, p_itens: [{ id: 'x1', q: 1 }] })), 'garçom não lança pedido em mesa de outro restaurante');
  ok(/indispon/.test(await bad('garcom_pedir', { p_token: gar, p_mesa: mesaG.id, p_itens: [{ id: 'nao-existe', q: 1 }] })), 'item inexistente recusado');
  ok(/vazio/.test(await bad('garcom_pedir', { p_token: gar, p_mesa: mesaG.id, p_itens: [] })), 'pedido vazio recusado');
  ok((await be.query('select count(*)::int c from comandas where mesa_id = $1 and status = $2', [mesaG.id, 'aberta'])).rows[0].c === 0, 'pedido recusado não deixa conta aberta');
  const ped = await good('garcom_pedir', { p_token: gar, p_mesa: mesaG.id, p_itens: [{ id: 'x1', q: 2, a: ['Bacon'] }], p_obs: 'sem cebola' });
  ok(!!ped.pedido_id && !!ped.comanda_id && ped.numero > 0, 'garçom lança pedido e a conta da mesa abre');
  const kd = await good('kds_listar', { p_token: kdA }), pk = kd.pedidos.find(p => p.id === ped.pedido_id);
  ok(pk && pk.cliente === 'Garçom Ana' && pk.itens[0].qtd === 2 && Number(pk.itens[0].adicionais.length) === 1 && pk.obs === 'sem cebola', 'pedido do garçom chega na cozinha com o nome dele e os adicionais');
  ok((await be.query('select preco_unit from pedido_itens where pedido_id = $1', [ped.pedido_id])).rows[0].preco_unit == 25, 'preço calculado pelo servidor (20 + bacon 5)');
  const ped2 = await good('garcom_pedir', { p_token: gar, p_mesa: mesaG.id, p_itens: [{ id: 'x1', q: 1 }] });
  ok(ped2.comanda_id === ped.comanda_id && (await be.query('select count(*)::int c from clientes where comanda_id = $1', [ped.comanda_id])).rows[0].c === 1, 'segundo pedido usa a mesma conta e o mesmo "cliente" Garçom');
  ok(/Não encontrado|não encontrado/.test(await bad('garcom_entregar', { p_token: gar, p_pedido: ped.pedido_id })), 'não entrega pedido que ainda não está pronto');
  await good('pedido_status', { p_token: kdA, p_pedido: ped.pedido_id, p_status: 'pronto' });
  const m2 = (await good('garcom_mesas', { p_token: gar })).mesas.find(m => m.id === mesaG.id);
  ok(m2.comanda.prontos === 1 && m2.comanda.pendentes === 1, 'garçom vê 1 pronto para entregar e 1 na cozinha');
  const det = await good('garcom_mesa', { p_token: gar, p_mesa: mesaG.id });
  ok(det.pedidos.filter(p => p.status === 'pronto').length === 1 && det.mesa.numero === mesaG.numero, 'detalhe da mesa lista os pedidos prontos');
  ok(/não encontrad/i.test(await bad('garcom_entregar', { p_token: tokB, p_pedido: ped.pedido_id })), 'garçom/admin de outro restaurante não entrega o pedido');
  await good('garcom_entregar', { p_token: gar, p_pedido: ped.pedido_id });
  ok((await be.query('select status from pedidos where id = $1', [ped.pedido_id])).rows[0].status === 'entregue', 'entrega marca o pedido como entregue');
  ok(/não encontrad|já entregue/i.test(await bad('garcom_entregar', { p_token: gar, p_pedido: ped.pedido_id })), 'não entrega duas vezes');
  // cliente chama o garçom
  await good('admin_config_set', { p_token: tokA, p_taxa: 10, p_auto: true });
  const cli = await good('publico_entrar', { p_slug: 'pizza-boa', p_codigo: mesaG.codigo, p_nome: 'Bia' });
  ok((await good('publico_estado', { p_cliente_token: cli.cliente_token })).comanda.chamado === false, 'cliente ainda não chamou');
  await good('publico_chamar_garcom', { p_cliente_token: cli.cliente_token });
  const m3 = (await good('garcom_mesas', { p_token: gar })).mesas.find(m => m.id === mesaG.id);
  ok(m3.comanda.chamado_por === 'Bia' && !!m3.comanda.chamado_em, 'garçom vê quem chamou');
  ok((await good('publico_estado', { p_cliente_token: cli.cliente_token })).comanda.chamado === true, 'cliente vê que o garçom foi chamado');
  await good('garcom_atender', { p_token: gar, p_comanda: ped.comanda_id });
  ok((await good('garcom_mesas', { p_token: gar })).mesas.find(m => m.id === mesaG.id).comanda.chamado_em === null, 'atender limpa o chamado');
  ok(/não encontrad/i.test(await bad('garcom_atender', { p_token: tokB, p_comanda: ped.comanda_id })), 'outro restaurante não atende o chamado');
  await good('admin_config_set', { p_token: tokA, p_taxa: 10, p_auto: false });
}

console.log('6d) setores de KDS, pedidos divididos e sugestões');
{
  ok(/sessao_invalida/.test(await bad('admin_setores', { p_token: cxA })), 'caixa não vê setores');
  await good('admin_setor_salvar', { p_token: tokA, p_id: null, p_nome: 'Cozinha' });
  await good('admin_setor_salvar', { p_token: tokA, p_id: null, p_nome: 'Bar' });
  const sA = await good('admin_setores', { p_token: tokA }), coz = sA.find(x => x.nome === 'Cozinha'), bar = sA.find(x => x.nome === 'Bar');
  ok(sA.length === 2 && coz.padrao && !bar.padrao, 'primeiro setor criado vira o padrão');
  ok(/Já existe/.test(await bad('admin_setor_salvar', { p_token: tokA, p_id: null, p_nome: 'Bar' })), 'nome de setor repetido recusado');
  ok((await good('admin_setores', { p_token: tokB })).length === 0, 'setores são por restaurante');
  ok(/não encontrado/i.test(await bad('admin_setor_itens', { p_token: tokB, p_atribuicoes: [{ id: 'x1', setor: bar.id }] })), 'admin de outro restaurante não usa o setor');
  await good('admin_setor_itens', { p_token: tokA, p_atribuicoes: [{ id: 'suco', setor: bar.id }] });
  ok((await good('admin_itens', { p_token: tokA })).find(i => i.id === 'suco').setor_id === bar.id, 'item atribuído ao Bar');
  await good('admin_usuario_salvar', { p_token: tokA, p_id: null, p_login: 'bar1', p_nome: 'Bar 1', p_papel: 'cozinha', p_senha: 'barbar123', p_ativo: true });
  await good('admin_usuario_setor', { p_token: tokA, p_login: 'bar1', p_setor: bar.id });
  ok(/não encontrado/i.test(await bad('admin_usuario_setor', { p_token: tokA, p_login: 'bar1', p_setor: '00000000-0000-0000-0000-000000000000' })), 'setor inexistente recusado');
  const kdBar = (await login('pizza-boa', 'bar1', 'barbar123')).token, g = (await login('pizza-boa', 'gar1', 'garcom123')).token, mesaS = mesasA[1];
  ok((await good('admin_usuarios', { p_token: tokA })).find(u => u.login === 'bar1').setor === 'Bar', 'lista da equipe mostra o setor do usuário');
  const misto = await good('garcom_pedir', { p_token: g, p_mesa: mesaS.id, p_itens: [{ id: 'x1', q: 1 }, { id: 'suco', q: 2, src: 'sugestao' }], p_obs: 'urgente' });
  ok(misto.pedidos.length === 2 && misto.pedidos.map(x => x.setor).sort().join() === 'Bar,Cozinha', 'pedido com itens de dois setores vira dois pedidos');
  const kb = await good('kds_listar', { p_token: kdBar }), kc = await good('kds_listar', { p_token: kdA });
  const meus = p => misto.pedidos.some(x => x.pedido_id === p.id), pb = kb.pedidos.filter(meus);
  ok(kb.setor.nome === 'Bar' && pb.length === 1 && pb[0].itens.length === 1 && pb[0].itens[0].nome === 'Suco' && pb[0].obs === 'urgente', 'KDS do Bar vê só a parte do Bar');
  ok(kc.pedidos.filter(meus).length === 2 && kc.setor === null, 'KDS sem setor vê todos os pedidos');
  ok(/não encontrado/i.test(await bad('pedido_status', { p_token: kdBar, p_pedido: misto.pedidos.find(x => x.setor === 'Cozinha').pedido_id, p_status: 'pronto' })), 'KDS do Bar não mexe no pedido da Cozinha');
  await good('pedido_status', { p_token: kdBar, p_pedido: pb[0].id, p_status: 'pronto' });
  ok((await be.query('select status from pedidos where id = $1', [pb[0].id])).rows[0].status === 'pronto', 'KDS do Bar atualiza o seu pedido');
  const lote = (await be.query('select count(distinct lote)::int n, count(*)::int c from pedidos where id = any($1)', [misto.pedidos.map(x => x.pedido_id)])).rows[0];
  ok(lote.n === 1 && lote.c === 2, 'os dois pedidos pertencem ao mesmo lote');
  ok((await be.query('select origem from pedido_itens where pedido_id = $1', [pb[0].id])).rows[0].origem === 'sugestao', 'origem "sugestao" gravada no item');
  await good('admin_publicar', { p_token: tokA, p_modelo: { name: 'Pizza Boa' }, p_itens: itA });
  ok((await good('admin_itens', { p_token: tokA })).find(i => i.id === 'suco').setor_id === bar.id, 'republicar o cardápio preserva o setor dos itens');
  await good('admin_setor_itens', { p_token: tokA, p_atribuicoes: [{ id: 'suco', setor: null }] });
  const pad = await good('garcom_pedir', { p_token: g, p_mesa: mesaS.id, p_itens: [{ id: 'suco', q: 1 }] });
  ok(pad.pedidos.length === 1 && pad.pedidos[0].setor === 'Cozinha', 'item sem setor vai para o setor padrão');
  ok(/outro setor como padrão/.test(await bad('admin_setor_excluir', { p_token: tokA, p_id: coz.id })), 'não exclui o setor padrão enquanto houver outros');
  await good('admin_setor_padrao', { p_token: tokA, p_id: bar.id });
  await good('admin_setor_excluir', { p_token: tokA, p_id: coz.id });
  ok((await good('admin_setores', { p_token: tokA })).length === 1, 'exclui o setor depois de trocar o padrão');
  const rs = await good('admin_relatorio', { p_token: tokA, p_de: null, p_ate: null });
  ok(rs.atual.sug_itens >= 2 && rs.atual.sug_receita >= 18, 'relatório mostra as vendas vindas das sugestões');
  const pop0 = await good('publico_populares', { p_slug: 'pizza-boa' });
  ok(typeof pop0.qtd === 'object' && (Object.keys(pop0.qtd).length === 0 || pop0.total >= 30), 'populares: sem histórico suficiente não destaca nada');
  ok(Object.keys(await good('publico_populares', { p_slug: 'nao-existe' })).length === 0, 'restaurante inexistente devolve vazio');
}

console.log('6e) cobrança: mensalidade, pagamentos, comissões, aviso e bloqueio gradual');
{
  const gar = (await login('pizza-boa', 'gar1', 'garcom123')).token;
  const dia = async n => (await be.query("select ((now() at time zone 'America/Sao_Paulo')::date + $1::int)::text as d", [n])).rows[0].d;
  const sit = async () => (await good('admin_cobranca', { p_token: tokA }));
  const cob = async () => (await good('plataforma_cobranca', {}, dono)).restaurantes.find(r => r.id === A);
  const salvar = (venc, extra = {}) => good('plataforma_cobranca_salvar', { p_rest: A, p_mensalidade: 179.9, p_implantacao: 100, p_vencimento: venc, p_vendedor: 'Carlos', p_comissao: 35, p_cancelado: null, ...extra }, dono);
  ok(/sem_permissao/.test(await bad('plataforma_cobranca', {}, intruso)) && /permission denied/.test(await bad('plataforma_cobranca', {})), 'só o dono vê a cobrança');
  ok(/sessao_invalida/.test(await bad('admin_cobranca', { p_token: cxA })), 'caixa não vê a situação da mensalidade');
  const c0 = await cob();
  ok(Number(c0.mensalidade) === 159.9 && Number(c0.implantacao) === 100 && c0.situacao === 'sem_cobranca' && c0.pedidos_30d >= 0, 'padrões: R$ 159,90 + R$ 100, sem cobrança configurada (nunca limita)');
  ok(/inválida/.test(await bad('plataforma_cobranca_salvar', { p_rest: A, p_mensalidade: -1, p_implantacao: 100, p_vencimento: null, p_vendedor: '', p_comissao: 35, p_cancelado: null }, dono)), 'mensalidade negativa recusada');
  ok(/Comissão inválida/.test(await bad('plataforma_cobranca_salvar', { p_rest: A, p_mensalidade: 100, p_implantacao: 100, p_vencimento: null, p_vendedor: '', p_comissao: 120, p_cancelado: null }, dono)), 'comissão acima de 100% recusada');
  await salvar(await dia(5));
  const c1 = await cob();
  ok(Number(c1.mensalidade) === 179.9 && c1.situacao === 'em_dia' && c1.vendedor === 'Carlos', 'mensalidade ajustável; vencimento futuro = em dia');
  // pagamentos e comissão
  const rp = await good('plataforma_pagamento_registrar', { p_rest: A, p_tipo: 'mensalidade', p_valor: 179.9, p_tarifa: 2, p_recebido_em: await dia(0), p_obs: 'Pix' }, dono);
  const venc1 = (await be.query("select ($1::date + interval '1 month')::date::text as d", [await dia(5)])).rows[0].d;
  ok(rp.vencimento === venc1, 'mensalidade paga adianta o vencimento em 1 mês');
  ok(/Tarifa inválida/.test(await bad('plataforma_pagamento_registrar', { p_rest: A, p_tipo: 'mensalidade', p_valor: 10, p_tarifa: 11, p_recebido_em: null, p_obs: '' }, dono)), 'tarifa maior que o valor recusada');
  await good('plataforma_pagamento_registrar', { p_rest: A, p_tipo: 'implantacao', p_valor: 100, p_tarifa: 0, p_recebido_em: await dia(0), p_obs: null }, dono);
  ok((await cob()).implantacao_paga_em === await dia(0), 'implantação registrada');
  const cm = await good('plataforma_comissoes', { p_mes: await dia(0) }, dono), lin = cm.linhas.find(l => l.restaurante_id === A);
  ok(lin && near(lin.bruto, 179.9) && near(lin.base, 177.9) && near(lin.comissao, 62.27) && lin.vendedor === 'Carlos', 'comissão = (valor − tarifa) × 35% = R$ 62,27');
  ok(near(cm.implantacoes, 100), 'implantação aparece à parte (100% do titular)');
  const hist = await good('plataforma_pagamentos', { p_rest: A }, dono);
  ok(hist.length === 2 && hist.some(h => h.tipo === 'mensalidade' && near(h.tarifa, 2)), 'histórico de pagamentos');
  const mens = hist.find(h => h.tipo === 'mensalidade');
  await good('plataforma_pagamento_estornar', { p_id: mens.id }, dono);
  ok((await cob()).vencimento === await dia(5), 'estorno devolve o vencimento');
  ok((await good('plataforma_comissoes', { p_mes: await dia(0) }, dono)).linhas.every(l => l.restaurante_id !== A), 'pagamento estornado não gera comissão');
  ok(/já estornado|não encontrado/i.test(await bad('plataforma_pagamento_estornar', { p_id: mens.id }, dono)), 'não estorna duas vezes');
  // atraso: tolerância (1–7), aviso (8–14), limitado (15–29), suspenso (30+)
  await salvar(await dia(-3)); let c = await sit();
  ok(c.situacao === 'tolerancia' && c.dias === 3, 'até 7 dias: tolerância');
  ok(Array.isArray((await good('garcom_mesas', { p_token: gar })).mesas), 'tolerância não tira nenhum recurso');
  await salvar(await dia(-10)); c = await sit();
  ok(c.situacao === 'aviso' && c.dias === 10, 'do 8º dia: aviso');
  ok(Array.isArray((await good('garcom_mesas', { p_token: gar })).mesas) && (await good('admin_relatorio', { p_token: tokA, p_de: null, p_ate: null })).dias === 1, 'no aviso os recursos continuam funcionando');
  await salvar(await dia(-20)); c = await sit();
  ok(c.situacao === 'limitado', 'a partir de 15 dias: recursos premium desativados');
  for (const [nome, fn, args, t] of [['garçom', 'garcom_mesas', {}, gar], ['relatórios', 'admin_relatorio', { p_de: null, p_ate: null }, tokA], ['setores', 'admin_setores', {}, tokA]])
    ok(/mensalidade em atraso/.test(await bad(fn, { p_token: t, ...args })), nome + ' bloqueado com mensalidade em atraso');
  ok(Object.keys(await good('publico_populares', { p_slug: 'pizza-boa' })).length === 0, 'sugestões automáticas desligadas');
  ok((await good('kds_listar', { p_token: kdA })).limitado === true, 'KDS sabe que a impressão automática está indisponível');
  ok(Array.isArray((await good('caixa_mesas', { p_token: cxA })).mesas) && Array.isArray((await good('kds_listar', { p_token: kdA })).pedidos) && !!(await good('publico_cardapio', { p_slug: 'pizza-boa' })).modelo, 'caixa, cozinha e cardápio continuam funcionando');
  await salvar(await dia(-40));
  ok(/restaurante_bloqueado/.test(await bad('admin_cobranca', { p_token: tokA })), 'a partir de 30 dias: acesso suspenso');
  ok(/restaurante_bloqueado/.test(await bad('publico_cardapio', { p_slug: 'pizza-boa' })), 'cardápio público fora do ar na suspensão');
  ok((await login('pizza-boa', 'dono', 'secreta1')).ok === false, 'login da equipe bloqueado na suspensão');
  ok((await cob()).situacao === 'suspenso' && (await cob()).dias >= 40, 'dono vê o restaurante suspenso');
  ok((await be.query('select count(*)::int c from cardapio where restaurante_id = $1', [A])).rows[0].c > 0, 'dados continuam guardados na suspensão');
  // pagamento regulariza
  await good('plataforma_pagamento_registrar', { p_rest: A, p_tipo: 'mensalidade', p_valor: 179.9, p_tarifa: 0, p_recebido_em: await dia(0), p_obs: null }, dono);
  ok((await login('pizza-boa', 'dono', 'secreta1')).ok === true, 'registrar o pagamento libera o acesso de novo');
  await salvar(null);
  ok((await cob()).situacao === 'sem_cobranca', 'vencimento vazio desliga a cobrança');
  await salvar(null, { p_cancelado: await dia(0) });
  ok((await cob()).situacao === 'cancelado', 'restaurante cancelado aparece como cancelado');
  await salvar(null);
}

console.log('7) bloqueio de restaurante');
await good('plataforma_salvar_restaurante', { p_id: B, p_nome: 'Burger', p_slug: 'burger', p_ativo: false, p_motivo: 'Inadimplente' }, dono);
ok((await be.query('select count(*)::int n from staff_sessoes where restaurante_id = $1', [B])).rows[0].n === 0, 'sessões do restaurante bloqueado foram apagadas');
const lb = await login('burger', 'dono', 'outra-senha');
ok(lb.ok === false && lb.bloqueado === true, 'login do bloqueado é recusado');
ok(/restaurante_bloqueado/.test(await bad('publico_cardapio', { p_slug: 'burger' })), 'cardápio do bloqueado some');
ok(/restaurante_bloqueado/.test(await bad('publico_estado', { p_cliente_token: bia.cliente_token })), 'clientes do bloqueado não usam mais');
ok(/restaurante_bloqueado/.test(await bad('publico_pedir', { p_cliente_token: bia.cliente_token, p_itens: [{ id: 'x1', q: 1 }] })), 'nem pedem');
ok((await good('publico_restaurante', { p_slug: 'burger' })).ativo === false, 'tela de login sabe que está bloqueado');
await good('plataforma_salvar_restaurante', { p_id: B, p_nome: 'Burger', p_slug: 'burger', p_ativo: true, p_motivo: '' }, dono);
ok((await login('burger', 'dono', 'outra-senha')).ok === true, 'desbloqueado volta a entrar');
await good('plataforma_usuario_salvar', { p_rest: B, p_id: null, p_login: 'novo', p_nome: 'Novo', p_papel: 'caixa', p_senha: 'abcdef12', p_ativo: true }, dono);
ok((await login('burger', 'novo', 'abcdef12')).ok === true, 'dono da plataforma cria usuário no restaurante');
const ub = await good('plataforma_usuarios', { p_rest: B }, dono);
ok(/pelo menos um administrador/.test(await bad('plataforma_usuario_salvar', { p_rest: B, p_id: ub.find(u => u.papel === 'admin').id, p_login: '', p_nome: 'Dono', p_papel: 'caixa', p_senha: '', p_ativo: true }, dono)), 'nunca fica sem administrador');

console.log(fails ? `\n${fails} falha(s)` : '\nBanco OK');
process.exit(fails ? 1 : 0);
