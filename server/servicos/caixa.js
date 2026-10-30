'use strict';

const { inserir, atualizar } = require('../persistencia/banco');
const C = require('../dominio/contabil');
const D = require('../dominio/datas');
const { texto, textoObrigatorio, valorEmCentavos, inteiro, formatar, ErroUsuario } = require('./contexto');

const TODOS = ['dono', 'recepcao', 'monitor'];

/* Itens alugados no PDV: quanto tempo cada um pode ficar fora e como aparece no recibo. */
const MAX_PERIODOS = { hora: 12, dia: 30, uso: 1 };
const CONTA_DO_TIPO = { loja: 'receita_loja', ingresso: 'receita_bilheteria', aluguel: 'receita_equipamentos' };
const valorDaLinha = i => i.preco * i.qtd * (i.periodos || 1);

function tempoDoAluguel(i) {
  if (i.periodo === 'hora') return `${i.periodos} h`;
  if (i.periodo === 'dia') return i.periodos === 1 ? '1 dia' : `${i.periodos} dias`;
  return 'por uso';
}
const linhaDoRecibo = i => `${i.qtd}× ${i.nome}${i.tipo === 'aluguel' ? ` (aluguel, ${tempoDoAluguel(i)})` : ''}`;

/** Até quando o item deve voltar: horas contadas da saída; diária até o fechamento do último dia. */
function devolverAte(i, agora, fecha) {
  if (i.periodo === 'hora') return D.somarMinutos(agora, 60 * i.periodos);
  if (i.periodo === 'dia') return `${D.somarDias(D.diaDe(agora), i.periodos - 1)}T${fecha === '00:00' ? '23:59' : fecha}:00`;
  return null;
}

/** Divide o desconto entre as receitas na proporção de cada uma; o centavo que sobra fica na maior. */
function creditosComDesconto(porConta, desconto) {
  const contas = Object.keys(porConta).sort((a, b) => porConta[b] - porConta[a]);
  const total = contas.reduce((t, c) => t + porConta[c], 0);
  const partes = contas.map(c => (total ? Math.round(desconto * porConta[c] / total) : 0));
  partes[0] += desconto - partes.reduce((t, p) => t + p, 0);
  return contas.map((conta, n) => ({ conta, valor: porConta[conta] - partes[n] }));
}

/** Quanto deveria haver em cada forma de pagamento neste caixa. */
async function esperadoDoCaixa(ctx, caixa) {
  const esperado = {};
  C.FORMAS.forEach(f => { esperado[f.id] = 0; });
  const r = await ctx.tx.query(
    `select forma, sum(case when sentido = 'entrada' then valor else -valor end) as total
       from movimentos where caixa_id = $1 group by forma`,
    [caixa.id]
  );
  r.rows.forEach(l => { esperado[l.forma] = Number(l.total); });
  const mov = await ctx.tx.query(
    `select coalesce(sum(case when tipo = 'suprimento' then valor else -valor end), 0) as saldo from movimentos_caixa where caixa_id = $1`,
    [caixa.id]
  );
  // Na gaveta: troco inicial + vendas em dinheiro + reforços − retiradas.
  esperado.dinheiro += Number(caixa.fundo) + Number(mov.rows[0].saldo);
  return esperado;
}

const ACOES = {
  'abrir-caixa': {
    papeis: TODOS,
    async executar(ctx, d) {
      if (await ctx.caixaAberto()) throw new ErroUsuario('O caixa já está aberto.');
      const fundo = valorEmCentavos(d.fundo, 'o troco da gaveta', { zeroOk: true, vazio: 0 });
      const caixa = await inserir(ctx.tx, 'caixas', { parque_id: ctx.parqueId, aberto_em: ctx.agora, aberto_por: ctx.quem, fundo });
      if (fundo > 0) await ctx.lancar(C.reconhecimento('caixa', 'bancos', fundo, 'Troco colocado na gaveta ao abrir o caixa'), { origem: 'caixa', id: caixa.id });
      return { resumo: `Abriu o caixa com ${formatar(fundo)} de troco.`, resultado: { caixaId: caixa.id } };
    }
  },

  'movimento-caixa': {
    papeis: TODOS,
    async executar(ctx, d) {
      const caixa = await ctx.caixaAberto();
      if (!caixa) throw new ErroUsuario('Abra o caixa antes de retirar ou colocar dinheiro.');
      const tipo = d.tipo === 'sangria' ? 'sangria' : 'suprimento';
      const valor = valorEmCentavos(d.valor, 'o valor');
      const nota = texto(d.nota) || (tipo === 'sangria' ? 'Retirada do caixa' : 'Reforço de troco');
      if (tipo === 'sangria') {
        const esperado = await esperadoDoCaixa(ctx, caixa);
        if (valor > esperado.dinheiro) throw new ErroUsuario(`Só há ${formatar(esperado.dinheiro)} em dinheiro na gaveta pelo sistema.`);
      }
      await inserir(ctx.tx, 'movimentos_caixa', { parque_id: ctx.parqueId, caixa_id: caixa.id, tipo, valor, nota, em: ctx.agora, por: ctx.quem });
      const linhas = tipo === 'sangria'
        ? C.reconhecimento('bancos', 'caixa', valor, `Retirada do caixa: ${nota}`)
        : C.reconhecimento('caixa', 'bancos', valor, `Reforço de troco: ${nota}`);
      await ctx.lancar(linhas, { origem: 'caixa', id: caixa.id });
      return { resumo: `${tipo === 'sangria' ? 'Retirou' : 'Colocou'} ${formatar(valor)} ${tipo === 'sangria' ? 'do' : 'no'} caixa: ${nota}.` };
    }
  },

  'fechar-caixa': {
    papeis: TODOS,
    async executar(ctx, d) {
      const caixa = await ctx.caixaAberto();
      if (!caixa) throw new ErroUsuario('Não há caixa aberto.');
      const esperado = await esperadoDoCaixa(ctx, caixa);
      const contado = {};
      let diferenca = 0;
      const linhas = [];
      C.FORMAS.forEach(f => {
        const informado = d.contado ? d.contado[f.id] : undefined;
        const valor = informado === '' || informado == null ? esperado[f.id] : valorEmCentavos(informado, `o valor contado em ${f.nome}`, { zeroOk: true });
        contado[f.id] = valor;
        const dif = valor - esperado[f.id];
        diferenca += dif;
        if (dif < 0) linhas.push(...C.reconhecimento('quebra_caixa', f.conta, -dif, `Falta no fechamento do caixa (${f.nome})`));
        if (dif > 0) linhas.push(...C.reconhecimento(f.conta, 'quebra_caixa', dif, `Sobra no fechamento do caixa (${f.nome})`));
      });
      // O dinheiro contado sai da gaveta e vai para o cofre ou banco; o caixa recomeça do zero.
      if (contado.dinheiro > 0) linhas.push(...C.reconhecimento('bancos', 'caixa', contado.dinheiro, 'Dinheiro recolhido no fechamento do caixa'));
      if (linhas.length) await ctx.lancar(linhas, { origem: 'caixa', id: caixa.id });
      await atualizar(ctx.tx, 'caixas', caixa.id, {
        fechado_em: ctx.agora, fechado_por: ctx.quem, esperado, contado, diferenca, observacao: texto(d.observacao, 500)
      });
      const situacao = diferenca === 0 ? 'sem diferença' : diferenca < 0 ? `com falta de ${formatar(-diferenca)}` : `com sobra de ${formatar(diferenca)}`;
      return { resumo: `Fechou o caixa ${situacao}.`, resultado: { diferenca: diferenca / 100 } };
    }
  },

  vender: {
    papeis: ['dono', 'recepcao'],
    async executar(ctx, d) {
      const caixa = await ctx.caixaAberto();
      if (!caixa) throw new ErroUsuario('Abra o caixa para vender.');
      const pedidos = Array.isArray(d.itens) ? d.itens : [];
      if (!pedidos.length) throw new ErroUsuario('Adicione pelo menos um item.');
      const ids = pedidos.map(i => Number(i.produtoId));
      const r = await ctx.tx.query('select * from produtos where parque_id = $1 and id = any($2::int[])', [ctx.parqueId, ids]);
      const porId = new Map(r.rows.map(p => [p.id, p]));
      const itens = pedidos.map(i => {
        const p = porId.get(Number(i.produtoId));
        if (!p || !p.ativo) throw new ErroUsuario('Há um item que não está mais à venda. Atualize a tela.');
        const qtd = inteiro(i.qtd, 'a quantidade', { min: 1, max: 999 });
        if (p.controla_estoque && p.estoque < qtd) {
          throw new ErroUsuario(p.tipo === 'aluguel' ? `Só ${p.estoque === 1 ? 'há 1' : `há ${p.estoque}`} de ${p.nome} livre para alugar agora.` : `Só há ${p.estoque} de ${p.nome} em estoque.`);
        }
        if (p.tipo !== 'aluguel') return { produtoId: p.id, nome: p.nome, tipo: p.tipo, qtd, preco: Number(p.preco) };
        const periodos = inteiro(i.periodos, 'o tempo do aluguel', { min: 1, max: MAX_PERIODOS[p.periodo], vazio: 1 });
        return { produtoId: p.id, nome: p.nome, tipo: p.tipo, qtd, preco: Number(p.preco), periodo: p.periodo, periodos };
      });
      // Quem leva um item alugado fica registrado, para cobrar a devolução.
      const aluga = itens.some(i => i.tipo === 'aluguel');
      const cliente = aluga ? textoObrigatorio(d.cliente, 'o nome de quem leva os itens alugados') : '';
      const telefone = aluga ? texto(d.telefone, 30) : '';
      const subtotal = itens.reduce((t, i) => t + valorDaLinha(i), 0);
      const desconto = valorEmCentavos(d.desconto, 'o desconto', { zeroOk: true, vazio: 0 });
      if (desconto > subtotal) throw new ErroUsuario('O desconto não pode ser maior que o total dos itens.');
      const total = subtotal - desconto;
      C.exigirForma(d.forma);

      const porConta = {};
      itens.forEach(i => { porConta[CONTA_DO_TIPO[i.tipo]] = (porConta[CONTA_DO_TIPO[i.tipo]] || 0) + valorDaLinha(i); });
      const creditos = creditosComDesconto(porConta, desconto);

      const numero = await ctx.proximoNumero('vendas');
      const venda = await inserir(ctx.tx, 'vendas', {
        parque_id: ctx.parqueId, numero, caixa_id: caixa.id, em: ctx.agora, itens, subtotal, desconto, total,
        forma: d.forma, taxa: 0, vendedor: ctx.quem
      });
      const descricao = `Venda ${String(numero).padStart(4, '0')}: ${itens.map(linhaDoRecibo).join(', ')}`;
      const { taxa } = await ctx.receber({ area: 'pdv', origem: 'venda', id: venda.id, descricao, valor: total, forma: d.forma, creditos });
      if (taxa) await atualizar(ctx.tx, 'vendas', venda.id, { taxa });
      for (const i of itens) {
        await ctx.tx.query('update produtos set estoque = estoque - $2 where id = $1 and controla_estoque', [i.produtoId, i.qtd]);
        if (i.tipo === 'aluguel') {
          await inserir(ctx.tx, 'itens_alugados', {
            parque_id: ctx.parqueId, venda_id: venda.id, produto_id: i.produtoId, nome: i.nome, qtd: i.qtd, periodos: i.periodos,
            cliente, telefone, saiu_em: ctx.agora, devolver_ate: devolverAte(i, ctx.agora, ctx.config.horario.fecha), status: 'fora', por: ctx.quem
          });
        }
      }
      const forma = C.formaPorId(d.forma).nome;
      return { resumo: `Vendeu ${formatar(total)} no PDV (${forma}): ${itens.map(linhaDoRecibo).join(', ')}${aluga ? `. Alugado para ${cliente}` : ''}.`, resultado: { vendaId: venda.id, numero } };
    }
  },

  'cancelar-venda': {
    papeis: ['dono', 'recepcao'],
    async executar(ctx, d) {
      const r = await ctx.tx.query('select * from vendas where parque_id = $1 and id = $2', [ctx.parqueId, Number(d.vendaId)]);
      const venda = r.rows[0];
      if (!venda) throw new ErroUsuario('Venda não encontrada.');
      if (venda.status === 'cancelada') throw new ErroUsuario('Essa venda já foi cancelada.');
      const caixa = await ctx.caixaAberto();
      if (ctx.usuario.papel !== 'dono' && (!caixa || venda.caixa_id !== caixa.id)) {
        throw new ErroUsuario('A recepção só cancela vendas do caixa aberto. Peça à gestão para cancelar vendas antigas.', 403);
      }
      const motivo = texto(d.motivo, 300);
      if (motivo.length < 3) throw new ErroUsuario('Escreva o motivo do cancelamento.');
      const numero = String(venda.numero).padStart(4, '0');
      await ctx.estornar('venda', venda.id, `venda ${numero}`);
      for (const i of venda.itens) {
        if (i.tipo === 'aluguel') {
          // Volta para a prateleira só o que ainda estava com o cliente; o devolvido já voltou.
          const fora = await ctx.tx.query(
            "update itens_alugados set status = 'cancelado' where venda_id = $1 and produto_id = $2 and status = 'fora' returning qtd",
            [venda.id, i.produtoId]
          );
          const qtd = fora.rows.reduce((t, x) => t + x.qtd, 0);
          if (qtd) await ctx.tx.query('update produtos set estoque = estoque + $2 where id = $1', [i.produtoId, qtd]);
        } else {
          await ctx.tx.query('update produtos set estoque = estoque + $2 where id = $1 and controla_estoque', [i.produtoId, i.qtd]);
        }
      }
      await atualizar(ctx.tx, 'vendas', venda.id, { status: 'cancelada', motivo });
      return { resumo: `Cancelou a venda ${numero} de ${formatar(venda.total)}. Motivo: ${motivo}.` };
    }
  },

  'devolver-item': {
    papeis: ['dono', 'recepcao'],
    async executar(ctx, d) {
      const r = await ctx.tx.query('select * from itens_alugados where parque_id = $1 and id = $2', [ctx.parqueId, Number(d.itemId)]);
      const item = r.rows[0];
      if (!item) throw new ErroUsuario('Aluguel não encontrado.');
      if (item.status !== 'fora') throw new ErroUsuario(item.status === 'devolvido' ? 'Esse item já foi devolvido.' : 'Esse aluguel foi cancelado.');
      await atualizar(ctx.tx, 'itens_alugados', item.id, { status: 'devolvido', devolvido_em: ctx.agora, recebido_por: ctx.quem });
      await ctx.tx.query('update produtos set estoque = estoque + $2 where id = $1', [item.produto_id, item.qtd]);
      const atraso = item.devolver_ate ? D.minutosEntre(item.devolver_ate, ctx.agora) : 0;
      return { resumo: `Recebeu de volta ${item.qtd}× ${item.nome}, alugado para ${item.cliente}${atraso > 10 ? `, ${atraso} min depois do combinado` : ''}.` };
    }
  }
};

module.exports = { ACOES, esperadoDoCaixa };
