'use strict';

const L = require('./ledger');

/**
 * Monta, a partir do estado do food park, só o que cada tela precisa mostrar.
 * O navegador nunca recebe o livro inteiro: o caixa vê o PDV, a gestão vê o resto.
 */

function somarDias(dia, n) {
  const d = new Date(dia + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function mesAnterior(mes) {
  const [a, m] = mes.split('-').map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${String(m - 1).padStart(2, '0')}`;
}

function centavos(v) { return Math.round((Number(v) || 0) * 100); }
function somar(lista, campo) { return lista.reduce((t, x) => t + centavos(x[campo]), 0) / 100; }

/** O estado precisa de ajuste antes de ser mostrado? (demonstração do dia, aluguel do mês) */
function precisaPreparar(estado, agora) {
  if (estado.mode === 'demo' && estado.demoDay !== L.dayOf(agora)) return true;
  const mes = L.ymOf(agora);
  return estado.stalls.some(s => s.status === 'ativo' && s.rent > 0 &&
    !estado.charges.some(c => c.stallId === s.id && c.competence === mes && c.status !== 'cancelado'));
}

function preparar(estado, agora) {
  if (estado.mode === 'demo' && estado.demoDay !== L.dayOf(agora)) {
    return { estado: L.demo(agora), resumo: 'Dados de demonstração atualizados para hoje.' };
  }
  return { estado: L.ensureMonthlyRents(estado, agora), resumo: 'Aluguéis do mês lançados para os boxes ocupados.' };
}

function construirVisao(estado, { agora, mes, papel }) {
  const hoje = L.dayOf(agora);
  const mesAtual = L.ymOf(agora);
  const mesVisto = /^\d{4}-\d{2}$/.test(mes || '') ? mes : mesAtual;
  const ehGestao = papel === 'dono';
  const porId = new Map(estado.stalls.map(s => [s.id, s]));
  const metodoLabel = id => (L.METHODS.find(m => m.id === id) || { label: id }).label;

  const venda = s => {
    const box = porId.get(s.stallId);
    return {
      id: s.id,
      numero: L.pad(s.number, 4),
      em: s.at,
      boxId: s.stallId,
      box: box ? L.pad(box.box, 2) : '',
      boxNome: box ? box.name : 'Box',
      pagamento: s.method,
      pagamentoNome: metodoLabel(s.method),
      quemRecebe: s.holder,
      total: s.total,
      desconto: s.discount,
      taxaParque: s.adminFee,
      taxaMaquininha: s.cardFee,
      liquidoLojista: s.netStall,
      status: s.status,
      motivo: s.cancelReason,
      acertada: !!s.settledAt,
      cliente: s.customer,
      mesa: s.table,
      sessaoId: s.sessionId,
      itens: s.items.map(i => ({ nome: i.name, qtd: i.qty, preco: i.price }))
    };
  };

  const ativos = estado.stalls.filter(s => s.status === 'ativo');
  const boxes = ativos.map(s => ({
    id: s.id,
    box: s.box,
    nome: s.name,
    responsavel: ehGestao ? s.owner : undefined,
    telefone: ehGestao ? s.phone : undefined,
    documento: ehGestao ? s.document : undefined,
    aluguel: ehGestao ? s.rent : undefined,
    taxa: s.feePercent,
    produtos: s.products
      .filter(p => ehGestao || p.active !== false)
      .map(p => ({ id: p.id, nome: p.name, preco: p.price, categoria: p.category, estoque: p.stock, ativo: p.active !== false }))
  }));

  const sessao = L.openSession(estado);
  let caixa = null;
  if (sessao) {
    const daSessao = estado.sales.filter(s => s.sessionId === sessao.id);
    const pagas = daSessao.filter(s => s.status === 'paga');
    const movimentos = estado.ledger
      .filter(l => l.refType === 'caixa' && l.refId === sessao.id && l.account === 'caixa' && l.memo !== 'Fundo de troco da administração')
      .map(l => ({ em: l.at, tipo: l.debit > 0 ? 'suprimento' : 'sangria', valor: l.debit || l.credit, nota: l.memo }));
    caixa = {
      id: sessao.id,
      abertoEm: sessao.openedAt,
      fundo: sessao.openingFloat,
      pedidos: pagas.length,
      total: somar(pagas, 'total'),
      esperado: L.expectedByMethod(pagas),
      vendas: daSessao.slice(0, 80).map(venda),
      movimentos
    };
  }

  const fechamentos = estado.sessions.filter(s => s.status === 'fechado').slice(0, 10).map(s => ({
    id: s.id,
    abertoEm: s.openedAt,
    fechadoEm: s.closedAt,
    esperado: Object.values(s.expected || {}).reduce((t, v) => t + centavos(v), 0) / 100,
    contado: Object.values(s.counted || {}).reduce((t, v) => t + centavos(v), 0) / 100,
    diferenca: s.difference,
    notas: s.notes
  }));

  const visao = {
    agora,
    hoje,
    mes: mesVisto,
    mesAtual,
    parque: {
      nome: estado.park.name,
      cidade: estado.park.city,
      cnpj: estado.park.cnpj,
      boxes: estado.park.boxes,
      taxa: estado.park.adminFeePercent,
      maquininha: estado.park.fees,
      modo: estado.mode
    },
    metodos: L.METHODS.map(m => ({ id: m.id, label: m.label, holder: m.holder })),
    boxes,
    caixa,
    fechamentos
  };
  if (!ehGestao) return visao;

  /* ----------------------------------------------------------- gestão */

  const pagas = estado.sales.filter(s => s.status === 'paga');
  const doMesAtual = pagas.filter(s => L.ymOf(s.at) === mesAtual);
  const deHoje = pagas.filter(s => L.dayOf(s.at) === hoje);
  const resumo = L.dashboard(estado, agora);

  const serie = [];
  for (let i = 13; i >= 0; i -= 1) {
    const dia = somarDias(hoje, -i);
    const doDia = pagas.filter(s => L.dayOf(s.at) === dia);
    serie.push({ dia, total: somar(doDia, 'total'), pedidos: doDia.length, taxa: somar(doDia, 'adminFee') });
  }

  const ranking = ativos.map(s => {
    const vendas = doMesAtual.filter(v => v.stallId === s.id);
    return { id: s.id, box: L.pad(s.box, 2), nome: s.name, total: somar(vendas, 'total'), pedidos: vendas.length, taxa: somar(vendas, 'adminFee') };
  }).sort((a, b) => b.total - a.total);

  const cobrancasAbertas = estado.charges.filter(c => c.status === 'aberto');
  const vencidas = cobrancasAbertas.filter(c => c.due < hoje);
  const contasProximas = estado.bills.filter(b => b.status === 'aberto' && b.direction === 'pagar' && b.due <= somarDias(hoje, 3));
  const estoqueBaixo = [];
  ativos.forEach(s => s.products.forEach(p => {
    if (p.active !== false && p.stock != null && p.stock <= 5) estoqueBaixo.push(`${p.name} (${s.name})`);
  }));
  const acertoAnterior = L.settlement(estado, mesAnterior(mesAtual)).filter(r => r.direction !== 'zerado');

  const alertas = [];
  if (!sessao) {
    alertas.push({ nivel: 'info', titulo: 'O caixa está fechado', texto: 'Abra o caixa para registrar vendas.', rota: 'caixa', botao: 'Abrir o caixa' });
  } else if (L.dayOf(sessao.openedAt) < hoje) {
    alertas.push({ nivel: 'atencao', titulo: 'Caixa aberto desde outro dia', texto: 'Feche o caixa para conferir os valores e comece um novo hoje.', rota: 'caixa', botao: 'Fechar o caixa' });
  }
  if (vencidas.length) {
    alertas.push({ nivel: 'problema', titulo: `${vencidas.length === 1 ? '1 aluguel vencido' : vencidas.length + ' aluguéis vencidos'}`, texto: `${somar(vencidas, 'amount').toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} para receber dos lojistas.`, rota: 'financeiro/alugueis', botao: 'Ver aluguéis' });
  } else if (cobrancasAbertas.length) {
    alertas.push({ nivel: 'info', titulo: `${cobrancasAbertas.length === 1 ? '1 aluguel a receber' : cobrancasAbertas.length + ' aluguéis a receber'}`, texto: 'Vencem no dia 10. Receba aqui ou desconte no acerto do mês.', rota: 'financeiro/alugueis', botao: 'Ver aluguéis' });
  }
  if (contasProximas.length) {
    alertas.push({ nivel: 'atencao', titulo: `${contasProximas.length === 1 ? '1 conta' : contasProximas.length + ' contas'} para pagar até ${somarDias(hoje, 3).split('-').reverse().slice(0, 2).join('/')}`, texto: contasProximas.map(b => b.description).slice(0, 3).join(', ') + '.', rota: 'financeiro/contas', botao: 'Ver contas' });
  }
  if (acertoAnterior.length) {
    alertas.push({ nivel: 'atencao', titulo: 'Acerto do mês passado pendente', texto: `${acertoAnterior.length} ${acertoAnterior.length === 1 ? 'lojista ainda não recebeu' : 'lojistas ainda não receberam'} o repasse.`, rota: 'financeiro/repasses?mes=' + mesAnterior(mesAtual), botao: 'Fazer o acerto' });
  }
  if (estoqueBaixo.length) {
    alertas.push({ nivel: 'atencao', titulo: 'Estoque acabando', texto: estoqueBaixo.slice(0, 3).join(', ') + (estoqueBaixo.length > 3 ? ` e mais ${estoqueBaixo.length - 3}.` : '.'), rota: 'boxes', botao: 'Ver cardápios' });
  }
  const livres = Number(estado.park.boxes) - ativos.length;
  if (livres > 0 && ativos.length) {
    alertas.push({ nivel: 'info', titulo: `${livres === 1 ? '1 box livre' : livres + ' boxes livres'}`, texto: 'Cada box ocupado gera aluguel e taxa sobre as vendas.', rota: 'boxes', botao: 'Ver boxes' });
  }

  const produtos = ativos.reduce((n, s) => n + s.products.length, 0);
  const passos = [
    { feito: ativos.length > 0, titulo: 'Cadastre o primeiro lojista', texto: 'Escolha o box, o aluguel e a taxa sobre as vendas.', rota: 'boxes' },
    { feito: produtos > 0, titulo: 'Monte o cardápio', texto: 'Itens com preço aparecem no caixa para vender.', rota: 'boxes' },
    { feito: estado.sessions.length > 0, titulo: 'Abra o caixa', texto: 'Informe o troco que fica na gaveta.', rota: 'caixa' },
    { feito: pagas.length > 0, titulo: 'Registre a primeira venda', texto: 'A divisão entre lojista e food park é feita na hora.', rota: 'caixa' }
  ];

  const dre = L.dre(estado, mesVisto);
  const repasse = L.settlement(estado, mesVisto);
  const alugueis = estado.charges
    .filter(c => c.competence === mesVisto || c.status === 'aberto')
    .map(c => ({ id: c.id, boxId: c.stallId, boxNome: porId.get(c.stallId) ? porId.get(c.stallId).name : 'Box', box: porId.get(c.stallId) ? L.pad(porId.get(c.stallId).box, 2) : '', competencia: c.competence, valor: c.amount, vencimento: c.due, status: c.status, pagoEm: c.paidAt, forma: c.payMethod, vencida: c.status === 'aberto' && c.due < hoje }))
    .sort((a, b) => (a.status === b.status ? a.vencimento.localeCompare(b.vencimento) : a.status === 'aberto' ? -1 : 1));
  const contas = estado.bills
    .map(b => ({ id: b.id, tipo: b.direction, descricao: b.description, categoria: b.category, valor: b.amount, vencimento: b.due, status: b.status, pagoEm: b.paidAt, vencida: b.status === 'aberto' && b.due < hoje }))
    .sort((a, b) => (a.status === b.status ? a.vencimento.localeCompare(b.vencimento) : a.status === 'aberto' ? -1 : 1));
  const doMesVisto = estado.ledger.filter(l => L.ymOf(l.at) === mesVisto);
  const livro = doMesVisto.slice().sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).slice(0, 300).map(l => ({
    em: l.at,
    conta: L.ACCOUNT_LABELS[l.account] || l.account,
    historico: l.memo,
    debito: l.debit,
    credito: l.credit
  }));
  const vendasMes = pagas.filter(s => L.ymOf(s.at) === mesVisto);

  visao.painel = {
    hoje: { total: resumo.todayGross, pedidos: resumo.todayTickets, taxa: resumo.todayAdmin, ticket: resumo.averageTicket, porMetodo: L.expectedByMethod(deHoje) },
    mes: { total: resumo.monthGross, resultado: resumo.monthResult, pedidos: doMesAtual.length },
    ocupados: resumo.occupied,
    serie,
    ranking,
    ultimas: pagas.slice(0, 8).map(venda),
    alertas,
    passos: passos.every(p => p.feito) ? null : passos
  };
  visao.financeiro = {
    dre,
    porMetodo: L.expectedByMethod(vendasMes),
    repasse,
    alugueis,
    contas,
    livro,
    livroTotal: doMesVisto.length,
    debitos: somar(doMesVisto, 'debit'),
    creditos: somar(doMesVisto, 'credit'),
    equilibrado: L.booksBalanced(estado)
  };
  visao.contasCategorias = Object.keys(L.EXPENSE_ACCOUNTS);
  return visao;
}

module.exports = { construirVisao, precisaPreparar, preparar };
