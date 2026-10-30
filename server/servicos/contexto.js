'use strict';

const { inserir, inserirVarios } = require('../persistencia/banco');
const C = require('../dominio/contabil');
const D = require('../dominio/datas');
const { completar } = require('../dominio/configuracao');
const { centavos, formatar } = require('../dominio/dinheiro');
const { ErroUsuario } = require('../acesso');

/* ----------------------------------------------------- leitura de campos */

const texto = (v, max = 200) => String(v == null ? '' : v).trim().slice(0, max);

function textoObrigatorio(v, rotulo, min = 2) {
  const t = texto(v);
  if (t.length < min) throw new ErroUsuario(`Informe ${rotulo}.`);
  return t;
}

/** Valor em reais digitado na tela -> centavos. `zeroOk` aceita R$ 0,00. */
function valorEmCentavos(v, rotulo, { zeroOk = false, vazio = null } = {}) {
  if ((v === '' || v == null) && vazio != null) return vazio;
  const c = centavos(v);
  if (!Number.isFinite(c) || c < 0 || (!zeroOk && c === 0)) throw new ErroUsuario(`Informe ${rotulo}.`);
  return c;
}

function inteiro(v, rotulo, { min = 0, max = 1e9, vazio } = {}) {
  if ((v === '' || v == null) && vazio !== undefined) return vazio;
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new ErroUsuario(`Informe ${rotulo}.`);
  return n;
}

function data(v, rotulo) {
  if (!D.dataValida(v)) throw new ErroUsuario(`Informe ${rotulo}.`);
  return v;
}

/* --------------------------------------------------------------- contexto */

/**
 * Tudo o que uma ação precisa dentro da transação. A linha do complexo fica
 * travada até o fim: operações simultâneas (dois caixas, duas reservas) entram em fila.
 */
async function criarContexto(tx, { parqueId, usuario, agora }) {
  const { rows } = await tx.query('select id, nome, config, modo from parques where id = $1 for update', [parqueId]);
  if (!rows[0]) throw new ErroUsuario('Complexo não encontrado.', 404);
  const ctx = {
    tx,
    parqueId,
    usuario,
    agora,
    hoje: D.diaDe(agora),
    mes: D.mesDe(agora),
    parque: rows[0],
    config: completar(rows[0].config),
    quem: usuario ? usuario.nome : 'Sistema',

    /** Grava linhas do livro já conferidas (débito = crédito). */
    async lancar(linhas, { origem, id, mes, em }) {
      const validas = C.conferir(linhas);
      await inserirVarios(tx, 'lancamentos', validas.map(l => ({
        parque_id: parqueId,
        em: em || agora,
        mes: mes || D.mesDe(em || agora),
        conta: l.conta,
        debito: l.debito,
        credito: l.credito,
        historico: l.historico,
        origem_tipo: origem,
        origem_id: id
      })));
    },

    async caixaAberto() {
      const r = await tx.query('select * from caixas where parque_id = $1 and fechado_em is null', [parqueId]);
      return r.rows[0] || null;
    },

    /** Dinheiro em espécie precisa de um caixa aberto para entrar na conferência do dia. */
    async caixaPara(forma) {
      const caixa = await ctx.caixaAberto();
      if (forma === 'dinheiro' && !caixa) throw new ErroUsuario('Abra o caixa para receber ou devolver dinheiro em espécie.');
      return caixa ? caixa.id : null;
    },

    /**
     * Dinheiro que entra, de qualquer área: lança no livro (com a taxa do cartão)
     * e no extrato. `creditos` diz de onde ele veio: [{ conta, valor }].
     */
    async receber({ area, origem, id, descricao, valor, forma, creditos, mes, em }) {
      C.exigirForma(forma);
      if (valor <= 0) return { taxa: 0, caixaId: null };
      const taxa = C.taxaDaForma(valor, forma, ctx.config.taxas);
      const caixaId = await ctx.caixaPara(forma);
      await ctx.lancar(C.recebimento({ valor, forma, taxa, creditos, historico: descricao }), { origem, id, mes, em });
      await inserir(tx, 'movimentos', {
        parque_id: parqueId, em: em || agora, sentido: 'entrada', area, origem_tipo: origem, origem_id: id,
        descricao, forma, valor, taxa, caixa_id: caixaId, por: ctx.quem
      });
      return { taxa, caixaId };
    },

    /** Dinheiro que sai: pagamento de conta, devolução de caução, reembolso. */
    async pagar({ area, origem, id, descricao, valor, forma, debito, mes }) {
      C.exigirForma(forma);
      const caixaId = await ctx.caixaPara(forma);
      await ctx.lancar(C.pagamento({ valor, forma, debito, historico: descricao }), { origem, id, mes });
      await inserir(tx, 'movimentos', {
        parque_id: parqueId, em: agora, sentido: 'saida', area, origem_tipo: origem, origem_id: id,
        descricao, forma, valor, taxa: 0, caixa_id: caixaId, por: ctx.quem
      });
    },

    /**
     * Cancela tudo o que uma operação gravou: estorna os lançamentos e devolve
     * cada entrada de dinheiro pela mesma forma em que entrou.
     */
    async estornar(origem, id, descricao) {
      const linhas = await tx.query(
        'select conta, debito, credito, historico from lancamentos where parque_id = $1 and origem_tipo = $2 and origem_id = $3',
        [parqueId, origem, id]
      );
      if (linhas.rows.length) await ctx.lancar(C.estorno(linhas.rows.map(l => ({ ...l, debito: Number(l.debito), credito: Number(l.credito) }))), { origem, id });
      const entradas = await tx.query(
        "select * from movimentos where parque_id = $1 and origem_tipo = $2 and origem_id = $3 and sentido = 'entrada'",
        [parqueId, origem, id]
      );
      for (const m of entradas.rows) {
        const caixaId = await ctx.caixaPara(m.forma);
        await inserir(tx, 'movimentos', {
          parque_id: parqueId, em: agora, sentido: 'saida', area: m.area, origem_tipo: origem, origem_id: id,
          descricao: `Devolução: ${descricao}`, forma: m.forma, valor: m.valor, taxa: m.taxa, caixa_id: caixaId, por: ctx.quem
        });
      }
    },

    async proximoNumero(tabela) {
      const r = await tx.query(`select coalesce(max(numero), 0) + 1 as n from ${tabela} where parque_id = $1`, [parqueId]);
      return r.rows[0].n;
    },

    async salvarConfig(config) {
      await tx.query('update parques set config = $2 where id = $1', [parqueId, JSON.stringify(config)]);
      ctx.config = completar(config);
    }
  };
  return ctx;
}

module.exports = { criarContexto, texto, textoObrigatorio, valorEmCentavos, inteiro, data, formatar, ErroUsuario };
