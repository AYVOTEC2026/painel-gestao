(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.AyvoFoodParkLedger = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const METHODS = [
    { id: 'dinheiro', label: 'Dinheiro', holder: 'lojista' },
    { id: 'pix', label: 'Pix', holder: 'administracao' },
    { id: 'debito', label: 'Débito', holder: 'administracao' },
    { id: 'credito', label: 'Crédito', holder: 'administracao' },
    { id: 'voucher', label: 'Voucher', holder: 'administracao' }
  ];

  const EXPENSE_ACCOUNTS = {
    energia: 'despesa_energia',
    agua: 'despesa_agua',
    marketing: 'despesa_marketing',
    manutencao: 'despesa_manutencao',
    folha: 'despesa_folha',
    outras: 'despesa_outras'
  };

  const ACCOUNT_LABELS = {
    caixa: 'Caixa da administração',
    bancos: 'Bancos / Pix',
    adquirente: 'Cartões a compensar',
    receber_lojista: 'Taxas a receber dos lojistas',
    receber_aluguel: 'Aluguéis a receber',
    contas_receber: 'Outras contas a receber',
    repasse_lojista: 'Repasses a pagar',
    contas_pagar: 'Contas a pagar',
    receita_taxa: 'Receita de taxa de administração',
    receita_aluguel: 'Receita de aluguel de boxes',
    receita_outras: 'Outras receitas',
    despesa_energia: 'Energia',
    despesa_agua: 'Água',
    despesa_marketing: 'Marketing',
    despesa_manutencao: 'Manutenção',
    despesa_folha: 'Folha e encargos',
    despesa_outras: 'Outras despesas',
    quebra_caixa: 'Quebra de caixa'
  };

  function cents(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100);
  }
  function reais(c) { return Math.round(c) / 100; }
  function pct(amountCents, percent) {
    return Math.round(amountCents * Number(percent || 0) / 100);
  }
  function round2(n) { return reais(cents(n)); }
  function clone(state) { return structuredClone(state); }
  function ymOf(iso) { return String(iso || '').slice(0, 10).slice(0, 7); }
  function dayOf(iso) { return String(iso || '').slice(0, 10); }
  function pad(n, size) { return String(n).padStart(size, '0'); }

  function methodOf(id) {
    return METHODS.find(m => m.id === id) || null;
  }

  function blank(park) {
    const fees = { dinheiro: 0, pix: 0, debito: 1.99, credito: 3.49, voucher: 0 };
    return {
      version: 1,
      onboarded: true,
      mode: 'empty',
      park: Object.assign({
        name: 'Food Park',
        city: '',
        cnpj: '',
        boxes: 8,
        adminFeePercent: 10,
        fees
      }, park || {}, { fees: Object.assign({}, fees, park && park.fees) }),
      seq: 10,
      stalls: [],
      sales: [],
      charges: [],
      bills: [],
      sessions: [],
      ledger: [],
      audit: []
    };
  }

  function nid(state, prefix) {
    state.seq += 1;
    return prefix + state.seq;
  }

  function audit(state, message, at) {
    state.audit.unshift({ id: nid(state, 'a'), at: at || new Date().toISOString(), message });
    state.audit = state.audit.slice(0, 80);
  }

  function post(state, entry) {
    const debit = cents(entry.debit);
    const credit = cents(entry.credit);
    if (debit === 0 && credit === 0) return;
    if (debit < 0 || credit < 0) throw new Error('Lançamento contábil inválido.');
    state.ledger.push({
      id: nid(state, 'l'),
      at: entry.at,
      refType: entry.refType,
      refId: entry.refId,
      stallId: entry.stallId || '',
      account: entry.account,
      debit: reais(debit),
      credit: reais(credit),
      memo: entry.memo || ''
    });
  }

  function cashAccount(method) {
    if (method === 'dinheiro') return 'caixa';
    if (method === 'debito' || method === 'credito') return 'adquirente';
    return 'bancos';
  }

  function stallById(state, id) {
    return state.stalls.find(s => s.id === id) || null;
  }

  function openSession(state) {
    return state.sessions.find(s => s.status === 'aberto') || null;
  }

  function productById(stall, id) {
    return (stall.products || []).find(p => p.id === id) || null;
  }

  function createStall(state, input, at) {
    const next = clone(state);
    const box = Number(input.box);
    if (!box || box < 1 || box > Number(next.park.boxes)) throw new Error('Escolha um box válido.');
    if (next.stalls.some(s => Number(s.box) === box && s.status !== 'inativo')) throw new Error('Esse box já tem um lojista ativo.');
    const name = String(input.name || '').trim();
    if (name.length < 2) throw new Error('Informe o nome da operação.');
    const when = at || new Date().toISOString();
    const stall = {
      id: nid(next, 'b'),
      box,
      name,
      owner: String(input.owner || '').trim(),
      phone: String(input.phone || '').trim(),
      document: String(input.document || '').trim(),
      rent: round2(Math.max(0, Number(input.rent) || 0)),
      feePercent: input.feePercent === '' || input.feePercent == null ? Number(next.park.adminFeePercent) : Number(input.feePercent),
      status: 'ativo',
      products: []
    };
    if (!(stall.feePercent >= 0 && stall.feePercent <= 100)) throw new Error('A taxa de administração precisa ficar entre 0 e 100%.');
    next.stalls.push(stall);
    next.stalls.sort((a, b) => a.box - b.box);
    if (stall.rent > 0) createRentCharge(next, stall, when);
    audit(next, `Lojista ${stall.name} vinculado ao box ${pad(stall.box, 2)}.`, when);
    return next;
  }

  function addProduct(state, stallId, input) {
    const next = clone(state);
    const stall = stallById(next, stallId);
    if (!stall) throw new Error('Lojista não encontrado.');
    const name = String(input.name || '').trim();
    const price = round2(input.price);
    if (name.length < 2) throw new Error('Informe o nome do produto.');
    if (!(price > 0)) throw new Error('Informe um preço maior que zero.');
    const stock = input.stock === '' || input.stock == null ? null : Math.max(0, Math.floor(Number(input.stock)));
    stall.products.push({
      id: nid(next, 'p'),
      name,
      price,
      category: String(input.category || 'Cardápio').trim() || 'Cardápio',
      stock,
      active: input.active !== false
    });
    audit(next, `Produto ${name} incluído no cardápio de ${stall.name}.`);
    return next;
  }

  function setProductActive(state, stallId, productId, active) {
    const next = clone(state);
    const stall = stallById(next, stallId);
    const product = stall && productById(stall, productId);
    if (!product) throw new Error('Produto não encontrado.');
    product.active = !!active;
    return next;
  }

  function createRentCharge(state, stall, at) {
    const when = at || new Date().toISOString();
    const competence = ymOf(when);
    if (state.charges.some(c => c.stallId === stall.id && c.competence === competence && c.status !== 'cancelado')) return;
    const dueDay = '10';
    const charge = {
      id: nid(state, 'c'),
      stallId: stall.id,
      type: 'aluguel',
      competence,
      amount: stall.rent,
      due: competence + '-' + dueDay,
      status: 'aberto',
      paidAt: '',
      settledSale: false
    };
    state.charges.push(charge);
    post(state, {
      at: when, refType: 'aluguel', refId: charge.id, stallId: stall.id,
      account: 'receber_aluguel', debit: charge.amount, credit: 0,
      memo: `Aluguel ${competence} • box ${pad(stall.box, 2)} • ${stall.name}`
    });
    post(state, {
      at: when, refType: 'aluguel', refId: charge.id, stallId: stall.id,
      account: 'receita_aluguel', debit: 0, credit: charge.amount,
      memo: `Receita de aluguel ${competence} • ${stall.name}`
    });
  }

  function ensureMonthlyRents(state, at) {
    const next = clone(state);
    const when = at || new Date().toISOString();
    next.stalls.filter(s => s.status === 'ativo' && s.rent > 0).forEach(s => createRentCharge(next, s, when));
    return next;
  }

  function payCharge(state, chargeId, method, at) {
    const next = clone(state);
    const charge = next.charges.find(c => c.id === chargeId);
    if (!charge) throw new Error('Cobrança não encontrada.');
    if (charge.status === 'pago') throw new Error('Esse aluguel já foi recebido.');
    const when = at || new Date().toISOString();
    const account = cashAccount(method || 'pix');
    charge.status = 'pago';
    charge.paidAt = when;
    charge.payMethod = method || 'pix';
    post(next, {
      at: when, refType: 'aluguel', refId: charge.id, stallId: charge.stallId,
      account, debit: charge.amount, credit: 0,
      memo: 'Recebimento de aluguel'
    });
    post(next, {
      at: when, refType: 'aluguel', refId: charge.id, stallId: charge.stallId,
      account: 'receber_aluguel', debit: 0, credit: charge.amount,
      memo: 'Baixa de aluguel a receber'
    });
    audit(next, `Aluguel recebido • ${charge.competence}.`, when);
    return next;
  }

  function addBill(state, input, at) {
    const next = clone(state);
    const direction = input.direction === 'receber' ? 'receber' : 'pagar';
    const amount = round2(input.amount);
    const description = String(input.description || '').trim();
    if (description.length < 2) throw new Error('Informe a descrição.');
    if (!(amount > 0)) throw new Error('Informe um valor maior que zero.');
    const when = at || new Date().toISOString();
    const category = direction === 'pagar' ? (EXPENSE_ACCOUNTS[input.category] ? input.category : 'outras') : 'outras';
    const bill = {
      id: nid(next, 'd'),
      direction,
      description,
      category,
      amount,
      due: input.due || dayOf(when),
      status: 'aberto',
      paidAt: '',
      payMethod: ''
    };
    next.bills.push(bill);
    if (direction === 'pagar') {
      post(next, {
        at: when, refType: 'conta', refId: bill.id, account: EXPENSE_ACCOUNTS[category],
        debit: amount, credit: 0, memo: description
      });
      post(next, {
        at: when, refType: 'conta', refId: bill.id, account: 'contas_pagar',
        debit: 0, credit: amount, memo: description
      });
    } else {
      post(next, {
        at: when, refType: 'conta', refId: bill.id, account: 'contas_receber',
        debit: amount, credit: 0, memo: description
      });
      post(next, {
        at: when, refType: 'conta', refId: bill.id, account: 'receita_outras',
        debit: 0, credit: amount, memo: description
      });
    }
    audit(next, `Conta lançada: ${description}.`, when);
    return next;
  }

  function payBill(state, billId, method, at) {
    const next = clone(state);
    const bill = next.bills.find(b => b.id === billId);
    if (!bill) throw new Error('Conta não encontrada.');
    if (bill.status === 'pago') throw new Error('Essa conta já foi baixada.');
    const when = at || new Date().toISOString();
    const account = cashAccount(method || (bill.direction === 'pagar' ? 'pix' : 'pix'));
    bill.status = 'pago';
    bill.paidAt = when;
    bill.payMethod = method || 'pix';
    if (bill.direction === 'pagar') {
      post(next, { at: when, refType: 'conta', refId: bill.id, account: 'contas_pagar', debit: bill.amount, credit: 0, memo: 'Pagamento • ' + bill.description });
      post(next, { at: when, refType: 'conta', refId: bill.id, account, debit: 0, credit: bill.amount, memo: 'Saída • ' + bill.description });
    } else {
      post(next, { at: when, refType: 'conta', refId: bill.id, account, debit: bill.amount, credit: 0, memo: 'Entrada • ' + bill.description });
      post(next, { at: when, refType: 'conta', refId: bill.id, account: 'contas_receber', debit: 0, credit: bill.amount, memo: 'Baixa • ' + bill.description });
    }
    audit(next, `Baixa registrada: ${bill.description}.`, when);
    return next;
  }

  function openCash(state, input, at) {
    const next = clone(state);
    if (openSession(next)) throw new Error('Já existe um caixa aberto.');
    const when = at || new Date().toISOString();
    const opening = round2(Math.max(0, Number(input && input.openingFloat) || 0));
    const session = {
      id: nid(next, 'x'),
      openedAt: when,
      closedAt: '',
      openingFloat: opening,
      status: 'aberto',
      counted: null,
      notes: '',
      difference: 0
    };
    next.sessions.unshift(session);
    if (opening > 0) {
      post(next, { at: when, refType: 'caixa', refId: session.id, account: 'caixa', debit: opening, credit: 0, memo: 'Fundo de troco da administração' });
      post(next, { at: when, refType: 'caixa', refId: session.id, account: 'bancos', debit: 0, credit: opening, memo: 'Transferência para fundo de troco' });
    }
    audit(next, 'Caixa aberto.', when);
    return next;
  }

  function cashMove(state, input, at) {
    const next = clone(state);
    const session = openSession(next);
    if (!session) throw new Error('Abra o caixa antes de lançar sangria ou suprimento.');
    const amount = round2(input.amount);
    if (!(amount > 0)) throw new Error('Informe um valor maior que zero.');
    const when = at || new Date().toISOString();
    const type = input.type === 'sangria' ? 'sangria' : 'suprimento';
    const note = String(input.note || '').trim() || (type === 'sangria' ? 'Sangria' : 'Suprimento');
    if (type === 'suprimento') {
      post(next, { at: when, refType: 'caixa', refId: session.id, account: 'caixa', debit: amount, credit: 0, memo: note });
      post(next, { at: when, refType: 'caixa', refId: session.id, account: 'bancos', debit: 0, credit: amount, memo: note });
    } else {
      post(next, { at: when, refType: 'caixa', refId: session.id, account: 'bancos', debit: amount, credit: 0, memo: note });
      post(next, { at: when, refType: 'caixa', refId: session.id, account: 'caixa', debit: 0, credit: amount, memo: note });
    }
    audit(next, `${type === 'sangria' ? 'Sangria' : 'Suprimento'} de caixa registrada.`, when);
    return next;
  }

  function quoteSale(state, input) {
    const stall = stallById(state, input.stallId);
    if (!stall || stall.status !== 'ativo') throw new Error('Selecione um box ativo.');
    const method = methodOf(input.method);
    if (!method) throw new Error('Selecione a forma de pagamento.');
    const items = (input.items || []).map(raw => {
      const product = productById(stall, raw.productId);
      if (!product || product.active === false) throw new Error('Há um item inativo ou inexistente no carrinho.');
      const qty = Math.floor(Number(raw.qty));
      if (!(qty > 0)) throw new Error('A quantidade precisa ser maior que zero.');
      return { productId: product.id, name: product.name, qty, price: product.price, category: product.category };
    });
    if (!items.length) throw new Error('Adicione pelo menos um item.');
    const gross = items.reduce((sum, item) => sum + cents(item.price) * item.qty, 0);
    const discount = cents(input.discount || 0);
    if (discount < 0 || discount > gross) throw new Error('O desconto não pode passar do valor dos itens.');
    const total = gross - discount;
    const feePercent = Number(state.park.fees[method.id] || 0);
    const cardFee = method.holder === 'administracao' ? pct(total, feePercent) : 0;
    const adminPercent = Number(stall.feePercent);
    const adminFee = pct(total, adminPercent);
    const netStall = total - cardFee - adminFee;
    if (netStall < 0) throw new Error('Taxas maiores que o valor da venda. Revise o cadastro.');
    return {
      items,
      method: method.id,
      methodLabel: method.label,
      holder: method.holder,
      gross: reais(gross),
      discount: reais(discount),
      total: reais(total),
      feePercent,
      cardFee: reais(cardFee),
      adminPercent,
      adminFee: reais(adminFee),
      netStall: reais(netStall)
    };
  }

  function commitSale(state, input, at) {
    const next = clone(state);
    const session = openSession(next);
    if (!session) throw new Error('Abra o caixa para registrar a venda no PDV.');
    const quoted = quoteSale(next, input);
    quoted.items.forEach(item => {
      const stall = stallById(next, input.stallId);
      const product = productById(stall, item.productId);
      if (product.stock != null) {
        if (product.stock < item.qty) throw new Error(`Estoque insuficiente de ${product.name}.`);
        product.stock -= item.qty;
      }
    });
    const when = at || new Date().toISOString();
    const sale = {
      id: nid(next, 'v'),
      number: next.sales.length + 1,
      at: when,
      stallId: input.stallId,
      sessionId: session.id,
      items: quoted.items,
      method: quoted.method,
      customer: String(input.customer || '').trim(),
      table: String(input.table || '').trim(),
      gross: quoted.gross,
      discount: quoted.discount,
      total: quoted.total,
      cardFee: quoted.cardFee,
      adminFee: quoted.adminFee,
      netStall: quoted.netStall,
      holder: quoted.holder,
      status: 'paga',
      cancelReason: '',
      settledAt: ''
    };
    next.sales.unshift(sale);
    const stall = stallById(next, sale.stallId);
    const memo = `PDV ${pad(sale.number, 4)} • ${stall.name} • ${quoted.methodLabel}`;
    if (sale.holder === 'administracao') {
      const received = reais(cents(sale.total) - cents(sale.cardFee));
      post(next, { at: when, refType: 'venda', refId: sale.id, stallId: sale.stallId, account: cashAccount(sale.method), debit: received, credit: 0, memo });
      post(next, { at: when, refType: 'venda', refId: sale.id, stallId: sale.stallId, account: 'receita_taxa', debit: 0, credit: sale.adminFee, memo: 'Taxa de administração • ' + memo });
      post(next, { at: when, refType: 'venda', refId: sale.id, stallId: sale.stallId, account: 'repasse_lojista', debit: 0, credit: sale.netStall, memo: 'Líquido do lojista • ' + memo });
    } else {
      post(next, { at: when, refType: 'venda', refId: sale.id, stallId: sale.stallId, account: 'receber_lojista', debit: sale.adminFee, credit: 0, memo: 'Taxa sobre venda em dinheiro • ' + memo });
      post(next, { at: when, refType: 'venda', refId: sale.id, stallId: sale.stallId, account: 'receita_taxa', debit: 0, credit: sale.adminFee, memo: 'Taxa de administração • ' + memo });
    }
    audit(next, `Venda ${pad(sale.number, 4)} • ${stall.name} • ${quoted.methodLabel}.`, when);
    return { state: next, sale };
  }

  function cancelSale(state, saleId, reason, at) {
    const next = clone(state);
    const sale = next.sales.find(s => s.id === saleId);
    if (!sale) throw new Error('Venda não encontrada.');
    if (sale.status === 'cancelada') throw new Error('Essa venda já foi cancelada.');
    if (sale.settledAt) throw new Error('Essa venda já entrou em um repasse e não pode ser cancelada por aqui.');
    const why = String(reason || '').trim();
    if (why.length < 3) throw new Error('Informe o motivo do cancelamento.');
    const when = at || new Date().toISOString();
    const stall = stallById(next, sale.stallId);
    sale.items.forEach(item => {
      const product = stall && productById(stall, item.productId);
      if (product && product.stock != null) product.stock += item.qty;
    });
    const lines = next.ledger.filter(line => line.refType === 'venda' && line.refId === sale.id);
    lines.forEach(line => {
      post(next, {
        at: when, refType: 'estorno', refId: sale.id, stallId: sale.stallId,
        account: line.account, debit: line.credit, credit: line.debit,
        memo: 'Estorno • ' + line.memo
      });
    });
    sale.status = 'cancelada';
    sale.cancelReason = why;
    audit(next, `Venda ${pad(sale.number, 4)} cancelada. ${why}`, when);
    return next;
  }

  function sessionSales(state, sessionId) {
    return state.sales.filter(s => s.sessionId === sessionId && s.status === 'paga');
  }

  function expectedByMethod(sales) {
    const totals = {};
    METHODS.forEach(m => { totals[m.id] = 0; });
    sales.forEach(s => { totals[s.method] = reais(cents(totals[s.method] || 0) + cents(s.total)); });
    return totals;
  }

  function closeCash(state, input, at) {
    const next = clone(state);
    const session = openSession(next);
    if (!session) throw new Error('Não há caixa aberto.');
    const when = at || new Date().toISOString();
    const expected = expectedByMethod(sessionSales(next, session.id));
    const counted = {};
    let diffCents = 0;
    METHODS.forEach(m => {
      const value = round2(input && input.counted ? input.counted[m.id] : expected[m.id]);
      counted[m.id] = value;
      diffCents += cents(value) - cents(expected[m.id]);
    });
    session.status = 'fechado';
    session.closedAt = when;
    session.counted = counted;
    session.expected = expected;
    session.notes = String(input && input.notes || '').trim();
    session.difference = reais(diffCents);
    if (diffCents !== 0) {
      const amount = reais(Math.abs(diffCents));
      if (diffCents < 0) {
        post(next, { at: when, refType: 'caixa', refId: session.id, account: 'quebra_caixa', debit: amount, credit: 0, memo: 'Falta de caixa no fechamento' });
        post(next, { at: when, refType: 'caixa', refId: session.id, account: 'caixa', debit: 0, credit: amount, memo: 'Ajuste de falta de caixa' });
      } else {
        post(next, { at: when, refType: 'caixa', refId: session.id, account: 'caixa', debit: amount, credit: 0, memo: 'Sobra de caixa no fechamento' });
        post(next, { at: when, refType: 'caixa', refId: session.id, account: 'quebra_caixa', debit: 0, credit: amount, memo: 'Ajuste de sobra de caixa' });
      }
    }
    audit(next, 'Caixa fechado.', when);
    return next;
  }

  function activeSales(state, month) {
    return state.sales.filter(s => s.status === 'paga' && (!month || ymOf(s.at) === month));
  }

  function settlement(state, month) {
    const rows = state.stalls.filter(s => s.status === 'ativo').map(stall => {
      const monthSales = activeSales(state, month).filter(s => s.stallId === stall.id);
      const sales = monthSales.filter(s => !s.settledAt);
      const liability = sales.filter(s => s.holder === 'administracao').reduce((acc, s) => acc + cents(s.netStall), 0);
      const cashAdminFee = sales.filter(s => s.holder === 'lojista').reduce((acc, s) => acc + cents(s.adminFee), 0);
      const rent = state.charges
        .filter(c => c.stallId === stall.id && c.status === 'aberto' && (!month || c.competence === month))
        .reduce((acc, c) => acc + cents(c.amount), 0);
      const net = liability - cashAdminFee - rent;
      return {
        stallId: stall.id,
        box: stall.box,
        name: stall.name,
        sales: monthSales.length,
        gross: reais(sumCents(monthSales, 'total')),
        cardFee: reais(sumCents(monthSales, 'cardFee')),
        adminFee: reais(sumCents(monthSales, 'adminFee')),
        netStall: reais(sumCents(monthSales, 'netStall')),
        liability: reais(liability),
        rentOpen: reais(rent),
        direction: net === 0 ? 'zerado' : net > 0 ? 'pagar_lojista' : 'receber_lojista',
        amount: reais(Math.abs(net)),
        saleIds: sales.map(s => s.id),
        chargeIds: state.charges.filter(c => c.stallId === stall.id && c.status === 'aberto' && (!month || c.competence === month)).map(c => c.id)
      };
    });
    return rows;
  }

  function sum(list, key) { return reais(sumCents(list, key)); }
  function sumCents(list, key) { return list.reduce((acc, item) => acc + cents(item[key]), 0); }

  function registerSettlement(state, stallId, month, method, at) {
    const next = clone(state);
    const row = settlement(next, month).find(r => r.stallId === stallId);
    if (!row) throw new Error('Lojista não encontrado.');
    if (row.direction === 'zerado' || row.amount === 0) throw new Error('Não há valor em aberto para este lojista no período.');
    const when = at || new Date().toISOString();
    const account = cashAccount(method || 'pix');
    const stall = stallById(next, stallId);
    const sales = next.sales.filter(s => row.saleIds.includes(s.id));
    const cashFee = sales.filter(s => s.holder === 'lojista').reduce((acc, s) => acc + cents(s.adminFee), 0);
    const rent = next.charges.filter(c => row.chargeIds.includes(c.id)).reduce((acc, c) => acc + cents(c.amount), 0);
    const liability = sales.filter(s => s.holder === 'administracao').reduce((acc, s) => acc + cents(s.netStall), 0);
    const net = liability - cashFee - rent;
    if (row.direction === 'pagar_lojista') {
      post(next, { at: when, refType: 'repasse', refId: stallId, stallId, account: 'repasse_lojista', debit: reais(liability), credit: 0, memo: `Repasse ${month} • ${stall.name}` });
      if (cashFee) post(next, { at: when, refType: 'repasse', refId: stallId, stallId, account: 'receber_lojista', debit: 0, credit: reais(cashFee), memo: `Compensação de taxa em dinheiro • ${stall.name}` });
      if (rent) post(next, { at: when, refType: 'repasse', refId: stallId, stallId, account: 'receber_aluguel', debit: 0, credit: reais(rent), memo: `Compensação de aluguel • ${stall.name}` });
      post(next, { at: when, refType: 'repasse', refId: stallId, stallId, account, debit: 0, credit: row.amount, memo: `Pagamento de repasse • ${stall.name}` });
    } else {
      post(next, { at: when, refType: 'repasse', refId: stallId, stallId, account, debit: row.amount, credit: 0, memo: `Recebimento do lojista • ${stall.name}` });
      if (liability) post(next, { at: when, refType: 'repasse', refId: stallId, stallId, account: 'repasse_lojista', debit: reais(liability), credit: 0, memo: `Compensação de repasse • ${stall.name}` });
      if (cashFee) post(next, { at: when, refType: 'repasse', refId: stallId, stallId, account: 'receber_lojista', debit: 0, credit: reais(cashFee), memo: `Taxa em dinheiro recebida • ${stall.name}` });
      if (rent) post(next, { at: when, refType: 'repasse', refId: stallId, stallId, account: 'receber_aluguel', debit: 0, credit: reais(rent), memo: `Aluguel recebido na compensação • ${stall.name}` });
    }
    if (Math.abs(Math.abs(net) - cents(row.amount)) > 0) throw new Error('O repasse não fechou. Nenhum lançamento foi concluído.');
    sales.forEach(s => { s.settledAt = when; });
    next.charges.forEach(c => {
      if (row.chargeIds.includes(c.id)) {
        c.status = 'pago';
        c.paidAt = when;
        c.payMethod = 'repasse';
      }
    });
    audit(next, `Repasse de ${month} lançado para ${stall.name}.`, when);
    return next;
  }

  function accountBalance(state, account, month) {
    return state.ledger.reduce((acc, line) => {
      if (line.account !== account) return acc;
      if (month && ymOf(line.at) !== month) return acc;
      return acc + cents(line.credit) - cents(line.debit);
    }, 0);
  }

  function dre(state, month) {
    const revenueAccounts = ['receita_taxa', 'receita_aluguel', 'receita_outras'];
    const expenseAccounts = Object.values(EXPENSE_ACCOUNTS).concat(['quebra_caixa']);
    const lines = [];
    revenueAccounts.forEach(account => {
      const value = accountBalance(state, account, month);
      lines.push({ account, label: ACCOUNT_LABELS[account], nature: 'receita', amount: reais(value) });
    });
    expenseAccounts.forEach(account => {
      const value = -accountBalance(state, account, month);
      lines.push({ account, label: ACCOUNT_LABELS[account], nature: 'despesa', amount: reais(value) });
    });
    const revenue = lines.filter(l => l.nature === 'receita').reduce((acc, l) => acc + cents(l.amount), 0);
    const expense = lines.filter(l => l.nature === 'despesa').reduce((acc, l) => acc + cents(l.amount), 0);
    const sales = activeSales(state, month);
    return {
      month,
      lines,
      revenue: reais(revenue),
      expense: reais(expense),
      result: reais(revenue - expense),
      grossSales: sum(sales, 'total'),
      cardFeesOnStalls: sum(sales, 'cardFee'),
      tickets: sales.length,
      averageTicket: sales.length ? reais(Math.round(sumCents(sales, 'total') / sales.length)) : 0
    };
  }

  function booksBalanced(state) {
    const delta = state.ledger.reduce((acc, line) => acc + cents(line.debit) - cents(line.credit), 0);
    return delta === 0;
  }

  function dashboard(state, at) {
    const when = at || new Date().toISOString();
    const today = dayOf(when);
    const month = ymOf(when);
    const todaySales = activeSales(state, null).filter(s => dayOf(s.at) === today);
    const monthSales = activeSales(state, month);
    const report = dre(state, month);
    const occupied = state.stalls.filter(s => s.status === 'ativo').length;
    const session = openSession(state);
    const pendingRent = state.charges.filter(c => c.status === 'aberto').reduce((acc, c) => acc + cents(c.amount), 0);
    const pendingPay = state.bills.filter(b => b.status === 'aberto' && b.direction === 'pagar').reduce((acc, b) => acc + cents(b.amount), 0);
    return {
      todayGross: sum(todaySales, 'total'),
      todayAdmin: sum(todaySales, 'adminFee'),
      todayTickets: todaySales.length,
      monthGross: sum(monthSales, 'total'),
      monthResult: report.result,
      occupied,
      boxes: Number(state.park.boxes) || 0,
      cashOpen: !!session,
      pendingRent: reais(pendingRent),
      pendingPay: reais(pendingPay),
      averageTicket: todaySales.length ? reais(Math.round(sumCents(todaySales, 'total') / todaySales.length)) : 0
    };
  }

  function csv(rows) {
    const esc = value => {
      const text = value == null ? '' : String(value);
      if (/[;"\n]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
      return text;
    };
    return rows.map(row => row.map(esc).join(';')).join('\r\n');
  }

  function moneyCsv(value) {
    return reais(cents(value)).toFixed(2).replace('.', ',');
  }

  function exportBundle(state, month) {
    const report = dre(state, month);
    const vendas = [['pedido', 'data', 'box', 'lojista', 'pagamento', 'bruto', 'desconto', 'total', 'taxa_cartao', 'taxa_admin', 'liquido_lojista', 'quem_recebe', 'status', 'cliente', 'comanda']];
    state.sales.filter(s => !month || ymOf(s.at) === month).forEach(sale => {
      const stall = stallById(state, sale.stallId);
      vendas.push([
        pad(sale.number, 4), sale.at, stall ? pad(stall.box, 2) : '', stall ? stall.name : '',
        sale.method, moneyCsv(sale.gross), moneyCsv(sale.discount), moneyCsv(sale.total),
        moneyCsv(sale.cardFee), moneyCsv(sale.adminFee), moneyCsv(sale.netStall),
        sale.holder, sale.status, sale.customer, sale.table
      ]);
    });
    const lancamentos = [['data', 'conta', 'historico', 'debito', 'credito', 'origem', 'lojista']];
    state.ledger.filter(line => !month || ymOf(line.at) === month).forEach(line => {
      const stall = stallById(state, line.stallId);
      lancamentos.push([
        line.at, ACCOUNT_LABELS[line.account] || line.account, line.memo,
        moneyCsv(line.debit), moneyCsv(line.credit), line.refType, stall ? stall.name : ''
      ]);
    });
    const dreRows = [['conta', 'natureza', 'valor']].concat(report.lines.map(line => [line.label, line.nature, moneyCsv(line.amount)]), [['Resultado do food park', 'resultado', moneyCsv(report.result)]]);
    const repasses = [['box', 'lojista', 'vendas', 'faturamento', 'taxa_cartao', 'taxa_admin', 'aluguel_aberto', 'sentido', 'valor']];
    settlement(state, month).forEach(row => {
      repasses.push([pad(row.box, 2), row.name, row.sales, moneyCsv(row.gross), moneyCsv(row.cardFee), moneyCsv(row.adminFee), moneyCsv(row.rentOpen), row.direction, moneyCsv(row.amount)]);
    });
    return {
      vendas: csv(vendas),
      lancamentos: csv(lancamentos),
      dre: csv(dreRows),
      repasses: csv(repasses)
    };
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function demo(now) {
    const clock = now ? new Date(now) : new Date();
    const iso = clock.toISOString();
    let state = blank({
      name: 'Food Park',
      city: '',
      cnpj: '',
      boxes: 8,
      adminFeePercent: 10
    });
    state.mode = 'demo';
    state.park.name = 'Food Park Central';
    state.park.city = 'A definir com a proprietária';
    const catalog = [
      ['Brasa & Burger', 'Marina Alves', '12.345.678/0001-90', 4200, [['Smash burger', 36], ['Batata rústica', 18], ['Milk-shake', 16], ['Combo brasa', 52]]],
      ['Forno da Praça', 'Ricardo Lima', '23.456.789/0001-01', 4500, [['Pizza média', 48], ['Fatia', 14], ['Calzone', 32], ['Refrigerante', 8]]],
      ['Açaí do Parque', 'Helena Dias', '34.567.890/0001-12', 2800, [['Açaí 500 ml', 24], ['Açaí 700 ml', 32], ['Tigela fitness', 28], ['Água de coco', 9]]],
      ['Yakisoba House', 'Kenji Sato', '45.678.901/0001-23', 3900, [['Yakisoba frango', 34], ['Yakisoba misto', 39], ['Guioza', 22], ['Chá gelado', 8]]],
      ['Doce Ponto', 'Camila Rocha', '56.789.012/0001-34', 2600, [['Churros', 16], ['Brownie', 14], ['Café', 8], ['Combo doce', 26]]]
    ];
    catalog.forEach((row, index) => {
      state = createStall(state, {
        box: index + 1,
        name: row[0],
        owner: row[1],
        document: row[2],
        phone: '8599000000' + index,
        rent: row[3],
        feePercent: 10
      }, iso.slice(0, 8) + '01T12:00:00.000Z');
      const stall = state.stalls[state.stalls.length - 1];
      row[4].forEach(product => {
        state = addProduct(state, stall.id, { name: product[0], price: product[1], category: 'Cardápio', stock: null });
      });
    });
    state.charges.slice(0, 4).forEach(charge => {
      state = payCharge(state, charge.id, 'pix', iso.slice(0, 8) + '08T15:00:00.000Z');
    });
    state = addBill(state, { direction: 'pagar', description: 'Energia das áreas comuns', category: 'energia', amount: 4180, due: iso.slice(0, 8) + '12' }, iso.slice(0, 8) + '05T12:00:00.000Z');
    state = addBill(state, { direction: 'pagar', description: 'Água e esgoto', category: 'agua', amount: 960, due: iso.slice(0, 8) + '12' }, iso.slice(0, 8) + '05T12:10:00.000Z');
    state = addBill(state, { direction: 'pagar', description: 'Divulgação de inauguração', category: 'marketing', amount: 1500, due: iso.slice(0, 8) + '20' }, iso.slice(0, 8) + '06T12:00:00.000Z');
    state = addBill(state, { direction: 'pagar', description: 'Manutenção da praça de alimentação', category: 'manutencao', amount: 740, due: iso.slice(0, 8) + '18' }, iso.slice(0, 8) + '09T12:00:00.000Z');
    const openBills = state.bills.filter(b => b.status === 'aberto');
    state = payBill(state, openBills[0].id, 'pix', iso.slice(0, 8) + '12T16:00:00.000Z');
    state = payBill(state, openBills[1].id, 'pix', iso.slice(0, 8) + '12T16:05:00.000Z');
    state = payBill(state, state.bills.find(b => b.description.startsWith('Manutenção')).id, 'pix', iso.slice(0, 8) + '14T11:00:00.000Z');

    state = openCash(state, { openingFloat: 300 }, dayOf(iso) + 'T11:00:00.000Z');
    const rand = mulberry32(20261016);
    const methods = ['pix', 'pix', 'credito', 'debito', 'dinheiro', 'pix', 'voucher'];
    const customers = ['Ana', 'Bruno', 'Carla', 'Diego', 'Fernanda', 'Gustavo', 'Helena', 'Igor', 'Julia', 'Balcão'];
    for (let day = 1; day <= clock.getUTCDate(); day += 1) {
      const count = day === clock.getUTCDate() ? 28 : 16 + Math.floor(rand() * 8);
      for (let n = 0; n < count; n += 1) {
        const stall = state.stalls[Math.floor(rand() * state.stalls.length)];
        const product = stall.products[Math.floor(rand() * stall.products.length)];
        const extra = stall.products[Math.floor(rand() * stall.products.length)];
        const items = [{ productId: product.id, qty: 1 + Math.floor(rand() * 2) }];
        if (extra && extra.id !== product.id) items.push({ productId: extra.id, qty: 1 });
        const hour = 12 + Math.floor(rand() * 8);
        const minute = Math.floor(rand() * 60);
        const at = `${iso.slice(0, 8)}${pad(day, 2)}T${pad(hour, 2)}:${pad(minute, 2)}:00.000Z`;
        const result = commitSale(state, {
          stallId: stall.id,
          method: methods[Math.floor(rand() * methods.length)],
          items,
          customer: customers[Math.floor(rand() * customers.length)],
          table: String(1 + Math.floor(rand() * 24))
        }, at);
        state = result.state;
      }
    }
    state.audit.unshift({ id: 'a-demo', at: iso, message: 'Operação de demonstração carregada para apresentação.' });
    return state;
  }

  return {
    METHODS,
    ACCOUNT_LABELS,
    EXPENSE_ACCOUNTS,
    cents,
    reais,
    round2,
    blank,
    demo,
    createStall,
    addProduct,
    setProductActive,
    ensureMonthlyRents,
    payCharge,
    addBill,
    payBill,
    openCash,
    cashMove,
    closeCash,
    quoteSale,
    commitSale,
    cancelSale,
    settlement,
    registerSettlement,
    dre,
    dashboard,
    expectedByMethod,
    sessionSales,
    openSession,
    booksBalanced,
    exportBundle,
    cashAccount,
    ymOf,
    dayOf,
    pad
  };
});
