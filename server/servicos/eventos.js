'use strict';

const { inserir, atualizar } = require('../persistencia/banco');
const C = require('../dominio/contabil');
const D = require('../dominio/datas');
const { texto, textoObrigatorio, valorEmCentavos, inteiro, data, formatar, ErroUsuario } = require('./contexto');

const TIPOS = { aniversario: 'Aniversário', confraternizacao: 'Confraternização', corporativo: 'Corporativo', esportivo: 'Esportivo', casamento: 'Casamento', outro: 'Outro' };
const STATUS = { orcamento: 'Orçamento', confirmado: 'Confirmado', realizado: 'Realizado', cancelado: 'Cancelado' };

function lerEvento(ctx, d) {
  const hora = (v, rotulo) => {
    if (v === '' || v == null) return null;
    if (!D.horaValida(v)) throw new ErroUsuario(`Informe ${rotulo}.`);
    return String(v).slice(0, 5);
  };
  const valor = valorEmCentavos(d.valor, 'o valor do evento', { zeroOk: true });
  const sinal = valorEmCentavos(d.sinal, 'o valor do sinal', { zeroOk: true, vazio: 0 });
  if (sinal > valor) throw new ErroUsuario('O sinal não pode ser maior que o valor do evento.');
  return {
    titulo: textoObrigatorio(d.titulo, 'o nome do evento'),
    tipo: TIPOS[d.tipo] ? d.tipo : 'outro',
    contratante: textoObrigatorio(d.contratante, 'quem está contratando'),
    telefone: texto(d.telefone, 30),
    email: texto(d.email, 120),
    data: data(d.data, 'a data do evento'),
    inicio: hora(d.inicio, 'o horário de início'),
    fim: hora(d.fim, 'o horário de término'),
    espaco: texto(d.espaco, 80),
    convidados: inteiro(d.convidados, 'o número de convidados', { min: 0, max: 5000, vazio: null }),
    valor,
    sinal,
    itens: texto(d.itens, 2000),
    observacoes: texto(d.observacoes, 2000)
  };
}

async function eventoDoParque(ctx, id) {
  const r = await ctx.tx.query('select * from eventos where parque_id = $1 and id = $2', [ctx.parqueId, Number(id)]);
  if (!r.rows[0]) throw new ErroUsuario('Evento não encontrado.');
  return r.rows[0];
}

async function totalPago(ctx, eventoId) {
  const r = await ctx.tx.query(
    "select coalesce(sum(case when sentido = 'entrada' then valor else -valor end), 0) as pago from movimentos where origem_tipo = 'evento' and origem_id = $1",
    [eventoId]
  );
  return Number(r.rows[0].pago);
}

async function receberDoEvento(ctx, evento, valor, forma) {
  await ctx.receber({
    area: 'eventos', origem: 'evento', id: evento.id, descricao: `Evento: ${evento.titulo}`,
    valor, forma, creditos: [{ conta: 'receita_eventos', valor }]
  });
}

const ACOES = {
  'novo-evento': {
    papeis: ['dono'],
    async executar(ctx, d) {
      const campos = lerEvento(ctx, d);
      const e = await inserir(ctx.tx, 'eventos', { parque_id: ctx.parqueId, ...campos, criado_em: ctx.agora });
      return { resumo: `Cadastrou o orçamento "${e.titulo}" para ${e.data.split('-').reverse().join('/')} (${formatar(e.valor)}).`, resultado: { eventoId: e.id } };
    }
  },

  'editar-evento': {
    papeis: ['dono'],
    async executar(ctx, d) {
      const e = await eventoDoParque(ctx, d.eventoId);
      if (e.status === 'cancelado') throw new ErroUsuario('Evento cancelado não pode ser alterado.');
      const campos = lerEvento(ctx, d);
      await atualizar(ctx.tx, 'eventos', e.id, campos);
      return { resumo: `Atualizou o evento "${campos.titulo}".` };
    }
  },

  'pagamento-evento': {
    papeis: ['dono'],
    async executar(ctx, d) {
      const e = await eventoDoParque(ctx, d.eventoId);
      if (e.status === 'cancelado') throw new ErroUsuario('Evento cancelado não recebe pagamento.');
      const valor = valorEmCentavos(d.valor, 'o valor recebido');
      const pago = await totalPago(ctx, e.id);
      if (pago + valor > Number(e.valor)) throw new ErroUsuario(`O saldo deste evento é ${formatar(Number(e.valor) - pago)}.`);
      C.exigirForma(d.forma);
      await receberDoEvento(ctx, e, valor, d.forma);
      let extra = '';
      // O primeiro pagamento (normalmente o sinal) confirma a data do evento.
      if (e.status === 'orcamento') {
        await atualizar(ctx.tx, 'eventos', e.id, { status: 'confirmado' });
        extra = ' O evento foi confirmado.';
      }
      return { resumo: `Recebeu ${formatar(valor)} do evento "${e.titulo}" (${C.formaPorId(d.forma).nome}).${extra}` };
    }
  },

  'status-evento': {
    papeis: ['dono'],
    async executar(ctx, d) {
      const e = await eventoDoParque(ctx, d.eventoId);
      const novo = d.status;
      if (!STATUS[novo] || novo === e.status) throw new ErroUsuario('Escolha a nova situação do evento.');
      if (e.status === 'cancelado') throw new ErroUsuario('Evento cancelado não muda mais de situação.');
      const campos = { status: novo };
      let extra = '';
      if (novo === 'cancelado') {
        campos.motivo = texto(d.motivo, 300) || 'Cancelado';
        const devolver = valorEmCentavos(d.devolver, 'o valor a devolver', { zeroOk: true, vazio: 0 });
        const pago = await totalPago(ctx, e.id);
        if (devolver > pago) throw new ErroUsuario(`Só foram pagos ${formatar(pago)} neste evento.`);
        if (devolver > 0) {
          C.exigirForma(d.forma);
          await ctx.pagar({ area: 'eventos', origem: 'evento', id: e.id, descricao: `Devolução: evento ${e.titulo}`, valor: devolver, forma: d.forma, debito: 'receita_eventos' });
          extra = ` e devolveu ${formatar(devolver)}`;
        }
      }
      await atualizar(ctx.tx, 'eventos', e.id, campos);
      return { resumo: `Mudou o evento "${e.titulo}" para ${STATUS[novo].toLowerCase()}${extra}.` };
    }
  }
};

module.exports = { ACOES, TIPOS, STATUS, totalPago };
