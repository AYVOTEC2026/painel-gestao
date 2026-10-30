'use strict';

const { inserir } = require('../persistencia/banco');
const { criarContexto, ErroUsuario } = require('./contexto');

const ACOES = Object.assign({},
  require('./caixa').ACOES,
  require('./parque').ACOES,
  require('./quadras').ACOES,
  require('./eventos').ACOES,
  require('./locacoes').ACOES,
  require('./financeiro').ACOES,
  require('./cadastros').ACOES
);

/**
 * Executa uma ação da tela numa transação: confere o perfil, roda a regra,
 * grava o histórico com o nome de quem fez e devolve o resultado.
 * Erros de regra ("Abra o caixa...") voltam como mensagem para a pessoa.
 */
async function executarAcao(banco, { nome, parqueId, usuario, agora, dados }) {
  const acao = Object.prototype.hasOwnProperty.call(ACOES, nome) ? ACOES[nome] : null;
  if (!acao) throw new ErroUsuario('Ação desconhecida.', 404);
  if (!acao.papeis.includes(usuario.papel)) throw new ErroUsuario('Seu perfil não pode fazer isso. Fale com a gestão do complexo.', 403);
  return banco.transacao(async tx => {
    const ctx = await criarContexto(tx, { parqueId, usuario, agora });
    let saida;
    try {
      saida = (await acao.executar(ctx, dados || {})) || {};
    } catch (err) {
      if (err instanceof ErroUsuario) throw err;
      if (err && err.constructor === Error) throw new ErroUsuario(err.message);
      throw err;
    }
    if (saida.resumo) {
      await inserir(tx, 'historico', { parque_id: parqueId, usuario_id: usuario.id, usuario_nome: usuario.nome, acao: nome, resumo: saida.resumo });
    }
    return saida.resultado || null;
  });
}

module.exports = { ACOES, executarAcao };
