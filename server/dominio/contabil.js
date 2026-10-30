'use strict';

/*
 * Plano de contas do complexo e as regras de lançamento de cada operação.
 * Toda operação gera linhas com débitos e créditos iguais (partidas dobradas):
 * se uma regra sair desbalanceada, `conferir` impede a gravação.
 */

const CONTAS = {
  // Ativo: onde o dinheiro está ou de quem vai entrar
  caixa: { nome: 'Caixa (dinheiro na gaveta)', grupo: 'ativo' },
  bancos: { nome: 'Bancos e Pix', grupo: 'ativo' },
  cartoes: { nome: 'Cartões a receber', grupo: 'ativo' },
  alugueis_receber: { nome: 'Aluguéis a receber', grupo: 'ativo' },
  contas_receber: { nome: 'Outras contas a receber', grupo: 'ativo' },
  // Passivo: o que o complexo deve
  contas_pagar: { nome: 'Contas a pagar', grupo: 'passivo' },
  caucoes: { nome: 'Cauções dos locatários', grupo: 'passivo' },
  // Receitas, por área do complexo
  receita_alugueis: { nome: 'Aluguel dos boxes', grupo: 'receita', area: 'alugueis' },
  receita_cobrancas: { nome: 'Cobranças aos locatários', grupo: 'receita', area: 'alugueis' },
  receita_multas: { nome: 'Multas e juros de aluguel', grupo: 'receita', area: 'alugueis' },
  receita_parque: { nome: 'Parque infantil', grupo: 'receita', area: 'parque' },
  receita_loja: { nome: 'Loja', grupo: 'receita', area: 'loja' },
  receita_bilheteria: { nome: 'Bilheteria e day use', grupo: 'receita', area: 'bilheteria' },
  receita_quadras: { nome: 'Quadras', grupo: 'receita', area: 'quadras' },
  receita_eventos: { nome: 'Eventos e festas', grupo: 'receita', area: 'eventos' },
  receita_outras: { nome: 'Outras receitas', grupo: 'receita', area: 'outras' },
  // Despesas
  despesa_energia: { nome: 'Energia', grupo: 'despesa' },
  despesa_agua: { nome: 'Água', grupo: 'despesa' },
  despesa_folha: { nome: 'Folha e encargos', grupo: 'despesa' },
  despesa_manutencao: { nome: 'Manutenção', grupo: 'despesa' },
  despesa_limpeza: { nome: 'Limpeza e segurança', grupo: 'despesa' },
  despesa_marketing: { nome: 'Marketing', grupo: 'despesa' },
  despesa_impostos: { nome: 'Impostos e taxas', grupo: 'despesa' },
  despesa_compras: { nome: 'Compras de mercadoria', grupo: 'despesa' },
  despesa_taxas_cartao: { nome: 'Taxas de cartão', grupo: 'despesa' },
  despesa_outras: { nome: 'Outras despesas', grupo: 'despesa' },
  quebra_caixa: { nome: 'Quebra de caixa', grupo: 'despesa' }
};

const AREAS = {
  alugueis: 'Aluguéis',
  parque: 'Parque infantil',
  loja: 'Loja',
  bilheteria: 'Bilheteria e day use',
  quadras: 'Quadras',
  eventos: 'Eventos e festas',
  outras: 'Outras receitas'
};

/** Categorias de despesa que a gestão escolhe ao lançar uma conta a pagar. */
const CATEGORIAS_DESPESA = {
  energia: 'despesa_energia',
  agua: 'despesa_agua',
  folha: 'despesa_folha',
  manutencao: 'despesa_manutencao',
  limpeza: 'despesa_limpeza',
  marketing: 'despesa_marketing',
  impostos: 'despesa_impostos',
  compras: 'despesa_compras',
  outras: 'despesa_outras'
};

const FORMAS = [
  { id: 'dinheiro', nome: 'Dinheiro', conta: 'caixa' },
  { id: 'pix', nome: 'Pix', conta: 'bancos' },
  { id: 'debito', nome: 'Débito', conta: 'cartoes', cartao: true },
  { id: 'credito', nome: 'Crédito', conta: 'cartoes', cartao: true },
  { id: 'transferencia', nome: 'Transferência ou boleto', conta: 'bancos' }
];

const formaPorId = id => FORMAS.find(f => f.id === id) || null;

function exigirForma(id) {
  const f = formaPorId(id);
  if (!f) throw new Error('Escolha a forma de pagamento.');
  return f;
}

/** Taxa da maquininha sobre um recebimento no cartão (em centavos). */
function taxaDaForma(valor, forma, taxas) {
  const f = formaPorId(forma);
  if (!f || !f.cartao) return 0;
  return Math.round(valor * (Number((taxas || {})[forma]) || 0) / 100);
}

const linha = (conta, debito, credito, historico) => ({ conta, debito: Math.round(debito), credito: Math.round(credito), historico });

/**
 * Dinheiro que entra: debita onde ele ficou (gaveta, banco, cartão a receber) e a
 * taxa do cartão como despesa; credita as contas de origem (receitas ou a receber).
 * `creditos` = [{ conta, valor }], somando o valor bruto recebido.
 */
function recebimento({ valor, forma, taxa = 0, creditos, historico }) {
  const f = exigirForma(forma);
  const linhas = [linha(f.conta, valor - taxa, 0, historico)];
  if (taxa > 0) linhas.push(linha('despesa_taxas_cartao', taxa, 0, `Taxa de cartão: ${historico}`));
  creditos.filter(c => c.valor > 0).forEach(c => linhas.push(linha(c.conta, 0, c.valor, historico)));
  return linhas;
}

/** Dinheiro que sai: credita de onde saiu e debita o destino (conta a pagar quitada, caução devolvida...). */
function pagamento({ valor, forma, debito, historico }) {
  const f = exigirForma(forma);
  return [linha(debito, valor, 0, historico), linha(f.conta, 0, valor, historico)];
}

/** Lançamento que não mexe em dinheiro: reconhece algo a receber ou a pagar. */
const reconhecimento = (debito, credito, valor, historico) => [linha(debito, valor, 0, historico), linha(credito, 0, valor, historico)];

/** Desfaz linhas já gravadas (cancelamento): troca débito por crédito. */
const estorno = (linhas, prefixo = 'Estorno') => linhas.map(l => linha(l.conta, l.credito, l.debito, `${prefixo}: ${l.historico}`));

function conferir(linhas) {
  let saldo = 0;
  linhas.forEach(l => {
    if (!CONTAS[l.conta]) throw new Error(`Conta contábil desconhecida: ${l.conta}`);
    if (l.debito < 0 || l.credito < 0 || !Number.isInteger(l.debito) || !Number.isInteger(l.credito)) throw new Error('Lançamento contábil inválido.');
    saldo += l.debito - l.credito;
  });
  if (saldo !== 0) throw new Error('Os lançamentos não fecham em débito e crédito. Nada foi gravado.');
  return linhas.filter(l => l.debito !== 0 || l.credito !== 0);
}

/**
 * DRE a partir das somas do livro no mês: [{ conta, debito, credito }].
 * Receita = créditos − débitos; despesa = débitos − créditos.
 */
function dre(somas) {
  const por = {};
  somas.forEach(s => { por[s.conta] = { debito: Number(s.debito) || 0, credito: Number(s.credito) || 0 }; });
  const saldo = (conta, natureza) => {
    const s = por[conta] || { debito: 0, credito: 0 };
    return natureza === 'receita' ? s.credito - s.debito : s.debito - s.credito;
  };
  const receitas = Object.keys(CONTAS).filter(c => CONTAS[c].grupo === 'receita').map(c => ({ conta: c, nome: CONTAS[c].nome, area: CONTAS[c].area, valor: saldo(c, 'receita') }));
  const despesas = Object.keys(CONTAS).filter(c => CONTAS[c].grupo === 'despesa').map(c => ({ conta: c, nome: CONTAS[c].nome, valor: saldo(c, 'despesa') }));
  const totalReceitas = receitas.reduce((t, r) => t + r.valor, 0);
  const totalDespesas = despesas.reduce((t, d) => t + d.valor, 0);
  const porArea = Object.keys(AREAS).map(area => ({
    area,
    nome: AREAS[area],
    valor: receitas.filter(r => r.area === area).reduce((t, r) => t + r.valor, 0)
  }));
  return { receitas, despesas, porArea, totalReceitas, totalDespesas, resultado: totalReceitas - totalDespesas };
}

module.exports = {
  CONTAS, AREAS, FORMAS, CATEGORIAS_DESPESA,
  formaPorId, exigirForma, taxaDaForma, recebimento, pagamento, reconhecimento, estorno, conferir, dre
};
