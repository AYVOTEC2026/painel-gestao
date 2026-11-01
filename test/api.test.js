'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { conectar } = require('../server/persistencia/banco');
const { criarApp } = require('../server/app');
const { lerConfig } = require('../server/config');
const { semearDemo, VERSAO_DEMO } = require('../server/demo');
const D = require('../server/dominio/datas');
const { lerZip } = require('./ler-zip');

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
      const bruto = tipo.includes('json') ? null : Buffer.from(await res.arrayBuffer());
      return { status: res.status, corpo: bruto ? (extra.binario ? bruto : bruto.toString('utf8')) : await res.json(), tipo, cabecalhos: res.headers };
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

    // Demonstração feita por um gerador mais antigo se refaz sozinha na próxima tela, sem tirar ninguém do sistema.
    await banco.query('update parques set demo_versao = 0');
    assert.strictEqual((await dona('GET', '/api/tela/painel')).status, 200);
    assert.strictEqual((await banco.query('select demo_versao from parques')).rows[0].demo_versao, VERSAO_DEMO);

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
    const raquete = pdv.produtos.find(p => p.tipo === 'loja' && p.nome.includes('Raquete') && p.controlaEstoque);
    const dayUse = pdv.produtos.find(p => p.tipo === 'ingresso');
    const venda = await acao(recepcao, 'vender', { itens: [{ produtoId: raquete.id, qtd: 1 }, { produtoId: dayUse.id, qtd: 2 }], desconto: '10,00', forma: 'credito' });
    assert.strictEqual(venda.status, 200, JSON.stringify(venda.corpo));
    let loja = (await dona('GET', '/api/tela/loja')).corpo;
    assert.strictEqual(loja.produtos.find(p => p.id === raquete.id).estoque, raquete.estoque - 1);
    assert.strictEqual((await acao(recepcao, 'vender', { itens: [{ produtoId: raquete.id, qtd: 999 }], forma: 'pix' })).corpo.erro, `Só há ${raquete.estoque - 1} de ${raquete.nome} em estoque.`);
    assert.strictEqual((await acao(recepcao, 'cancelar-venda', { vendaId: venda.corpo.resultado.vendaId, motivo: 'Cliente desistiu' })).status, 200);
    loja = (await dona('GET', '/api/tela/loja')).corpo;
    assert.strictEqual(loja.produtos.find(p => p.id === raquete.id).estoque, raquete.estoque);

    // Aluguel de equipamentos: o cadastro diz se o item é vendido ou alugado.
    assert.strictEqual((await acao(dona, 'salvar-produto', { tipo: 'aluguel', nome: 'Raquete teste para alugar', preco: '20', unidades: 3 })).status, 400, 'aluguel diz como cobra');
    const itemNovo = await acao(dona, 'salvar-produto', { tipo: 'aluguel', nome: 'Raquete teste para alugar', categoria: 'Raquetes', preco: '20', periodo: 'hora', unidades: 3 });
    assert.strictEqual(itemNovo.status, 200, JSON.stringify(itemNovo.corpo));
    const itemId = itemNovo.corpo.resultado.produtoId;
    const alugar = extra => acao(recepcao, 'vender', { itens: [{ produtoId: itemId, qtd: 2, periodos: 2 }], forma: 'pix', ...extra });
    assert.match((await alugar({})).corpo.erro, /nome de quem leva/);
    const aluguel = await alugar({ cliente: 'Leandro Teste', telefone: '(85) 98888-0000' });
    assert.strictEqual(aluguel.status, 200, JSON.stringify(aluguel.corpo));
    const doItem = async () => (await recepcao('GET', '/api/tela/pdv')).corpo;
    let pdvAluguel = await doItem();
    assert.strictEqual(pdvAluguel.produtos.find(p => p.id === itemId).estoque, 1, 'duas das três unidades com o cliente');
    const fora = pdvAluguel.alugados.find(a => a.produtoId === itemId);
    assert.deepStrictEqual([fora.qtd, fora.cliente, fora.devolverAte, fora.atrasado], [2, 'Leandro Teste', '2026-10-28T17:20:00', false]);
    assert.match((await alugar({ cliente: 'Outra pessoa' })).corpo.erro, /Só há 1 de Raquete teste para alugar livre/);
    const vendaAluguel = (await dona('GET', '/api/tela/loja')).corpo.vendas.find(v => v.numero === String(aluguel.corpo.resultado.numero).padStart(4, '0'));
    assert.strictEqual(vendaAluguel.total, 80, '2 raquetes por 2 horas a R$ 20');
    assert.strictEqual((await acao(recepcao, 'devolver-item', { itemId: fora.id })).status, 200);
    assert.strictEqual((await acao(recepcao, 'devolver-item', { itemId: fora.id })).status, 400, 'não devolve duas vezes');
    assert.strictEqual((await doItem()).produtos.find(p => p.id === itemId).estoque, 3);
    assert.strictEqual((await acao(recepcao, 'cancelar-venda', { vendaId: aluguel.corpo.resultado.vendaId, motivo: 'Teste de estorno' })).status, 200);
    assert.strictEqual((await doItem()).produtos.find(p => p.id === itemId).estoque, 3, 'cancelar depois da devolução não conta a unidade duas vezes');
    const segundo = await alugar({ cliente: 'Marina Teste' });
    assert.strictEqual(segundo.status, 200, JSON.stringify(segundo.corpo));
    assert.strictEqual((await acao(dona, 'salvar-produto', { produtoId: itemId, tipo: 'loja', nome: 'Raquete teste para alugar', preco: '20' })).status, 400, 'item com cliente não vira venda');
    assert.strictEqual((await acao(dona, 'salvar-produto', { produtoId: itemId, tipo: 'aluguel', nome: 'Raquete teste para alugar', preco: '20', periodo: 'hora', unidades: 1 })).status, 400, 'total não fica menor que o que está fora');
    assert.strictEqual((await acao(dona, 'salvar-produto', { produtoId: itemId, tipo: 'aluguel', nome: 'Raquete teste para alugar', preco: '20', periodo: 'hora', unidades: 5 })).status, 200);
    assert.strictEqual((await doItem()).produtos.find(p => p.id === itemId).estoque, 3, '5 unidades, 2 com cliente');
    assert.match((await acao(dona, 'excluir-produto', { produtoId: itemId })).corpo.erro, /Receba a devolução antes de excluir/);

    // Excluir produto: some da loja e do PDV, e o caixa não vende mais.
    const chaveiro = (await acao(dona, 'salvar-produto', { tipo: 'loja', nome: 'Chaveiro teste', preco: '15' })).corpo.resultado.produtoId;
    assert.strictEqual((await acao(recepcao, 'excluir-produto', { produtoId: chaveiro })).status, 403);
    assert.strictEqual((await acao(dona, 'excluir-produto', { produtoId: chaveiro })).status, 200);
    assert.ok(!(await dona('GET', '/api/tela/loja')).corpo.produtos.some(p => p.id === chaveiro), 'sai da loja');
    assert.ok(!(await doItem()).produtos.some(p => p.id === chaveiro), 'sai do PDV');
    assert.strictEqual((await acao(recepcao, 'vender', { itens: [{ produtoId: chaveiro, qtd: 1 }], forma: 'pix' })).status, 400);
    assert.strictEqual((await acao(dona, 'excluir-produto', { produtoId: chaveiro })).status, 400, 'não exclui duas vezes');

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

    // A raquete da Marina devia voltar às 17:20: às 17:30 o PDV e o painel avisam.
    relogio = '2026-10-28T17:30:00';
    const atrasada = (await doItem()).alugados.find(a => a.cliente === 'Marina Teste');
    assert.strictEqual(atrasada.atrasado, true);
    assert.ok((await dona('GET', '/api/tela/painel')).corpo.alertas.some(a => /passou da hora de voltar|passaram da hora de voltar/.test(a.titulo) && /Marina Teste/.test(a.texto)));
    assert.strictEqual((await acao(recepcao, 'devolver-item', { itemId: atrasada.id })).status, 200);

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

    // Perfil Eventos: só a tela de eventos e os arquivos dos eventos, sem o dinheiro da empresa.
    const cadastro = await dona('POST', '/api/equipe', { nome: 'Júlia Festas', email: 'julia@pepama.demo', senha: 'festas2026', papel: 'eventos' });
    assert.strictEqual(cadastro.status, 200, JSON.stringify(cadastro.corpo));
    const festas = cliente();
    const julia = (await festas('POST', '/api/entrar', { email: 'julia@pepama.demo', senha: 'festas2026' })).corpo.usuario;
    assert.deepStrictEqual(julia.telas, ['eventos', 'ajuda']);
    assert.strictEqual(julia.inicio, 'eventos');
    for (const tela of ['painel', 'financeiro', 'contabilidade', 'relatorios', 'boxes', 'loja', 'pdv', 'parque', 'quadras', 'admin']) {
      assert.strictEqual((await festas('GET', `/api/tela/${tela}`)).status, 403, `eventos não abre ${tela}`);
    }
    assert.strictEqual((await festas('GET', '/api/equipe')).status, 403);
    assert.strictEqual((await festas('GET', '/api/exportar-pacote?mes=2026-10')).status, 403);
    assert.strictEqual((await acao(festas, 'nova-conta', { sentido: 'pagar', descricao: 'x', valor: 10, vencimento: '2026-10-30' })).status, 403);
    assert.strictEqual((await acao(festas, 'abrir-caixa', { fundo: '100' })).status, 403);
    const festa = await acao(festas, 'novo-evento', { titulo: 'Festa da Júlia', tipo: 'aniversario', contratante: 'Família Festa', data: '2026-12-05', valor: '2.000,00', sinal: '500,00' });
    assert.strictEqual(festa.status, 200, JSON.stringify(festa.corpo));
    const festaId = festa.corpo.resultado.eventoId;
    assert.strictEqual((await acao(festas, 'pagamento-evento', { eventoId: festaId, valor: 500, forma: 'pix' })).status, 200);
    assert.strictEqual((await festas('GET', '/api/tela/eventos')).corpo.eventos.find(e => e.id === festaId).saldo, 1500);
    const contratoFesta = await festas('POST', `/api/anexos?tipo=evento&id=${festaId}`, undefined, { bruto: pdf, headers: { 'Content-Type': 'application/pdf', 'X-Arquivo-Nome': 'Contrato da festa.pdf' } });
    assert.strictEqual(contratoFesta.status, 200, JSON.stringify(contratoFesta.corpo));
    assert.strictEqual((await festas('GET', `/api/anexos/${contratoFesta.corpo.anexo.id}`)).status, 200);
    assert.strictEqual((await festas('POST', `/api/anexos?tipo=contrato&id=${novo.id}`, undefined, { bruto: pdf, headers: { 'Content-Type': 'application/pdf', 'X-Arquivo-Nome': 'a.pdf' } })).status, 403);
    const doBox = await dona('POST', `/api/anexos?tipo=contrato&id=${novo.id}`, undefined, { bruto: pdf, headers: { 'Content-Type': 'application/pdf', 'X-Arquivo-Nome': 'Contrato do box.pdf' } });
    assert.strictEqual((await festas('GET', `/api/anexos/${doBox.corpo.anexo.id}`)).status, 404, 'não abre contrato de box');
    assert.strictEqual((await festas('DELETE', `/api/anexos/${doBox.corpo.anexo.id}`)).status, 404, 'não apaga contrato de box');
    assert.strictEqual((await dona('GET', `/api/anexos/${doBox.corpo.anexo.id}`)).status, 200, 'o contrato de box continua lá');
    assert.strictEqual((await festas('DELETE', `/api/anexos/${contratoFesta.corpo.anexo.id}`)).status, 200);

    // Excluir login: a pessoa sai na hora e não entra mais; o histórico guarda o nome.
    const pessoas = (await dona('GET', '/api/equipe')).corpo.pessoas;
    const eu = pessoas.find(p => p.eu);
    const idJulia = pessoas.find(p => p.email === 'julia@pepama.demo').id;
    assert.strictEqual((await festas('DELETE', `/api/equipe/${idJulia}`)).status, 403);
    assert.strictEqual((await dona('DELETE', `/api/equipe/${eu.id}`)).status, 400, 'não exclui o próprio acesso');
    assert.strictEqual((await dona('DELETE', `/api/equipe/${idJulia}`)).status, 200);
    assert.strictEqual((await festas('GET', '/api/tela/eventos')).status, 401, 'sai dos aparelhos');
    assert.strictEqual((await cliente()('POST', '/api/entrar', { email: 'julia@pepama.demo', senha: 'festas2026' })).status, 400, 'não entra mais');
    const depois = (await dona('GET', '/api/equipe')).corpo;
    assert.ok(!depois.pessoas.some(p => p.id === idJulia));
    assert.ok(depois.atividade.some(a => /Excluiu o acesso de Júlia Festas/.test(a.resumo)));
    assert.ok(depois.atividade.some(a => a.usuarioNome === 'Júlia Festas'), 'o que ela fez continua no histórico');

    // Financeiro: despesa já paga aparece como saída.
    assert.strictEqual((await acao(dona, 'nova-conta', { sentido: 'pagar', categoria: 'manutencao', descricao: 'Troca de rede da quadra 2', valor: '850', vencimento: D.diaDe(relogio), jaPaga: true, forma: 'pix' })).status, 200);
    const fin = (await dona('GET', '/api/tela/financeiro')).corpo;
    assert.ok(fin.movimentos.some(m => m.descricao === 'Troca de rede da quadra 2' && m.sentido === 'saida'));
    assert.ok(fin.totais.entradas > 0 && fin.totais.saidas > 0);

    // Notas fiscais: a demonstração deixa duas despesas sem nota e o painel cobra.
    assert.ok(painel.alertas.some(a => /despesas? sem nota fiscal/.test(a.titulo) && a.rota === 'financeiro/notas?mes=2026-09'), 'nota faltando do mês passado');
    const compra = await acao(dona, 'nova-conta', { sentido: 'pagar', categoria: 'compras', descricao: 'Raquetes para a loja', pessoa: 'Beach Pro', pessoaDocumento: '12.345.678/0001-95', documentoTipo: 'nota_fiscal', documentoNumero: '4821', valor: '3240', vencimento: D.diaDe(relogio) });
    assert.strictEqual(compra.status, 200, JSON.stringify(compra.corpo));
    const contaId = compra.corpo.resultado.contaId;
    const semNota = (await dona('GET', '/api/tela/financeiro')).corpo;
    assert.strictEqual(semNota.despesas.find(c => c.id === contaId).documentacao, 'pendente');
    const anexar = (nome, mime, bruto) => dona('POST', `/api/anexos?tipo=conta&id=${contaId}`, undefined, { bruto, headers: { 'Content-Type': mime, 'X-Arquivo-Nome': encodeURIComponent(nome) } });
    assert.strictEqual((await anexar('DANFE 4821.pdf', 'application/pdf', Buffer.from('%PDF-1.4\n%danfe\n'))).status, 200);
    const xmlNota = await anexar('NFe 4821.xml', 'application/xml', '<?xml version="1.0"?><nfeProc><NFe><infNFe Id="NFe1"><ide><nNF>4821</nNF></ide></infNFe></NFe></nfeProc>');
    assert.strictEqual(xmlNota.status, 200, JSON.stringify(xmlNota.corpo));
    assert.strictEqual((await anexar('nota.xml', 'application/xml', 'MZ não é XML')).status, 400, 'XML falso é recusado');
    assert.strictEqual((await recepcao('POST', `/api/anexos?tipo=conta&id=${contaId}`, undefined, { bruto: 'x', headers: { 'Content-Type': 'application/pdf', 'X-Arquivo-Nome': 'a.pdf' } })).status, 403);
    const xmlBaixado = await dona('GET', `/api/anexos/${xmlNota.corpo.anexo.id}`);
    assert.match(xmlBaixado.cabecalhos.get('content-disposition'), /^attachment/, 'XML sempre baixa, nunca abre como página');
    assert.match(xmlBaixado.cabecalhos.get('content-security-policy'), /sandbox/);
    const comNota = (await dona('GET', '/api/tela/financeiro')).corpo;
    assert.strictEqual(comNota.despesas.find(c => c.id === contaId).documentacao, 'completa');
    assert.strictEqual(comNota.despesas.find(c => c.id === contaId).anexos.length, 2);
    assert.strictEqual(comNota.notas.pendentes, semNota.notas.pendentes - 1);

    // Sem documento só com o motivo, que vai para o contador.
    const portao = (await acao(dona, 'nova-conta', { sentido: 'pagar', categoria: 'manutencao', descricao: 'Conserto do portão', pessoa: 'Seu Zé', valor: '150', vencimento: D.diaDe(relogio) })).corpo.resultado.contaId;
    assert.strictEqual((await acao(dona, 'dados-fiscais', { contaId: portao, documentoTipo: 'sem_documento' })).status, 400);
    assert.strictEqual((await acao(dona, 'dados-fiscais', { contaId: portao, documentoTipo: 'sem_documento', justificativa: 'Autônomo sem recibo' })).status, 200);
    assert.strictEqual((await dona('GET', '/api/tela/financeiro')).corpo.despesas.find(c => c.id === portao).documentacao, 'sem_documento');

    // Pacote do contador: ZIP válido, com resumo, planilha, relatórios e as notas com nome organizado.
    const pacote = await dona('GET', '/api/exportar-pacote?mes=2026-10&completo=1', undefined, { binario: true });
    assert.strictEqual(pacote.status, 200);
    assert.strictEqual(pacote.tipo, 'application/zip');
    assert.match(pacote.cabecalhos.get('content-disposition'), /contador-pepama-2026-10-completo\.zip/);
    const zip = lerZip(pacote.corpo);
    const nomes = [...zip.keys()];
    const pasta = 'contador Pepama 2026-10/';
    assert.ok(nomes.every(n => n.startsWith(pasta)), 'tudo dentro de uma pasta só');
    for (const n of ['LEIA-ME.html', 'despesas-2026-10.csv', 'relatorios/livro-contabil-2026-10.csv', 'relatorios/resultado-dre-2026-10.csv']) assert.ok(zip.has(pasta + n), n);
    const notasNoZip = nomes.filter(n => n.includes('/notas/') && n.includes('Beach Pro - NF 4821'));
    assert.deepStrictEqual(notasNoZip.map(n => n.split('.').pop()).sort(), ['pdf', 'xml']);
    const linhaCsv = zip.get(pasta + 'despesas-2026-10.csv').dados.toString('utf8').split('\r\n').find(l => l.includes('Raquetes para a loja'));
    assert.match(linhaCsv, /12\.345\.678\/0001-95;Raquetes para a loja;Compras de mercadoria;Nota fiscal \(NF-e ou NFS-e\);4821;3240,00/);
    const leiaMe = zip.get(pasta + 'LEIA-ME.html').dados.toString('utf8');
    assert.match(leiaMe, /Autônomo sem recibo/);
    assert.match(leiaMe, /href="notas\/[^"]*Beach%20Pro%20-%20NF%204821\.pdf"/, 'link relativo para abrir a nota');
    const soDespesas = lerZip((await dona('GET', '/api/exportar-pacote?mes=2026-10', undefined, { binario: true })).corpo);
    assert.ok(![...soDespesas.keys()].some(n => n.includes('/relatorios/')), 'pacote só de despesas não leva relatórios');
    assert.strictEqual((await recepcao('GET', '/api/exportar-pacote?mes=2026-10')).status, 403);

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
    assert.ok(cont.dre.porArea.find(a => a.area === 'equipamentos').valor > 0, 'aluguel de equipamentos tem receita própria');
    for (const arq of ['lancamentos', 'dre', 'extrato', 'alugueis']) {
      const csv = await dona('GET', `/api/exportar/${arq}?mes=2026-10`);
      assert.strictEqual(csv.status, 200, arq);
      assert.ok(csv.corpo.split('\n').length > 2, arq);
    }
    const rel = (await dona('GET', '/api/tela/relatorios?meses=3')).corpo;
    assert.strictEqual(rel.porMes.length, 3);
    assert.ok(rel.quadras.length === 4);

    // Mensagens do WhatsApp: a gestão edita o texto, o sistema confere as variáveis.
    assert.match((await recepcao('GET', '/api/sessao')).corpo.parque.mensagens.quadra_reserva, /\{quadra\}/);
    assert.strictEqual((await acao(recepcao, 'salvar-mensagem', { id: 'quadra_reserva', texto: 'Oi {nome}' })).status, 403);
    assert.match((await acao(dona, 'salvar-mensagem', { id: 'quadra_reserva', texto: 'Oi {nmoe}, sua quadra é a {quadra}.' })).corpo.erro, /\{nmoe\} não existe/);
    const texto = 'Oi, {nome}! Sua reserva: {quadra}, {data}, das {horario}.';
    assert.strictEqual((await acao(dona, 'salvar-mensagem', { id: 'quadra_reserva', texto })).status, 200);
    assert.strictEqual((await recepcao('GET', '/api/sessao')).corpo.parque.mensagens.quadra_reserva, texto);
    const msgAdmin = (await dona('GET', '/api/tela/admin')).corpo.mensagens.find(m => m.id === 'quadra_reserva');
    assert.deepStrictEqual([msgAdmin.texto, msgAdmin.editada], [texto, true]);
    assert.strictEqual((await acao(dona, 'salvar-mensagem', { id: 'quadra_reserva', padrao: true })).status, 200);
    assert.strictEqual((await recepcao('GET', '/api/sessao')).corpo.parque.mensagens.quadra_reserva, msgAdmin.padrao);
    // A mensagem escrita sobrevive à troca para a operação real (conferido no fim do roteiro).
    assert.strictEqual((await acao(dona, 'salvar-mensagem', { id: 'parque_tempo', texto: 'Oi, {nome}! O tempo de {crianca} acaba às {termina}.' })).status, 200);

    // Histórico guarda quem fez.
    const equipe = (await dona('GET', '/api/equipe')).corpo;
    assert.ok(equipe.atividade.some(a => a.usuarioNome === 'Bianca Lima' && /saída de Ana Teste/.test(a.resumo)));
    assert.ok(equipe.atividade.some(a => a.usuarioNome === 'Rafael Souza' && /Cancelou a venda/.test(a.resumo)));
    assert.ok(equipe.atividade.some(a => /Exportou o pacote completo de 2026-10 para o contador/.test(a.resumo)));

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
    assert.strictEqual((await dona('GET', '/api/sessao')).corpo.parque.mensagens.parque_tempo, 'Oi, {nome}! O tempo de {crianca} acaba às {termina}.');
    assert.strictEqual((await acao(dona, 'salvar-quadra', { nome: 'Quadra Central', modalidade: 'Beach tennis', precoHora: '120' })).status, 200);
  } finally {
    await new Promise(r => servidor.close(r));
    await banco.fechar();
  }
});
