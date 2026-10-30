'use strict';

const { editadas } = require('./mensagens');

/*
 * Configurações do complexo que mudam pouco (ficam em parques.config).
 * Valores em dinheiro em centavos; percentuais como número (1.99 = 1,99%).
 */

const PADRAO = {
  cidade: '',
  cnpj: '',
  telefone: '',
  horario: { abre: '08:00', fecha: '22:00' },
  taxas: { debito: 1.99, credito: 3.49 },
  parque: {
    capacidade: 40,
    tolerancia: 5,
    bloco: 15,
    valorBloco: 500,
    alerta: 10,
    planos: [
      { id: 'p30', nome: '30 minutos', minutos: 30, preco: 2500 },
      { id: 'p60', nome: '1 hora', minutos: 60, preco: 4000 },
      { id: 'p120', nome: '2 horas', minutos: 120, preco: 6000 },
      { id: 'livre', nome: 'Dia livre', minutos: null, preco: 8000 }
    ]
  },
  espacos: ['Salão de festas', 'Área kids', 'Quiosque gourmet']
};

/** Junta o que está salvo com o padrão, para nenhuma tela quebrar por falta de um campo. */
function completar(config) {
  const c = config || {};
  return {
    cidade: c.cidade || '',
    cnpj: c.cnpj || '',
    telefone: c.telefone || '',
    horario: Object.assign({}, PADRAO.horario, c.horario),
    taxas: Object.assign({}, PADRAO.taxas, c.taxas),
    parque: Object.assign({}, PADRAO.parque, c.parque, {
      planos: Array.isArray(c.parque && c.parque.planos) && c.parque.planos.length ? c.parque.planos : PADRAO.parque.planos
    }),
    espacos: Array.isArray(c.espacos) && c.espacos.length ? c.espacos : PADRAO.espacos,
    mensagens: editadas(c.mensagens)
  };
}

module.exports = { PADRAO, completar };
