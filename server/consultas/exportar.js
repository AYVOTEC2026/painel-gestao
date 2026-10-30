'use strict';

const C = require('../dominio/contabil');
const D = require('../dominio/datas');
const { dreDoMes, intervaloDoMes } = require('./comum');

/* Planilhas do mês para o contador: CSV com ponto e vírgula, que abre no Excel em português. */

const celula = v => {
  const t = v == null ? '' : String(v);
  return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
const csv = linhas => linhas.map(l => l.map(celula).join(';')).join('\r\n');
const valor = c => (Math.round(Number(c) || 0) / 100).toFixed(2).replace('.', ',');
const valorReais = v => (Number(v) || 0).toFixed(2).replace('.', ',');
const dataBr = t => (t ? `${String(t).slice(8, 10)}/${String(t).slice(5, 7)}/${String(t).slice(0, 4)}${String(t).length > 10 ? ' ' + String(t).slice(11, 16) : ''}` : '');

const ARQUIVOS = {
  async lancamentos(db, parqueId, mes) {
    const q = await db.query('select * from lancamentos where parque_id = $1 and mes = $2 order by em, id', [parqueId, mes]);
    return csv([['data', 'conta', 'historico', 'debito', 'credito', 'origem']].concat(
      q.rows.map(l => [dataBr(l.em), (C.CONTAS[l.conta] || {}).nome || l.conta, l.historico, valor(l.debito), valor(l.credito), l.origem_tipo])
    ));
  },
  async dre(db, parqueId, mes) {
    const d = await dreDoMes(db, parqueId, mes);
    return csv([['grupo', 'conta', 'valor']]
      .concat(d.receitas.map(l => ['Receita', l.nome, valorReais(l.valor)]))
      .concat([['Total', 'Receitas', valorReais(d.totalReceitas)]])
      .concat(d.despesas.map(l => ['Despesa', l.nome, valorReais(l.valor)]))
      .concat([['Total', 'Despesas', valorReais(d.totalDespesas)], ['Resultado', mes, valorReais(d.resultado)]]));
  },
  async extrato(db, parqueId, mes) {
    const [ini, fim] = intervaloDoMes(mes);
    const q = await db.query('select * from movimentos where parque_id = $1 and em >= $2 and em < $3 order by em, id', [parqueId, ini, fim]);
    const forma = id => (C.formaPorId(id) || { nome: id }).nome;
    return csv([['data', 'tipo', 'area', 'descricao', 'forma', 'valor', 'taxa_cartao', 'registrado_por']].concat(
      q.rows.map(m => [dataBr(m.em), m.sentido === 'entrada' ? 'Entrada' : 'Saída', m.area, m.descricao, forma(m.forma), valor(m.valor), valor(m.taxa), m.por])
    ));
  },
  async alugueis(db, parqueId, mes) {
    const q = await db.query(
      `select b.*, c.locatario, c.documento, u.numero from cobrancas b join contratos c on c.id = b.contrato_id join unidades u on u.id = c.unidade_id
        where b.parque_id = $1 and b.competencia = $2 and b.status <> 'cancelada' order by u.numero, b.vencimento`,
      [parqueId, mes]
    );
    return csv([['box', 'locatario', 'documento', 'descricao', 'vencimento', 'valor', 'situacao', 'recebido_em', 'valor_recebido']].concat(
      q.rows.map(b => [b.numero, b.locatario, b.documento, b.descricao, dataBr(b.vencimento), valor(b.valor), b.status === 'paga' ? 'Recebido' : 'Em aberto', dataBr(b.pago_em), b.valor_pago == null ? '' : valor(b.valor_pago)])
    ));
  }
};

async function exportar(db, parqueId, arquivo, mes) {
  if (!ARQUIVOS[arquivo] || !D.mesValido(mes)) return null;
  return '﻿' + (await ARQUIVOS[arquivo](db, parqueId, mes));
}

module.exports = { exportar, ARQUIVOS };
