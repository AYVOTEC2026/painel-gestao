'use strict';

const C = require('../dominio/contabil');
const D = require('../dominio/datas');
const R = require('../dominio/regras');
const { TIPOS: TIPOS_EVENTO, STATUS: STATUS_EVENTO } = require('../servicos/eventos');
const { TIPOS_UNIDADE } = require('../servicos/locacoes');
const { NOMES_CATEGORIA, DOCUMENTOS } = require('../servicos/financeiro');
const { despesasDoMes, documentacao } = require('./pacote');
const { r, hhmm, formas, somasDoLivro, dreDoMes, intervaloDoMes } = require('./comum');
const { linhaAlugado } = require('./operacao');
const M = require('../dominio/mensagens');

const mesDoParametro = (params, agora) => (D.mesValido(params.mes) ? params.mes : D.mesDe(agora));

/* ----------------------------------------------------------------- boxes */

async function boxes(db, { parqueId, agora, params }) {
  const hoje = D.diaDe(agora);
  const mes = mesDoParametro(params, agora);
  const unidades = (await db.query('select * from unidades where parque_id = $1 and ativa order by numero', [parqueId])).rows;
  const contratos = (await db.query(
    `select c.*, u.numero, u.tipo as unidade_tipo from contratos c join unidades u on u.id = c.unidade_id
      where c.parque_id = $1 and (c.status = 'ativo' or c.encerrado_em >= $2::date - 365) order by u.numero`,
    [parqueId, hoje]
  )).rows;
  const abertas = (await db.query("select * from cobrancas where parque_id = $1 and status = 'aberta' order by vencimento", [parqueId])).rows;
  const doMes = (await db.query('select * from cobrancas where parque_id = $1 and competencia = $2 order by vencimento', [parqueId, mes])).rows;
  const anexos = (await db.query("select id, dono_id, nome, mime, tamanho, criado_em from anexos where parque_id = $1 and dono_tipo = 'contrato' order by criado_em", [parqueId])).rows;
  const historico = (await db.query(
    "select * from cobrancas where parque_id = $1 and status <> 'cancelada' and competencia >= $2 order by competencia desc, vencimento desc",
    [parqueId, D.somarMeses(D.mesDe(agora), -11)]
  )).rows;

  const porContrato = new Map(contratos.map(c => [c.id, c]));
  const cobranca = b => {
    const c = porContrato.get(b.contrato_id) || {};
    const s = R.situacaoDaCobranca(b, hoje);
    return {
      id: b.id, contratoId: b.contrato_id, box: c.numero, locatario: c.locatario, responsavel: c.responsavel, telefone: c.telefone,
      tipo: b.tipo, descricao: b.descricao, competencia: b.competencia, valor: r(b.valor), vencimento: b.vencimento,
      status: b.status, pagoEm: b.pago_em, valorPago: r(b.valor_pago), forma: b.forma, ...s
    };
  };
  const contrato = c => {
    const minhas = abertas.filter(b => b.contrato_id === c.id).map(cobranca);
    const vencidas = minhas.filter(b => b.situacao === 'vencida');
    return {
      id: c.id, unidadeId: c.unidade_id, box: c.numero, locatario: c.locatario, atividade: c.atividade, documento: c.documento,
      responsavel: c.responsavel, telefone: c.telefone, email: c.email, valor: r(c.valor), diaVencimento: c.dia_vencimento,
      inicio: c.inicio, fim: c.fim, caucao: r(c.caucao), caucaoStatus: c.caucao_status, reajuste: c.reajuste, observacoes: c.observacoes,
      status: c.status, encerradoEm: c.encerrado_em, diasParaFim: c.fim ? D.diasEntre(hoje, c.fim) : null,
      emAberto: r(minhas.reduce((t, b) => t + Math.round(b.valor * 100), 0)),
      vencido: r(vencidas.reduce((t, b) => t + Math.round(b.valor * 100), 0)),
      maiorAtraso: vencidas.reduce((m, b) => Math.max(m, b.dias), 0),
      anexos: anexos.filter(a => a.dono_id === c.id).map(a => ({ id: a.id, nome: a.nome, mime: a.mime, tamanho: a.tamanho, criadoEm: a.criado_em })),
      historico: historico.filter(b => b.contrato_id === c.id).map(cobranca)
    };
  };
  const ativos = contratos.filter(c => c.status === 'ativo').map(contrato);
  const mapa = unidades.map(u => ({
    id: u.id, numero: u.numero, tipo: u.tipo, tipoNome: TIPOS_UNIDADE[u.tipo], area: u.area, observacao: u.observacao,
    contrato: ativos.find(c => c.unidadeId === u.id) || null
  }));
  const inadimplentes = ativos.concat(contratos.filter(c => c.status !== 'ativo').map(contrato)).filter(c => c.vencido > 0)
    .map(c => ({ ...c, cobrancas: abertas.filter(b => b.contrato_id === c.id).map(cobranca).filter(b => b.situacao === 'vencida') }))
    .sort((a, b) => b.maiorAtraso - a.maiorAtraso);
  const cobrancasMes = doMes.concat(abertas.filter(b => b.competencia < mes)).map(cobranca);
  const previsto = doMes.filter(b => b.status !== 'cancelada').reduce((t, b) => t + Number(b.valor), 0);
  const recebido = doMes.filter(b => b.status === 'paga').reduce((t, b) => t + Number(b.valor), 0);
  return {
    agora,
    mes,
    resumo: {
      total: unidades.length,
      ocupados: ativos.length,
      aluguelMensal: r(ativos.reduce((t, c) => t + Math.round(c.valor * 100), 0)),
      previsto: r(previsto),
      recebido: r(recebido),
      emAtraso: r(inadimplentes.reduce((t, c) => t + Math.round(c.vencido * 100), 0)),
      vencendo: ativos.filter(c => c.diasParaFim != null && c.diasParaFim <= 60).length
    },
    mapa,
    contratos: contratos.map(c => (c.status === 'ativo' ? ativos.find(a => a.id === c.id) : contrato(c))),
    cobrancas: cobrancasMes,
    inadimplentes,
    tipos: TIPOS_UNIDADE,
    formas: formas()
  };
}

/* --------------------------------------------------------------- eventos */

async function eventos(db, { parqueId, agora, config }) {
  const hoje = D.diaDe(agora);
  const lista = (await db.query(
    `select e.*,
            coalesce((select sum(case when m.sentido = 'entrada' then m.valor else -m.valor end) from movimentos m where m.origem_tipo = 'evento' and m.origem_id = e.id), 0) as pago
       from eventos e where e.parque_id = $1 and (e.data >= $2::date - 120 or e.status = 'orcamento') order by e.data`,
    [parqueId, hoje]
  )).rows;
  const pagamentos = (await db.query(
    "select origem_id, em, sentido, forma, valor, descricao from movimentos where parque_id = $1 and origem_tipo = 'evento' order by em",
    [parqueId]
  )).rows;
  const anexos = (await db.query("select id, dono_id, nome, mime, tamanho, criado_em from anexos where parque_id = $1 and dono_tipo = 'evento'", [parqueId])).rows;
  return {
    agora,
    eventos: lista.map(e => ({
      id: e.id, titulo: e.titulo, tipo: e.tipo, tipoNome: TIPOS_EVENTO[e.tipo] || 'Outro', contratante: e.contratante, telefone: e.telefone, email: e.email,
      data: e.data, inicio: hhmm(e.inicio), fim: hhmm(e.fim), espaco: e.espaco, convidados: e.convidados, valor: r(e.valor), sinal: r(e.sinal),
      pago: r(e.pago), saldo: r(Number(e.valor) - Number(e.pago)), itens: e.itens, observacoes: e.observacoes, status: e.status,
      statusNome: STATUS_EVENTO[e.status], motivo: e.motivo, dias: D.diasEntre(hoje, e.data),
      pagamentos: pagamentos.filter(p => p.origem_id === e.id).map(p => ({ em: p.em, sentido: p.sentido, forma: p.forma, valor: r(p.valor), descricao: p.descricao })),
      anexos: anexos.filter(a => a.dono_id === e.id).map(a => ({ id: a.id, nome: a.nome, mime: a.mime, tamanho: a.tamanho, criadoEm: a.criado_em }))
    })),
    tipos: TIPOS_EVENTO,
    espacos: config.espacos,
    formas: formas()
  };
}

/* ------------------------------------------------------------------ loja */

async function loja(db, { parqueId, agora, params }) {
  const mes = mesDoParametro(params, agora);
  const [ini, fim] = intervaloDoMes(mes);
  const produtos = (await db.query('select * from produtos where parque_id = $1 and excluido_em is null order by tipo, ativo desc, categoria, nome', [parqueId])).rows;
  const vendidos = (await db.query(
    `select (i->>'produtoId')::int as id, sum((i->>'qtd')::int) as qtd,
            sum((i->>'qtd')::int * coalesce((i->>'periodos')::int, 1) * (i->>'preco')::bigint) as valor
       from vendas v, jsonb_array_elements(v.itens) i
      where v.parque_id = $1 and v.status = 'paga' and v.em >= $2 and v.em < $3 group by 1`,
    [parqueId, ini, fim]
  )).rows;
  const hoje = D.diaDe(agora);
  const dayUseHoje = (await db.query(
    `select coalesce(sum((i->>'qtd')::int), 0) as qtd from vendas v, jsonb_array_elements(v.itens) i
      where v.parque_id = $1 and v.status = 'paga' and v.em >= $2::date and v.em < $2::date + 1 and i->>'tipo' = 'ingresso'`,
    [parqueId, hoje]
  )).rows[0].qtd;
  const vendas = (await db.query('select * from vendas where parque_id = $1 and em >= $2 and em < $3 order by em desc limit 200', [parqueId, ini, fim])).rows;
  const totais = (await db.query(
    "select count(*)::int as n, coalesce(sum(total), 0) as total from vendas where parque_id = $1 and status = 'paga' and em >= $2 and em < $3",
    [parqueId, ini, fim]
  )).rows[0];
  const porId = new Map(vendidos.map(v => [v.id, v]));
  const alugados = (await db.query("select * from itens_alugados where parque_id = $1 and status = 'fora' order by devolver_ate nulls last, saiu_em", [parqueId])).rows;
  const fora = new Map();
  alugados.forEach(a => fora.set(a.produto_id, (fora.get(a.produto_id) || 0) + a.qtd));
  return {
    agora,
    mes,
    dayUseHoje: Number(dayUseHoje),
    alugados: alugados.map(a => linhaAlugado(a, agora)),
    totais: { vendas: totais.n, valor: r(totais.total) },
    produtos: produtos.map(p => ({
      id: p.id, tipo: p.tipo, nome: p.nome, categoria: p.categoria, preco: r(p.preco), periodo: p.periodo, controlaEstoque: p.controla_estoque,
      estoque: p.estoque, estoqueMinimo: p.estoque_minimo, ativo: p.ativo, fora: fora.get(p.id) || 0,
      vendidosMes: porId.get(p.id) ? Number(porId.get(p.id).qtd) : 0, valorMes: porId.get(p.id) ? r(porId.get(p.id).valor) : 0
    })),
    vendas: vendas.map(v => ({
      id: v.id, numero: String(v.numero).padStart(4, '0'), em: v.em, itens: v.itens.map(i => ({ ...i, preco: r(i.preco) })),
      desconto: r(v.desconto), total: r(v.total), forma: v.forma, status: v.status, motivo: v.motivo, vendedor: v.vendedor
    })),
    formas: formas()
  };
}

/* ------------------------------------------------------------ financeiro */

async function financeiro(db, { parqueId, agora, params }) {
  const hoje = D.diaDe(agora);
  const mes = mesDoParametro(params, agora);
  const [ini, fim] = intervaloDoMes(mes);
  const movimentos = (await db.query('select * from movimentos where parque_id = $1 and em >= $2 and em < $3 order by em desc, id desc', [parqueId, ini, fim])).rows;
  const entradas = movimentos.filter(m => m.sentido === 'entrada' && m.area !== 'caucao').reduce((t, m) => t + Number(m.valor), 0);
  const devolucoes = movimentos.filter(m => m.sentido === 'saida' && m.area !== 'despesas' && m.area !== 'caucao').reduce((t, m) => t + Number(m.valor), 0);
  const saidas = movimentos.filter(m => m.sentido === 'saida' && m.area === 'despesas').reduce((t, m) => t + Number(m.valor), 0);
  const taxas = movimentos.filter(m => m.sentido === 'entrada').reduce((t, m) => t + Number(m.taxa), 0);
  const porDia = new Map();
  movimentos.forEach(m => {
    if (m.area === 'caucao') return;
    const dia = D.diaDe(m.em);
    const l = porDia.get(dia) || { dia, entradas: 0, saidas: 0 };
    if (m.sentido === 'entrada') l.entradas += Number(m.valor); else if (m.area === 'despesas') l.saidas += Number(m.valor); else l.entradas -= Number(m.valor);
    porDia.set(dia, l);
  });
  const porArea = {};
  movimentos.filter(m => m.area !== 'despesas' && m.area !== 'caucao').forEach(m => { porArea[m.area] = (porArea[m.area] || 0) + (m.sentido === 'entrada' ? 1 : -1) * Number(m.valor); });
  const contas = (await db.query(
    "select * from contas where parque_id = $1 and (status = 'aberta' or (pago_em >= $2 and pago_em < $3) or competencia = $4) order by status, vencimento",
    [parqueId, ini, fim, mes]
  )).rows;
  const cobrancasAbertas = (await db.query(
    `select b.*, c.locatario, u.numero from cobrancas b join contratos c on c.id = b.contrato_id join unidades u on u.id = c.unidade_id
      where b.parque_id = $1 and b.status = 'aberta' order by b.vencimento`,
    [parqueId]
  )).rows;
  const saldosEventos = (await db.query(
    `select e.id, e.titulo, e.data, e.valor,
            coalesce((select sum(case when m.sentido = 'entrada' then m.valor else -m.valor end) from movimentos m where m.origem_tipo = 'evento' and m.origem_id = e.id), 0) as pago
       from eventos e where e.parque_id = $1 and e.status in ('confirmado', 'realizado') order by e.data`,
    [parqueId]
  )).rows.filter(e => Number(e.valor) > Number(e.pago));
  const caixas = (await db.query('select * from caixas where parque_id = $1 and aberto_em >= $2 and aberto_em < $3 order by aberto_em desc', [parqueId, ini, fim])).rows;
  const anexosContas = contas.length ? (await db.query(
    "select id, dono_id, nome, mime, tamanho, criado_em from anexos where parque_id = $1 and dono_tipo = 'conta' and dono_id = any($2::int[]) order by id",
    [parqueId, contas.map(c => c.id)]
  )).rows : [];
  const anexo = a => ({ id: a.id, nome: a.nome, mime: a.mime, tamanho: a.tamanho, criadoEm: a.criado_em });
  const fiscal = (c, anexos) => ({
    pessoaDocumento: c.pessoa_documento, documentoTipo: c.documento_tipo, documentoTipoNome: DOCUMENTOS[c.documento_tipo],
    documentoNumero: c.documento_numero, justificativa: c.justificativa, documentacao: documentacao(c, anexos), anexos: anexos.map(anexo)
  });
  const despesas = await despesasDoMes(db, parqueId, mes);
  const conta = c => ({
    id: c.id, sentido: c.sentido, descricao: c.descricao, categoria: c.categoria, categoriaNome: c.sentido === 'pagar' ? NOMES_CATEGORIA[c.categoria] : 'Receita avulsa',
    pessoa: c.pessoa, valor: r(c.valor), vencimento: c.vencimento, competencia: c.competencia, status: c.status, pagoEm: c.pago_em, forma: c.forma,
    vencida: c.status === 'aberta' && c.vencimento < hoje,
    ...fiscal(c, anexosContas.filter(a => a.dono_id === c.id))
  });
  return {
    agora,
    mes,
    totais: { entradas: r(entradas - devolucoes), saidas: r(saidas), saldo: r(entradas - devolucoes - saidas), taxas: r(taxas) },
    porArea: Object.entries(porArea).map(([area, v]) => ({ area, valor: r(v) })).sort((a, b) => b.valor - a.valor),
    movimentos: movimentos.map(m => ({ id: m.id, em: m.em, sentido: m.sentido, area: m.area, descricao: m.descricao, forma: m.forma, valor: r(m.valor), taxa: r(m.taxa), por: m.por })),
    fluxo: [...porDia.values()].sort((a, b) => a.dia.localeCompare(b.dia)).map(l => ({ dia: l.dia, entradas: r(l.entradas), saidas: r(l.saidas) })),
    pagar: contas.filter(c => c.sentido === 'pagar').map(conta),
    receber: {
      contas: contas.filter(c => c.sentido === 'receber').map(conta),
      alugueis: cobrancasAbertas.map(b => ({ id: b.id, box: b.numero, locatario: b.locatario, descricao: b.descricao, valor: r(b.valor), vencimento: b.vencimento, ...R.situacaoDaCobranca(b, hoje) })),
      eventos: saldosEventos.map(e => ({ id: e.id, titulo: e.titulo, data: e.data, saldo: r(Number(e.valor) - Number(e.pago)) }))
    },
    caixas: caixas.map(c => ({
      id: c.id, abertoEm: c.aberto_em, abertoPor: c.aberto_por, fechadoEm: c.fechado_em, fechadoPor: c.fechado_por,
      esperado: r(Object.values(c.esperado || {}).reduce((t, v) => t + Number(v), 0)),
      contado: r(Object.values(c.contado || {}).reduce((t, v) => t + Number(v), 0)),
      diferenca: r(c.diferenca), observacao: c.observacao
    })),
    despesas: despesas.map(c => ({ ...conta(c), ...fiscal(c, c.anexos) })),
    notas: resumoDasNotas(despesas),
    categorias: NOMES_CATEGORIA,
    documentos: DOCUMENTOS,
    formas: formas()
  };
}

/** Quantas despesas do mês já têm documento: alimenta a aba de notas e o pacote do contador. */
const resumoDasNotas = despesas => ({
  total: despesas.length,
  completas: despesas.filter(c => c.documentacao === 'completa').length,
  pendentes: despesas.filter(c => c.documentacao === 'pendente').length,
  semDocumento: despesas.filter(c => c.documentacao === 'sem_documento').length,
  valorPendente: r(despesas.filter(c => c.documentacao === 'pendente').reduce((t, c) => t + Number(c.valor), 0))
});

/* ---------------------------------------------------------- contabilidade */

async function contabilidade(db, { parqueId, agora, params }) {
  const mes = mesDoParametro(params, agora);
  const dre = await dreDoMes(db, parqueId, mes);
  const acumulado = await somasDoLivro(db, parqueId, { ate: mes });
  const saldos = Object.keys(C.CONTAS).filter(c => ['ativo', 'passivo'].includes(C.CONTAS[c].grupo)).map(c => {
    const s = acumulado.find(x => x.conta === c) || { debito: 0, credito: 0 };
    const saldo = C.CONTAS[c].grupo === 'ativo' ? Number(s.debito) - Number(s.credito) : Number(s.credito) - Number(s.debito);
    return { conta: c, nome: C.CONTAS[c].nome, grupo: C.CONTAS[c].grupo, saldo: r(saldo) };
  });
  const livro = (await db.query('select * from lancamentos where parque_id = $1 and mes = $2 order by em desc, id desc limit 400', [parqueId, mes])).rows;
  const totais = (await db.query('select count(*)::int as n, coalesce(sum(debito), 0) as d, coalesce(sum(credito), 0) as c from lancamentos where parque_id = $1 and mes = $2', [parqueId, mes])).rows[0];
  const geral = (await db.query('select coalesce(sum(debito), 0) - coalesce(sum(credito), 0) as saldo from lancamentos where parque_id = $1', [parqueId])).rows[0];
  return {
    agora,
    mes,
    dre,
    saldos,
    livro: livro.map(l => ({ em: l.em, conta: (C.CONTAS[l.conta] || {}).nome || l.conta, historico: l.historico, debito: r(l.debito), credito: r(l.credito) })),
    totais: { lancamentos: totais.n, debitos: r(totais.d), creditos: r(totais.c) },
    equilibrado: Number(geral.saldo) === 0,
    notas: resumoDasNotas(await despesasDoMes(db, parqueId, mes))
  };
}

/* ------------------------------------------------------------- relatórios */

async function relatorios(db, { parqueId, agora, config, params }) {
  const mesAtual = D.mesDe(agora);
  let meses = [3, 6, 12].includes(Number(params.meses)) ? Number(params.meses) : null;
  if (!meses) {
    // Sem escolha, o período acompanha o histórico: não abre com meses vazios antes do sistema existir.
    const primeiro = (await db.query('select min(mes) as m from lancamentos where parque_id = $1', [parqueId])).rows[0].m;
    const [a1, m1] = (primeiro || mesAtual).split('-').map(Number);
    const [a2, m2] = mesAtual.split('-').map(Number);
    meses = (a2 - a1) * 12 + (m2 - m1) + 1 <= 3 ? 3 : 6;
  }
  const lista = Array.from({ length: meses }, (_, i) => D.somarMeses(mesAtual, i - meses + 1));
  const porMes = [];
  for (const mes of lista) {
    const d = await dreDoMes(db, parqueId, mes);
    porMes.push({ mes, porArea: d.porArea, receitas: d.totalReceitas, despesas: d.totalDespesas, resultado: d.resultado });
  }
  const [ini, fim] = intervaloDoMes(mesAtual);
  const hoje = D.diaDe(agora);
  const diasPassados = Number(hoje.slice(8, 10));

  const porHora = (await db.query(
    `select extract(hour from entrada)::int as hora, count(*)::int as n from entradas_parque
      where parque_id = $1 and status <> 'cancelada' and entrada >= $2 and entrada < $3 group by 1 order by 1`,
    [parqueId, ini, fim]
  )).rows;
  const parque = (await db.query(
    `select count(*)::int as n, coalesce(avg(extract(epoch from (saida - entrada)) / 60) filter (where status = 'saiu'), 0) as media,
            count(*) filter (where excedente_valor > 0)::int as excederam
       from entradas_parque where parque_id = $1 and status <> 'cancelada' and entrada >= $2 and entrada < $3`,
    [parqueId, ini, fim]
  )).rows[0];
  const porDiaSemana = (await db.query(
    `select extract(dow from entrada)::int as dia, count(*)::int as n, count(distinct entrada::date)::int as dias
       from entradas_parque where parque_id = $1 and status <> 'cancelada' and entrada >= $2::date - 56 group by 1 order by 1`,
    [parqueId, hoje]
  )).rows;

  const abre = D.paraMinutos(config.horario.abre);
  const fecha = R.fimDoDia(config.horario.fecha);
  const quadras = (await db.query(
    `select q.id, q.nome, q.modalidade, coalesce(sum(extract(epoch from (r.fim - r.inicio)) / 60), 0) as minutos, count(r.id)::int as reservas,
            coalesce(sum(r.valor) filter (where r.status = 'paga'), 0) as recebido
       from quadras q left join reservas r on r.quadra_id = q.id and r.status <> 'cancelada' and r.data >= $2 and r.data <= $3
      where q.parque_id = $1 and q.ativa group by q.id order by q.ordem`,
    [parqueId, ini, hoje]
  )).rows;

  const boxes = (await db.query(
    `select count(*)::int as total, count(c.id)::int as ocupados from unidades u left join contratos c on c.unidade_id = u.id and c.status = 'ativo' where u.parque_id = $1 and u.ativa`,
    [parqueId]
  )).rows[0];
  const alugueis = (await db.query(
    `select competencia, coalesce(sum(valor), 0) as previsto, coalesce(sum(valor) filter (where status = 'paga'), 0) as recebido,
            coalesce(sum(valor) filter (where status = 'aberta' and vencimento < $3), 0) as atrasado
       from cobrancas where parque_id = $1 and status <> 'cancelada' and competencia >= $2 group by 1 order by 1`,
    [parqueId, lista[0], hoje]
  )).rows;

  const top = (await db.query(
    `select i->>'nome' as nome, i->>'tipo' as tipo, sum((i->>'qtd')::int) as qtd, sum((i->>'qtd')::int * (i->>'preco')::bigint) as valor
       from vendas v, jsonb_array_elements(v.itens) i
      where v.parque_id = $1 and v.status = 'paga' and v.em >= $2 and v.em < $3 group by 1, 2 order by 4 desc limit 8`,
    [parqueId, ini, fim]
  )).rows;

  return {
    agora,
    meses,
    porMes,
    parque: {
      entradas: parque.n,
      mediaPorDia: diasPassados ? Math.round(parque.n / diasPassados) : 0,
      tempoMedio: Math.round(Number(parque.media)),
      excederam: parque.excederam,
      porHora: porHora.map(h => ({ hora: h.hora, entradas: h.n })),
      porDiaSemana: porDiaSemana.map(d => ({ dia: d.dia, media: d.dias ? Math.round(d.n / d.dias) : 0 }))
    },
    quadras: quadras.map(q => ({
      nome: q.nome, modalidade: q.modalidade, reservas: q.reservas, horas: Math.round(Number(q.minutos) / 6) / 10,
      ocupacao: Math.round(Number(q.minutos) / ((fecha - abre) * diasPassados) * 100), recebido: r(q.recebido)
    })),
    boxes: {
      ...boxes,
      alugueis: alugueis.map(a => ({ mes: a.competencia, previsto: r(a.previsto), recebido: r(a.recebido), atrasado: r(a.atrasado) }))
    },
    produtos: top.map(t => ({ nome: t.nome, tipo: t.tipo, qtd: Number(t.qtd), valor: r(t.valor) }))
  };
}

/* ---------------------------------------------------------- administração */

async function admin(db, { parqueId, config }) {
  const p = (await db.query('select nome, modo from parques where id = $1', [parqueId])).rows[0];
  const quadras = (await db.query('select * from quadras where parque_id = $1 order by ordem, nome', [parqueId])).rows;
  const movimento = (await db.query('select (select count(*) from movimentos where parque_id = $1)::int + (select count(*) from contratos where parque_id = $1)::int as n', [parqueId])).rows[0].n;
  return {
    nome: p.nome,
    modo: p.modo,
    temMovimento: movimento > 0,
    config: {
      ...config,
      parque: { ...config.parque, valorBloco: r(config.parque.valorBloco), planos: config.parque.planos.map(x => ({ ...x, preco: r(x.preco) })) }
    },
    quadras: quadras.map(q => ({ id: q.id, nome: q.nome, modalidade: q.modalidade, precoHora: r(q.preco_hora), ativa: q.ativa })),
    mensagens: Object.entries(M.MENSAGENS).map(([id, m]) => ({
      id, grupo: m.grupo, titulo: m.titulo, quando: m.quando, variaveis: m.variaveis, exemplo: m.exemplo, padrao: m.padrao,
      texto: config.mensagens[id] || m.padrao, editada: !!config.mensagens[id]
    }))
  };
}

module.exports = { boxes, eventos, loja, financeiro, contabilidade, relatorios, admin };
