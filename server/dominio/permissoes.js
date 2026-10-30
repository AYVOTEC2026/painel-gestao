'use strict';

/**
 * Três perfis, pensados para quem trabalha no complexo:
 * a gestão (proprietária, gerente), a recepção (caixa, quadras, parque) e o
 * monitor do parque infantil (entrada e saída das crianças).
 */
const PAPEIS = {
  dono: {
    nome: 'Gestão',
    descricao: 'Vê e altera tudo: boxes, financeiro, contabilidade, relatórios, equipe e configurações.',
    telas: ['painel', 'pdv', 'boxes', 'parque', 'loja', 'quadras', 'eventos', 'contabilidade', 'financeiro', 'relatorios', 'admin', 'ajuda'],
    inicio: 'painel'
  },
  recepcao: {
    nome: 'Recepção',
    descricao: 'Abre e fecha o caixa, vende na loja e na bilheteria, vende pulseiras e cuida das reservas de quadra.',
    telas: ['pdv', 'parque', 'quadras', 'ajuda'],
    inicio: 'pdv'
  },
  monitor: {
    nome: 'Monitor do parque',
    descricao: 'Registra a entrada e a saída das crianças no parque infantil e acompanha o tempo de cada uma.',
    telas: ['parque', 'ajuda'],
    inicio: 'parque'
  }
};

const papelValido = papel => Object.prototype.hasOwnProperty.call(PAPEIS, papel);
const podeVerTela = (papel, tela) => papelValido(papel) && PAPEIS[papel].telas.includes(tela);

module.exports = { PAPEIS, papelValido, podeVerTela };
