'use strict';

const L = require('./ledger');
const { ErroUsuario } = require('../acesso');

const reais = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dinheiro = v => reais.format(Number(v) || 0);
const metodo = id => (L.METHODS.find(m => m.id === id) || { label: id }).label;
const nomeBox = (estado, id) => {
  const s = estado.stalls.find(x => x.id === id);
  return s ? `${s.name} (box ${L.pad(s.box, 2)})` : 'box';
};

/**
 * Cada ação do sistema: quem pode executar e como ela muda o food park.
 * `executar` recebe o estado atual e devolve { estado, resumo, resultado? }.
 * O resumo vai para o histórico ("quem fez o quê") com o nome de quem executou.
 */
const ACOES = {
  'abrir-caixa': {
    papeis: ['dono', 'caixa'],
    executar(estado, d, { agora }) {
      const novo = L.openCash(estado, { openingFloat: d.fundo }, agora);
      const sessao = L.openSession(novo);
      return { estado: novo, resumo: `Abriu o caixa com ${dinheiro(sessao.openingFloat)} de troco.` };
    }
  },

  'movimento-caixa': {
    papeis: ['dono', 'caixa'],
    executar(estado, d, { agora }) {
      const novo = L.cashMove(estado, { type: d.tipo, amount: d.valor, note: d.nota }, agora);
      const tipo = d.tipo === 'sangria' ? 'Retirou' : 'Colocou';
      return { estado: novo, resumo: `${tipo} ${dinheiro(d.valor)} do caixa${d.nota ? ': ' + String(d.nota).trim() : ''}.` };
    }
  },

  'fechar-caixa': {
    papeis: ['dono', 'caixa'],
    executar(estado, d, { agora }) {
      const sessao = L.openSession(estado);
      const novo = L.closeCash(estado, { counted: d.contado, notes: d.notas }, agora);
      const fechada = novo.sessions.find(s => s.id === (sessao && sessao.id));
      const dif = fechada ? fechada.difference : 0;
      const texto = dif === 0 ? 'sem diferença' : dif < 0 ? `com falta de ${dinheiro(-dif)}` : `com sobra de ${dinheiro(dif)}`;
      return { estado: novo, resumo: `Fechou o caixa ${texto}.`, resultado: { diferenca: dif } };
    }
  },

  vender: {
    papeis: ['dono', 'caixa'],
    executar(estado, d, { agora }) {
      const { state, sale } = L.commitSale(estado, {
        stallId: d.boxId,
        method: d.pagamento,
        items: Array.isArray(d.itens) ? d.itens.map(i => ({ productId: i.produtoId, qty: i.qtd })) : [],
        discount: d.desconto,
        customer: d.cliente,
        table: d.mesa
      }, agora);
      return {
        estado: state,
        resumo: `Venda ${L.pad(sale.number, 4)} de ${dinheiro(sale.total)} em ${nomeBox(state, sale.stallId)}, ${metodo(sale.method)}.`,
        resultado: { vendaId: sale.id }
      };
    }
  },

  'cancelar-venda': {
    papeis: ['dono', 'caixa'],
    executar(estado, d, { agora, usuario }) {
      const venda = estado.sales.find(s => s.id === d.vendaId);
      if (!venda) throw new ErroUsuario('Venda não encontrada.');
      const sessao = L.openSession(estado);
      if (usuario.papel !== 'dono' && (!sessao || venda.sessionId !== sessao.id)) {
        throw new ErroUsuario('O caixa só cancela vendas do caixa aberto. Peça à gestão para cancelar vendas antigas.', 403);
      }
      const novo = L.cancelSale(estado, d.vendaId, d.motivo, agora);
      return { estado: novo, resumo: `Cancelou a venda ${L.pad(venda.number, 4)} de ${dinheiro(venda.total)}. Motivo: ${String(d.motivo).trim()}.` };
    }
  },

  'novo-lojista': {
    papeis: ['dono'],
    executar(estado, d, { agora }) {
      const novo = L.createStall(estado, {
        box: d.box, name: d.nome, owner: d.responsavel, phone: d.telefone,
        document: d.documento, rent: d.aluguel, feePercent: d.taxa
      }, agora);
      const s = novo.stalls.find(x => Number(x.box) === Number(d.box) && x.status === 'ativo');
      return { estado: novo, resumo: `Cadastrou ${s.name} no box ${L.pad(s.box, 2)}.`, resultado: { boxId: s.id } };
    }
  },

  'editar-lojista': {
    papeis: ['dono'],
    executar(estado, d, { agora }) {
      const novo = L.updateStall(estado, d.boxId, {
        name: d.nome, owner: d.responsavel, phone: d.telefone,
        document: d.documento, rent: d.aluguel, feePercent: d.taxa
      }, agora);
      return { estado: novo, resumo: `Atualizou o cadastro de ${nomeBox(novo, d.boxId)}.` };
    }
  },

  'encerrar-lojista': {
    papeis: ['dono'],
    executar(estado, d, { agora }) {
      const nome = nomeBox(estado, d.boxId);
      return { estado: L.endStall(estado, d.boxId, agora), resumo: `Encerrou o contrato de ${nome}.` };
    }
  },

  'novo-produto': {
    papeis: ['dono'],
    executar(estado, d) {
      const novo = L.addProduct(estado, d.boxId, { name: d.nome, price: d.preco, category: d.categoria, stock: d.estoque });
      return { estado: novo, resumo: `Incluiu ${String(d.nome).trim()} (${dinheiro(d.preco)}) no cardápio de ${nomeBox(novo, d.boxId)}.` };
    }
  },

  'editar-produto': {
    papeis: ['dono'],
    executar(estado, d) {
      const campos = {};
      if (d.nome !== undefined) campos.name = d.nome;
      if (d.preco !== undefined) campos.price = d.preco;
      if (d.categoria !== undefined) campos.category = d.categoria;
      if (d.estoque !== undefined) campos.stock = d.estoque;
      if (d.ativo !== undefined) campos.active = d.ativo;
      const novo = L.updateProduct(estado, d.boxId, d.produtoId, campos);
      const stall = novo.stalls.find(s => s.id === d.boxId);
      const p = stall.products.find(x => x.id === d.produtoId);
      const acao = d.ativo === false ? 'Pausou' : d.ativo === true && Object.keys(campos).length === 1 ? 'Reativou' : 'Atualizou';
      return { estado: novo, resumo: `${acao} ${p.name} no cardápio de ${nomeBox(novo, d.boxId)}.` };
    }
  },

  'receber-aluguel': {
    papeis: ['dono'],
    executar(estado, d, { agora }) {
      const c = estado.charges.find(x => x.id === d.cobrancaId);
      if (!c) throw new ErroUsuario('Cobrança não encontrada.');
      return {
        estado: L.payCharge(estado, d.cobrancaId, d.metodo, agora),
        resumo: `Recebeu o aluguel de ${nomeBox(estado, c.stallId)} (${dinheiro(c.amount)}, ${metodo(d.metodo || 'pix')}).`
      };
    }
  },

  'nova-conta': {
    papeis: ['dono'],
    executar(estado, d, { agora }) {
      const novo = L.addBill(estado, { direction: d.tipo, category: d.categoria, description: d.descricao, amount: d.valor, due: d.vencimento }, agora);
      return { estado: novo, resumo: `Lançou conta a ${d.tipo === 'receber' ? 'receber' : 'pagar'}: ${String(d.descricao).trim()} (${dinheiro(d.valor)}).` };
    }
  },

  'baixar-conta': {
    papeis: ['dono'],
    executar(estado, d, { agora }) {
      const b = estado.bills.find(x => x.id === d.contaId);
      if (!b) throw new ErroUsuario('Conta não encontrada.');
      return {
        estado: L.payBill(estado, d.contaId, d.metodo, agora),
        resumo: `${b.direction === 'pagar' ? 'Pagou' : 'Recebeu'} ${b.description} (${dinheiro(b.amount)}).`
      };
    }
  },

  'lancar-repasse': {
    papeis: ['dono'],
    executar(estado, d, { agora }) {
      const linha = L.settlement(estado, d.mes).find(r => r.stallId === d.boxId);
      if (!linha) throw new ErroUsuario('Lojista não encontrado.');
      const sentido = linha.direction === 'pagar_lojista' ? 'Pagou' : 'Recebeu';
      const prep = linha.direction === 'pagar_lojista' ? 'a' : 'de';
      return {
        estado: L.registerSettlement(estado, d.boxId, d.mes, d.metodo, agora),
        resumo: `${sentido} ${dinheiro(linha.amount)} ${prep} ${nomeBox(estado, d.boxId)} no acerto de ${d.mes}.`
      };
    }
  },

  'editar-parque': {
    papeis: ['dono'],
    executar(estado, d, { agora }) {
      const novo = L.updatePark(estado, {
        name: d.nome, city: d.cidade, cnpj: d.cnpj, boxes: d.boxes,
        adminFeePercent: d.taxa, fees: d.maquininha
      }, agora);
      return { estado: novo, resumo: 'Atualizou os dados e as taxas do food park.' };
    }
  },

  'carregar-demo': {
    papeis: ['dono'],
    executar(estado, _d, { agora }) {
      if (estado.mode !== 'demo' && (estado.sales.length || estado.stalls.length)) {
        throw new ErroUsuario('Este food park já tem lojistas ou vendas reais. A demonstração apagaria esses dados.');
      }
      return { estado: L.demo(agora), resumo: 'Carregou os dados de demonstração.' };
    }
  }
};

module.exports = { ACOES, dinheiro };
