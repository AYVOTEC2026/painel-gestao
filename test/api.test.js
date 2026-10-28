'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { criarApp } = require('../server/app');
const { criarRepoMemoria } = require('../server/persistencia/repo-memoria');
const { criarRepoPg } = require('../server/persistencia/repo-pg');
const { semearDemo } = require('../server/seed');
const { lerConfig } = require('../server/config');

const AGORA = '2026-10-28T15:20:00';

async function subir(repo) {
  const cfg = lerConfig({ SEED_DEMO: 'true', SENHA_DEMO: 'demo1234' });
  const agora = () => AGORA;
  await repo.iniciar();
  await semearDemo(repo, cfg, agora);
  const servidor = criarApp({ cfg, repo, agora }).listen(0);
  await new Promise(r => servidor.once('listening', r));
  const base = `http://127.0.0.1:${servidor.address().port}`;

  function cliente() {
    let cookie = '';
    async function chamar(metodo, caminho, corpo) {
      const res = await fetch(base + caminho, {
        method: metodo,
        headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
        body: corpo === undefined ? undefined : JSON.stringify(corpo)
      });
      const set = res.headers.get('set-cookie');
      if (set) cookie = set.split(';')[0];
      const tipo = res.headers.get('content-type') || '';
      return { status: res.status, corpo: tipo.includes('json') ? await res.json() : await res.text() };
    }
    chamar.cookie = () => cookie;
    return chamar;
  }
  return { base, cliente, fechar: () => new Promise(r => servidor.close(r)) };
}

async function roteiro(repo) {
  const srv = await subir(repo);
  try {
    const anonimo = srv.cliente();
    const pub = await anonimo('GET', '/api/publico');
    assert.strictEqual(pub.corpo.instalado, true);
    assert.strictEqual(pub.corpo.demo.perfis.length, 2);
    assert.strictEqual((await anonimo('GET', '/api/visao')).status, 401);

    const errado = await anonimo('POST', '/api/entrar', { email: 'caixa@foodpark.demo', senha: 'x' });
    assert.strictEqual(errado.status, 400);
    assert.match(errado.corpo.erro, /não conferem/);

    // Funcionário do caixa: vende, mas não vê o financeiro nem cadastra lojista.
    const caixa = srv.cliente();
    const entrou = await caixa('POST', '/api/entrar', { email: 'caixa@foodpark.demo', senha: 'demo1234' });
    assert.strictEqual(entrou.status, 200);
    assert.strictEqual(entrou.corpo.usuario.inicio, 'caixa');
    const vCaixa = (await caixa('GET', '/api/visao')).corpo;
    assert.strictEqual(vCaixa.financeiro, undefined);
    assert.strictEqual(vCaixa.boxes[0].aluguel, undefined);
    assert.ok(vCaixa.caixa, 'demonstração começa com o caixa aberto');
    assert.strictEqual((await caixa('POST', '/api/acao/novo-lojista', { box: 6, nome: 'Teste' })).status, 403);
    assert.strictEqual((await caixa('GET', '/api/exportar/vendas')).status, 403);

    const box = vCaixa.boxes[0];
    const venda = await caixa('POST', '/api/acao/vender', {
      boxId: box.id, pagamento: 'pix', itens: [{ produtoId: box.produtos[0].id, qtd: 2 }], mesa: '7'
    });
    assert.strictEqual(venda.status, 200, JSON.stringify(venda.corpo));
    const nova = venda.corpo.visao.caixa.vendas[0];
    assert.strictEqual(nova.id, venda.corpo.resultado.vendaId);
    assert.strictEqual(nova.total, box.produtos[0].preco * 2);

    const semCaixa = await caixa('POST', '/api/acao/vender', { boxId: box.id, pagamento: 'pix', itens: [] });
    assert.strictEqual(semCaixa.status, 400);
    assert.match(semCaixa.corpo.erro, /item/i);

    const cancel = await caixa('POST', '/api/acao/cancelar-venda', { vendaId: nova.id, motivo: 'Cliente desistiu' });
    assert.strictEqual(cancel.status, 200);
    assert.strictEqual(cancel.corpo.visao.caixa.vendas[0].status, 'cancelada');

    // Gestão: painel, financeiro, equipe e histórico com o nome de quem fez.
    const dona = srv.cliente();
    await dona('POST', '/api/entrar', { email: 'proprietaria@foodpark.demo', senha: 'demo1234' });
    const v = (await dona('GET', '/api/visao?mes=2026-10')).corpo;
    assert.ok(v.painel.hoje.total > 0);
    assert.strictEqual(v.painel.serie.length, 14);
    assert.strictEqual(v.financeiro.equilibrado, true);
    assert.strictEqual(v.financeiro.debitos, v.financeiro.creditos);

    const csv = await dona('GET', '/api/exportar/vendas?mes=2026-10');
    assert.strictEqual(csv.status, 200);
    assert.ok(csv.corpo.includes('pedido;data;box'));

    const equipe = (await dona('GET', '/api/equipe')).corpo;
    assert.ok(equipe.atividade.some(a => a.usuarioNome === 'Rafael Souza' && /Cancelou a venda/.test(a.resumo)));

    const cadastro = await dona('POST', '/api/equipe', { nome: 'Joana Lima', email: 'joana@exemplo.com', papel: 'caixa', senha: 'joana123' });
    assert.strictEqual(cadastro.status, 200);
    assert.strictEqual((await dona('POST', '/api/equipe', { nome: 'Outra', email: 'JOANA@exemplo.com', papel: 'caixa', senha: 'joana123' })).status, 409);
    const eu = equipe.pessoas.find(p => p.eu);
    assert.strictEqual((await dona('PATCH', `/api/equipe/${eu.id}`, { ativo: false })).status, 400);

    // Pedido vindo de outro site não altera nada, mesmo com o cookie da sessão.
    const forasteiro = await fetch(srv.base + '/api/acao/abrir-caixa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://site-malicioso.example', Cookie: dona.cookie() },
      body: '{}'
    });
    assert.strictEqual(forasteiro.status, 403);

    // Fim da demonstração: dados zerados, acesso novo, demos desligados.
    const real = await dona('POST', '/api/operacao-real', {
      parque: { nome: 'Food Park da Orla', cidade: 'Fortaleza', boxes: 10, taxa: 12 },
      dono: { nome: 'Carla Mendes', email: 'carla@orla.com.br', senha: 'orla2026' }
    });
    assert.strictEqual(real.status, 200, JSON.stringify(real.corpo));
    const vazio = (await dona('GET', '/api/visao')).corpo;
    assert.strictEqual(vazio.parque.nome, 'Food Park da Orla');
    assert.strictEqual(vazio.parque.modo, 'real');
    assert.strictEqual(vazio.boxes.length, 0);
    assert.strictEqual(vazio.painel.passos.length, 4);
    assert.strictEqual((await caixa('GET', '/api/visao')).status, 401, 'acesso de demonstração desligado');
    assert.strictEqual((await anonimo('GET', '/api/publico')).corpo.demo, null);
    assert.strictEqual((await dona('POST', '/api/acao/novo-lojista', { box: 3, nome: 'Tapioca da Vó', aluguel: 1500 })).status, 200);
    assert.strictEqual((await dona('POST', '/api/acao/carregar-demo', {})).status, 400, 'demonstração não apaga operação real');
  } finally {
    await srv.fechar();
  }
}

test('API em memória', () => roteiro(criarRepoMemoria()));

test('API no Postgres', { skip: !process.env.TEST_DATABASE_URL && 'defina TEST_DATABASE_URL para rodar' }, async () => {
  const repo = criarRepoPg({ url: process.env.TEST_DATABASE_URL });
  await repo.iniciar();
  await repo.saudavel();
  // Banco de teste começa limpo a cada execução.
  const { Client } = require('pg');
  const c = new Client({ connectionString: process.env.TEST_DATABASE_URL });
  await c.connect();
  await c.query('truncate historico, sessoes, usuarios, parques restart identity cascade');
  await c.end();
  try {
    await roteiro(repo);
  } finally {
    await repo.fechar();
  }
});
