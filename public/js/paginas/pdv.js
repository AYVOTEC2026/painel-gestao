import { esc, icone, dinheiro, hora, dataCurta, plural, vazio, avisar, abrirModal, confirmar, campo, campoDinheiro, dica, classeLinha, botaoMostrarTudo } from '../ui.js';
import { abrirEntrada } from './parque.js';
import { abrirCaixa, nomeForma, NOMES_AREA, PERIODOS, tempoDoAluguel, htmlAlugados } from './comum.js';

/* O pedido em andamento fica aqui, para sobreviver às atualizações da tela. */
let carrinho = [];
let forma = 'pix';
let desconto = '';
let recebido = '';
let tipo = 'loja';
let busca = '';
let comandaNaTela = false;
// Quem leva os itens alugados, para cobrar a devolução.
let cliente = '';
let foneCliente = '';

const limpar = () => { carrinho = []; desconto = ''; recebido = ''; cliente = ''; foneCliente = ''; };
const centavos = v => Math.round((Number(String(v).replace(/\./g, '').replace(',', '.')) || 0) * 100);
const valorDaLinha = i => Math.round(i.preco * 100) * i.qtd * (i.periodos || 1);
const subtotal = () => carrinho.reduce((t, i) => t + valorDaLinha(i), 0);
const temAluguel = () => carrinho.some(i => i.periodo);
const MAX_PERIODOS = { hora: 8, dia: 7 };
const total = () => Math.max(0, subtotal() - centavos(desconto));

function htmlProdutos(d) {
  const termo = busca.trim().toLowerCase();
  const lista = d.produtos.filter(p => p.tipo === tipo && (!termo || p.nome.toLowerCase().includes(termo)));
  if (!lista.length) return termo ? `<p class="nota">Nenhum item com "${esc(busca)}".</p>` : vazio({ icone: 'loja', titulo: 'Nada cadastrado aqui', texto: 'A gestão cadastra produtos e ingressos em Loja e bilheteria.' });
  return `<div class="produtos">${lista.map(p => {
    const noPedido = (carrinho.find(i => i.produtoId === p.id) || {}).qtd || 0;
    const esgotado = p.controlaEstoque && p.estoque <= 0;
    const aluguel = p.tipo === 'aluguel';
    const estoque = aluguel ? (esgotado ? 'Todos alugados' : `${p.estoque} ${p.estoque === 1 ? 'livre' : 'livres'}`) : esgotado ? 'Esgotado' : `${p.estoque} em estoque`;
    return `<button type="button" class="produto ${aluguel ? 'de-aluguel' : ''}" data-a="add" data-id="${p.id}" ${esgotado ? 'disabled' : ''}>
      ${noPedido ? `<span class="no-pedido">${noPedido}</span>` : ''}
      <span class="categoria">${esc(p.categoria)}</span>
      <b>${esc(p.nome)}</b>
      ${p.controlaEstoque ? `<small>${estoque}</small>` : ''}
      <strong>${esc(dinheiro(p.preco))}${aluguel ? `<span class="periodo"> ${esc(PERIODOS[p.periodo])}</span>` : ''}</strong>
    </button>`;
  }).join('')}</div>`;
}

function htmlLinhas() {
  if (!carrinho.length) return '<div class="comanda-vazia">Toque nos itens para montar o pedido.</div>';
  return carrinho.map((i, n) => `
    <div class="comanda-linha">
      <div class="qtd">
        <button type="button" data-a="menos" data-n="${n}" aria-label="Tirar um ${esc(i.nome)}">${icone('menos')}</button>
        <span>${i.qtd}</span>
        <button type="button" data-a="mais" data-n="${n}" aria-label="Pôr mais um ${esc(i.nome)}">${icone('mais')}</button>
      </div>
      <div><b>${esc(i.nome)}</b>${i.periodo ? `<small>Aluguel, ${esc(dinheiro(i.preco))} ${esc(PERIODOS[i.periodo])}</small>${MAX_PERIODOS[i.periodo] ? `
        <label class="tempo-aluguel">Por <select data-a="periodos" data-n="${n}" aria-label="Tempo do aluguel de ${esc(i.nome)}">${Array.from({ length: MAX_PERIODOS[i.periodo] }, (_, k) => k + 1).map(k => `<option value="${k}" ${k === i.periodos ? 'selected' : ''}>${esc(tempoDoAluguel(i.periodo, k))}</option>`).join('')}</select></label>` : ''}` : `<small>${esc(dinheiro(i.preco))} cada</small>`}</div>
      <span class="valor">${esc(dinheiro(valorDaLinha(i) / 100))}</span>
    </div>`).join('');
}

/** Item alugado precisa de um nome: é com ele que a recepção cobra a devolução. */
function htmlCliente() {
  if (!temAluguel()) return '';
  return `<div class="comanda-cliente">
    <div class="campo"><label for="pdvCliente">Quem leva os itens alugados</label><input id="pdvCliente" value="${esc(cliente)}" placeholder="Nome" autocomplete="off"></div>
    <div class="campo"><label for="pdvFone">WhatsApp <span class="opcional">(opcional)</span></label><input id="pdvFone" type="tel" value="${esc(foneCliente)}" placeholder="(85) 99999-9999" autocomplete="off"></div>
  </div>`;
}

function htmlAlugadosFora(d) {
  if (!d.alugados.length) return '';
  const atrasados = d.alugados.filter(a => a.atrasado).length;
  return `<section class="bloco" style="margin-top:24px">
    <div class="bloco-cabeca"><div><h2>Itens alugados fora</h2><p>${plural(d.alugados.length, 'aluguel com cliente', 'aluguéis com clientes')}${atrasados ? `, ${plural(atrasados, 'passou', 'passaram')} da hora de voltar` : ''}. Quando o item voltar, toque em Devolvido.</p></div></div>
    ${htmlAlugados(d.alugados, d.agora)}
  </section>`;
}

function htmlTotal() {
  const desc = centavos(desconto);
  return `<span>Total</span><div><strong>${esc(dinheiro(total() / 100))}</strong>${desc ? `<small>com ${esc(dinheiro(desc / 100))} de desconto</small>` : ''}</div>`;
}

function htmlTroco() {
  if (forma !== 'dinheiro' || !carrinho.length) return '';
  const troco = centavos(recebido) - total();
  return `<div class="troco">
    <div class="campo"><label for="pdvRecebido">Cliente entregou</label><div class="campo-prefixo"><span>R$</span><input id="pdvRecebido" inputmode="decimal" value="${esc(recebido)}" placeholder="0,00"></div></div>
    <div class="troco-valor ${recebido && troco < 0 ? 'ruim' : ''}"><span>${recebido && troco < 0 ? 'Falta' : 'Troco'}</span><b>${recebido ? esc(dinheiro(Math.abs(troco) / 100)) : '—'}</b></div>
  </div>`;
}

function htmlBotao(d) {
  if (!d.caixa) return '<button type="button" class="botao grande largo" disabled>Abra o caixa para vender</button>';
  if (!carrinho.length) return '<button type="button" class="botao primario grande largo" disabled>Finalizar venda</button>';
  return `<button type="button" class="botao primario grande largo" data-a="finalizar">Finalizar venda de ${esc(dinheiro(total() / 100))}</button>`;
}

function htmlComanda(d) {
  return `<aside class="comanda" id="comanda" aria-label="Pedido">
    <div class="comanda-cabeca"><h2>Pedido</h2>${carrinho.length ? '<button type="button" class="botao fantasma pequeno" data-a="limpar">Limpar</button>' : ''}</div>
    <div class="comanda-linhas" id="comandaLinhas">${htmlLinhas()}</div>
    ${htmlCliente()}
    <div class="comanda-extra uma">
      <div class="campo"><label for="pdvDesconto">Desconto</label><div class="campo-prefixo"><span>R$</span><input id="pdvDesconto" inputmode="decimal" value="${esc(desconto)}" placeholder="0,00"></div></div>
    </div>
    <div class="comanda-total" id="comandaTotal">${htmlTotal()}</div>
    <div class="formas" id="pdvFormas" role="group" aria-label="Forma de pagamento">${d.formas.filter(f => f.id !== 'transferencia').map(f => `<button type="button" class="forma ${f.id === forma ? 'ativa' : ''}" data-a="forma" data-id="${esc(f.id)}" aria-pressed="${f.id === forma}">${esc(f.nome)}</button>`).join('')}</div>
    <div id="comandaTroco">${htmlTroco()}</div>
    <div id="comandaBotao">${htmlBotao(d)}</div>
  </aside>`;
}

function htmlEstado(d) {
  const c = d.caixa;
  if (!c) {
    return `<div class="estado-caixa"><div><b>Caixa fechado</b><br><span>Abra o caixa para vender na loja, na bilheteria e no parque.</span></div>
      <div class="cabecalho-acoes"><button class="botao primario" data-a="abrir">${icone('caixa')}Abrir o caixa</button></div></div>`;
  }
  const hoje = d.agora.slice(0, 10);
  const outroDia = c.abertoEm.slice(0, 10) < hoje;
  return `<div class="estado-caixa">
    <span class="luz" aria-hidden="true"></span>
    <div><b>Caixa aberto ${outroDia ? `desde ${dataCurta(c.abertoEm)} às ` : 'às '}${esc(hora(c.abertoEm))}</b><br>
      <span>${esc(plural(c.atendimentos, 'recebimento', 'recebimentos'))}, ${esc(dinheiro(c.recebido))} no total. ${esc(dinheiro(c.esperado.dinheiro))} em dinheiro na gaveta.${outroDia ? ' Feche este caixa e abra um novo para hoje.' : ''}</span></div>
    <div class="cabecalho-acoes">
      <button class="botao pequeno" data-a="sangria">Retirar dinheiro</button>
      <button class="botao pequeno" data-a="suprimento">Colocar troco</button>
      <button class="botao pequeno ${outroDia ? 'primario' : ''}" data-a="fechar">Fechar o caixa</button>
    </div>
  </div>`;
}

function htmlMovimento(d) {
  const c = d.caixa;
  if (!c) return '';
  if (!c.movimentos.length) return `<section class="bloco" style="margin-top:24px"><div class="bloco-cabeca"><div><h2>Movimento deste caixa</h2><p>Vendas, pulseiras e reservas recebidas aparecem aqui.</p></div></div></section>`;
  return `<section class="bloco" style="margin-top:24px">
    <div class="bloco-cabeca"><div><h2>Movimento deste caixa</h2><p>Tudo o que entrou e saiu desde a abertura, de todas as áreas.</p></div></div>
    <div class="tabela-envolve"><table class="tabela">
      <thead><tr><th>Hora</th><th>O quê</th><th class="so-largo">Área</th><th>Forma</th><th class="num">Valor</th><th></th></tr></thead>
      <tbody>${c.movimentos.map((m, i) => `<tr class="${m.cancelada && m.sentido === 'entrada' ? 'apagada' : ''} ${classeLinha(i)}">
        <td class="num">${esc(hora(m.em))}</td>
        <td>${esc(m.descricao)}</td>
        <td class="so-largo">${esc(NOMES_AREA[m.area] || m.area)}</td>
        <td>${esc(nomeForma(d.formas, m.forma))}</td>
        <td class="num"><b>${m.sentido === 'saida' ? '− ' : ''}${esc(dinheiro(m.valor))}</b></td>
        <td class="acoes">${m.cancelavel ? `<button class="botao pequeno perigo" data-a="cancelar" data-id="${m.origemId}" data-desc="${esc(m.descricao)}" data-valor="${m.valor}">Cancelar</button>` : m.cancelada && m.sentido === 'entrada' ? '<span class="selo problema">Cancelada</span>' : ''}</td>
      </tr>`).join('')}</tbody>
    </table></div>
    ${botaoMostrarTudo(c.movimentos.length)}
  </section>`;
}

function htmlFechamentos(d) {
  if (!d.fechamentos.length) return '';
  return `<section class="bloco" style="margin-top:18px">
    <div class="bloco-cabeca"><div><h2>Últimos fechamentos</h2><p>Diferença é o que foi contado menos o que o sistema esperava.</p></div></div>
    <div class="tabela-envolve"><table class="tabela">
      <thead><tr><th>Dia</th><th class="so-largo">Fechado por</th><th class="num so-largo">Esperado</th><th class="num">Contado</th><th class="num">Diferença</th></tr></thead>
      <tbody>${d.fechamentos.map(f => `<tr>
        <td>${esc(dataCurta(f.abertoEm))}, ${esc(hora(f.abertoEm))} às ${esc(hora(f.fechadoEm))}</td><td class="so-largo">${esc(f.fechadoPor || '')}</td>
        <td class="num so-largo">${esc(dinheiro(f.esperado))}</td><td class="num">${esc(dinheiro(f.contado))}</td>
        <td class="num ${f.diferenca === 0 ? 'dif-zero' : f.diferenca < 0 ? 'dif-neg' : 'dif-pos'}">${f.diferenca === 0 ? 'Sem diferença' : esc(dinheiro(f.diferenca))}</td>
      </tr>`).join('')}</tbody>
    </table></div>
  </section>`;
}

function htmlBarraMovel() {
  const qtd = carrinho.reduce((t, i) => t + i.qtd, 0);
  return `<div class="barra-pedido-movel ${qtd && !comandaNaTela ? '' : 'oculta'}" id="barraMovel">
    <span>${esc(plural(qtd, 'item', 'itens'))}, ${esc(dinheiro(total() / 100))}</span>
    <button class="botao primario" data-a="ir-comanda">Ver pedido</button>
  </div>`;
}

const semUnidades = p => (p.tipo === 'aluguel'
  ? `${p.estoque === 1 ? 'Só 1 unidade livre' : `Só ${p.estoque} unidades livres`} de ${p.nome} agora.`
  : `Só há ${p.estoque} de ${p.nome} em estoque.`);

/* -------------------------------------------------------------- modais */

function movimento(ctx, tipoMov) {
  const sangria = tipoMov === 'sangria';
  abrirModal({
    titulo: sangria ? 'Retirar dinheiro do caixa' : 'Colocar troco no caixa',
    subtitulo: sangria ? 'Quando a gaveta acumular notas demais (sangria).' : 'Quando o troco acabar (suprimento).',
    corpo: `<form class="grade-form">
      ${campoDinheiro({ nome: 'valor', rotulo: 'Valor', obrigatorio: true, classe: 'inteira' })}
      ${campo({ nome: 'nota', rotulo: 'Motivo', classe: 'inteira', placeholder: sangria ? 'Ex.: levado ao cofre' : 'Ex.: troco trazido do banco' })}
    </form>`,
    botao: sangria ? 'Registrar retirada' : 'Registrar troco',
    aoEnviar: d => ctx.acao('movimento-caixa', { tipo: tipoMov, valor: d.valor, nota: d.nota }, sangria ? 'Retirada registrada.' : 'Troco registrado.')
  });
}

function fecharCaixa(ctx) {
  const d = ctx.dadosAtuais();
  const c = d.caixa;
  const linha = f => `
    <div class="conferencia-linha">
      <span><b>${esc(f.nome)}</b>${f.id === 'dinheiro' ? ` ${dica('Troco inicial, mais o que entrou em dinheiro, mais reforços, menos retiradas.')}` : ''}<span class="so-celular">No sistema: ${esc(dinheiro(c.esperado[f.id] || 0))}</span></span>
      <span class="num so-largo">${esc(dinheiro(c.esperado[f.id] || 0))}</span>
      <input name="${esc(f.id)}" inputmode="decimal" value="${(c.esperado[f.id] || 0).toFixed(2).replace('.', ',')}" aria-label="Valor contado em ${esc(f.nome)}">
      <span class="num so-largo" data-dif="${esc(f.id)}"><span class="dif-zero">Confere</span></span>
    </div>`;
  const m = abrirModal({
    titulo: 'Fechar o caixa',
    subtitulo: `Aberto às ${hora(c.abertoEm)}, ${plural(c.atendimentos, 'recebimento', 'recebimentos')}.`,
    largo: true,
    corpo: `<form>
      <p class="nota" style="margin-bottom:14px">Já deixamos o valor que o sistema espera. <b>Conte o dinheiro da gaveta e confira a maquininha</b>; mude só o que for diferente.</p>
      <div class="conferencia">
        <div class="conferencia-linha cabeca"><span>Forma</span><span class="num so-largo">No sistema</span><span class="num">Contado</span><span class="num so-largo">Diferença</span></div>
        ${d.formas.map(linha).join('')}
      </div>
      <div class="recibo-linha total" id="difTotal" style="margin-top:14px"><span>Diferença total</span><span class="dif-zero">Sem diferença</span></div>
      ${campo({ nome: 'observacao', rotulo: 'Observação', tipo: 'textarea', placeholder: 'Opcional. Ex.: troco errado no fim da tarde.' })}
    </form>`,
    botao: 'Fechar o caixa',
    aoEnviar: async v => {
      const contado = {};
      d.formas.forEach(f => { contado[f.id] = v[f.id]; });
      await ctx.acao('fechar-caixa', { contado, observacao: v.observacao }, r => (!r || !r.diferenca ? 'Caixa fechado sem diferença.' : `Caixa fechado com ${r.diferenca < 0 ? 'falta' : 'sobra'} de ${dinheiro(Math.abs(r.diferenca))}.`));
    }
  });
  m.fundo.addEventListener('input', () => {
    let soma = 0;
    d.formas.forEach(f => {
      const dif = (centavos(m.fundo.querySelector(`input[name="${f.id}"]`).value) - Math.round((c.esperado[f.id] || 0) * 100)) / 100;
      soma += dif;
      m.fundo.querySelector(`[data-dif="${f.id}"]`).innerHTML = dif === 0 ? '<span class="dif-zero">Confere</span>' : `<span class="${dif < 0 ? 'dif-neg' : 'dif-pos'}">${dif < 0 ? 'Falta ' : 'Sobra '}${esc(dinheiro(Math.abs(dif)))}</span>`;
    });
    soma = Math.round(soma * 100) / 100;
    m.fundo.querySelector('#difTotal span:last-child').outerHTML = soma === 0 ? '<span class="dif-zero">Sem diferença</span>' : `<span class="${soma < 0 ? 'dif-neg' : 'dif-pos'}">${soma < 0 ? 'Falta de ' : 'Sobra de '}${esc(dinheiro(Math.abs(soma)))}</span>`;
  });
}

function cancelar(ctx, alvo) {
  abrirModal({
    titulo: 'Cancelar venda',
    subtitulo: `${alvo.dataset.desc}: ${dinheiro(Number(alvo.dataset.valor))}.`,
    corpo: `<form><p class="nota" style="margin-bottom:12px">O valor é estornado pela mesma forma de pagamento e o estoque volta.</p>${campo({ nome: 'motivo', rotulo: 'Motivo', obrigatorio: true, placeholder: 'Ex.: cobrado em duplicidade', extra: 'minlength="3"' })}</form>`,
    botao: 'Cancelar venda',
    botaoTipo: 'perigo cheio',
    cancelar: 'Voltar',
    aoEnviar: d => ctx.acao('cancelar-venda', { vendaId: Number(alvo.dataset.id), motivo: d.motivo }, 'Venda cancelada.')
  });
}

/* ---------------------------------------------------------------- tela */

export default {
  tela: 'pdv',
  aoVivo: true,
  podeAtualizar: () => carrinho.length === 0,
  titulo: 'PDV',
  descricao: 'O caixa da recepção: loja, aluguel de equipamentos, bilheteria e day use. As pulseiras do parque também entram aqui.',

  render(ctx) {
    const d = ctx.dados;
    carrinho = carrinho.filter(i => d.produtos.some(p => p.id === i.produtoId));
    return `
      ${htmlEstado(d)}
      <div class="pdv">
        <div>
          <div class="atalhos">
            <button type="button" class="atalho" data-a="pulseira">${icone('pulseira')}<span><b>Vender pulseira</b><small>Cadastra a criança e começa o tempo</small></span></button>
            <a class="atalho" href="#/quadras">${icone('quadra')}<span><b>Reservar quadra</b><small>Abre a agenda das quadras</small></span></a>
          </div>
          <div class="etapa-titulo">
            <div class="seg" role="group" aria-label="Tipo de item">
              ${[['loja', 'Loja'], ['aluguel', 'Aluguel'], ['ingresso', 'Bilheteria e day use']].map(([id, nome]) => `<button type="button" data-a="tipo" data-id="${id}" class="${tipo === id ? 'ativo' : ''}" aria-pressed="${tipo === id}">${nome}</button>`).join('')}
            </div>
            <div class="busca"><input id="pdvBusca" type="search" placeholder="Buscar item" value="${esc(busca)}" aria-label="Buscar item"></div>
          </div>
          <div id="pdvProdutos">${htmlProdutos(d)}</div>
        </div>
        ${htmlComanda(d)}
      </div>
      ${htmlAlugadosFora(d)}
      ${htmlMovimento(d)}
      ${htmlFechamentos(d)}
      ${htmlBarraMovel()}`;
  },

  ligar(raiz, ctx) {
    const corpo = raiz.querySelector('#corpoPagina');
    const d = () => ctx.dadosAtuais();

    const atualizar = ({ produtos = true } = {}) => {
      if (produtos) corpo.querySelector('#pdvProdutos').innerHTML = htmlProdutos(d());
      corpo.querySelector('#comanda').outerHTML = htmlComanda(d());
      vigiar();
      const barra = corpo.querySelector('#barraMovel');
      if (barra) barra.outerHTML = htmlBarraMovel();
    };
    const atualizarTotais = () => {
      corpo.querySelector('#comandaTotal').innerHTML = htmlTotal();
      corpo.querySelector('#comandaBotao').innerHTML = htmlBotao(d());
      const troco = corpo.querySelector('#comandaTroco');
      const foco = document.activeElement && document.activeElement.id;
      if (foco !== 'pdvRecebido') troco.innerHTML = htmlTroco();
      else {
        const t = centavos(recebido) - total();
        const el = troco.querySelector('.troco-valor');
        el.className = `troco-valor ${recebido && t < 0 ? 'ruim' : ''}`;
        el.innerHTML = `<span>${recebido && t < 0 ? 'Falta' : 'Troco'}</span><b>${recebido ? esc(dinheiro(Math.abs(t) / 100)) : '—'}</b>`;
      }
    };

    // No celular, a barra "Ver pedido" some enquanto o pedido está na tela.
    let vigia = null;
    function vigiar() {
      if (vigia) vigia.disconnect();
      const comanda = corpo.querySelector('#comanda');
      if (!comanda || !('IntersectionObserver' in window)) return;
      vigia = new IntersectionObserver(([e]) => {
        comandaNaTela = e.isIntersecting;
        const barra = corpo.querySelector('#barraMovel');
        if (barra) barra.classList.toggle('oculta', comandaNaTela || !carrinho.length);
      }, { threshold: 0.12 });
      vigia.observe(comanda);
    }
    vigiar();

    async function finalizar(botao) {
      if (botao.classList.contains('carregando')) return;
      if (forma === 'dinheiro' && recebido && centavos(recebido) < total()) { avisar('O valor entregue é menor que o total.', 'erro'); return; }
      if (temAluguel() && cliente.trim().length < 2) {
        avisar('Escreva o nome de quem leva os itens alugados.', 'erro');
        corpo.querySelector('#pdvCliente').focus();
        return;
      }
      botao.classList.add('carregando');
      const troco = forma === 'dinheiro' && recebido ? centavos(recebido) - total() : 0;
      const pedido = { itens: carrinho.map(i => ({ produtoId: i.produtoId, qtd: i.qtd, periodos: i.periodos })), desconto, forma, cliente, telefone: foneCliente };
      // Esvazia antes de redesenhar com a venda gravada; se o servidor recusar, o pedido volta.
      const antes = { carrinho: carrinho.map(i => ({ ...i })), desconto, recebido, cliente, foneCliente };
      limpar();
      try {
        const r = await ctx.acao('vender', pedido);
        avisar(`Venda ${String(r.numero).padStart(4, '0')} registrada.${troco > 0 ? ` Troco: ${dinheiro(troco / 100)}.` : ''}`);
      } catch (err) {
        ({ carrinho, desconto, recebido, cliente, foneCliente } = antes);
        avisar(err.message, 'erro');
        ctx.desenhar();
      }
    }

    corpo.addEventListener('click', async e => {
      if (e.target.closest('[data-abrir-caixa]')) return abrirCaixa(ctx);
      const devolver = e.target.closest('[data-devolver]');
      if (devolver) {
        devolver.classList.add('carregando');
        return ctx.acao('devolver-item', { itemId: Number(devolver.dataset.devolver) }, 'Devolução registrada. O item voltou para a prateleira.')
          .catch(err => { avisar(err.message, 'erro'); devolver.classList.remove('carregando'); });
      }
      const alvo = e.target.closest('[data-a]');
      if (!alvo || alvo.disabled) return;
      const a = alvo.dataset.a;
      if (a === 'add') {
        const p = d().produtos.find(x => x.id === Number(alvo.dataset.id));
        const item = carrinho.find(i => i.produtoId === p.id);
        if (p.controlaEstoque && (item ? item.qtd : 0) + 1 > p.estoque) return avisar(semUnidades(p), 'erro');
        if (item) item.qtd += 1;
        else carrinho.push({ produtoId: p.id, nome: p.nome, preco: p.preco, qtd: 1, ...(p.tipo === 'aluguel' ? { periodo: p.periodo, periodos: 1 } : {}) });
        atualizar();
      } else if (a === 'mais' || a === 'menos') {
        const item = carrinho[Number(alvo.dataset.n)];
        if (!item) return;
        if (a === 'mais') {
          const p = d().produtos.find(x => x.id === item.produtoId);
          if (p && p.controlaEstoque && item.qtd + 1 > p.estoque) return avisar(semUnidades(p), 'erro');
          item.qtd += 1;
        } else if ((item.qtd -= 1) <= 0) carrinho.splice(Number(alvo.dataset.n), 1);
        atualizar();
      } else if (a === 'limpar') {
        limpar();
        atualizar();
      } else if (a === 'forma') {
        forma = alvo.dataset.id;
        atualizar({ produtos: false });
      } else if (a === 'tipo') {
        tipo = alvo.dataset.id;
        corpo.querySelectorAll('[data-a="tipo"]').forEach(b => { b.classList.toggle('ativo', b === alvo); b.setAttribute('aria-pressed', String(b === alvo)); });
        corpo.querySelector('#pdvProdutos').innerHTML = htmlProdutos(d());
      } else if (a === 'finalizar') finalizar(alvo);
      else if (a === 'abrir') abrirCaixa(ctx);
      else if (a === 'sangria' || a === 'suprimento') movimento(ctx, a);
      else if (a === 'fechar') fecharCaixa(ctx);
      else if (a === 'cancelar') cancelar(ctx, alvo);
      else if (a === 'pulseira') {
        if (!d().caixa && !(await confirmar({ titulo: 'Caixa fechado', texto: 'Sem o caixa aberto, a pulseira só pode ser paga com Pix ou cartão. Continuar?', botao: 'Continuar' }))) return;
        abrirEntrada(ctx, { planos: d().planos, formas: d().formas });
      } else if (a === 'ir-comanda') corpo.querySelector('#comanda').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    corpo.addEventListener('change', e => {
      if (e.target.dataset.a !== 'periodos') return;
      const item = carrinho[Number(e.target.dataset.n)];
      if (!item) return;
      item.periodos = Number(e.target.value);
      atualizar({ produtos: false });
    });

    corpo.addEventListener('input', e => {
      if (e.target.id === 'pdvCliente') { cliente = e.target.value; return; }
      if (e.target.id === 'pdvFone') { foneCliente = e.target.value; return; }
      if (e.target.id === 'pdvBusca') {
        busca = e.target.value;
        corpo.querySelector('#pdvProdutos').innerHTML = htmlProdutos(d());
      } else if (e.target.id === 'pdvDesconto') {
        desconto = e.target.value;
        atualizarTotais();
      } else if (e.target.id === 'pdvRecebido') {
        recebido = e.target.value;
        atualizarTotais();
      }
    });
    return () => { if (vigia) vigia.disconnect(); };
  }
};
