'use strict';

/*
 * Regras de cada área que não dependem do banco: tempo do parque, agenda das
 * quadras e vencimento dos aluguéis. Testadas isoladamente em test/regras.test.js.
 */

const D = require('./datas');

/* -------------------------------------------------------- parque infantil */

/**
 * Quanto cobrar a mais na saída. Dentro da tolerância não cobra; passou dela,
 * cobra cada bloco (ex.: 15 min) começado, contando desde o fim do plano.
 */
function excedenteDoParque({ entrada, agora, minutos, tolerancia = 0, bloco = 15, valorBloco = 0 }) {
  const decorridos = Math.max(0, D.minutosEntre(entrada, agora));
  if (minutos == null) return { decorridos, excedidos: 0, blocos: 0, valor: 0 };
  const excedidos = Math.max(0, decorridos - minutos);
  if (excedidos <= tolerancia || !(bloco > 0)) return { decorridos, excedidos, blocos: 0, valor: 0 };
  const blocos = Math.ceil(excedidos / bloco);
  return { decorridos, excedidos, blocos, valor: blocos * valorBloco };
}

/** Situação do tempo de uma criança: no tempo, acabando ou passou. */
function situacaoDoTempo({ entrada, agora, minutos, alerta = 10 }) {
  const decorridos = Math.max(0, D.minutosEntre(entrada, agora));
  if (minutos == null) return { decorridos, restantes: null, situacao: 'livre' };
  const restantes = minutos - decorridos;
  return { decorridos, restantes, situacao: restantes < 0 ? 'passou' : restantes <= alerta ? 'acabando' : 'no_tempo' };
}

/* ---------------------------------------------------------------- quadras */

/** Fim do expediente em minutos; "00:00" ou "24:00" significam meia-noite. */
const fimDoDia = fecha => {
  const m = D.paraMinutos(fecha);
  return m === 0 ? 24 * 60 : m;
};

function validarHorario({ inicio, duracao, horario }) {
  if (!D.horaValida(inicio)) throw new Error('Informe o horário de início.');
  const ini = D.paraMinutos(inicio);
  const dur = Math.floor(Number(duracao));
  if (!(dur >= 30 && dur <= 360)) throw new Error('A reserva precisa durar entre 30 minutos e 6 horas.');
  const fim = ini + dur;
  const abre = D.paraMinutos(horario.abre);
  const fecha = fimDoDia(horario.fecha);
  if (ini < abre || fim > fecha) throw new Error(`As quadras funcionam das ${horario.abre} às ${horario.fecha}.`);
  return { inicio: D.deMinutos(ini), fim: D.deMinutos(fim), minutos: dur };
}

/** Duas reservas da mesma quadra no mesmo dia se sobrepõem? */
const sobrepoe = (a, b) => D.paraMinutos(a.inicio) < D.paraMinutos(b.fim) && D.paraMinutos(b.inicio) < D.paraMinutos(a.fim);

/** Valor da reserva pelo preço por hora, proporcional à duração. */
const valorDaReserva = (precoHora, minutos) => Math.round(precoHora * minutos / 60);

/** Datas de um grupo fixo: a mesma hora toda semana por N semanas. */
const datasSemanais = (data, semanas) => Array.from({ length: Math.max(1, Math.min(26, Math.floor(semanas) || 1)) }, (_, i) => D.somarDias(data, i * 7));

/* -------------------------------------------------------------- locações */

/** O contrato vale em algum dia deste mês? */
function contratoVigenteNoMes(contrato, mes) {
  const primeiro = `${mes}-01`;
  const ultimo = D.diaNoMes(mes, 31);
  return contrato.inicio <= ultimo && (!contrato.fim || contrato.fim >= primeiro);
}

/** Situação de uma cobrança em aberto: a vencer, vence hoje ou vencida (inadimplente). */
function situacaoDaCobranca(cobranca, hoje) {
  if (cobranca.status === 'paga') return { situacao: 'paga', dias: 0 };
  if (cobranca.status === 'cancelada') return { situacao: 'cancelada', dias: 0 };
  const dias = D.diasEntre(cobranca.vencimento, hoje);
  if (dias > 0) return { situacao: 'vencida', dias };
  if (dias === 0) return { situacao: 'vence_hoje', dias: 0 };
  return { situacao: 'a_vencer', dias: -dias };
}

module.exports = {
  excedenteDoParque, situacaoDoTempo,
  validarHorario, sobrepoe, valorDaReserva, datasSemanais, fimDoDia,
  contratoVigenteNoMes, situacaoDaCobranca
};
