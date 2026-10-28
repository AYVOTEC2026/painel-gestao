import { esc, icone, dinheiro, hora, dataCurta, plural, selo, vazio, dica, avisar, abrirModal, confirmar, campo, campoDinheiro } from '../ui.js';

const L = window.AyvoFoodParkLedger;

/* O pedido em andamento fica aqui, para sobreviver a trocas de tela e redesenhos. */
let boxId = '';
let carrinho = [];
let pagamento = 'pix';
let desconto = '';
let mesa = '';
let cliente = '';
let busca = '';
let verTodas = false;
let comandaNaTela = false;

const limparPedido = () => { carrinho = []; desconto = ''; mesa = ''; cliente = ''; };

function boxAtual(v) {
  if (!v.boxes.some(b => b.id === boxId)) { boxId = v.boxes[0] ? v.boxes[0].id : ''; carrinho = []; }
  return v.boxes.find(b => b.id === boxId) || null;
}

/** Mesmo cálculo do servidor, feito aqui só para mostrar a divisão antes de confirmar. */
function cotar(v) {
  if (!carrinho.length || !boxId) return { cota: null, erro: '' };
  const estado = {
    park: { fees: v.parque.maquininha },
    stalls: v.boxes.map(b => ({
      id: b.id, status: 'ativo', feePercent: b.taxa,
      products: b.produtos.map(p => ({ id: p.id, name: p.nome, price: p.preco, category: p.categoria, active: p.ativo }))
    }))
  };
  try {
    return {
      cota: L.quoteSale(estado, {
        stallId: boxId, method: pagamento, discount: Number(desconto) || 0,
        items: carrinho.map(i => ({ productId: i.produtoId, qty: i.qtd }))
      }),
      erro: ''
    };
  } catch (err) {
    return { cota: null, erro: err.message };
  }
}

const itensResumo = itens => itens.map(i => `${i.qtd}× ${i.nome}`).join(', ');

/* ------------------------------------------------------------- pedaços */

function htmlEstado(v, ctx) {
  const c = v.caixa;
  if (!c) {
    return `<div class="estado-caixa"><div><b>Caixa fechado</b><br><span>Abra o caixa para começar a registrar vendas.</span></div>
      <div class="cabecalho-acoes"><button class="botao primario" data-a="abrir">${icone('caixa')}Abrir o caixa</button></div></div>`;
  }
  const deOutroDia = c.abertoEm.slice(0, 10) < v.hoje;
  return `<div class="estado-caixa">
    <span class="luz" aria-hidden="true"></span>
    <div><b>Caixa aberto ${deOutroDia ? 'desde ' + dataCurta(c.abertoEm) + ' às ' : 'às '}${esc(hora(c.abertoEm))}</b><br>
      <span>${esc(plural(c.pedidos, 'pedido', 'pedidos'))}, ${esc(dinheiro(c.total))}. Troco inicial de ${esc(dinheiro(c.fundo))}.${deOutroDia ? ' Feche este caixa e abra um novo para o dia de hoje.' : ''}</span></div>
    <div class="cabecalho-acoes">
      <button class="botao pequeno" data-a="sangria">Retirar dinheiro</button>
      <button class="botao pequeno" data-a="suprimento">Colocar troco</button>
      <button class="botao pequeno ${deOutroDia ? 'primario' : ''}" data-a="fechar">Fechar o caixa</button>
    </div>
  </div>`;
}

function htmlProdutos(box) {
  if (!box) return '';
  const termo = busca.trim().toLowerCase();
  const lista = box.produtos.filter(p => p.ativo && (!termo || p.nome.toLowerCase().includes(termo)));
  if (!box.produtos.some(p => p.ativo)) {
    return vazio({ icone: 'recibo', titulo: 'Cardápio vazio', texto: 'Este box ainda não tem itens à venda. A gestão cadastra o cardápio em Boxes e lojistas.' });
  }
  if (!lista.length) return `<p class="nota">Nenhum item com "${esc(busca)}".</p>`;
  const grupos = {};
  lista.forEach(p => { (grupos[p.categoria] = grupos[p.categoria] || []).push(p); });
  // Cardápio curto fica numa grade só, com a categoria dentro do cartão; títulos só ajudam em cardápio grande.
  const varias = Object.keys(grupos).length > 1 && lista.length > 8;
  return `<div class="produtos">${Object.keys(grupos).map(cat => `
    ${varias ? `<div class="categoria-titulo">${esc(cat)}</div>` : ''}
    ${grupos[cat].map(p => {
      const noPedido = (carrinho.find(i => i.produtoId === p.id) || {}).qtd || 0;
      const esgotado = p.estoque != null && p.estoque <= 0;
      return `<button type="button" class="produto" data-a="add" data-id="${esc(p.id)}" ${esgotado ? 'disabled' : ''}>
        ${noPedido ? `<span class="no-pedido">${noPedido}</span>` : ''}
        ${varias ? '' : `<span class="categoria">${esc(p.categoria)}</span>`}
        <b>${esc(p.nome)}</b>
        ${p.estoque != null ? `<small>${esgotado ? 'Esgotado' : `${p.estoque} em estoque`}</small>` : ''}
        <strong>${esc(dinheiro(p.preco))}</strong>
      </button>`;
    }).join('')}`).join('')}</div>`;
}

function htmlLinhas() {
  if (!carrinho.length) return '<div class="comanda-vazia">Toque nos itens ao lado para montar o pedido.</div>';
  return carrinho.map((i, n) => `
    <div class="comanda-linha">
      <div class="qtd">
        <button type="button" data-a="menos" data-n="${n}" aria-label="Tirar um ${esc(i.nome)}">${icone('menos')}</button>
        <span>${i.qtd}</span>
        <button type="button" data-a="mais" data-n="${n}" aria-label="Pôr mais um ${esc(i.nome)}">${icone('mais')}</button>
      </div>
      <div><b>${esc(i.nome)}</b><small>${esc(dinheiro(i.preco))} cada</small></div>
      <span class="valor">${esc(dinheiro(i.preco * i.qtd))}</span>
    </div>`).join('');
}

function htmlTotal(cota) {
  const bruto = carrinho.reduce((t, i) => t + i.preco * i.qtd, 0);
  const total = cota ? cota.total : bruto;
  return `<span>Total</span><div><strong>${esc(dinheiro(total))}</strong>${cota && cota.discount ? `<small>com ${esc(dinheiro(cota.discount))} de desconto</small>` : ''}</div>`;
}

function htmlDivisao(cota, erro) {
  if (erro) return `<div class="erro-form">${icone('alerta')}<span>${esc(erro)}</span></div>`;
  if (!cota) {
    return `<div class="divisao-titulo">Para onde vai o dinheiro ${dica('Cada venda é dividida entre o lojista, o food park (taxa sobre a venda) e a maquininha, quando é cartão.')}</div>
      <div class="divisao-barra"></div>
      <p class="nota" style="margin-top:8px">Monte o pedido para ver a divisão.</p>`;
  }
  const t = cota.total || 1;
  const pc = v => `${Math.max(0, (v / t) * 100)}%`;
  const fica = cota.holder === 'lojista'
    ? '<b>Dinheiro em espécie fica no box.</b> A taxa do food park fica a receber do lojista e é descontada no acerto do mês.'
    : '<b>O valor entra na conta do food park,</b> que repassa a parte do lojista no acerto do mês.';
  return `
    <div class="divisao-titulo">Para onde vai o dinheiro ${dica('Cada venda é dividida entre o lojista, o food park (taxa sobre a venda) e a maquininha, quando é cartão.')}</div>
    <div class="divisao-barra" role="img" aria-label="Lojista ${dinheiro(cota.netStall)}, food park ${dinheiro(cota.adminFee)}, maquininha ${dinheiro(cota.cardFee)}">
      <i class="lojista" style="width:${pc(cota.netStall)}"></i><i class="parque" style="width:${pc(cota.adminFee)}"></i>${cota.cardFee ? `<i class="maquininha" style="width:${pc(cota.cardFee)}"></i>` : ''}
    </div>
    <div class="divisao-legenda">
      <div><i style="background:var(--pinho)"></i><span>Lojista recebe</span><span class="num">${esc(dinheiro(cota.netStall))}</span></div>
      <div><i style="background:var(--brasa)"></i><span>Taxa do food park (${esc(String(cota.adminPercent).replace('.', ','))}%)</span><span class="num">${esc(dinheiro(cota.adminFee))}</span></div>
      ${cota.cardFee ? `<div><i style="background:#a7b6b1"></i><span>Maquininha (${esc(String(cota.feePercent).replace('.', ','))}%)</span><span class="num">${esc(dinheiro(cota.cardFee))}</span></div>` : ''}
    </div>
    <div class="divisao-quem">${fica}</div>`;
}

function htmlBotaoFinalizar(v, cota) {
  if (!v.caixa) return '<button type="button" class="botao grande largo" disabled>Abra o caixa para vender</button>';
  if (!cota) return '<button type="button" class="botao primario grande largo" disabled>Finalizar venda</button>';
  return `<button type="button" class="botao primario grande largo" data-a="finalizar">Finalizar venda de ${esc(dinheiro(cota.total))}</button>`;
}

function htmlComanda(v, box) {
  const { cota, erro } = cotar(v);
  return `<aside class="comanda" id="comanda" aria-label="Comanda">
    <div class="comanda-cabeca"><h2>Comanda</h2><span>${box ? `Box ${esc(String(box.box).padStart(2, '0'))}, ${esc(box.nome)}` : ''}</span></div>
    <div class="comanda-linhas" id="comandaLinhas">${htmlLinhas()}</div>
    <div class="comanda-extra">
      <div class="campo"><label for="pdvMesa">Mesa ou comanda</label><input id="pdvMesa" value="${esc(mesa)}" placeholder="Opcional" inputmode="numeric"></div>
      <div class="campo"><label for="pdvDesconto">Desconto</label><div class="campo-prefixo"><span>R$</span><input id="pdvDesconto" type="number" min="0" step="0.01" inputmode="decimal" value="${esc(desconto)}" placeholder="0,00"></div></div>
    </div>
    <div class="comanda-total" id="comandaTotal">${htmlTotal(cota)}</div>
    <div class="etapa-titulo" style="margin-top:14px"><span class="etapa-n">3</span><h2>Forma de pagamento</h2></div>
    <div class="formas" id="pdvFormas">${v.metodos.map(m => `<button type="button" class="forma ${m.id === pagamento ? 'ativa' : ''}" data-a="pagar" data-id="${esc(m.id)}" aria-pressed="${m.id === pagamento}">${esc(m.label)}</button>`).join('')}</div>
    <div class="divisao" id="comandaDivisao">${htmlDivisao(cota, erro)}</div>
    <div id="comandaBotao">${htmlBotaoFinalizar(v, cota)}</div>
  </aside>`;
}

function htmlVendasDoCaixa(v, ctx) {
  const c = v.caixa;
  if (!c) return '';
  if (!c.vendas.length) {
    return `<section class="bloco" style="margin-top:28px"><div class="bloco-cabeca"><div><h2>Vendas deste caixa</h2><p>As vendas aparecem aqui assim que forem finalizadas.</p></div></div></section>`;
  }
  const lista = verTodas ? c.vendas : c.vendas.slice(0, 12);
  return `<section class="bloco" style="margin-top:28px">
    <div class="bloco-cabeca"><div><h2>Vendas deste caixa</h2><p>Para corrigir uma venda, cancele e registre de novo. O cancelamento fica no histórico com o seu nome.</p></div></div>
    <div class="tabela-envolve"><table class="tabela">
      <thead><tr><th>Nº</th><th>Hora</th><th>Box</th><th class="so-largo">Itens</th><th class="so-largo">Pagamento</th><th class="num">Total</th><th></th></tr></thead>
      <tbody>${lista.map(s => `<tr class="${s.status === 'cancelada' ? 'apagada' : ''}">
        <td class="num">${esc(s.numero)}</td>
        <td class="num">${esc(hora(s.em))}</td>
        <td>${esc(s.boxNome)}</td>
        <td class="so-largo">${esc(itensResumo(s.itens))}${s.mesa ? `<small>Mesa ${esc(s.mesa)}</small>` : ''}</td>
        <td class="so-largo">${esc(s.pagamentoNome)}</td>
        <td class="num"><b>${esc(dinheiro(s.total))}</b></td>
        <td class="acoes">${s.status === 'cancelada' ? selo('Cancelada', 'problema') : s.acertada ? selo('Acertada', 'sem-ponto') : `<button class="botao pequeno perigo" data-a="cancelar" data-id="${esc(s.id)}">Cancelar</button>`}</td>
      </tr>`).join('')}</tbody>
    </table></div>
    ${c.vendas.length > 12 && !verTodas ? `<button class="botao fantasma pequeno" data-a="ver-todas" style="margin-top:10px">Ver as ${c.vendas.length} vendas</button>` : ''}
  </section>`;
}

function htmlFechamentos(v) {
  if (!v.fechamentos.length) return '';
  return `<section class="bloco" style="margin-top:18px">
    <div class="bloco-cabeca"><div><h2>Últimos fechamentos</h2><p>Diferença é o que foi contado menos o que o sistema esperava.</p></div></div>
    <div class="tabela-envolve"><table class="tabela">
      <thead><tr><th>Dia</th><th class="so-largo">Aberto</th><th class="so-largo">Fechado</th><th class="num so-largo">Esperado</th><th class="num">Contado</th><th class="num">Diferença</th></tr></thead>
      <tbody>${v.fechamentos.map(f => `<tr>
        <td>${esc(dataCurta(f.abertoEm))}</td><td class="num so-largo">${esc(hora(f.abertoEm))}</td><td class="num so-largo">${esc(hora(f.fechadoEm))}</td>
        <td class="num so-largo">${esc(dinheiro(f.esperado))}</td><td class="num">${esc(dinheiro(f.contado))}</td>
        <td class="num ${f.diferenca === 0 ? 'dif-zero' : f.diferenca < 0 ? 'dif-neg' : 'dif-pos'}">${f.diferenca === 0 ? 'Sem diferença' : esc(dinheiro(f.diferenca))}</td>
      </tr>`).join('')}</tbody>
    </table></div>
  </section>`;
}

function htmlBarraMovel(v) {
  const qtd = carrinho.reduce((t, i) => t + i.qtd, 0);
  const { cota } = cotar(v);
  const total = cota ? cota.total : carrinho.reduce((t, i) => t + i.preco * i.qtd, 0);
  return `<div class="barra-pedido-movel ${qtd && !comandaNaTela ? '' : 'oculta'}" id="barraMovel">
    <span>${esc(plural(qtd, 'item', 'itens'))}, ${esc(dinheiro(total))}</span>
    <button class="botao primario" data-a="ir-comanda">Ver comanda</button>
  </div>`;
}

/* ------------------------------------------------------------- modais */

function abrirCaixa(ctx) {
  abrirModal({
    titulo: 'Abrir o caixa',
    subtitulo: 'Conte o dinheiro que está na gaveta agora.',
    corpo: `<form>${campoDinheiro({ nome: 'fundo', rotulo: 'Troco na gaveta', valor: '', placeholder: '0,00', ajuda: 'É o fundo de troco do dia. Não entra como venda.' })}</form>`,
    botao: 'Abrir o caixa',
    aoEnviar: d => ctx.acao('abrir-caixa', { fundo: d.fundo || 0 }, 'Caixa aberto. Pode vender.')
  });
}

function movimento(ctx, tipo) {
  const sangria = tipo === 'sangria';
  abrirModal({
    titulo: sangria ? 'Retirar dinheiro do caixa' : 'Colocar troco no caixa',
    subtitulo: sangria ? 'Use quando a gaveta acumular notas demais (sangria).' : 'Use quando o troco acabar (suprimento).',
    corpo: `<form class="grade-form">
      ${campoDinheiro({ nome: 'valor', rotulo: 'Valor', obrigatorio: true, classe: 'inteira' })}
      ${campo({ nome: 'nota', rotulo: 'Motivo', classe: 'inteira', placeholder: sangria ? 'Ex.: levado ao cofre' : 'Ex.: troco trazido do banco' })}
    </form>`,
    botao: sangria ? 'Registrar retirada' : 'Registrar troco',
    aoEnviar: d => ctx.acao('movimento-caixa', { tipo, valor: d.valor, nota: d.nota }, sangria ? 'Retirada registrada.' : 'Troco registrado.')
  });
}

function fecharCaixa(ctx) {
  const v = ctx.visaoAtual();
  const c = v.caixa;
  const linha = m => `
    <div class="conferencia-linha">
      <span><b>${esc(m.label)}</b>${m.id === 'dinheiro' ? ` ${dica('Dinheiro em espécie recebido pelos boxes. Some o que cada box informar.')}` : ''}<span class="so-celular">No sistema: ${esc(dinheiro(c.esperado[m.id] || 0))}</span></span>
      <span class="num so-largo">${esc(dinheiro(c.esperado[m.id] || 0))}</span>
      <input name="${esc(m.id)}" type="number" min="0" step="0.01" inputmode="decimal" value="${(c.esperado[m.id] || 0).toFixed(2)}" aria-label="Valor contado em ${esc(m.label)}">
      <span class="num so-largo" data-dif="${esc(m.id)}"><span class="dif-zero">Confere</span></span>
    </div>`;
  const m = abrirModal({
    titulo: 'Fechar o caixa',
    subtitulo: `${plural(c.pedidos, 'pedido', 'pedidos')}, ${dinheiro(c.total)} desde ${hora(c.abertoEm)}.`,
    largo: true,
    corpo: `<form>
      <p class="nota" style="margin-bottom:14px">Já deixamos preenchido o valor que o sistema espera. <b>Confira com a maquininha e com o dinheiro</b> e mude só o que for diferente.</p>
      <div class="conferencia">
        <div class="conferencia-linha cabeca"><span>Forma</span><span class="num so-largo">No sistema</span><span class="num">Contado</span><span class="num so-largo">Diferença</span></div>
        ${v.metodos.map(linha).join('')}
      </div>
      <div class="recibo-linha total" id="difTotal" style="margin-top:14px"><span>Diferença total</span><span class="dif-zero">Sem diferença</span></div>
      ${campo({ nome: 'notas', rotulo: 'Observação', tipo: 'textarea', placeholder: 'Opcional. Ex.: falta de R$ 10 no dinheiro, troco errado no box 03.', classe: '' })}
    </form>`,
    botao: 'Fechar o caixa',
    aoEnviar: async d => {
      const contado = {};
      v.metodos.forEach(x => { contado[x.id] = Number(d[x.id]) || 0; });
      const r = await ctx.acao('fechar-caixa', { contado, notas: d.notas });
      const dif = r && r.diferenca;
      avisar(!dif ? 'Caixa fechado sem diferença.' : `Caixa fechado com ${dif < 0 ? 'falta' : 'sobra'} de ${dinheiro(Math.abs(dif))}.`);
    }
  });
  const atualizar = () => {
    let total = 0;
    v.metodos.forEach(x => {
      const campoEl = m.fundo.querySelector(`input[name="${x.id}"]`);
      const dif = Math.round(((Number(campoEl.value) || 0) - (c.esperado[x.id] || 0)) * 100) / 100;
      total += dif;
      const el = m.fundo.querySelector(`[data-dif="${x.id}"]`);
      el.innerHTML = dif === 0 ? '<span class="dif-zero">Confere</span>' : `<span class="${dif < 0 ? 'dif-neg' : 'dif-pos'}">${dif < 0 ? 'Falta ' : 'Sobra '}${esc(dinheiro(Math.abs(dif)))}</span>`;
    });
    total = Math.round(total * 100) / 100;
    m.fundo.querySelector('#difTotal span:last-child').outerHTML = total === 0
      ? '<span class="dif-zero">Sem diferença</span>'
      : `<span class="${total < 0 ? 'dif-neg' : 'dif-pos'}">${total < 0 ? 'Falta de ' : 'Sobra de '}${esc(dinheiro(Math.abs(total)))}</span>`;
  };
  m.fundo.addEventListener('input', atualizar);
}

function cancelarVenda(ctx, id) {
  const s = ctx.visaoAtual().caixa.vendas.find(x => x.id === id);
  if (!s) return;
  abrirModal({
    titulo: `Cancelar a venda ${s.numero}`,
    subtitulo: `${s.boxNome}, ${dinheiro(s.total)} no ${s.pagamentoNome}, às ${hora(s.em)}.`,
    corpo: `<form>
      <p class="nota" style="margin-bottom:12px">${esc(itensResumo(s.itens))}. O valor sai das contas e o estoque volta.</p>
      ${campo({ nome: 'motivo', rotulo: 'Motivo do cancelamento', obrigatorio: true, placeholder: 'Ex.: lançado no box errado', extra: 'minlength="3"' })}
    </form>`,
    botao: 'Cancelar a venda',
    botaoTipo: 'perigo cheio',
    cancelar: 'Voltar',
    aoEnviar: d => ctx.acao('cancelar-venda', { vendaId: id, motivo: d.motivo }, `Venda ${s.numero} cancelada.`)
  });
}

function recibo(ctx, vendaId) {
  const s = ctx.visaoAtual().caixa.vendas.find(x => x.id === vendaId);
  if (!s) return;
  abrirModal({
    titulo: `Venda ${s.numero} registrada`,
    subtitulo: `${s.boxNome}, às ${hora(s.em)}${s.mesa ? `, mesa ${s.mesa}` : ''}.`,
    corpo: `<div class="recibo">
      ${s.itens.map(i => `<div class="recibo-linha"><span>${i.qtd}× ${esc(i.nome)}</span><span>${esc(dinheiro(i.preco * i.qtd))}</span></div>`).join('')}
      ${s.desconto ? `<div class="recibo-linha"><span>Desconto</span><span>− ${esc(dinheiro(s.desconto))}</span></div>` : ''}
      <div class="recibo-linha total"><span>Total no ${esc(s.pagamentoNome)}</span><span>${esc(dinheiro(s.total))}</span></div>
    </div>
    <div class="divisao-legenda" style="margin-top:14px">
      <div><i style="background:var(--pinho)"></i><span>Lojista recebe</span><span class="num">${esc(dinheiro(s.liquidoLojista))}</span></div>
      <div><i style="background:var(--brasa)"></i><span>Taxa do food park</span><span class="num">${esc(dinheiro(s.taxaParque))}</span></div>
      ${s.taxaMaquininha ? `<div><i style="background:#a7b6b1"></i><span>Maquininha</span><span class="num">${esc(dinheiro(s.taxaMaquininha))}</span></div>` : ''}
    </div>`,
    cancelar: '',
    botao: 'Nova venda',
    aoEnviar: async () => {}
  });
}

/* --------------------------------------------------------------- tela */

export default {
  titulo: 'Caixa',
  descricao: 'Escolha o box, toque nos itens e na forma de pagamento. A divisão do valor aparece antes de confirmar.',
  ajuda: 'caixa',

  render(ctx) {
    const v = ctx.visao;
    if (!v.boxes.length) {
      return vazio({
        icone: 'boxes',
        titulo: 'Nenhum box com lojista ainda',
        texto: ctx.ehGestao ? 'Cadastre um lojista e o cardápio dele para começar a vender.' : 'Peça à gestão do food park para cadastrar os lojistas e os cardápios.',
        botao: ctx.ehGestao ? '<a class="botao primario" href="#/boxes">Cadastrar lojista</a>' : ''
      });
    }
    const box = boxAtual(v);
    return `
      ${htmlEstado(v, ctx)}
      <div class="pdv">
        <div>
          <div class="etapa-titulo"><span class="etapa-n">1</span><h2>Escolha o box</h2></div>
          <div class="box-chips" role="group" aria-label="Box">${v.boxes.map(b => `<button type="button" class="box-chip ${b.id === boxId ? 'ativo' : ''}" data-a="box" data-id="${esc(b.id)}" aria-pressed="${b.id === boxId}"><i>${esc(String(b.box).padStart(2, '0'))}</i>${esc(b.nome)}</button>`).join('')}</div>
          <div class="etapa-titulo"><span class="etapa-n">2</span><h2>Toque nos itens</h2>
            <div class="busca"><input id="pdvBusca" type="search" placeholder="Buscar item" value="${esc(busca)}" aria-label="Buscar item do cardápio"></div>
          </div>
          <div id="pdvProdutos">${htmlProdutos(box)}</div>
        </div>
        ${htmlComanda(v, box)}
      </div>
      ${htmlVendasDoCaixa(v, ctx)}
      ${htmlFechamentos(v)}
      ${htmlBarraMovel(v)}`;
  },

  ligar(raiz, ctx) {
    const corpo = raiz.querySelector('#corpoPagina');

    // No celular, a barra "Ver comanda" some enquanto a comanda está na tela, para não cobrir o botão de finalizar.
    let vigia = null;
    function vigiarComanda() {
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
    vigiarComanda();
    const v = () => ctx.visaoAtual();

    function atualizarPedido({ produtos = true } = {}) {
      const vis = v();
      const box = boxAtual(vis);
      const { cota, erro } = cotar(vis);
      if (produtos) corpo.querySelector('#pdvProdutos').innerHTML = htmlProdutos(box);
      corpo.querySelector('#comandaLinhas').innerHTML = htmlLinhas();
      corpo.querySelector('#comandaTotal').innerHTML = htmlTotal(cota);
      corpo.querySelector('#comandaDivisao').innerHTML = htmlDivisao(cota, erro);
      corpo.querySelector('#comandaBotao').innerHTML = htmlBotaoFinalizar(vis, cota);
      corpo.querySelectorAll('#pdvFormas .forma').forEach(b => {
        b.classList.toggle('ativa', b.dataset.id === pagamento);
        b.setAttribute('aria-pressed', String(b.dataset.id === pagamento));
      });
      const barra = corpo.querySelector('#barraMovel');
      if (barra) barra.outerHTML = htmlBarraMovel(vis);
    }

    async function finalizar(botao) {
      if (botao.classList.contains('carregando')) return; // toque duplo não registra duas vendas
      botao.classList.add('carregando');
      let r;
      try {
        r = await ctx.acao('vender', {
          boxId, pagamento, desconto: Number(desconto) || 0, mesa, cliente,
          itens: carrinho.map(i => ({ produtoId: i.produtoId, qtd: i.qtd }))
        });
      } catch (err) {
        avisar(err.message, 'erro');
        botao.classList.remove('carregando');
        return;
      }
      // Daqui em diante a venda já está gravada: nada abaixo pode sugerir que ela falhou.
      limparPedido();
      ctx.desenhar();
      if (r && r.vendaId) recibo(ctx, r.vendaId);
      else avisar('Venda registrada.');
    }

    corpo.addEventListener('click', async e => {
      const alvo = e.target.closest('[data-a]');
      if (!alvo || alvo.disabled) return;
      const a = alvo.dataset.a;
      const vis = v();
      if (a === 'box') {
        if (alvo.dataset.id === boxId) return;
        if (carrinho.length && !(await confirmar({ titulo: 'Trocar de box?', texto: 'Cada venda é de um box só. A comanda atual será esvaziada.', botao: 'Trocar e esvaziar' }))) return;
        boxId = alvo.dataset.id;
        limparPedido();
        corpo.querySelectorAll('.box-chip').forEach(b => {
          b.classList.toggle('ativo', b.dataset.id === boxId);
          b.setAttribute('aria-pressed', String(b.dataset.id === boxId));
        });
        corpo.querySelector('#comanda').outerHTML = htmlComanda(vis, boxAtual(vis));
        vigiarComanda();
        atualizarPedido();
      } else if (a === 'add') {
        const p = boxAtual(vis).produtos.find(x => x.id === alvo.dataset.id);
        const item = carrinho.find(i => i.produtoId === p.id);
        if (p.estoque != null && (item ? item.qtd : 0) + 1 > p.estoque) { avisar(`Só há ${p.estoque} de ${p.nome} em estoque.`, 'erro'); return; }
        if (item) item.qtd += 1; else carrinho.push({ produtoId: p.id, nome: p.nome, preco: p.preco, qtd: 1 });
        atualizarPedido();
      } else if (a === 'mais' || a === 'menos') {
        const item = carrinho[Number(alvo.dataset.n)];
        if (!item) return;
        if (a === 'mais') {
          const p = boxAtual(vis).produtos.find(x => x.id === item.produtoId);
          if (p && p.estoque != null && item.qtd + 1 > p.estoque) { avisar(`Só há ${p.estoque} de ${p.nome} em estoque.`, 'erro'); return; }
          item.qtd += 1;
        } else {
          item.qtd -= 1;
          if (item.qtd <= 0) carrinho.splice(Number(alvo.dataset.n), 1);
        }
        atualizarPedido();
      } else if (a === 'pagar') {
        pagamento = alvo.dataset.id;
        atualizarPedido({ produtos: false });
      } else if (a === 'finalizar') {
        finalizar(alvo);
      } else if (a === 'abrir') {
        abrirCaixa(ctx);
      } else if (a === 'sangria' || a === 'suprimento') {
        movimento(ctx, a);
      } else if (a === 'fechar') {
        fecharCaixa(ctx);
      } else if (a === 'cancelar') {
        cancelarVenda(ctx, alvo.dataset.id);
      } else if (a === 'ver-todas') {
        verTodas = true;
        ctx.desenhar();
      } else if (a === 'ir-comanda') {
        corpo.querySelector('#comanda').scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });

    corpo.addEventListener('input', e => {
      if (e.target.id === 'pdvBusca') {
        busca = e.target.value;
        corpo.querySelector('#pdvProdutos').innerHTML = htmlProdutos(boxAtual(v()));
      } else if (e.target.id === 'pdvDesconto') {
        desconto = e.target.value;
        atualizarPedido({ produtos: false });
      } else if (e.target.id === 'pdvMesa') {
        mesa = e.target.value;
      }
    });

    return () => { if (vigia) vigia.disconnect(); };
  }
};
