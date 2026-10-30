'use strict';

const crypto = require('crypto');
const { inserir, atualizar } = require('../persistencia/banco');
const C = require('../dominio/contabil');
const D = require('../dominio/datas');
const R = require('../dominio/regras');
const { texto, textoObrigatorio, valorEmCentavos, inteiro, data, formatar, ErroUsuario } = require('./contexto');

const dm = dia => dia.split('-').reverse().slice(0, 2).join('/');

async function quadraAtiva(ctx, id) {
  const r = await ctx.tx.query('select * from quadras where parque_id = $1 and id = $2', [ctx.parqueId, Number(id)]);
  const q = r.rows[0];
  if (!q || !q.ativa) throw new ErroUsuario('Escolha uma quadra.');
  return q;
}

async function exigirHorarioLivre(ctx, quadra, dia, horario, ignorarId) {
  const r = await ctx.tx.query(
    "select id, inicio, fim, cliente from reservas where quadra_id = $1 and data = $2 and status <> 'cancelada' and id <> $3",
    [quadra.id, dia, ignorarId || 0]
  );
  const choque = r.rows.find(x => R.sobrepoe(horario, { inicio: x.inicio.slice(0, 5), fim: x.fim.slice(0, 5) }));
  if (choque) {
    throw new ErroUsuario(`A ${quadra.nome} já está reservada em ${dm(dia)} das ${choque.inicio.slice(0, 5)} às ${choque.fim.slice(0, 5)} (${choque.cliente}).`);
  }
}

async function pagarReserva(ctx, reserva, forma) {
  const r = await ctx.tx.query('select nome from quadras where id = $1', [reserva.quadra_id]);
  const { taxa, caixaId } = await ctx.receber({
    area: 'quadras', origem: 'reserva', id: reserva.id,
    descricao: `${r.rows[0].nome}: ${reserva.cliente} em ${dm(reserva.data)} às ${String(reserva.inicio).slice(0, 5)}`,
    valor: Number(reserva.valor), forma, creditos: [{ conta: 'receita_quadras', valor: Number(reserva.valor) }]
  });
  await atualizar(ctx.tx, 'reservas', reserva.id, { status: 'paga', pago_em: ctx.agora, forma, taxa, caixa_id: caixaId });
}

const ACOES = {
  'nova-reserva': {
    papeis: ['dono', 'recepcao'],
    async executar(ctx, d) {
      const quadra = await quadraAtiva(ctx, d.quadraId);
      const dia = data(d.data, 'a data');
      const horario = R.validarHorario({ inicio: d.inicio, duracao: d.duracao, horario: ctx.config.horario });
      const cliente = textoObrigatorio(d.cliente, 'o nome de quem reservou');
      const valor = d.valor === '' || d.valor == null
        ? R.valorDaReserva(Number(quadra.preco_hora), horario.minutos)
        : valorEmCentavos(d.valor, 'o valor', { zeroOk: true });
      const semanas = inteiro(d.semanas, 'quantas semanas', { min: 1, max: 26, vazio: 1 });
      const datas = R.datasSemanais(dia, semanas);
      if (dia < ctx.hoje) throw new ErroUsuario('Escolha uma data a partir de hoje.');
      for (const x of datas) await exigirHorarioLivre(ctx, quadra, x, horario);
      const grupo = datas.length > 1 ? crypto.randomBytes(6).toString('hex') : null;
      const criadas = [];
      for (const x of datas) {
        criadas.push(await inserir(ctx.tx, 'reservas', {
          parque_id: ctx.parqueId, quadra_id: quadra.id, data: x, inicio: horario.inicio, fim: horario.fim,
          cliente, telefone: texto(d.telefone, 30), valor, grupo, criado_em: ctx.agora, criado_por: ctx.quem
        }));
      }
      if (d.pagarAgora) {
        C.exigirForma(d.forma);
        await pagarReserva(ctx, criadas[0], d.forma);
      }
      const repete = datas.length > 1 ? `, toda semana por ${datas.length} semanas` : '';
      return {
        resumo: `Reservou a ${quadra.nome} para ${cliente} em ${dm(dia)} das ${horario.inicio} às ${horario.fim} (${formatar(valor)})${repete}.`,
        resultado: { reservaId: criadas[0].id, quantidade: criadas.length }
      };
    }
  },

  'pagar-reserva': {
    papeis: ['dono', 'recepcao'],
    async executar(ctx, d) {
      const r = await ctx.tx.query('select * from reservas where parque_id = $1 and id = $2', [ctx.parqueId, Number(d.reservaId)]);
      const reserva = r.rows[0];
      if (!reserva) throw new ErroUsuario('Reserva não encontrada.');
      if (reserva.status !== 'reservada') throw new ErroUsuario(reserva.status === 'paga' ? 'Essa reserva já foi paga.' : 'Essa reserva foi cancelada.');
      C.exigirForma(d.forma);
      await pagarReserva(ctx, reserva, d.forma);
      return { resumo: `Recebeu ${formatar(reserva.valor)} da reserva de ${reserva.cliente} em ${dm(reserva.data)} (${C.formaPorId(d.forma).nome}).` };
    }
  },

  'cancelar-reserva': {
    papeis: ['dono', 'recepcao'],
    async executar(ctx, d) {
      const r = await ctx.tx.query('select * from reservas where parque_id = $1 and id = $2', [ctx.parqueId, Number(d.reservaId)]);
      const reserva = r.rows[0];
      if (!reserva) throw new ErroUsuario('Reserva não encontrada.');
      if (reserva.status === 'cancelada') throw new ErroUsuario('Essa reserva já foi cancelada.');
      const motivo = texto(d.motivo, 300) || 'Cancelada a pedido do cliente';
      let alvo = [reserva];
      if (d.todasDoGrupo && reserva.grupo) {
        const g = await ctx.tx.query(
          "select * from reservas where parque_id = $1 and grupo = $2 and data >= $3 and status <> 'cancelada' order by data",
          [ctx.parqueId, reserva.grupo, reserva.data]
        );
        alvo = g.rows;
      }
      let devolvido = 0;
      for (const x of alvo) {
        if (x.status === 'paga') {
          if (ctx.usuario.papel !== 'dono') throw new ErroUsuario('Reserva já paga: só a gestão cancela e devolve o valor.', 403);
          await ctx.estornar('reserva', x.id, `reserva de ${x.cliente} em ${dm(x.data)}`);
          devolvido += Number(x.valor);
        }
        await atualizar(ctx.tx, 'reservas', x.id, { status: 'cancelada', motivo });
      }
      const qtd = alvo.length > 1 ? `${alvo.length} reservas de ${reserva.cliente}` : `a reserva de ${reserva.cliente} em ${dm(reserva.data)}`;
      return { resumo: `Cancelou ${qtd}${devolvido ? ` e devolveu ${formatar(devolvido)}` : ''}. Motivo: ${motivo}.` };
    }
  }
};

module.exports = { ACOES, pagarReserva };
