'use strict';

const test = require('node:test');
const assert = require('node:assert');
const R = require('../server/dominio/regras');
const C = require('../server/dominio/contabil');
const D = require('../server/dominio/datas');
const { centavos } = require('../server/dominio/dinheiro');

test('valores digitados viram centavos sem erro de arredondamento', () => {
  assert.strictEqual(centavos('1.234,56'), 123456);
  assert.strictEqual(centavos('1234,5'), 123450);
  assert.strictEqual(centavos('1234.56'), 123456);
  assert.strictEqual(centavos('R$ 50'), 5000);
  assert.strictEqual(centavos('1.500'), 150000);
  assert.strictEqual(centavos(0.1 + 0.2), 30);
  assert.ok(Number.isNaN(centavos('abc')));
});

test('parque: tolerância, blocos de excedente e dia livre', () => {
  const base = { entrada: '2026-10-28T14:00:00', minutos: 60, tolerancia: 5, bloco: 15, valorBloco: 500 };
  assert.strictEqual(R.excedenteDoParque({ ...base, agora: '2026-10-28T15:04:00' }).valor, 0, 'dentro da tolerância');
  assert.deepStrictEqual(R.excedenteDoParque({ ...base, agora: '2026-10-28T15:20:00' }), { decorridos: 80, excedidos: 20, blocos: 2, valor: 1000 });
  assert.strictEqual(R.excedenteDoParque({ ...base, minutos: null, agora: '2026-10-28T20:00:00' }).valor, 0, 'dia livre não tem excedente');
  assert.strictEqual(R.situacaoDoTempo({ ...base, agora: '2026-10-28T14:52:00', alerta: 10 }).situacao, 'acabando');
  assert.strictEqual(R.situacaoDoTempo({ ...base, agora: '2026-10-28T15:01:00' }).situacao, 'passou');
  assert.strictEqual(R.situacaoDoTempo({ ...base, agora: '2026-10-28T14:10:00' }).restantes, 50);
});

test('quadras: horário de funcionamento, conflito e grupo fixo', () => {
  const horario = { abre: '08:00', fecha: '22:00' };
  assert.deepStrictEqual(R.validarHorario({ inicio: '19:00', duracao: 90, horario }), { inicio: '19:00', fim: '20:30', minutos: 90 });
  assert.throws(() => R.validarHorario({ inicio: '21:30', duracao: 60, horario }), /funcionam/);
  assert.throws(() => R.validarHorario({ inicio: '07:00', duracao: 60, horario }), /funcionam/);
  assert.deepStrictEqual(R.validarHorario({ inicio: '23:00', duracao: 60, horario: { abre: '08:00', fecha: '00:00' } }).fim, '24:00');
  assert.strictEqual(R.sobrepoe({ inicio: '19:00', fim: '20:00' }, { inicio: '19:30', fim: '21:00' }), true);
  assert.strictEqual(R.sobrepoe({ inicio: '19:00', fim: '20:00' }, { inicio: '20:00', fim: '21:00' }), false, 'encostar não é conflito');
  assert.strictEqual(R.valorDaReserva(12000, 90), 18000);
  assert.deepStrictEqual(R.datasSemanais('2026-10-27', 3), ['2026-10-27', '2026-11-03', '2026-11-10']);
});

test('locações: vencimento no mês curto e situação da cobrança', () => {
  assert.strictEqual(D.diaNoMes('2026-02', 31), '2026-02-28');
  assert.strictEqual(D.diaNoMes('2028-02', 30), '2028-02-29');
  const c = { inicio: '2026-03-15', fim: '2026-10-05' };
  assert.strictEqual(R.contratoVigenteNoMes(c, '2026-03'), true);
  assert.strictEqual(R.contratoVigenteNoMes(c, '2026-10'), true);
  assert.strictEqual(R.contratoVigenteNoMes(c, '2026-11'), false);
  assert.strictEqual(R.contratoVigenteNoMes(c, '2026-02'), false);
  assert.deepStrictEqual(R.situacaoDaCobranca({ status: 'aberta', vencimento: '2026-10-10' }, '2026-10-28'), { situacao: 'vencida', dias: 18 });
  assert.deepStrictEqual(R.situacaoDaCobranca({ status: 'aberta', vencimento: '2026-10-28' }, '2026-10-28'), { situacao: 'vence_hoje', dias: 0 });
  assert.deepStrictEqual(R.situacaoDaCobranca({ status: 'aberta', vencimento: '2026-11-05' }, '2026-10-28'), { situacao: 'a_vencer', dias: 8 });
});

test('contabilidade: recebimento no cartão separa a taxa e fecha em débito e crédito', () => {
  const taxa = C.taxaDaForma(10000, 'credito', { credito: 3.49 });
  assert.strictEqual(taxa, 349);
  const linhas = C.conferir(C.recebimento({ valor: 10000, forma: 'credito', taxa, creditos: [{ conta: 'receita_loja', valor: 6000 }, { conta: 'receita_bilheteria', valor: 4000 }], historico: 'Venda' }));
  assert.deepStrictEqual(linhas.map(l => [l.conta, l.debito, l.credito]), [
    ['cartoes', 9651, 0], ['despesa_taxas_cartao', 349, 0], ['receita_loja', 0, 6000], ['receita_bilheteria', 0, 4000]
  ]);
  assert.throws(() => C.conferir([{ conta: 'caixa', debito: 100, credito: 0, historico: 'x' }]), /não fecham/);
  const estorno = C.conferir(C.estorno(linhas));
  assert.strictEqual(estorno.find(l => l.conta === 'receita_loja').debito, 6000);
  const dre = C.dre([{ conta: 'receita_loja', debito: 0, credito: 6000 }, { conta: 'despesa_taxas_cartao', debito: 349, credito: 0 }]);
  assert.strictEqual(dre.totalReceitas, 6000);
  assert.strictEqual(dre.resultado, 5651);
});
