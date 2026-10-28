'use strict';

/**
 * Dois perfis, pensados para quem usa o food park no dia a dia:
 * a gestão (proprietária, gerente) e o funcionário do caixa.
 */
const PAPEIS = {
  dono: {
    nome: 'Gestão',
    descricao: 'Vê e altera tudo: vendas, lojistas, financeiro, equipe e configurações.',
    telas: ['inicio', 'caixa', 'boxes', 'financeiro', 'equipe', 'config', 'ajuda'],
    inicio: 'inicio'
  },
  caixa: {
    nome: 'Caixa',
    descricao: 'Abre e fecha o caixa, registra vendas e cancela vendas do caixa aberto.',
    telas: ['caixa', 'ajuda'],
    inicio: 'caixa'
  }
};

function papelValido(papel) {
  return Object.prototype.hasOwnProperty.call(PAPEIS, papel);
}

module.exports = { PAPEIS, papelValido };
