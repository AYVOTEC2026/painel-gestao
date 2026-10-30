'use strict';

const { inserir, atualizar } = require('../persistencia/banco');
const C = require('../dominio/contabil');
const D = require('../dominio/datas');
const { texto, textoObrigatorio, valorEmCentavos, data, formatar, ErroUsuario } = require('./contexto');

const NOMES_CATEGORIA = {
  energia: 'Energia', agua: 'Água', folha: 'Folha e encargos', manutencao: 'Manutenção', limpeza: 'Limpeza e segurança',
  marketing: 'Marketing', impostos: 'Impostos e taxas', compras: 'Compras de mercadoria', outras: 'Outras'
};

async function criarConta(ctx, d) {
  const sentido = d.sentido === 'receber' ? 'receber' : 'pagar';
  const categoria = sentido === 'pagar' ? (C.CATEGORIAS_DESPESA[d.categoria] ? d.categoria : 'outras') : 'outras';
  const valor = valorEmCentavos(d.valor, 'o valor');
  const vencimento = data(d.vencimento, 'o vencimento');
  const competencia = D.mesValido(d.competencia) ? d.competencia : D.mesDe(vencimento);
  const conta = await inserir(ctx.tx, 'contas', {
    parque_id: ctx.parqueId, sentido, descricao: textoObrigatorio(d.descricao, 'a descrição'), categoria,
    pessoa: texto(d.pessoa, 120), valor, vencimento, competencia, criado_em: ctx.agora, criado_por: ctx.quem
  });
  const linhas = sentido === 'pagar'
    ? C.reconhecimento(C.CATEGORIAS_DESPESA[categoria], 'contas_pagar', valor, conta.descricao)
    : C.reconhecimento('contas_receber', 'receita_outras', valor, conta.descricao);
  await ctx.lancar(linhas, { origem: 'conta', id: conta.id, mes: competencia });
  return conta;
}

async function baixarConta(ctx, conta, forma) {
  C.exigirForma(forma);
  if (conta.sentido === 'pagar') {
    await ctx.pagar({ area: 'despesas', origem: 'conta', id: conta.id, descricao: conta.descricao, valor: Number(conta.valor), forma, debito: 'contas_pagar' });
  } else {
    await ctx.receber({ area: 'outras', origem: 'conta', id: conta.id, descricao: conta.descricao, valor: Number(conta.valor), forma, creditos: [{ conta: 'contas_receber', valor: Number(conta.valor) }] });
  }
  await atualizar(ctx.tx, 'contas', conta.id, { status: 'paga', pago_em: ctx.agora, forma });
}

async function contaDoParque(ctx, id) {
  const r = await ctx.tx.query('select * from contas where parque_id = $1 and id = $2', [ctx.parqueId, Number(id)]);
  if (!r.rows[0]) throw new ErroUsuario('Conta não encontrada.');
  return r.rows[0];
}

const ACOES = {
  'nova-conta': {
    papeis: ['dono'],
    async executar(ctx, d) {
      const conta = await criarConta(ctx, d);
      if (d.jaPaga) await baixarConta(ctx, conta, d.forma);
      const tipo = conta.sentido === 'pagar' ? 'despesa' : 'receita';
      return { resumo: `Lançou a ${tipo} "${conta.descricao}" de ${formatar(conta.valor)}${d.jaPaga ? ', já quitada' : `, vence em ${conta.vencimento.split('-').reverse().join('/')}`}.`, resultado: { contaId: conta.id } };
    }
  },

  'baixar-conta': {
    papeis: ['dono'],
    async executar(ctx, d) {
      const conta = await contaDoParque(ctx, d.contaId);
      if (conta.status !== 'aberta') throw new ErroUsuario('Essa conta não está em aberto.');
      await baixarConta(ctx, conta, d.forma);
      return { resumo: `${conta.sentido === 'pagar' ? 'Pagou' : 'Recebeu'} "${conta.descricao}" (${formatar(conta.valor)}, ${C.formaPorId(d.forma).nome}).` };
    }
  },

  'cancelar-conta': {
    papeis: ['dono'],
    async executar(ctx, d) {
      const conta = await contaDoParque(ctx, d.contaId);
      if (conta.status !== 'aberta') throw new ErroUsuario('Só contas em aberto podem ser canceladas.');
      await ctx.estornar('conta', conta.id, conta.descricao);
      await atualizar(ctx.tx, 'contas', conta.id, { status: 'cancelada' });
      return { resumo: `Cancelou a conta "${conta.descricao}" (${formatar(conta.valor)}).` };
    }
  }
};

module.exports = { ACOES, criarConta, baixarConta, NOMES_CATEGORIA };
