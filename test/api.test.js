'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { conectar } = require('../server/persistencia/banco');
const { criarApp } = require('../server/app');
const { lerConfig } = require('../server/config');
const { semearDemo } = require('../server/demo');
const D = require('../server/dominio/datas');

const URL_TESTE = process.env.TEST_DATABASE_URL;

/*
 * Roteiro completo contra um Postgres de teste: banco zerado, as duas migrações,
 * a demonstração e o uso de cada perfil. O relógio é controlado pelo teste.
 */
test('API do complexo no Postgres', { skip: !URL_TESTE && 'defina TEST_DATABASE_URL para rodar' }, async () => {
  const banco = conectar({ url: URL_TESTE });
  await banco.query('drop schema public cascade; create schema public;');
  await banco.migrar();

  let relogio = '2026-10-28T15:20:00';
  const agora = () => relogio;
  const cfg = lerConfig({ SEED_DEMO: 'true', SENHA_DEMO: 'demo1234', NOME_DEMO: 'Pepama' });
  await semearDemo(banco, cfg, agora);
  const { app } = criarApp({ cfg, banco, agora });
  const servidor = app.listen(0);
  await new Promise(r => servidor.once('listening', r));
  const base = `http://127.0.0.1:${servidor.address().port}`;

  function cliente() {
    let cookie = '';
    async function chamar(metodo, caminho, corpo, extra = {}) {
      const res = await fetch(base + caminho, {
        method: metodo,
        headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...extra.headers },
        body: extra.bruto !== undefined ? extra.bruto : corpo === undefined ? undefined : JSON.stringify(corpo)
      });
      const set = res.headers.get('set-cookie');
      if (set) cookie = set.split(';')[0];
      const tipo = res.headers.get('content-type') || '';
      return { status: res.status, corpo: tipo.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer()).toString('utf8'), tipo };
    }
    chamar.cookie = () => cookie;
    return chamar;
  }
  const acao = (c, nome, dados) => c('POST', `/api/acao/${nome}`, dados);

  try {
    const anon = cliente();
    const pub = (await anon('GET', '/api/publico')).corpo;
    assert.strictEqual(pub.nomeParque, 'Pepama');
    assert.deepStrictEqual(pub.demo.perfis.map(p => p.papel), ['dono', 'recepcao', 'monitor']);
    assert.strictEqual((await anon('GET', '/api/tela/painel')).status, 401);

    const dona = cliente();
    const recepcao = cliente();
    const monitor = cliente();
    assert.strictEqual((await dona('POST', '/api/entrar', { email: 'proprietaria@foodpark.demo', senha: 'demo1234' })).status, 200);
    assert.strictEqual((await recepcao('POST', '/api/entrar', { email: 'caixa@foodpark.demo', senha: 'demo1234' })).corpo.usuario.inicio, 'pdv');
    assert.strictEqual((await monitor('POST', '/api/entrar', { email: 'monitor@foodpark.demo', senha: 'demo1234' })).corpo.usuario.inicio, 'parque');

    // Cada perfil só vê o que é dele.
    assert.strictEqual((await monitor('GET', '/api/tela/pdv')).status, 403);
    assert.strictEqual((await recepcao('GET', '/api/tela/financeiro')).status, 403);
    assert.strictEqual((await recepcao('GET', '/api/tela/boxes')).status, 403);
    assert.strictEqual((await acao(recepcao, 'nova-conta', { sentido: 'pagar', descricao: 'x', valor: 10, vencimento: '2026-10-30' })).status, 403);

    // Painel executivo.
    const painel = (await dona('GET', '/api/tela/painel')).corpo;
    assert.ok(painel.hoje.total > 0, 'demonstração tem movimento hoje');
    assert.ok(painel.parque.dentro > 0, 'há crianças no parque agora');
    assert.ok(painel.inadimplencia.total > 0, 'há locatário inadimplente');
    assert.strictEqual(painel.serie.length, 14);
    assert.ok(painel.alertas.some(a => /aluguel vencido/.test(a.titulo)));

    // PDV: venda com estoque, depois cancelamento devolve o estoque.
    const pdv = (await recepcao('GET', '/api/tela/pdv')).corpo;
    assert.ok(pdv.caixa, 'caixa aberto na demonstração');
    const raquete = pdv.produtos.find(p => p.nome.includes('Raquete') && p.controlaEstoque);
    const dayUse = pdv.produtos.find(p => p.tipo === 'ingresso');
    const venda = await acao(recepcao, 'vender', { itens: [{ produtoId: raquete.id, qtd: 1 }, { produtoId: dayUse.id, qtd: 2 }], desconto: '10,00', forma: 'credito' });
    assert.strictEqual(venda.status, 200, JSON.stringify(venda.corpo));
    let loja = (await dona('GET', '/api/tela/loja')).corpo;
    assert.strictEqual(loja.produtos.find(p => p.id === raquete.id).estoque, raquete.estoque - 1);
    assert.strictEqual((await acao(recepcao, 'vender', { itens: [{ produtoId: raquete.id, qtd: 999 }], forma: 'pix' })).corpo.erro, `Só há ${raquete.estoque - 1} de ${raquete.nome} em estoque.`);
    assert.strictEqual((await acao(recepcao, 'cancelar-venda', { vendaId: venda.corpo.resultado.vendaId, motivo: 'Cliente desistiu' })).status, 200);
    loja = (await dona('GET', '/api/tela/loja')).corpo;
    assert.strictEqual(loja.produtos.find(p => p.id === raquete.id).estoque, raquete.estoque);

    // Parque: pulseira de 1 hora, saída 80 minutos depois cobra 2 blocos de 15 min.
    const parque = (await monitor('GET', '/api/tela/parque')).corpo;
    assert.strictEqual(parque.resumo.receita, null, 'monitor não vê valores do dia');
    const entrada = await acao(monitor, 'entrada-parque', { crianca: 'Ana Teste', idade: 6, responsavel: 'Paula Teste', telefone: '(85) 99999-0000', planoId: 'p60', forma: 'pix', observacoes: 'Alergia a leite' });
    assert.strictEqual(entrada.status, 200, JSON.stringify(entrada.corpo));
    relogio = '2026-10-28T16:40:00';
    const saida = await acao(monitor, 'saida-parque', { entradaId: entrada.corpo.resultado.entradaId, forma: 'pix' });
    assert.strictEqual(saida.status, 200, JSON.stringify(saida.corpo));
    assert.strictEqual(saida.corpo.resultado.cobrado, 10);
    assert.strictEqual((await acao(monitor, 'saida-parque', { entradaId: entrada.corpo.resultado.entradaId })).status, 400);

    // Quadras: grupo fixo de 3 semanas e conflito de horário.
    let terca = D.somarDias(D.diaDe(relogio), 1);
    while (D.diaDaSemana(terca) !== 2) terca = D.somarDias(terca, 1);
    const quadras = (await recepcao('GET', `/api/tela/quadras?data=${terca}`)).corpo;
    const q4 = quadras.quadras[3];
    const reserva = await acao(recepcao, 'nova-reserva', { quadraId: q4.id, data: terca, inicio: '08:00', duracao: 90, cliente: 'Time do Teste', semanas: 3, pagarAgora: true, forma: 'pix' });
    assert.strictEqual(reserva.status, 200, JSON.stringify(reserva.corpo));
    assert.strictEqual(reserva.corpo.resultado.quantidade, 3);
    const choque = await acao(recepcao, 'nova-reserva', { quadraId: q4.id, data: D.somarDias(terca, 7), inicio: '08:30', duracao: 60, cliente: 'Outro' });
    assert.strictEqual(choque.status, 400);
    assert.match(choque.corpo.erro, /já está reservada/);
    const doDia = (await recepcao('GET', `/api/tela/quadras?data=${terca}`)).corpo.reservas.find(x => x.cliente === 'Time do Teste');
    assert.strictEqual(doDia.status, 'paga');
    assert.strictEqual(doDia.valor, 270, '1h30 a R$ 180/h');

    // Locações: novo contrato no box livre gera o aluguel do mês; recebimento com multa.
    let boxes = (await dona('GET', '/api/tela/boxes')).corpo;
    const livre = boxes.mapa.find(u => !u.contrato);
    assert.ok(boxes.inadimplentes.length >= 1);
    const contrato = await acao(dona, 'novo-contrato', { unidadeId: livre.id, locatario: 'Tapiocaria Teste', valor: '2.500,00', diaVencimento: 10, inicio: '2026-10-01', fim: '2027-09-30', caucao: '5000' });
    assert.strictEqual(contrato.status, 200, JSON.stringify(contrato.corpo));
    boxes = (await dona('GET', '/api/tela/boxes')).corpo;
    const novo = boxes.contratos.find(c => c.locatario === 'Tapiocaria Teste');
    assert.strictEqual(novo.caucaoStatus, 'pendente');
    assert.strictEqual(novo.vencido, 2500, 'aluguel de outubro venceu dia 10');
    const cob = novo.historico[0];
    assert.strictEqual((await acao(dona, 'receber-cobranca', { cobrancaId: cob.id, forma: 'transferencia', acrescimo: '50' })).status, 200);
    assert.strictEqual((await acao(dona, 'caucao', { contratoId: novo.id, operacao: 'receber', forma: 'pix' })).status, 200);

    // Anexo do contrato: envio, leitura e remoção.
    const pdf = Buffer.from('%PDF-1.4\n%teste\n');
    const envio = await dona('POST', `/api/anexos?tipo=contrato&id=${novo.id}`, undefined, { bruto: pdf, headers: { 'Content-Type': 'application/pdf', 'X-Arquivo-Nome': encodeURIComponent('Contrato assinado.pdf') } });
    assert.strictEqual(envio.status, 200, JSON.stringify(envio.corpo) + " " + envio.tipo);
    const baixado = await dona('GET', `/api/anexos/${envio.corpo.anexo.id}`);
    assert.strictEqual(baixado.status, 200);
    assert.ok(baixado.tipo.startsWith('application/pdf'));
    assert.strictEqual((await recepcao('GET', `/api/anexos/${envio.corpo.anexo.id}`)).status, 403);
    assert.strictEqual((await dona('POST', `/api/anexos?tipo=contrato&id=${novo.id}`, undefined, { bruto: 'x', headers: { 'Content-Type': 'text/html', 'X-Arquivo-Nome': 'a.html' } })).status, 415);
    assert.strictEqual((await dona('DELETE', `/api/anexos/${envio.corpo.anexo.id}`)).status, 200);

    // Eventos: o primeiro pagamento confirma; não aceita pagar mais que o saldo.
    const evento = await acao(dona, 'novo-evento', { titulo: 'Aniversário do Pedro', tipo: 'aniversario', contratante: 'Família Teste', data: '2026-11-20', valor: '3.000,00', sinal: '1.000,00' });
    assert.strictEqual(evento.status, 200, JSON.stringify(evento.corpo));
    assert.strictEqual((await acao(dona, 'pagamento-evento', { eventoId: evento.corpo.resultado.eventoId, valor: 1000, forma: 'pix' })).status, 200);
    assert.strictEqual((await acao(dona, 'pagamento-evento', { eventoId: evento.corpo.resultado.eventoId, valor: 5000, forma: 'pix' })).status, 400);
    const ev = (await dona('GET', '/api/tela/eventos')).corpo.eventos.find(e => e.titulo === 'Aniversário do Pedro');
    assert.strictEqual(ev.status, 'confirmado');
    assert.strictEqual(ev.saldo, 2000);

    // Financeiro: despesa já paga aparece como saída.
    assert.strictEqual((await acao(dona, 'nova-conta', { sentido: 'pagar', categoria: 'manutencao', descricao: 'Troca de rede da quadra 2', valor: '850', vencimento: D.diaDe(relogio), jaPaga: true, forma: 'pix' })).status, 200);
    const fin = (await dona('GET', '/api/tela/financeiro')).corpo;
    assert.ok(fin.movimentos.some(m => m.descricao === 'Troca de rede da quadra 2' && m.sentido === 'saida'));
    assert.ok(fin.totais.entradas > 0 && fin.totais.saidas > 0);

    // Fechamento do caixa com R$ 10 a menos no dinheiro.
    const sessao = (await recepcao('GET', '/api/tela/pdv')).corpo.caixa;
    const contado = Object.assign({}, sessao.esperado, { dinheiro: sessao.esperado.dinheiro - 10 });
    const fecha = await acao(recepcao, 'fechar-caixa', { contado });
    assert.strictEqual(fecha.status, 200, JSON.stringify(fecha.corpo));
    assert.strictEqual(fecha.corpo.resultado.diferenca, -10);
    assert.match((await acao(recepcao, 'vender', { itens: [{ produtoId: dayUse.id, qtd: 1 }], forma: 'pix' })).corpo.erro, /Abra o caixa/);

    // Contabilidade: o livro fecha e as exportações saem.
    const cont = (await dona('GET', '/api/tela/contabilidade')).corpo;
    assert.strictEqual(cont.equilibrado, true);
    assert.strictEqual(cont.totais.debitos, cont.totais.creditos);
    assert.ok(cont.dre.porArea.find(a => a.area === 'parque').valor > 0);
    for (const arq of ['lancamentos', 'dre', 'extrato', 'alugueis']) {
      const csv = await dona('GET', `/api/exportar/${arq}?mes=2026-10`);
      assert.strictEqual(csv.status, 200, arq);
      assert.ok(csv.corpo.split('\n').length > 2, arq);
    }
    const rel = (await dona('GET', '/api/tela/relatorios?meses=3')).corpo;
    assert.strictEqual(rel.porMes.length, 3);
    assert.ok(rel.quadras.length === 4);

    // Histórico guarda quem fez.
    const equipe = (await dona('GET', '/api/equipe')).corpo;
    assert.ok(equipe.atividade.some(a => a.usuarioNome === 'Bianca Lima' && /saída de Ana Teste/.test(a.resumo)));
    assert.ok(equipe.atividade.some(a => a.usuarioNome === 'Rafael Souza' && /Cancelou a venda/.test(a.resumo)));

    // Outro site não altera nada, mesmo com o cookie.
    const forasteiro = await fetch(base + '/api/acao/abrir-caixa', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://malicioso.example', Cookie: recepcao.cookie() }, body: '{}' });
    assert.strictEqual(forasteiro.status, 403);

    // Fim da demonstração: tudo zerado, acesso novo, demos desligados.
    const real = await dona('POST', '/api/operacao-real', { parque: { nome: 'Pepama Park', cidade: 'Fortaleza, CE' }, dono: { nome: 'Carla Mendes', email: 'carla@pepama.com.br', senha: 'pepama2026' } });
    assert.strictEqual(real.status, 200, JSON.stringify(real.corpo));
    const vazio = (await dona('GET', '/api/tela/painel')).corpo;
    assert.strictEqual(vazio.hoje.total, 0);
    assert.strictEqual(vazio.boxes.total, 0);
    assert.strictEqual((await monitor('GET', '/api/tela/parque')).status, 401, 'acesso de demonstração desligado');
    assert.strictEqual((await anon('GET', '/api/publico')).corpo.demo, null);
    assert.strictEqual((await acao(dona, 'salvar-quadra', { nome: 'Quadra Central', modalidade: 'Beach tennis', precoHora: '120' })).status, 200);
  } finally {
    await new Promise(r => servidor.close(r));
    await banco.fechar();
  }
});
