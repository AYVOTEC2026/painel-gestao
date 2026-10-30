'use strict';

const C = require('../dominio/contabil');
const D = require('../dominio/datas');
const R = require('../dominio/regras');
const { esperadoDoCaixa } = require('../servicos/caixa');
const { r, hhmm, formas, dreDoMes, caixaAberto } = require('./comum');

/* Telas do dia a dia: painel executivo, PDV, parque infantil e quadras. */

function linhaEntrada(e, agora, alerta) {
  const s = R.situacaoDoTempo({ entrada: e.entrada, agora, minutos: e.minutos, alerta });
  return {
    id: e.id, numero: e.numero, crianca: e.crianca, idade: e.idade, responsavel: e.responsavel, telefone: e.telefone,
    pulseira: e.pulseira, observacoes: e.observacoes, plano: e.plano, minutos: e.minutos, valor: r(e.valor), forma: e.forma,
    entrada: e.entrada, saida: e.saida, status: e.status, excedenteMinutos: e.excedente_minutos, excedenteValor: r(e.excedente_valor),
    atendente: e.atendente, caixaId: e.caixa_id, motivo: e.motivo, ...s
  };
}

async function painel(db, { parqueId, agora, config }) {
  const hoje = D.diaDe(agora);
  const mes = D.mesDe(agora);
  const hora = D.horaDe(agora);

  const recebidoHoje = await db.query(
    `select area, sum(case when sentido = 'entrada' then valor else -valor end) as total
       from movimentos where parque_id = $1 and em >= $2::date and em < $2::date + 1 and area not in ('despesas', 'caucao') group by area`,
    [parqueId, hoje]
  );
  const porArea = {};
  recebidoHoje.rows.forEach(l => { porArea[l.area] = r(l.total); });

  const serie = await db.query(
    `select d::date as dia, coalesce(sum(case when m.sentido = 'entrada' then m.valor else -m.valor end), 0) as total
       from generate_series($2::date - 13, $2::date, interval '1 day') d
       left join movimentos m on m.parque_id = $1 and m.em >= d and m.em < d + interval '1 day' and m.area not in ('despesas', 'caucao')
      group by d order by d`,
    [parqueId, hoje]
  );

  const dentro = (await db.query("select * from entradas_parque where parque_id = $1 and status = 'dentro'", [parqueId])).rows
    .map(e => linhaEntrada(e, agora, config.parque.alerta));
  const quadras = (await db.query('select count(*)::int as n from quadras where parque_id = $1 and ativa', [parqueId])).rows[0].n;
  const reservasHoje = (await db.query(
    `select r.*, q.nome as quadra from reservas r join quadras q on q.id = r.quadra_id
      where r.parque_id = $1 and r.data = $2 and r.status <> 'cancelada' order by r.inicio`,
    [parqueId, hoje]
  )).rows;
  const emJogo = reservasHoje.filter(x => hhmm(x.inicio) <= hora && hora < hhmm(x.fim)).length;

  const inad = (await db.query(
    `select count(*)::int as n, count(distinct contrato_id)::int as locatarios, coalesce(sum(valor), 0) as total
       from cobrancas where parque_id = $1 and status = 'aberta' and vencimento < $2`,
    [parqueId, hoje]
  )).rows[0];

  const alertas = [];
  const caixa = await caixaAberto(db, parqueId);
  if (!caixa) alertas.push({ nivel: 'info', titulo: 'O caixa está fechado', texto: 'Abra o caixa para vender na loja, na bilheteria e no parque.', rota: 'pdv', botao: 'Ir para o PDV' });
  else if (D.diaDe(caixa.abertoEm) < hoje) alertas.push({ nivel: 'atencao', titulo: 'Caixa aberto desde outro dia', texto: 'Feche o caixa para conferir os valores e abra um novo hoje.', rota: 'pdv', botao: 'Fechar o caixa' });
  if (inad.n) alertas.push({ nivel: 'problema', titulo: `${inad.locatarios === 1 ? '1 locatário' : inad.locatarios + ' locatários'} com aluguel vencido`, texto: `${r(inad.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} em atraso.`, rota: 'boxes/inadimplencia', botao: 'Ver inadimplência' });
  const passando = dentro.filter(e => e.situacao === 'passou').length;
  if (passando) alertas.push({ nivel: 'atencao', titulo: `${passando === 1 ? '1 criança passou' : passando + ' crianças passaram'} do tempo no parque`, texto: 'Avise os responsáveis. O excedente é cobrado na saída.', rota: 'parque', botao: 'Ver o parque' });
  const vencendo = (await db.query(
    `select c.locatario, c.fim, u.numero from contratos c join unidades u on u.id = c.unidade_id
      where c.parque_id = $1 and c.status = 'ativo' and c.fim between $2 and $2::date + 45 order by c.fim`,
    [parqueId, hoje]
  )).rows;
  vencendo.forEach(c => alertas.push({ nivel: 'atencao', titulo: `Contrato do box ${c.numero} termina em ${D.diasEntre(hoje, c.fim)} dias`, texto: `${c.locatario}. Renove ou prepare a saída.`, rota: 'boxes/contratos', botao: 'Ver contratos' }));
  // Contrato que passou do fim e continua ativo: o aluguel deixa de ser lançado até renovar ou encerrar.
  const vencidos = (await db.query(
    `select c.locatario, c.fim, u.numero from contratos c join unidades u on u.id = c.unidade_id
      where c.parque_id = $1 and c.status = 'ativo' and c.fim < $2 order by c.fim`,
    [parqueId, hoje]
  )).rows;
  vencidos.forEach(c => alertas.push({ nivel: 'problema', titulo: `Contrato do box ${c.numero} venceu em ${c.fim.split('-').reverse().slice(0, 2).join('/')}`, texto: `${c.locatario}. Sem contrato vigente o aluguel não é lançado: renove (edite o fim) ou encerre.`, rota: 'boxes/contratos', botao: 'Ver contratos' }));
  const contas = (await db.query(
    "select count(*)::int as n, coalesce(sum(valor), 0) as total, min(vencimento) as primeira from contas where parque_id = $1 and sentido = 'pagar' and status = 'aberta' and vencimento <= $2::date + 3",
    [parqueId, hoje]
  )).rows[0];
  if (contas.n) alertas.push({ nivel: contas.primeira < hoje ? 'problema' : 'atencao', titulo: `${contas.n === 1 ? '1 conta' : contas.n + ' contas'} para pagar ${contas.primeira < hoje ? '(há vencidas)' : 'nos próximos 3 dias'}`, texto: `${r(contas.total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} no total.`, rota: 'financeiro/pagar', botao: 'Ver contas' });
  const eventos = (await db.query(
    `select e.id, e.titulo, e.data, e.valor, coalesce((select sum(case when m.sentido = 'entrada' then m.valor else -m.valor end) from movimentos m where m.origem_tipo = 'evento' and m.origem_id = e.id), 0) as pago
       from eventos e where e.parque_id = $1 and e.status in ('confirmado', 'orcamento') and e.data between $2 and $2::date + 7 order by e.data`,
    [parqueId, hoje]
  )).rows;
  eventos.filter(e => Number(e.valor) > Number(e.pago)).forEach(e => alertas.push({ nivel: 'info', titulo: `${e.titulo} em ${D.diasEntre(hoje, e.data) || 'hoje'}${D.diasEntre(hoje, e.data) ? ' dias' : ''}`, texto: `Saldo a receber de ${r(Number(e.valor) - Number(e.pago)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`, rota: 'eventos', botao: 'Ver evento' }));
  const estoque = (await db.query("select nome, estoque from produtos where parque_id = $1 and ativo and controla_estoque and estoque <= estoque_minimo order by estoque", [parqueId])).rows;
  if (estoque.length) alertas.push({ nivel: 'atencao', titulo: 'Estoque baixo na loja', texto: estoque.slice(0, 3).map(p => `${p.nome} (${p.estoque})`).join(', ') + '.', rota: 'loja', botao: 'Ver a loja' });
  const caucoes = (await db.query("select count(*)::int as n from contratos where parque_id = $1 and status = 'ativo' and caucao_status = 'pendente'", [parqueId])).rows[0].n;
  if (caucoes) alertas.push({ nivel: 'info', titulo: `${caucoes === 1 ? '1 caução' : caucoes + ' cauções'} a receber`, texto: 'Contratos com caução combinada que ainda não entrou.', rota: 'boxes/contratos', botao: 'Ver contratos' });

  const proximosEventos = (await db.query(
    "select id, titulo, data, inicio, espaco, convidados from eventos where parque_id = $1 and status = 'confirmado' and data >= $2 order by data, inicio limit 4",
    [parqueId, hoje]
  )).rows;
  const ocupados = (await db.query(
    "select count(*)::int as total, count(c.id)::int as ocupados from unidades u left join contratos c on c.unidade_id = u.id and c.status = 'ativo' where u.parque_id = $1 and u.ativa",
    [parqueId]
  )).rows[0];

  return {
    agora,
    hoje: { porArea, total: Object.values(porArea).reduce((t, v) => t + v, 0) },
    serie: serie.rows.map(l => ({ dia: l.dia, total: r(l.total) })),
    parque: { dentro: dentro.length, capacidade: config.parque.capacidade, passando },
    quadras: { emJogo, total: quadras, reservasHoje: reservasHoje.length, proximas: reservasHoje.filter(x => hhmm(x.fim) > hora).slice(0, 6).map(x => ({ quadra: x.quadra, inicio: hhmm(x.inicio), fim: hhmm(x.fim), cliente: x.cliente, status: x.status })) },
    boxes: ocupados,
    inadimplencia: { total: r(inad.total), cobrancas: inad.n, locatarios: inad.locatarios },
    mes: await dreDoMes(db, parqueId, mes),
    caixa,
    alertas,
    eventos: proximosEventos.map(e => ({ ...e, inicio: hhmm(e.inicio) }))
  };
}

async function pdv(db, { parqueId, agora, config }) {
  const produtos = (await db.query("select * from produtos where parque_id = $1 and ativo order by tipo, categoria, nome", [parqueId])).rows;
  const caixa = await caixaAberto(db, parqueId);
  let sessao = null;
  if (caixa) {
    const linha = (await db.query('select * from caixas where id = $1', [caixa.id])).rows[0];
    const esperado = await esperadoDoCaixa({ tx: db }, linha);
    const movimentos = (await db.query(
      'select * from movimentos where caixa_id = $1 order by em desc, id desc limit 120',
      [caixa.id]
    )).rows;
    const vendas = (await db.query('select id, numero, status from vendas where caixa_id = $1', [caixa.id])).rows;
    const retiradas = (await db.query('select * from movimentos_caixa where caixa_id = $1 order by em', [caixa.id])).rows;
    const entradas = movimentos.filter(m => m.sentido === 'entrada');
    sessao = {
      ...caixa,
      esperado: Object.fromEntries(Object.entries(esperado).map(([k, v]) => [k, r(v)])),
      recebido: r(entradas.reduce((t, m) => t + Number(m.valor), 0) - movimentos.filter(m => m.sentido === 'saida').reduce((t, m) => t + Number(m.valor), 0)),
      atendimentos: entradas.length,
      movimentos: movimentos.map(m => {
        const v = m.origem_tipo === 'venda' ? vendas.find(x => x.id === m.origem_id) : null;
        return { id: m.id, em: m.em, sentido: m.sentido, area: m.area, descricao: m.descricao, forma: m.forma, valor: r(m.valor), origemTipo: m.origem_tipo, origemId: m.origem_id, cancelavel: !!(v && v.status === 'paga' && m.sentido === 'entrada'), cancelada: !!(v && v.status === 'cancelada') };
      }),
      retiradas: retiradas.map(m => ({ tipo: m.tipo, valor: r(m.valor), nota: m.nota, em: m.em, por: m.por }))
    };
  }
  const fechamentos = (await db.query('select * from caixas where parque_id = $1 and fechado_em is not null order by fechado_em desc limit 10', [parqueId])).rows;
  return {
    agora,
    produtos: produtos.map(p => ({ id: p.id, tipo: p.tipo, nome: p.nome, categoria: p.categoria, preco: r(p.preco), controlaEstoque: p.controla_estoque, estoque: p.estoque })),
    caixa: sessao,
    planos: config.parque.planos.map(p => ({ ...p, preco: r(p.preco) })),
    taxas: config.taxas,
    formas: formas(),
    fechamentos: fechamentos.map(f => ({
      id: f.id, abertoEm: f.aberto_em, fechadoEm: f.fechado_em, fechadoPor: f.fechado_por,
      esperado: r(Object.values(f.esperado || {}).reduce((t, v) => t + Number(v), 0)),
      contado: r(Object.values(f.contado || {}).reduce((t, v) => t + Number(v), 0)),
      diferenca: r(f.diferenca), observacao: f.observacao
    }))
  };
}

async function parque(db, { parqueId, agora, config, papel }) {
  const hoje = D.diaDe(agora);
  const p = config.parque;
  const dentro = (await db.query("select * from entradas_parque where parque_id = $1 and status = 'dentro' order by entrada", [parqueId])).rows
    .map(e => linhaEntrada(e, agora, p.alerta))
    .sort((a, b) => (a.restantes == null ? 1e9 : a.restantes) - (b.restantes == null ? 1e9 : b.restantes));
  const hojeTodas = (await db.query(
    "select * from entradas_parque where parque_id = $1 and entrada >= $2::date and entrada < $2::date + 1 and status <> 'dentro' order by coalesce(saida, entrada) desc",
    [parqueId, hoje]
  )).rows.map(e => linhaEntrada(e, agora, p.alerta));
  const saidas = hojeTodas.filter(e => e.status === 'saiu');
  const tempoMedio = saidas.length ? Math.round(saidas.reduce((t, e) => t + D.minutosEntre(e.entrada, e.saida), 0) / saidas.length) : null;
  const receita = (await db.query(
    "select coalesce(sum(case when sentido = 'entrada' then valor else -valor end), 0) as total from movimentos where parque_id = $1 and area = 'parque' and em >= $2::date and em < $2::date + 1",
    [parqueId, hoje]
  )).rows[0].total;
  return {
    agora,
    config: { capacidade: p.capacidade, tolerancia: p.tolerancia, bloco: p.bloco, valorBloco: r(p.valorBloco), alerta: p.alerta },
    planos: p.planos.map(x => ({ ...x, preco: r(x.preco) })),
    dentro,
    hoje: hojeTodas,
    resumo: { entradas: dentro.length + hojeTodas.filter(e => e.status !== 'cancelada').length, tempoMedio, receita: papel === 'monitor' ? null : r(receita) },
    caixa: await caixaAberto(db, parqueId),
    formas: formas()
  };
}

async function quadras(db, { parqueId, agora, config, params }) {
  const hoje = D.diaDe(agora);
  const dia = D.dataValida(params.data) ? params.data : hoje;
  const lista = (await db.query('select * from quadras where parque_id = $1 and ativa order by ordem, nome', [parqueId])).rows;
  const reservas = (await db.query(
    "select * from reservas where parque_id = $1 and data = $2 and status <> 'cancelada' order by inicio",
    [parqueId, dia]
  )).rows;
  const segunda = D.somarDias(dia, -((D.diaDaSemana(dia) + 6) % 7));
  const semana = (await db.query(
    `select d::date as dia, count(r.id)::int as reservas
       from generate_series($2::date, $2::date + 6, interval '1 day') d
       left join reservas r on r.parque_id = $1 and r.data = d::date and r.status <> 'cancelada'
      group by d order by d`,
    [parqueId, segunda]
  )).rows;
  const aReceber = (await db.query(
    `select r.*, q.nome as quadra from reservas r join quadras q on q.id = r.quadra_id
      where r.parque_id = $1 and r.status = 'reservada' and (r.data < $2 or (r.data = $2 and r.fim <= $3::time))
      order by r.data desc, r.inicio limit 40`,
    [parqueId, hoje, D.horaDe(agora)]
  )).rows;
  const abre = D.paraMinutos(config.horario.abre);
  const fecha = R.fimDoDia(config.horario.fecha);
  const reservado = reservas.reduce((t, x) => t + D.paraMinutos(x.fim) - D.paraMinutos(x.inicio), 0);
  const linha = x => ({
    id: x.id, quadraId: x.quadra_id, quadra: x.quadra, data: x.data, inicio: hhmm(x.inicio), fim: hhmm(x.fim), cliente: x.cliente, telefone: x.telefone,
    valor: r(x.valor), status: x.status, grupo: x.grupo, forma: x.forma, pagoEm: x.pago_em
  });
  return {
    agora,
    dia,
    horario: config.horario,
    quadras: lista.map(q => ({ id: q.id, nome: q.nome, modalidade: q.modalidade, precoHora: r(q.preco_hora) })),
    reservas: reservas.map(linha),
    semana,
    aReceber: aReceber.map(linha),
    ocupacao: lista.length ? Math.round(reservado / ((fecha - abre) * lista.length) * 100) : 0,
    caixa: await caixaAberto(db, parqueId),
    formas: formas()
  };
}

module.exports = { painel, pdv, parque, quadras, C };
