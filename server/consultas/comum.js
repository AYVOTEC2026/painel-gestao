'use strict';

const C = require('../dominio/contabil');
const D = require('../dominio/datas');

/** Centavos -> reais para a tela. */
const r = c => Math.round(Number(c) || 0) / 100;
const hhmm = t => (t == null ? null : String(t).slice(0, 5));
const formas = () => C.FORMAS.map(f => ({ id: f.id, nome: f.nome }));

/** Somas do livro por conta num mês (ou até o fim de um mês, para saldos). */
async function somasDoLivro(db, parqueId, { mes, ate }) {
  const filtro = mes ? 'mes = $2' : 'mes <= $2';
  const q = await db.query(
    `select conta, sum(debito) as debito, sum(credito) as credito from lancamentos where parque_id = $1 and ${filtro} group by conta`,
    [parqueId, mes || ate]
  );
  return q.rows;
}

async function dreDoMes(db, parqueId, mes) {
  const d = C.dre(await somasDoLivro(db, parqueId, { mes }));
  const conv = l => ({ ...l, valor: r(l.valor) });
  return {
    receitas: d.receitas.map(conv),
    despesas: d.despesas.map(conv),
    porArea: d.porArea.map(conv),
    totalReceitas: r(d.totalReceitas),
    totalDespesas: r(d.totalDespesas),
    resultado: r(d.resultado)
  };
}

async function caixaAberto(db, parqueId) {
  const q = await db.query('select id, aberto_em, aberto_por, fundo from caixas where parque_id = $1 and fechado_em is null', [parqueId]);
  const c = q.rows[0];
  return c ? { id: c.id, abertoEm: c.aberto_em, abertoPor: c.aberto_por, fundo: r(c.fundo) } : null;
}

const intervaloDoMes = mes => [`${mes}-01`, `${D.somarMeses(mes, 1)}-01`];

module.exports = { r, hhmm, formas, somasDoLivro, dreDoMes, caixaAberto, intervaloDoMes };
