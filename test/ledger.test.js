const assert = require('assert');
const L = require('../server/dominio/ledger');

function balanced(state) {
  assert.strictEqual(L.booksBalanced(state), true, 'livros contábeis desbalanceados');
}

const empty = L.blank({ name: 'Novo Food Park', boxes: 6, adminFeePercent: 10, city: 'Fortaleza' });
assert.strictEqual(empty.stalls.length, 0);
assert.strictEqual(L.dashboard(empty, '2026-10-16T18:00:00.000Z').todayGross, 0);
assert.strictEqual(L.dre(empty, '2026-10').result, 0);
balanced(empty);

let state = L.createStall(empty, {
  box: 1, name: 'Brasa & Burger', owner: 'Marina', rent: 1000, feePercent: 10, document: '00'
}, '2026-10-02T12:00:00.000Z');
state = L.addProduct(state, state.stalls[0].id, { name: 'Smash', price: 36, category: 'Lanche' });
state = L.addProduct(state, state.stalls[0].id, { name: 'Batata', price: 10, category: 'Lanche', stock: 2 });
const stallId = state.stalls[0].id;
const smash = state.stalls[0].products[0].id;
const fries = state.stalls[0].products[1].id;
balanced(state);
assert.strictEqual(L.dre(state, '2026-10').revenue, 1000);

assert.throws(() => L.commitSale(state, {
  stallId, method: 'pix', items: [{ productId: smash, qty: 1 }]
}), /caixa/i);

state = L.openCash(state, { openingFloat: 100 }, '2026-10-16T11:00:00.000Z');
const cashSale = L.commitSale(state, {
  stallId, method: 'dinheiro', items: [{ productId: smash, qty: 1 }], customer: 'Ana', table: '4'
}, '2026-10-16T12:00:00.000Z');
state = cashSale.state;
assert.strictEqual(cashSale.sale.adminFee, 3.6);
assert.strictEqual(cashSale.sale.cardFee, 0);
assert.strictEqual(cashSale.sale.holder, 'lojista');
assert.strictEqual(cashSale.sale.netStall, 32.4);

const card = L.commitSale(state, {
  stallId, method: 'credito', items: [{ productId: smash, qty: 1 }, { productId: fries, qty: 1 }]
}, '2026-10-16T13:00:00.000Z');
state = card.state;
const cardFee = L.cents(46) * 349 / 10000;
assert.strictEqual(card.sale.total, 46);
assert.strictEqual(card.sale.cardFee, L.reais(Math.round(cardFee)));
assert.strictEqual(card.sale.adminFee, 4.6);
assert.strictEqual(card.sale.holder, 'administracao');
assert.strictEqual(L.cents(card.sale.netStall) + L.cents(card.sale.cardFee) + L.cents(card.sale.adminFee), L.cents(card.sale.total));
assert.strictEqual(state.stalls[0].products[1].stock, 1);
balanced(state);

state = L.cancelSale(state, cashSale.sale.id, 'Pedido lançado no box errado', '2026-10-16T13:10:00.000Z');
assert.strictEqual(state.sales.find(s => s.id === cashSale.sale.id).status, 'cancelada');
balanced(state);

const again = L.commitSale(state, {
  stallId, method: 'pix', items: [{ productId: fries, qty: 1 }]
}, '2026-10-16T13:20:00.000Z');
assert.throws(() => L.commitSale(state, {
  stallId, method: 'pix', items: [{ productId: fries, qty: 2 }]
}), /estoque/i);
state = again.state;
assert.strictEqual(state.stalls[0].products[1].stock, 0);
balanced(state);

const report = L.dre(state, '2026-10');
assert.ok(report.revenue > 1000);
assert.strictEqual(report.grossSales, L.round2(card.sale.total + again.sale.total));

const beforeRent = L.settlement(state, '2026-10').find(r => r.stallId === stallId);
assert.strictEqual(beforeRent.direction, 'receber_lojista');
assert.ok(beforeRent.rentOpen === 1000);
state = L.payCharge(state, state.charges[0].id, 'pix', '2026-10-16T17:00:00.000Z');
const row = L.settlement(state, '2026-10').find(r => r.stallId === stallId);
assert.strictEqual(row.direction, 'pagar_lojista');
state = L.registerSettlement(state, stallId, '2026-10', 'pix', '2026-10-16T18:00:00.000Z');
balanced(state);
assert.strictEqual(L.settlement(state, '2026-10').find(r => r.stallId === stallId).direction, 'zerado');
assert.ok(state.charges.every(c => c.status === 'pago'));

state = L.addBill(state, { direction: 'pagar', description: 'Energia', category: 'energia', amount: 200, due: '2026-10-20' }, '2026-10-16T18:10:00.000Z');
balanced(state);
const before = L.dre(state, '2026-10').result;
state = L.payBill(state, state.bills[0].id, 'pix', '2026-10-16T18:20:00.000Z');
assert.strictEqual(L.dre(state, '2026-10').result, before);
balanced(state);

state = L.closeCash(state, { counted: Object.assign({}, L.expectedByMethod(L.sessionSales(state, L.openSession(state).id)), { pix: 0 }) }, '2026-10-16T22:00:00.000Z');
balanced(state);
assert.ok(state.sessions[0].difference !== 0);

const demo = L.demo('2026-10-16T18:00:00.000Z');
balanced(demo);
assert.strictEqual(demo.stalls.length, 5);
assert.ok(demo.sales.length > 20);
assert.strictEqual(L.openSession(demo).status, 'aberto');
const demoDre = L.dre(demo, '2026-10');
assert.ok(demoDre.revenue > 0);
assert.ok(demoDre.grossSales > 0);
assert.ok(demo.sales.filter(s => s.holder === 'administracao').length > 0);
assert.ok(demo.sales.filter(s => s.holder === 'lojista').length > 0);
const demoRow = L.settlement(demo, '2026-10').find(r => r.direction !== 'zerado');
assert.ok(demoRow, 'demonstração precisa ter repasse em aberto');
const settledDemo = L.registerSettlement(demo, demoRow.stallId, '2026-10', 'pix', '2026-10-16T21:00:00.000Z');
balanced(settledDemo);
const bundle = L.exportBundle(demo, '2026-10');
assert.ok(bundle.vendas.includes('pedido'));
assert.ok(bundle.lancamentos.includes('Taxa de administração') || bundle.lancamentos.includes('Receita de taxa'));
assert.ok(bundle.repasses.split('\n').length > 2);

const fresh = L.blank({ boxes: 8, adminFeePercent: 12 });
assert.throws(() => L.createStall(fresh, { box: 9, name: 'Fora', rent: 0 }), /box/i);

console.log('foodpark-ledger: ok');
console.log(JSON.stringify({
  vendas: demo.sales.length,
  receitaParque: demoDre.revenue,
  resultado: demoDre.result,
  faturamentoBoxes: demoDre.grossSales
}));
