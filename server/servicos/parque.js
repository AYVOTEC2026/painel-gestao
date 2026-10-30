'use strict';

const { inserir, atualizar } = require('../persistencia/banco');
const C = require('../dominio/contabil');
const D = require('../dominio/datas');
const { excedenteDoParque } = require('../dominio/regras');
const { texto, textoObrigatorio, inteiro, formatar, ErroUsuario } = require('./contexto');

const TODOS = ['dono', 'recepcao', 'monitor'];

const duracao = minutos => {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return h ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`;
};

/**
 * Vende a pulseira: cadastra a criança e começa a contar o tempo agora.
 * `em` só é usado pela demonstração, para simular quem entrou há alguns minutos.
 */
async function registrarEntrada(ctx, d, { em } = {}) {
  const crianca = textoObrigatorio(d.crianca, 'o nome da criança');
  const responsavel = textoObrigatorio(d.responsavel, 'o nome do responsável');
  const plano = ctx.config.parque.planos.find(p => p.id === d.planoId);
  if (!plano) throw new ErroUsuario('Escolha o tempo da pulseira.');
  C.exigirForma(d.forma);
  const dentro = await ctx.tx.query("select count(*)::int as n from entradas_parque where parque_id = $1 and status = 'dentro'", [ctx.parqueId]);
  const capacidade = ctx.config.parque.capacidade;
  if (dentro.rows[0].n >= capacidade) throw new ErroUsuario(`O parque está lotado: ${capacidade} de ${capacidade} crianças. Aguarde uma saída.`);
  const quando = em || ctx.agora;
  const numero = await ctx.proximoNumero('entradas_parque');
  const entrada = await inserir(ctx.tx, 'entradas_parque', {
    parque_id: ctx.parqueId,
    numero,
    crianca,
    idade: inteiro(d.idade, 'a idade', { min: 0, max: 17, vazio: null }),
    responsavel,
    telefone: texto(d.telefone, 30),
    pulseira: texto(d.pulseira, 20),
    observacoes: texto(d.observacoes, 500),
    plano: plano.nome,
    minutos: plano.minutos,
    valor: plano.preco,
    forma: d.forma,
    entrada: quando,
    atendente: ctx.quem
  });
  const { taxa, caixaId } = await ctx.receber({
    area: 'parque', origem: 'entrada', id: entrada.id, em: quando,
    descricao: `Pulseira ${plano.nome}: ${crianca}`,
    valor: plano.preco, forma: d.forma, creditos: [{ conta: 'receita_parque', valor: plano.preco }]
  });
  await atualizar(ctx.tx, 'entradas_parque', entrada.id, { taxa, caixa_id: caixaId });
  return entrada;
}

/** Registra a saída e, se passou do tempo, recebe o excedente. */
async function registrarSaida(ctx, entrada, { cobrar = true, forma } = {}) {
  const p = ctx.config.parque;
  const calc = excedenteDoParque({
    entrada: entrada.entrada, agora: ctx.agora, minutos: entrada.minutos,
    tolerancia: p.tolerancia, bloco: p.bloco, valorBloco: p.valorBloco
  });
  const valor = cobrar ? calc.valor : 0;
  const campos = { saida: ctx.agora, status: 'saiu', excedente_minutos: calc.excedidos, excedente_valor: valor };
  if (valor > 0) {
    const formaExcedente = forma || entrada.forma;
    const { taxa } = await ctx.receber({
      area: 'parque', origem: 'entrada', id: entrada.id,
      descricao: `Tempo excedente: ${entrada.crianca} (${calc.excedidos} min)`,
      valor, forma: formaExcedente, creditos: [{ conta: 'receita_parque', valor }]
    });
    Object.assign(campos, { excedente_forma: formaExcedente, excedente_taxa: taxa });
  }
  await atualizar(ctx.tx, 'entradas_parque', entrada.id, campos);
  return { ...calc, cobrado: valor };
}

async function entradaAberta(ctx, id) {
  const r = await ctx.tx.query('select * from entradas_parque where parque_id = $1 and id = $2', [ctx.parqueId, Number(id)]);
  const e = r.rows[0];
  if (!e) throw new ErroUsuario('Entrada não encontrada.');
  return e;
}

const ACOES = {
  'entrada-parque': {
    papeis: TODOS,
    async executar(ctx, d) {
      const e = await registrarEntrada(ctx, d);
      return {
        resumo: `Liberou ${e.crianca} no parque (${e.plano}, ${formatar(e.valor)}, ${C.formaPorId(e.forma).nome}).`,
        resultado: { entradaId: e.id, numero: e.numero }
      };
    }
  },

  'saida-parque': {
    papeis: TODOS,
    async executar(ctx, d) {
      const e = await entradaAberta(ctx, d.entradaId);
      if (e.status !== 'dentro') throw new ErroUsuario('Essa criança já saiu do parque.');
      const cobrar = d.cobrar !== false;
      if (cobrar && d.forma) C.exigirForma(d.forma);
      const r = await registrarSaida(ctx, e, { cobrar, forma: d.forma });
      let extra = '';
      if (r.cobrado > 0) extra = `, cobrando ${formatar(r.cobrado)} de tempo excedente`;
      else if (r.valor > 0) extra = `, sem cobrar ${formatar(r.valor)} de tempo excedente`;
      return {
        resumo: `Registrou a saída de ${e.crianca} depois de ${duracao(r.decorridos)}${extra}.`,
        resultado: { decorridos: r.decorridos, excedidos: r.excedidos, valor: r.valor / 100, cobrado: r.cobrado / 100 }
      };
    }
  },

  'cancelar-entrada': {
    papeis: TODOS,
    async executar(ctx, d) {
      const e = await entradaAberta(ctx, d.entradaId);
      if (e.status === 'cancelada') throw new ErroUsuario('Essa entrada já foi cancelada.');
      const caixa = await ctx.caixaAberto();
      if (ctx.usuario.papel !== 'dono' && (e.status !== 'dentro' || !caixa || e.caixa_id !== caixa.id)) {
        throw new ErroUsuario('Só a gestão cancela entradas de caixas anteriores ou de crianças que já saíram.', 403);
      }
      const motivo = texto(d.motivo, 300);
      if (motivo.length < 3) throw new ErroUsuario('Escreva o motivo do cancelamento.');
      await ctx.estornar('entrada', e.id, `pulseira de ${e.crianca}`);
      await atualizar(ctx.tx, 'entradas_parque', e.id, { status: 'cancelada', saida: e.saida || ctx.agora, motivo });
      return { resumo: `Cancelou a pulseira de ${e.crianca} e devolveu ${formatar(Number(e.valor) + Number(e.excedente_valor))}. Motivo: ${motivo}.` };
    }
  }
};

module.exports = { ACOES, registrarEntrada, registrarSaida, duracao };
