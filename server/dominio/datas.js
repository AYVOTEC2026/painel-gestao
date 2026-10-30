'use strict';

/*
 * Datas como texto na hora local do complexo: "2026-10-28" e "2026-10-28T14:30:00".
 * Para fazer conta, cada texto é lido como se fosse UTC; como os dois lados da conta
 * usam a mesma regra, a diferença sai certa sem depender do fuso do servidor.
 */

const comoUtc = t => new Date(String(t).length <= 10 ? `${t}T00:00:00Z` : `${String(t).slice(0, 19)}Z`);
const pad = n => String(n).padStart(2, '0');

const diaDe = t => String(t).slice(0, 10);
const mesDe = t => String(t).slice(0, 7);
const horaDe = t => String(t).slice(11, 16);

function somarDias(dia, n) {
  const d = comoUtc(diaDe(dia));
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function somarMeses(mes, n) {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

function somarMinutos(momento, n) {
  const d = comoUtc(momento);
  d.setUTCMinutes(d.getUTCMinutes() + n);
  return d.toISOString().slice(0, 19);
}

const ultimoDiaDoMes = mes => {
  const [a, m] = mes.split('-').map(Number);
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
};

/** Dia `dia` do mês, ou o último dia quando o mês é mais curto (vencimento dia 31 em fevereiro). */
const diaNoMes = (mes, dia) => `${mes}-${pad(Math.min(Number(dia), ultimoDiaDoMes(mes)))}`;

const minutosEntre = (de, ate) => Math.floor((comoUtc(ate) - comoUtc(de)) / 60000);
const diasEntre = (de, ate) => Math.round((comoUtc(diaDe(ate)) - comoUtc(diaDe(de))) / 86400000);

/** "14:30" -> 870 */
const paraMinutos = hhmm => {
  const [h, m] = String(hhmm).slice(0, 5).split(':').map(Number);
  return h * 60 + m;
};
const deMinutos = n => `${pad(Math.floor(n / 60))}:${pad(n % 60)}`;

/** 0 = domingo ... 6 = sábado */
const diaDaSemana = dia => comoUtc(diaDe(dia)).getUTCDay();

const dataValida = t => /^\d{4}-\d{2}-\d{2}$/.test(String(t)) && !Number.isNaN(comoUtc(t).getTime());
const mesValido = t => /^\d{4}-(0[1-9]|1[0-2])$/.test(String(t));
const horaValida = t => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(t).slice(0, 5));

module.exports = {
  pad, diaDe, mesDe, horaDe, somarDias, somarMeses, somarMinutos, ultimoDiaDoMes, diaNoMes,
  minutosEntre, diasEntre, paraMinutos, deMinutos, diaDaSemana, dataValida, mesValido, horaValida
};
