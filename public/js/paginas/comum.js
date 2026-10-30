/* Peças repetidas entre as telas: mês, abas, números de destaque, forma de pagamento, caixa. */

import { esc, icone, dinheiro, dataCurta, hora, mesNome, somarMes, telefone, selo, tamanhoArquivo, abrirModal, campo, campoDinheiro, avisar, zonaDeArquivos } from '../ui.js';
import { api, tipoDoArquivo } from '../api.js';
import { lerNotaFiscal } from '../nota-fiscal.js';
import { zap, conversa, primeiroNome } from '../mensagens.js';

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

/* ------------------------------------------------- aluguel de equipamentos */

export const PERIODOS = { hora: 'por hora', dia: 'por dia', uso: 'por uso' };

/** Tempo escolhido no aluguel, como aparece na comanda: "2 h", "3 dias". */
export const tempoDoAluguel = (periodo, n) => (periodo === 'hora' ? `${n} h` : periodo === 'dia' ? (n === 1 ? '1 dia' : `${n} dias`) : 'por uso');

/** Hora de hoje ("17:10") ou de outro dia ("22:00 de 31/10"). */
const horaCombinada = (momento, agora) => (String(momento).slice(0, 10) === String(agora).slice(0, 10) ? hora(momento) : `${hora(momento)} de ${dataCurta(momento)}`);

const itemNaFrase = a => {
  const nome = a.nome.charAt(0).toLowerCase() + a.nome.slice(1);
  return a.qtd === 1 ? nome : `${a.qtd} unidades de ${nome}`;
};

/** Itens alugados que estão com clientes: quem levou, até quando, o atraso e a devolução. */
export function htmlAlugados(lista, agora) {
  return `<ul class="alugados">${lista.map(a => {
    const link = a.devolverAte
      ? zap('item_devolucao', a.telefone, { nome: primeiroNome(a.cliente), item: itemNaFrase(a), saiu: horaCombinada(a.saiuEm, agora), ate: horaCombinada(a.devolverAte, agora) })
      : conversa(a.telefone, a.cliente);
    return `<li class="${a.atrasado ? 'atrasado' : ''}">
      <div class="alugado-item"><b>${a.qtd}× ${esc(a.nome)}</b><small>${esc(a.cliente)}${a.telefone ? `, ${esc(telefone(a.telefone))}` : ''}</small></div>
      <div class="alugado-tempo">${!a.devolverAte ? '<span>Volta ao fim do uso</span>' : a.atrasado ? selo(`Devia ter voltado às ${horaCombinada(a.devolverAte, agora)}`, 'problema') : `<span>Volta até <b>${esc(horaCombinada(a.devolverAte, agora))}</b></span>`}<small>Saiu às ${esc(horaCombinada(a.saiuEm, agora))}</small></div>
      <div class="alugado-acoes">${link ? `<a class="botao pequeno fantasma" href="${esc(link)}" target="_blank" rel="noopener" aria-label="Chamar ${esc(a.cliente)} no WhatsApp">${icone('whatsapp')}</a>` : ''}<button type="button" class="botao pequeno" data-devolver="${a.id}">${icone('certo')}Devolvido</button></div>
    </li>`;
  }).join('')}</ul>`;
}

export const ACEITA_ARQUIVOS = 'application/pdf,image/jpeg,image/png,image/webp,.xml,text/xml,application/xml';
const TIPOS_ACEITOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/xml', 'text/xml'];

/** Confere tipo e tamanho antes de enviar: o erro aparece na hora, não depois do upload. */
export function arquivosValidos(lista) {
  return lista.filter(a => {
    if (!TIPOS_ACEITOS.includes(tipoDoArquivo(a))) { avisar(`${a.name}: envie PDF, XML, JPG, PNG ou WEBP.`, 'erro'); return false; }
    if (a.size > 10 * 1024 * 1024) { avisar(`${a.name} passa de 10 MB.`, 'erro'); return false; }
    return true;
  });
}

/** Envia vários arquivos para o mesmo dono (contrato, evento, despesa), um de cada vez. */
export async function enviarArquivos(tipo, id, arquivos) {
  let enviados = 0;
  for (const arquivo of arquivosValidos(arquivos)) {
    try {
      await api.enviarAnexo(tipo, id, arquivo);
      enviados += 1;
    } catch (err) {
      avisar(`${arquivo.name}: ${err.message}`, 'erro');
    }
  }
  return enviados;
}

/** Área do formulário onde se solta a nota. Os arquivos ficam guardados até salvar. */
export const zonaDaNota = (titulo, texto) => `<div class="inteira zona-arquivos" data-zona>
    ${icone('anexo')}<div><b>${esc(titulo)}</b><small>${esc(texto)}</small></div>
    <label class="botao pequeno">Escolher arquivos<input type="file" multiple accept="${ACEITA_ARQUIVOS}" data-arquivos class="so-leitor"></label>
  </div>
  <div class="inteira" data-lida></div>
  <ul class="anexos inteira" data-escolhidos></ul>`;

const htmlNotaLida = n => `<div class="nota-lida">${icone('certo')}<div>
  <b>${esc(n.modelo)} nº ${esc(n.numero || 'sem número')} lida</b>
  <span>${esc([n.emitente || 'Emitente não identificado', n.documento, n.valor ? dinheiro(n.valor) : '', n.emissao ? `emitida em ${dataCurta(n.emissao)}` : ''].filter(Boolean).join(', '))}</span>
  <small>Os campos abaixo foram preenchidos com os dados da nota. Confira antes de salvar.</small></div></div>`;

/**
 * Liga a zona da nota. Cada XML de NF-e ou NFS-e lido chama `aoLer(nota, preencher)`
 * para o formulário se preencher sozinho. Devolve a função que entrega os arquivos escolhidos.
 */
export function ligarZonaDaNota(fundo, aoLer) {
  let arquivos = [];
  const lista = fundo.querySelector('[data-escolhidos]');
  const preencher = (nome, valor) => {
    const el = fundo.querySelector(`[name=${nome}]`);
    if (!el || valor == null || valor === '') return;
    el.value = valor;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const mostrar = () => {
    lista.innerHTML = arquivos.map((a, i) => `<li>${icone(tipoDoArquivo(a) === 'application/xml' ? 'livro' : 'recibo')}<span>${esc(a.name)}</span><small>${esc(tamanhoArquivo(a.size))}</small><button type="button" class="botao fantasma pequeno" data-tirar="${i}" aria-label="Tirar ${esc(a.name)}">${icone('fechar')}</button></li>`).join('');
  };
  async function receber(novos) {
    const validos = arquivosValidos(novos);
    arquivos = arquivos.concat(validos);
    mostrar();
    // XML de nota tem poucos KB; um arquivo muito maior só é anexado, não lido.
    for (const a of validos.filter(x => tipoDoArquivo(x) === 'application/xml' && x.size < 2 * 1024 * 1024)) {
      const nota = lerNotaFiscal(await a.text());
      if (!nota) { avisar(`${a.name} não parece uma NF-e ou NFS-e. Ele vai anexado, mas preencha os campos à mão.`, 'erro'); continue; }
      aoLer(nota, preencher);
      fundo.querySelector('[data-lida]').innerHTML = htmlNotaLida(nota);
    }
  }
  zonaDeArquivos(fundo.querySelector('[data-zona]'), receber);
  fundo.querySelector('[data-arquivos]').addEventListener('change', e => { receber([...e.target.files]); e.target.value = ''; });
  lista.addEventListener('click', e => {
    const b = e.target.closest('[data-tirar]');
    if (b) { arquivos.splice(Number(b.dataset.tirar), 1); mostrar(); }
  });
  return () => arquivos;
}
