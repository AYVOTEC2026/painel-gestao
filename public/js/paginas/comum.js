/* Peças repetidas entre as telas: mês, abas, números de destaque, forma de pagamento, caixa. */

import { esc, icone, dinheiro, mesNome, somarMes, abrirModal, campo, campoDinheiro } from '../ui.js';

/** Seletor de mês com setas. Muda a rota mantendo a aba. */
export function seletorMes(mes, mesAtual, rotaBase) {
  const nome = mesNome(mes).replace(/^./, c => c.toUpperCase());
  return `<div class="seletor-mes" role="group" aria-label="Mês">
    <a class="seta" href="#/${rotaBase}?mes=${somarMes(mes, -1)}" aria-label="Mês anterior">${icone('esquerda')}</a>
    <b>${esc(nome)}</b>
    ${mes < mesAtual ? `<a class="seta" href="#/${rotaBase}?mes=${somarMes(mes, 1)}" aria-label="Próximo mês">${icone('direita')}</a>` : `<span class="seta desligada">${icone('direita')}</span>`}
  </div>`;
}

/** Abas como links de rota. lista: [[id, nome, contador]] */
export function abas(tela, atual, lista, sufixo = '') {
  return `<nav class="abas" aria-label="Seções">${lista.map(([id, nome, n]) => `<a class="aba ${id === atual ? 'ativa' : ''}" href="#/${tela}/${id}${sufixo}" ${id === atual ? 'aria-current="page"' : ''}>${esc(nome)}${n ? `<span class="contador">${n}</span>` : ''}</a>`).join('')}</nav>`;
}

export const abaAtual = (rota, ids) => (ids.includes(rota.sub) ? rota.sub : ids[0]);

/** Linha de números em destaque. itens: [{ rotulo, valor, sub, classe }] */
export const fatos = itens => `<div class="fatos" style="--n:${itens.length}">${itens.map(f => `
  <div class="fato"><span>${esc(f.rotulo)}</span><strong class="${f.classe || ''}">${esc(f.valor)}</strong>${f.sub ? `<em>${esc(f.sub)}</em>` : ''}</div>`).join('')}</div>`;

export const campoForma = (formas, { rotulo = 'Forma de pagamento', valor = 'pix', nome = 'forma', semDinheiro = false } = {}) =>
  campo({ nome, rotulo, valor, opcoes: formas.filter(f => !semDinheiro || f.id !== 'dinheiro').map(f => ({ valor: f.id, texto: f.nome })) });

export const nomeForma = (formas, id) => (formas.find(f => f.id === id) || { nome: id || '' }).nome;

export const NOMES_AREA = {
  pdv: 'Loja e bilheteria',
  parque: 'Parque infantil',
  quadras: 'Quadras',
  eventos: 'Eventos e festas',
  alugueis: 'Aluguéis',
  outras: 'Outras receitas',
  despesas: 'Despesas',
  caucao: 'Cauções'
};

export function abrirCaixa(ctx) {
  abrirModal({
    titulo: 'Abrir o caixa',
    subtitulo: 'Conte o dinheiro que está na gaveta agora.',
    corpo: `<form>${campoDinheiro({ nome: 'fundo', rotulo: 'Troco na gaveta', placeholder: '0,00', ajuda: 'É o fundo de troco do dia. Não entra como venda.' })}</form>`,
    botao: 'Abrir o caixa',
    aoEnviar: d => ctx.acao('abrir-caixa', { fundo: d.fundo || 0 }, 'Caixa aberto.')
  });
}

/** Aviso para telas que recebem dinheiro: sem caixa aberto, só Pix e cartão. */
export const avisoCaixaFechado = () => `<div class="faixa-demo faixa-neutra">${icone('info')}<span><b>Caixa fechado.</b> Pix e cartão funcionam normalmente; para receber em dinheiro, abra o caixa.</span><button type="button" class="botao pequeno" data-abrir-caixa>Abrir o caixa</button></div>`;

export const valorOuTraco = v => (v ? dinheiro(v) : '—');
