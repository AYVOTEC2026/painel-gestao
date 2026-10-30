'use strict';

const { inserir, atualizar } = require('../persistencia/banco');
const C = require('../dominio/contabil');
const D = require('../dominio/datas');
const R = require('../dominio/regras');
const { texto, textoObrigatorio, valorEmCentavos, inteiro, data, formatar, ErroUsuario } = require('./contexto');

const TIPOS_UNIDADE = { conteiner: 'Contêiner', loja: 'Loja', quiosque: 'Quiosque', sala: 'Sala' };
const nomeDoMes = mes => new Date(`${mes}-15T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/**
 * Lança o aluguel de cada mês em que o contrato vale e que ainda não foi cobrado,
 * do mês em que ele entrou no sistema até o mês atual. Roda ao abrir as telas,
 * então nenhum mês fica sem cobrança mesmo que ninguém acesse o sistema por dias.
 */
async function gerarAlugueis(ctx, contratoId) {
  const r = await ctx.tx.query(
    `select c.*, u.numero from contratos c join unidades u on u.id = c.unidade_id
      where c.parque_id = $1 and c.status = 'ativo' ${contratoId ? 'and c.id = $2' : ''}`,
    contratoId ? [ctx.parqueId, contratoId] : [ctx.parqueId]
  );
  let criadas = 0;
  for (const c of r.rows) {
    const desde = [D.mesDe(c.inicio), D.mesDe(c.criado_em)].sort().pop();
    for (let mes = desde; mes <= ctx.mes; mes = D.somarMeses(mes, 1)) {
      if (!R.contratoVigenteNoMes(c, mes)) continue;
      const existe = await ctx.tx.query(
        "select 1 from cobrancas where contrato_id = $1 and competencia = $2 and tipo = 'aluguel' and status <> 'cancelada'",
        [c.id, mes]
      );
      if (existe.rows.length) continue;
      const cob = await inserir(ctx.tx, 'cobrancas', {
        parque_id: ctx.parqueId, contrato_id: c.id, tipo: 'aluguel', descricao: `Aluguel de ${nomeDoMes(mes)}`,
        competencia: mes, valor: c.valor, vencimento: D.diaNoMes(mes, c.dia_vencimento), criado_em: ctx.agora
      });
      await ctx.lancar(
        C.reconhecimento('alugueis_receber', 'receita_alugueis', Number(c.valor), `Aluguel ${mes}: box ${c.numero}, ${c.locatario}`),
        { origem: 'cobranca', id: cob.id, mes, em: `${mes}-01T00:00:00` > ctx.agora ? ctx.agora : `${mes}-01T00:00:00` }
      );
      criadas += 1;
    }
  }
  return criadas;
}

function lerContrato(d) {
  const inicio = data(d.inicio, 'o início do contrato');
  const fim = d.fim ? data(d.fim, 'o fim do contrato') : null;
  if (fim && fim < inicio) throw new ErroUsuario('O fim do contrato precisa ser depois do início.');
  const caucao = valorEmCentavos(d.caucao, 'o valor da caução', { zeroOk: true, vazio: 0 });
  return {
    locatario: textoObrigatorio(d.locatario, 'o nome da empresa locatária'),
    atividade: texto(d.atividade, 80),
    documento: texto(d.documento, 30),
    responsavel: texto(d.responsavel, 120),
    telefone: texto(d.telefone, 30),
    email: texto(d.email, 120),
    valor: valorEmCentavos(d.valor, 'o valor do aluguel'),
    dia_vencimento: inteiro(d.diaVencimento, 'o dia do vencimento (1 a 31)', { min: 1, max: 31 }),
    inicio,
    fim,
    caucao,
    reajuste: texto(d.reajuste, 200),
    observacoes: texto(d.observacoes, 2000)
  };
}

async function contratoDoParque(ctx, id) {
  const r = await ctx.tx.query(
    'select c.*, u.numero from contratos c join unidades u on u.id = c.unidade_id where c.parque_id = $1 and c.id = $2',
    [ctx.parqueId, Number(id)]
  );
  if (!r.rows[0]) throw new ErroUsuario('Contrato não encontrado.');
  return r.rows[0];
}

async function cobrancaDoParque(ctx, id) {
  const r = await ctx.tx.query(
    `select b.*, c.locatario, u.numero from cobrancas b join contratos c on c.id = b.contrato_id join unidades u on u.id = c.unidade_id
      where b.parque_id = $1 and b.id = $2`,
    [ctx.parqueId, Number(id)]
  );
  if (!r.rows[0]) throw new ErroUsuario('Cobrança não encontrada.');
  return r.rows[0];
}

const ACOES = {
  'salvar-unidade': {
    papeis: ['dono'],
    async executar(ctx, d) {
      const campos = {
        numero: textoObrigatorio(d.numero, 'o número ou nome do box', 1),
        tipo: TIPOS_UNIDADE[d.tipo] ? d.tipo : 'conteiner',
        area: d.area === '' || d.area == null ? null : Number(String(d.area).replace(',', '.')),
        observacao: texto(d.observacao, 300)
      };
      if (campos.area != null && !(campos.area > 0)) throw new ErroUsuario('Informe a área em m².');
      const repetido = await ctx.tx.query('select id from unidades where parque_id = $1 and lower(numero) = lower($2) and id <> $3', [ctx.parqueId, campos.numero, Number(d.unidadeId) || 0]);
      if (repetido.rows.length) throw new ErroUsuario(`Já existe um box ${campos.numero}.`);
      if (d.unidadeId) {
        await atualizar(ctx.tx, 'unidades', Number(d.unidadeId), campos);
        return { resumo: `Atualizou o box ${campos.numero}.` };
      }
      const u = await inserir(ctx.tx, 'unidades', { parque_id: ctx.parqueId, ...campos });
      return { resumo: `Cadastrou o box ${u.numero} (${TIPOS_UNIDADE[u.tipo].toLowerCase()}).`, resultado: { unidadeId: u.id } };
    }
  },

  'novo-contrato': {
    papeis: ['dono'],
    async executar(ctx, d) {
      const u = await ctx.tx.query('select * from unidades where parque_id = $1 and id = $2 and ativa', [ctx.parqueId, Number(d.unidadeId)]);
      if (!u.rows[0]) throw new ErroUsuario('Escolha o box.');
      const ocupado = await ctx.tx.query("select 1 from contratos where unidade_id = $1 and status = 'ativo'", [u.rows[0].id]);
      if (ocupado.rows.length) throw new ErroUsuario(`O box ${u.rows[0].numero} já tem um contrato ativo.`);
      const campos = lerContrato(d);
      const c = await inserir(ctx.tx, 'contratos', {
        parque_id: ctx.parqueId, unidade_id: u.rows[0].id, ...campos,
        caucao_status: campos.caucao > 0 ? 'pendente' : 'nao_ha', criado_em: ctx.agora
      });
      const cobrancas = await gerarAlugueis(ctx, c.id);
      return {
        resumo: `Fechou contrato do box ${u.rows[0].numero} com ${c.locatario}: ${formatar(c.valor)} por mês, vencimento dia ${c.dia_vencimento}.`,
        resultado: { contratoId: c.id, cobrancas }
      };
    }
  },

  'editar-contrato': {
    papeis: ['dono'],
    async executar(ctx, d) {
      const c = await contratoDoParque(ctx, d.contratoId);
      if (c.status !== 'ativo') throw new ErroUsuario('Contrato encerrado não pode ser alterado.');
      const campos = lerContrato(d);
      if (c.caucao_status === 'recebida' || c.caucao_status === 'devolvida') campos.caucao = Number(c.caucao);
      else campos.caucao_status = campos.caucao > 0 ? 'pendente' : 'nao_ha';
      await atualizar(ctx.tx, 'contratos', c.id, campos);
      return { resumo: `Atualizou o contrato do box ${c.numero} (${campos.locatario}). Mudanças no valor valem para os próximos aluguéis.` };
    }
  },

  'encerrar-contrato': {
    papeis: ['dono'],
    async executar(ctx, d) {
      const c = await contratoDoParque(ctx, d.contratoId);
      if (c.status !== 'ativo') throw new ErroUsuario('Esse contrato já foi encerrado.');
      const dia = d.data ? data(d.data, 'a data de encerramento') : ctx.hoje;
      // Aluguéis de meses depois da saída deixam de existir; os anteriores em aberto continuam cobráveis.
      const futuras = await ctx.tx.query(
        "select id from cobrancas where contrato_id = $1 and status = 'aberta' and competencia > $2",
        [c.id, D.mesDe(dia)]
      );
      for (const f of futuras.rows) {
        await ctx.estornar('cobranca', f.id, `aluguel após o encerramento do box ${c.numero}`);
        await atualizar(ctx.tx, 'cobrancas', f.id, { status: 'cancelada' });
      }
      await atualizar(ctx.tx, 'contratos', c.id, { status: 'encerrado', encerrado_em: dia, fim: dia });
      const pendentes = await ctx.tx.query("select count(*)::int as n, coalesce(sum(valor), 0) as total from cobrancas where contrato_id = $1 and status = 'aberta'", [c.id]);
      const aviso = pendentes.rows[0].n ? ` Ficaram ${formatar(pendentes.rows[0].total)} em aberto para receber.` : '';
      return { resumo: `Encerrou o contrato do box ${c.numero} com ${c.locatario}.${aviso}` };
    }
  },

  'caucao': {
    papeis: ['dono'],
    async executar(ctx, d) {
      const c = await contratoDoParque(ctx, d.contratoId);
      C.exigirForma(d.forma);
      const valor = Number(c.caucao);
      if (d.operacao === 'receber') {
        if (c.caucao_status !== 'pendente') throw new ErroUsuario('Não há caução pendente neste contrato.');
        await ctx.receber({ area: 'caucao', origem: 'caucao', id: c.id, descricao: `Caução do box ${c.numero}: ${c.locatario}`, valor, forma: d.forma, creditos: [{ conta: 'caucoes', valor }] });
        await atualizar(ctx.tx, 'contratos', c.id, { caucao_status: 'recebida' });
        return { resumo: `Recebeu a caução de ${formatar(valor)} de ${c.locatario}.` };
      }
      if (c.caucao_status !== 'recebida') throw new ErroUsuario('A caução deste contrato não foi recebida.');
      await ctx.pagar({ area: 'caucao', origem: 'caucao', id: c.id, descricao: `Devolução da caução do box ${c.numero}: ${c.locatario}`, valor, forma: d.forma, debito: 'caucoes' });
      await atualizar(ctx.tx, 'contratos', c.id, { caucao_status: 'devolvida' });
      return { resumo: `Devolveu a caução de ${formatar(valor)} para ${c.locatario}.` };
    }
  },

  'nova-cobranca': {
    papeis: ['dono'],
    async executar(ctx, d) {
      const c = await contratoDoParque(ctx, d.contratoId);
      const descricao = textoObrigatorio(d.descricao, 'a descrição da cobrança');
      const valor = valorEmCentavos(d.valor, 'o valor');
      const vencimento = data(d.vencimento, 'o vencimento');
      const competencia = D.mesDe(vencimento);
      const cob = await inserir(ctx.tx, 'cobrancas', {
        parque_id: ctx.parqueId, contrato_id: c.id, tipo: 'avulsa', descricao, competencia, valor, vencimento, criado_em: ctx.agora
      });
      await ctx.lancar(C.reconhecimento('alugueis_receber', 'receita_cobrancas', valor, `${descricao}: box ${c.numero}, ${c.locatario}`), { origem: 'cobranca', id: cob.id, mes: competencia });
      return { resumo: `Lançou a cobrança "${descricao}" de ${formatar(valor)} para ${c.locatario}.` };
    }
  },

  'receber-cobranca': {
    papeis: ['dono'],
    async executar(ctx, d) {
      const b = await cobrancaDoParque(ctx, d.cobrancaId);
      if (b.status !== 'aberta') throw new ErroUsuario(b.status === 'paga' ? 'Essa cobrança já foi recebida.' : 'Essa cobrança foi cancelada.');
      C.exigirForma(d.forma);
      const acrescimo = valorEmCentavos(d.acrescimo, 'a multa ou juros', { zeroOk: true, vazio: 0 });
      const valor = Number(b.valor) + acrescimo;
      await ctx.receber({
        area: 'alugueis', origem: 'cobranca', id: b.id, descricao: `${b.descricao}: box ${b.numero}, ${b.locatario}`,
        valor, forma: d.forma, creditos: [{ conta: 'alugueis_receber', valor: Number(b.valor) }, { conta: 'receita_multas', valor: acrescimo }]
      });
      await atualizar(ctx.tx, 'cobrancas', b.id, { status: 'paga', pago_em: ctx.agora, valor_pago: valor, forma: d.forma });
      return { resumo: `Recebeu ${formatar(valor)} de ${b.locatario}: ${b.descricao.toLowerCase()}${acrescimo ? ` (com ${formatar(acrescimo)} de multa e juros)` : ''}.` };
    }
  },

  'ajustar-cobranca': {
    papeis: ['dono'],
    async executar(ctx, d) {
      const b = await cobrancaDoParque(ctx, d.cobrancaId);
      if (b.status !== 'aberta') throw new ErroUsuario('Só cobranças em aberto podem ter o valor ajustado.');
      const novo = valorEmCentavos(d.valor, 'o novo valor', { zeroOk: true });
      const motivo = texto(d.motivo, 200) || 'Ajuste de valor';
      const dif = novo - Number(b.valor);
      if (dif === 0) throw new ErroUsuario('O valor é o mesmo.');
      const receita = b.tipo === 'aluguel' ? 'receita_alugueis' : 'receita_cobrancas';
      const historico = `${motivo}: ${b.descricao}, box ${b.numero}`;
      const linhas = dif > 0 ? C.reconhecimento('alugueis_receber', receita, dif, historico) : C.reconhecimento(receita, 'alugueis_receber', -dif, historico);
      await ctx.lancar(linhas, { origem: 'cobranca', id: b.id, mes: b.competencia });
      await atualizar(ctx.tx, 'cobrancas', b.id, { valor: novo });
      return { resumo: `Ajustou ${b.descricao.toLowerCase()} de ${b.locatario} de ${formatar(b.valor)} para ${formatar(novo)}. Motivo: ${motivo}.` };
    }
  },

  'cancelar-cobranca': {
    papeis: ['dono'],
    async executar(ctx, d) {
      const b = await cobrancaDoParque(ctx, d.cobrancaId);
      if (b.status !== 'aberta') throw new ErroUsuario('Só cobranças em aberto podem ser canceladas.');
      await ctx.estornar('cobranca', b.id, `${b.descricao}, box ${b.numero}`);
      await atualizar(ctx.tx, 'cobrancas', b.id, { status: 'cancelada' });
      return { resumo: `Cancelou ${b.descricao.toLowerCase()} de ${b.locatario} (${formatar(b.valor)}).` };
    }
  }
};

module.exports = { ACOES, gerarAlugueis, TIPOS_UNIDADE, nomeDoMes };
