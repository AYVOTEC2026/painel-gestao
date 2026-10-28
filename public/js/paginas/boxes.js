import { esc, icone, dinheiro, porcento, plural, selo, mesCurto, telefone, avisar, abrirModal, confirmar, campo, campoDinheiro, campoPorcento, validarEmPortugues } from '../ui.js';

const doisDigitos = n => String(n).padStart(2, '0');

function situacaoAluguel(v, id) {
  const abertas = (v.financeiro ? v.financeiro.alugueis : []).filter(c => c.boxId === id && c.status === 'aberto');
  if (!abertas.length) return { texto: 'Aluguel em dia', tipo: 'ok' };
  if (abertas.some(c => c.vencida)) return { texto: 'Aluguel vencido', tipo: 'problema' };
  return { texto: 'Aluguel a receber', tipo: 'atencao' };
}

function boxesLivres(v) {
  const usados = new Set(v.boxes.map(b => Number(b.box)));
  const livres = [];
  for (let n = 1; n <= v.parque.boxes; n += 1) if (!usados.has(n)) livres.push(n);
  return livres;
}

function camposContrato(v, b) {
  return `
    ${campo({ nome: 'nome', rotulo: 'Nome da operação', valor: b ? b.nome : '', obrigatorio: true, classe: 'inteira', placeholder: 'Como aparece no caixa. Ex.: Brasa & Burger' })}
    ${campo({ nome: 'responsavel', rotulo: 'Responsável', valor: b ? b.responsavel : '' })}
    ${campo({ nome: 'telefone', rotulo: 'WhatsApp', tipo: 'tel', valor: b ? b.telefone : '', placeholder: '(85) 99999-9999' })}
    ${campo({ nome: 'documento', rotulo: 'CPF ou CNPJ', valor: b ? b.documento : '', classe: 'inteira' })}
    ${campoDinheiro({ nome: 'aluguel', rotulo: 'Aluguel por mês', valor: b ? b.aluguel : '', placeholder: '0,00', dica: 'Lançado todo mês com vencimento no dia 10. Deixe zero se o box não paga aluguel.' })}
    ${campoPorcento({ nome: 'taxa', rotulo: 'Taxa sobre as vendas', valor: b ? b.taxa : v.parque.taxa, dica: 'Percentual de cada venda que fica com o food park.' })}`;
}

function novoLojista(ctx, boxEscolhido) {
  const v = ctx.visaoAtual();
  const livres = boxesLivres(v);
  if (!livres.length) { avisar('Todos os boxes estão ocupados. Aumente a quantidade em Configurações.', 'erro'); return; }
  const escolhido = livres.includes(Number(boxEscolhido)) ? Number(boxEscolhido) : livres[0];
  abrirModal({
    titulo: 'Cadastrar lojista',
    subtitulo: 'Depois de salvar, você monta o cardápio.',
    largo: true,
    corpo: `<form class="grade-form">
      ${campo({ nome: 'box', rotulo: 'Box', valor: escolhido, classe: 'inteira', opcoes: livres.map(n => ({ valor: n, texto: `Box ${doisDigitos(n)}` })) })}
      ${camposContrato(v, null)}
    </form>`,
    botao: 'Cadastrar lojista',
    aoEnviar: async d => {
      const r = await ctx.acao('novo-lojista', d, `${d.nome} cadastrado no box ${doisDigitos(d.box)}.`);
      if (r && r.boxId) setTimeout(() => painelDoBox(ctx, r.boxId, true), 60);
    }
  });
}

function editarContrato(ctx, id, reabrir) {
  const v = ctx.visaoAtual();
  const b = v.boxes.find(x => x.id === id);
  abrirModal({
    titulo: `Contrato do box ${doisDigitos(b.box)}`,
    largo: true,
    corpo: `<form class="grade-form">${camposContrato(v, b)}
      <p class="nota inteira">Mudança no aluguel vale a partir do próximo mês. Mudança na taxa vale para as próximas vendas.</p></form>`,
    botao: 'Salvar contrato',
    aoEnviar: async d => {
      await ctx.acao('editar-lojista', { boxId: id, ...d }, 'Contrato atualizado.');
      if (reabrir) reabrir();
    }
  });
}

function painelDoBox(ctx, id, recemCriado) {
  let modal;
  const conteudo = () => {
    const v = ctx.visaoAtual();
    const b = v.boxes.find(x => x.id === id);
    if (!b) return '<p class="nota">Este box não tem mais lojista.</p>';
    const r = (v.painel ? v.painel.ranking : []).find(x => x.id === id) || { total: 0, pedidos: 0, taxa: 0 };
    const alug = situacaoAluguel(v, id);
    const categorias = [...new Set(b.produtos.map(p => p.categoria))];
    return `
      ${recemCriado && !b.produtos.length ? `<div class="faixa-demo" style="margin:0 0 16px">${icone('info')}<span><b>Lojista cadastrado.</b> Agora inclua os itens do cardápio. Só itens com preço aparecem no caixa.</span></div>` : ''}
      <div class="ficha">
        <div><span>Vendido em ${esc(mesCurto(v.mesAtual))}</span><b>${esc(dinheiro(r.total))}</b></div>
        <div><span>Taxa do food park no mês</span><b>${esc(dinheiro(r.taxa))}</b></div>
        <div><span>Aluguel</span><b>${esc(dinheiro(b.aluguel))} por mês</b></div>
        <div><span>Taxa sobre as vendas</span><b>${esc(porcento(b.taxa))}</b></div>
        <div><span>Responsável</span><b>${esc(b.responsavel || 'Não informado')}</b></div>
        <div><span>WhatsApp</span><b>${esc(telefone(b.telefone) || 'Não informado')}</b></div>
      </div>
      <div class="cabecalho-acoes" style="margin-top:14px">
        ${selo(alug.texto, alug.tipo)}
        <span style="flex:1"></span>
        <button type="button" class="botao pequeno" data-p="editar">${icone('lapis')}Editar contrato</button>
        <button type="button" class="botao pequeno perigo" data-p="encerrar">Encerrar contrato</button>
      </div>
      <div class="separador"></div>
      <h3 style="font-size:17px">Cardápio</h3>
      <p class="nota" style="margin:3px 0 8px">Altere preço ou estoque e toque em Salvar. Pause o item quando acabar, sem perder o histórico.</p>
      ${b.produtos.length ? b.produtos.map(p => `
        <div class="cardapio-linha ${p.ativo ? '' : 'pausado'}" data-prod="${esc(p.id)}">
          <div><b>${esc(p.nome)}</b><small>${esc(p.categoria)}${p.ativo ? '' : ', pausado'}</small></div>
          <div class="campo-prefixo"><span>R$</span><input type="number" min="0" step="0.01" inputmode="decimal" value="${esc(p.preco)}" data-campo="preco" aria-label="Preço de ${esc(p.nome)}"></div>
          <input class="estoque-col" type="number" min="0" step="1" value="${p.estoque == null ? '' : esc(p.estoque)}" placeholder="Livre" data-campo="estoque" aria-label="Estoque de ${esc(p.nome)}" title="Estoque: deixe vazio para não controlar">
          <div class="cabecalho-acoes">
            <button type="button" class="botao pequeno oculto" data-p="salvar">Salvar</button>
            <button type="button" class="botao pequeno fantasma" data-p="${p.ativo ? 'pausar' : 'reativar'}" title="${p.ativo ? 'Pausar' : 'Reativar'} ${esc(p.nome)}">${icone(p.ativo ? 'pausa' : 'play')}${p.ativo ? 'Pausar' : 'Reativar'}</button>
          </div>
        </div>`).join('') : '<p class="nota" style="padding:10px 0">Nenhum item ainda.</p>'}
      <form id="formItem" class="grade-form" style="margin-top:16px;padding:14px;border-radius:14px;background:var(--papel)">
        <h3 class="inteira" style="font-size:15px">Incluir item</h3>
        ${campo({ nome: 'nome', rotulo: 'Nome do item', obrigatorio: true, classe: 'inteira', placeholder: 'Ex.: Smash burger' })}
        ${campoDinheiro({ nome: 'preco', rotulo: 'Preço', obrigatorio: true })}
        ${campo({ nome: 'categoria', rotulo: 'Categoria', valor: categorias[0] || 'Cardápio', extra: 'list="categoriasBox"' })}
        ${campo({ nome: 'estoque', rotulo: 'Estoque', tipo: 'number', extra: 'min="0" step="1"', placeholder: 'Livre', ajuda: 'Opcional. Vazio = sem controle.' })}
        <div class="campo" style="align-self:end"><button type="submit" class="botao primario">${icone('mais')}Incluir no cardápio</button></div>
        <datalist id="categoriasBox">${categorias.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
      </form>`;
  };
  const v0 = ctx.visaoAtual();
  const b0 = v0.boxes.find(x => x.id === id);
  if (!b0) return;
  modal = abrirModal({
    titulo: b0.nome,
    subtitulo: `Box ${doisDigitos(b0.box)}`,
    lateral: true,
    cancelar: 'Fechar',
    corpo: `<div id="painelBox">${conteudo()}</div>`
  });
  const area = modal.fundo.querySelector('#painelBox');
  const redesenhar = () => {
    if (!modal.fundo.isConnected) return;
    const v = ctx.visaoAtual();
    const b = v.boxes.find(x => x.id === id);
    if (b) modal.fundo.querySelector('.modal-cabeca h2').textContent = b.nome;
    area.innerHTML = conteudo();
    const formItem = area.querySelector('#formItem');
    if (formItem) validarEmPortugues(formItem);
  };

  area.addEventListener('input', e => {
    const linha = e.target.closest('.cardapio-linha');
    if (linha) linha.querySelector('[data-p="salvar"]').classList.remove('oculto');
  });
  area.addEventListener('submit', async e => {
    e.preventDefault();
    const form = e.target;
    const botao = form.querySelector('button[type=submit]');
    const d = Object.fromEntries(new FormData(form).entries());
    botao.classList.add('carregando');
    try {
      await ctx.acao('novo-produto', { boxId: id, ...d }, `${d.nome} incluído no cardápio.`);
      recemCriado = false;
      redesenhar();
      area.querySelector('#formItem input[name=nome]').focus();
    } catch (err) {
      avisar(err.message, 'erro');
      botao.classList.remove('carregando');
    }
  });
  area.addEventListener('click', async e => {
    const alvo = e.target.closest('[data-p]');
    if (!alvo) return;
    const acao = alvo.dataset.p;
    const linha = alvo.closest('.cardapio-linha');
    const produtoId = linha && linha.dataset.prod;
    try {
      if (acao === 'salvar') {
        alvo.classList.add('carregando');
        const estoque = linha.querySelector('[data-campo=estoque]').value;
        await ctx.acao('editar-produto', { boxId: id, produtoId, preco: linha.querySelector('[data-campo=preco]').value, estoque: estoque === '' ? null : estoque }, 'Item atualizado.');
        redesenhar();
      } else if (acao === 'pausar' || acao === 'reativar') {
        await ctx.acao('editar-produto', { boxId: id, produtoId, ativo: acao === 'reativar' }, acao === 'pausar' ? 'Item pausado. Ele some do caixa.' : 'Item de volta ao caixa.');
        redesenhar();
      } else if (acao === 'editar') {
        editarContrato(ctx, id, redesenhar);
      } else if (acao === 'encerrar') {
        const b = ctx.visaoAtual().boxes.find(x => x.id === id);
        const ok = await confirmar({
          titulo: `Encerrar o contrato de ${b.nome}?`,
          texto: `O box ${doisDigitos(b.box)} fica livre e o lojista some do caixa. O histórico de vendas continua no financeiro. Antes, o aluguel e o acerto do mês precisam estar quitados.`,
          botao: 'Encerrar contrato',
          perigo: true
        });
        if (!ok) return;
        await ctx.acao('encerrar-lojista', { boxId: id }, `Contrato encerrado. Box ${doisDigitos(b.box)} livre.`);
        modal.fechar();
      }
    } catch (err) {
      avisar(err.message, 'erro');
      alvo.classList.remove('carregando');
    }
  });
}

export default {
  titulo: 'Boxes e lojistas',
  descricao: ctx => {
    const v = ctx.visao;
    const aluguel = v.boxes.reduce((t, b) => t + (Number(b.aluguel) || 0), 0);
    return `${v.boxes.length} de ${v.parque.boxes} boxes ocupados. ${aluguel ? `Aluguéis somam ${dinheiro(aluguel)} por mês.` : ''} Toque em um box para ver o contrato e o cardápio.`;
  },
  ajuda: 'boxes',
  acoesCabecalho: ctx => boxesLivres(ctx.visao).length ? `<button type="button" class="botao primario" id="novoLojista">${icone('mais')}Cadastrar lojista</button>` : '',

  render(ctx) {
    const v = ctx.visao;
    const porNumero = new Map(v.boxes.map(b => [Number(b.box), b]));
    const ranking = new Map((v.painel ? v.painel.ranking : []).map(r => [r.id, r]));
    const placas = [];
    for (let n = 1; n <= v.parque.boxes; n += 1) {
      const b = porNumero.get(n);
      if (!b) {
        placas.push(`<button type="button" class="box-placa livre" data-livre="${n}">
          <span class="placa-numero"><small>Box</small>${doisDigitos(n)}</span>
          <span class="placa-info">Livre</span>
          <span class="mais">${icone('mais')}Cadastrar lojista</span>
        </button>`);
        continue;
      }
      const alug = situacaoAluguel(v, b.id);
      const r = ranking.get(b.id);
      const ativos = b.produtos.filter(p => p.ativo).length;
      placas.push(`<button type="button" class="box-placa ocupado" data-box="${esc(b.id)}">
        <span class="placa-numero"><small>Box</small>${doisDigitos(n)}</span>
        <b>${esc(b.nome)}</b>
        <span class="placa-info">${esc(dinheiro(b.aluguel))} por mês, taxa de ${esc(porcento(b.taxa))}</span>
        <span class="placa-info">${r && r.total ? `${esc(dinheiro(r.total))} vendidos no mês` : ativos ? esc(plural(ativos, 'item', 'itens') + ' no cardápio') : 'Cardápio vazio'}</span>
        ${selo(alug.texto, alug.tipo)}
      </button>`);
    }
    return `<div class="mapa">${placas.join('')}</div>`;
  },

  ligar(raiz, ctx) {
    const botao = raiz.querySelector('#novoLojista');
    if (botao) botao.addEventListener('click', () => novoLojista(ctx));
    raiz.querySelector('#corpoPagina').addEventListener('click', e => {
      const livre = e.target.closest('[data-livre]');
      if (livre) { novoLojista(ctx, livre.dataset.livre); return; }
      const ocupado = e.target.closest('[data-box]');
      if (ocupado) painelDoBox(ctx, ocupado.dataset.box);
    });
  }
};
