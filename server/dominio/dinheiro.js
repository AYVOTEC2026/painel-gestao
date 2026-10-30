'use strict';

/*
 * Dinheiro circula em centavos inteiros (sem erro de arredondamento) e só vira
 * reais na resposta para a tela.
 */

/**
 * Lê o que a pessoa digitou: "1.234,56", "1234,56", "1234.56", 1234.56 ou "R$ 50".
 * Devolve centavos, ou NaN se não for um valor.
 */
function centavos(valor) {
  if (typeof valor === 'number') return Number.isFinite(valor) ? Math.round(valor * 100) : NaN;
  let t = String(valor == null ? '' : valor).replace(/R\$|\s/g, '');
  if (!t) return NaN;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

const reais = c => Math.round(Number(c) || 0) / 100;

const formato = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const formatar = c => formato.format(reais(c));

/** Percentual de um valor em centavos, arredondado ao centavo. */
const porcentagem = (valorCentavos, percentual) => Math.round(valorCentavos * (Number(percentual) || 0) / 100);

module.exports = { centavos, reais, formatar, porcentagem };
