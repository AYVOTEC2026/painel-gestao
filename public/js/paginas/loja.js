import { esc, icone, dinheiro, dataCurta, hora, plural, selo, vazio, avisar, abrirModal, campo, campoDinheiro } from '../ui.js';
import { abas, abaAtual, seletorMes, fatos, campoForma, nomeForma, enviarArquivos, zonaDaNota, ligarZonaDaNota, PERIODOS, tempoDoAluguel, htmlAlugados } from './comum.js';

const ABAS = ['loja', 'aluguel', 'ingressos', 'vendas'];

/**
 * Cadastro do item. Produto da loja pode ser de venda (sai e não volta) ou de
 * aluguel (sai e volta, cobrado por tempo); o PDV trata cada um de um jeito.
 */
function salvarProduto(ctx, p, tipoNovo) {
  const inicial = p ? p.tipo : tipoNovo;
  const ingresso = inicial === 'ingresso';
  const m = abrirModal({
    titulo: p ? p.nome : ingresso ? 'Novo ingresso' : inicial === 'aluguel' ? 'Novo item para alugar' : 'Novo produto',
    subtitulo: ingresso ? '' : 'Venda sai do estoque e não volta. Aluguel sai, volta e fica livre para o próximo cliente.',
    largo: !ingresso,
    corpo: `<form class="grade-form">
      ${ingresso ? '' : `<fieldset class="inteira escolhas-tipo">
        <legend>Como este item sai do complexo?</legend>
        <label class="escolha"><input type="radio" name="tipo" value="loja" ${inicial !== 'aluguel' ? 'checked' : ''}>${icone('loja')}<span><b>Venda</b><small>Sai e não volta. Ex.: bola, garrafa, bebida.</small></span></label>
        <label class="escolha"><input type="radio" name="tipo" value="aluguel" ${inicial === 'aluguel' ? 'checked' : ''}>${icone('relogio')}<span><b>Aluguel</b><small>Sai e volta. Cobra por hora, por dia ou por uso. Ex.: raquete, guarda-sol.</small></span></label>
      </fieldset>`}
      ${campo({ nome: 'nome', rotulo: 'Nome', valor: p ? p.nome : '', obrigatorio: true, classe: 'inteira', placeholder: ingresso ? 'Ex.: Day use adulto' : 'Ex.: Raquete de beach tennis' })}
      ${campo({ nome: 'categoria', rotulo: 'Categoria', valor: p ? p.categoria : ingresso ? 'Day use' : '', placeholder: ingresso ? 'Day use' : 'Ex.: Raquetes, Bebidas, Praia' })}
      ${campoDinheiro({ nome: 'preco', rotulo: 'Preço', valor: p ? p.preco : '', obrigatorio: true })}
      <div class="grade-form inteira" data-so="aluguel">
        ${campo({ nome: 'periodo', rotulo: 'O preço vale', valor: p && p.periodo ? p.periodo : 'hora', opcoes: Object.entries(PERIODOS).map(([valor, texto]) => ({ valor, texto })), ajuda: 'Por hora e por dia, o PDV pergunta o tempo e calcula.' })}
        ${campo({ nome: 'unidades', rotulo: 'Unidades que o complexo tem', tipo: 'number', valor: p ? p.estoque + (p.fora || 0) : 1, obrigatorio: true, extra: 'min="1"', ajuda: p && p.fora ? `${p.fora} com clientes agora.` : 'O PDV não aluga mais do que isso ao mesmo tempo.' })}
      </div>
      <div class="inteira" data-so="loja">
        <label class="escolha"><input type="checkbox" name="controlaEstoque" ${!p || p.controlaEstoque ? 'checked' : ''}><span><b>Controlar estoque</b><small>O PDV avisa e bloqueia quando acabar.</small></span></label>
        <div class="grade-form" data-estoque style="margin-top:14px">
          ${p ? '' : campo({ nome: 'estoque', rotulo: 'Quantidade agora', tipo: 'number', valor: 0, extra: 'min="0"' })}
          ${campo({ nome: 'estoqueMinimo', rotulo: 'Avisar quando chegar a', tipo: 'number', valor: p ? p.estoqueMinimo : 3, extra: 'min="0"', ajuda: 'Aparece no painel como estoque baixo.' })}
        </div>
      </div>
      ${p ? `<label class="escolha inteira"><input type="checkbox" name="ativo" ${p.ativo ? 'checked' : ''}><span><b>No PDV</b><small>Desmarque para tirar do caixa sem apagar o histórico.</small></span></label>` : ''}
    </form>`,
    botao: p ? 'Salvar' : 'Cadastrar',
    aoEnviar: v => {
      const tipo = ingresso ? 'ingresso' : v.tipo;
      return ctx.acao('salvar-produto', {
        produtoId: p ? p.id : undefined, tipo, nome: v.nome, categoria: v.categoria, preco: v.preco, periodo: v.periodo, unidades: v.unidades,
        controlaEstoque: v.controlaEstoque === 'on', estoque: v.estoque, estoqueMinimo: v.estoqueMinimo, ativo: p ? v.ativo === 'on' : true
      }, p ? 'Item atualizado.' : tipo === 'aluguel' ? 'Item cadastrado para alugar.' : 'Cadastrado.');
    }
  });
  const f = m.fundo;
  // Mostra só os campos do tipo escolhido; os escondidos ficam desligados e não travam o envio.
  const mostrar = () => {
    const tipo = ingresso ? 'ingresso' : f.querySelector('[name=tipo]:checked').value;
    f.querySelectorAll('[data-so]').forEach(grupo => {
      const ligado = grupo.dataset.so === tipo;
      grupo.classList.toggle('oculto', !ligado);
      grupo.querySelectorAll('input, select').forEach(el => { el.disabled = !ligado; });
    });
    const caixa = f.querySelector('[name=controlaEstoque]');
    f.querySelector('[data-estoque]').classList.toggle('oculto', !caixa.checked);
  };
  f.querySelectorAll('[name=tipo], [name=controlaEstoque]').forEach(el => el.addEventListener('change', mostrar));
  mostrar();
}

function entradaEstoque(ctx, p) {
  const d = ctx.dadosAtuais();
  let arquivos = () => [];
  const m = abrirModal({
    titulo: `Entrada de estoque: ${p.nome}`,
    subtitulo: `Hoje há ${p.estoque} em estoque.`,
    largo: true,
    corpo: `<form class="grade-form">
      ${zonaDaNota('Nota fiscal da compra', 'Solte o XML ou o PDF da nota. Ela fica guardada na despesa da compra, pronta para o contador.')}
      ${campo({ nome: 'quantidade', rotulo: 'Quantas unidades chegaram', tipo: 'number', obrigatorio: true, extra: 'min="1"' })}
      ${campoDinheiro({ nome: 'custo', rotulo: 'Custo total da compra', placeholder: '0,00', ajuda: 'Opcional. Vira uma despesa de compra no financeiro.' })}
      ${campo({ nome: 'fornecedor', rotulo: 'Fornecedor', classe: 'inteira' })}
      ${campo({ nome: 'pessoaDocumento', rotulo: 'CNPJ do fornecedor', placeholder: '00.000.000/0000-00' })}
      ${campo({ nome: 'documentoNumero', rotulo: 'Número da nota', placeholder: 'Ex.: 4821' })}
      <label class="escolha inteira"><input type="checkbox" name="jaPaga" checked><span><b>Compra já paga</b><small>Se não marcar, fica em contas a pagar.</small></span></label>
      <div class="inteira" data-pago>${campoForma(d.formas, { semDinheiro: true })}</div>
      <div class="inteira oculto" data-vencimento>${campo({ nome: 'vencimento', rotulo: 'Vencimento', tipo: 'date' })}</div>
    </form>`,
    botao: 'Dar entrada',
    aoEnviar: async (v, { mostrarErro }) => {
      if (arquivos().length && !(Number(v.custo) > 0)) {
        mostrarErro('Informe o custo da compra. A nota fica anexada na despesa que ele gera.');
        return false;
      }
      const r = await ctx.acao('entrada-estoque', {
        produtoId: p.id, quantidade: v.quantidade, custo: v.custo, fornecedor: v.fornecedor, pessoaDocumento: v.pessoaDocumento,
        documentoNumero: v.documentoNumero, jaPaga: v.jaPaga === 'on', forma: v.forma, vencimento: v.vencimento
      });
      const enviados = arquivos().length && r && r.contaId ? await enviarArquivos('conta', r.contaId, arquivos()) : 0;
      if (enviados) await ctx.recarregar();
      avisar(enviados ? 'Estoque atualizado. A nota está na despesa da compra.' : 'Estoque atualizado.');
    }
  });
  m.fundo.querySelector('[name=jaPaga]').addEventListener('change', e => {
    m.fundo.querySelector('[data-pago]').classList.toggle('oculto', !e.target.checked);
    m.fundo.querySelector('[data-vencimento]').classList.toggle('oculto', e.target.checked);
  });
  arquivos = ligarZonaDaNota(m.fundo, (nota, preencher) => {
    preencher('fornecedor', nota.emitente);
    preencher('pessoaDocumento', nota.documento);
    preencher('documentoNumero', nota.numero);
    if (nota.valor) preencher('custo', nota.valor.toFixed(2));
    preencher('vencimento', nota.vencimento);
  });
}

function ajustarEstoque(ctx, p) {
  abrirModal({
    titulo: `Contagem de ${p.nome}`,
    subtitulo: `O sistema registra ${p.estoque} em estoque.`,
    corpo: `<form>${campo({ nome: 'contagem', rotulo: 'Quantidade contada na prateleira', tipo: 'number', valor: p.estoque, obrigatorio: true, extra: 'min="0"', ajuda: 'Use para corrigir perdas, quebras ou erros de contagem.' })}</form>`,
    botao: 'Ajustar estoque',
    aoEnviar: v => ctx.acao('ajustar-estoque', { produtoId: p.id, contagem: v.contagem }, 'Estoque ajustado.')
  });
}

function tabelaAluguel(d, lista) {
  if (!lista.length) {
    return vazio({ icone: 'relogio', titulo: 'Nenhum item para alugar', texto: 'Cadastre raquetes, guarda-sóis, cadeiras e bolas que saem e voltam. O PDV controla quem está com cada um.', botao: '<button type="button" class="botao primario" data-l="novo" data-tipo="aluguel">Cadastrar item para alugar</button>' });
  }
  return `<div class="tabela-envolve"><table class="tabela">
    <thead><tr><th>Item</th><th class="num">Preço</th><th>Unidades</th><th class="num so-largo">Aluguéis no mês</th><th></th></tr></thead>
    <tbody>${lista.map(p => {
      const total = p.estoque + p.fora;
      return `<tr class="${p.ativo ? '' : 'apagada'}">
        <td><b>${esc(p.nome)}</b><small>${esc(p.categoria)}${p.ativo ? '' : ', fora do PDV'}</small></td>
        <td class="num">${esc(dinheiro(p.preco))}<small>${esc(PERIODOS[p.periodo])}</small></td>
        <td><div class="unidades" role="img" aria-label="${p.fora} de ${total} com clientes">${Array.from({ length: Math.min(total, 24) }, (_, i) => `<i class="${i < p.fora ? 'fora' : ''}"></i>`).join('')}</div>
          <small>${p.estoque} ${p.estoque === 1 ? 'livre' : 'livres'}${p.fora ? `, ${p.fora} com clientes` : ''}</small></td>
        <td class="num so-largo">${p.vendidosMes}<small>${esc(dinheiro(p.valorMes))}</small></td>
        <td class="acoes"><button type="button" class="botao fantasma pequeno" data-l="editar" data-id="${p.id}" aria-label="Editar ${esc(p.nome)}">${icone('lapis')}</button></td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

function tabelaProdutos(lista, ingressos) {
  if (!lista.length) return vazio({ icone: ingressos ? 'pulseira' : 'loja', titulo: ingressos ? 'Nenhum ingresso cadastrado' : 'Nenhum produto cadastrado', texto: ingressos ? 'Cadastre o day use e outros ingressos para vender no PDV.' : 'Cadastre raquetes, bolas, acessórios e bebidas para vender no PDV.', botao: `<button type="button" class="botao primario" data-l="novo" data-tipo="${ingressos ? 'ingresso' : 'loja'}">Cadastrar</button>` });
  return `<div class="tabela-envolve"><table class="tabela">
    <thead><tr><th>${ingressos ? 'Ingresso' : 'Produto'}</th><th class="num">Preço</th>${ingressos ? '' : '<th class="num">Estoque</th>'}<th class="num so-largo">Vendidos no mês</th><th></th></tr></thead>
    <tbody>${lista.map(p => {
      const baixo = p.controlaEstoque && p.estoque <= p.estoqueMinimo;
      return `<tr class="${p.ativo ? '' : 'apagada'}">
        <td><b>${esc(p.nome)}</b><small>${esc(p.categoria)}${p.ativo ? '' : ', fora do PDV'}</small></td>
        <td class="num">${esc(dinheiro(p.preco))}</td>
        ${ingressos ? '' : `<td class="num">${p.controlaEstoque ? `${p.estoque}${baixo ? ` ${selo('Baixo', 'atencao')}` : ''}` : '<span class="nota">Livre</span>'}</td>`}
        <td class="num so-largo">${p.vendidosMes}<small>${esc(dinheiro(p.valorMes))}</small></td>
        <td class="acoes">
          ${!ingressos && p.controlaEstoque ? `<button type="button" class="botao pequeno" data-l="entrada" data-id="${p.id}">${icone('estoque')}Entrada</button><button type="button" class="botao fantasma pequeno" data-l="contagem" data-id="${p.id}">Contagem</button>` : ''}
          <button type="button" class="botao fantasma pequeno" data-l="editar" data-id="${p.id}" aria-label="Editar ${esc(p.nome)}">${icone('lapis')}</button>
        </td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

export default {
  tela: 'loja',
  params: rota => ({ mes: rota.query.mes }),
  titulo: 'Loja e bilheteria',
  descricao: 'Produtos à venda, itens para alugar, ingressos e day use: preços, estoque e o que saiu no PDV.',
  acoesCabecalho: ctx => {
    const aba = abaAtual(ctx.rota, ABAS);
    const [tipo, rotulo] = { loja: ['loja', 'Novo produto'], aluguel: ['aluguel', 'Novo item para alugar'], ingressos: ['ingresso', 'Novo ingresso'] }[aba] || [];
    return tipo ? `<button type="button" class="botao primario" data-l="novo" data-tipo="${tipo}">${icone('mais')}${rotulo}</button>` : '';
  },

  render(ctx) {
    const d = ctx.dados;
    const aba = abaAtual(ctx.rota, ABAS);
    const loja = d.produtos.filter(p => p.tipo === 'loja');
    const aluguel = d.produtos.filter(p => p.tipo === 'aluguel');
    const ingressos = d.produtos.filter(p => p.tipo === 'ingresso');
    const atrasados = d.alugados.filter(a => a.atrasado).length;
    const baixos = loja.filter(p => p.ativo && p.controlaEstoque && p.estoque <= p.estoqueMinimo);
    let conteudo;
    if (aba === 'vendas') {
      conteudo = `<section class="bloco"><div class="bloco-cabeca"><div><h2>Vendas do PDV</h2><p>${plural(d.totais.vendas, 'venda', 'vendas')}, ${esc(dinheiro(d.totais.valor))} no mês.</p></div></div>
        ${d.vendas.length ? `<div class="tabela-envolve"><table class="tabela">
          <thead><tr><th>Nº</th><th>Quando</th><th>Itens</th><th class="so-largo">Pagamento</th><th class="num">Total</th></tr></thead>
          <tbody>${d.vendas.map(v => `<tr class="${v.status === 'cancelada' ? 'apagada' : ''}">
            <td class="num">${esc(v.numero)}</td><td class="num">${esc(dataCurta(v.em))} ${esc(hora(v.em))}</td>
            <td>${esc(v.itens.map(i => `${i.qtd}× ${i.nome}${i.periodo ? ` (aluguel, ${tempoDoAluguel(i.periodo, i.periodos)})` : ''}`).join(', '))}${v.status === 'cancelada' ? `<small>Cancelada: ${esc(v.motivo || '')}</small>` : v.desconto ? `<small>Desconto de ${esc(dinheiro(v.desconto))}</small>` : ''}</td>
            <td class="so-largo">${esc(nomeForma(d.formas, v.forma))}</td><td class="num"><b>${esc(dinheiro(v.total))}</b></td>
          </tr>`).join('')}</tbody>
        </table></div>` : '<p class="nota">Nenhuma venda neste mês.</p>'}</section>`;
    } else if (aba === 'aluguel') {
      conteudo = `<section class="bloco">${tabelaAluguel(d, aluguel)}</section>
        ${d.alugados.length ? `<section class="bloco">
          <div class="bloco-cabeca"><div><h2>Com clientes agora</h2><p>${plural(d.alugados.length, 'aluguel', 'aluguéis')}${atrasados ? `, ${plural(atrasados, 'passou', 'passaram')} da hora de voltar` : ''}. A recepção registra a devolução no PDV.</p></div></div>
          ${htmlAlugados(d.alugados, d.agora)}
        </section>` : ''}`;
    } else {
      conteudo = `<section class="bloco">${tabelaProdutos(aba === 'ingressos' ? ingressos : loja, aba === 'ingressos')}</section>`;
    }
    return `
      ${fatos([
        { rotulo: 'Vendas no mês', valor: dinheiro(d.totais.valor), sub: plural(d.totais.vendas, 'venda no PDV', 'vendas no PDV') },
        { rotulo: 'Alugados agora', valor: String(d.alugados.reduce((t, a) => t + a.qtd, 0)), sub: atrasados ? plural(atrasados, 'aluguel atrasado', 'aluguéis atrasados') : 'Nenhum atrasado', classe: atrasados ? 'negativo' : '' },
        { rotulo: 'Day use hoje', valor: String(d.dayUseHoje), sub: d.dayUseHoje === 1 ? 'ingresso vendido' : 'ingressos vendidos' },
        { rotulo: 'Estoque baixo', valor: String(baixos.length), sub: baixos.length ? baixos.slice(0, 2).map(p => p.nome).join(', ') : 'Tudo abastecido', classe: baixos.length ? 'negativo' : '' }
      ])}
      <div class="abas-linha">
        ${abas('loja', aba, [['loja', 'Produtos à venda', baixos.length], ['aluguel', 'Itens para alugar', atrasados], ['ingressos', 'Ingressos e day use'], ['vendas', 'Vendas do mês']], aba === 'vendas' ? `?mes=${d.mes}` : '')}
        ${aba === 'vendas' ? seletorMes(d.mes, d.agora.slice(0, 7), 'loja/vendas') : ''}
      </div>
      ${conteudo}`;
  },

  ligar(raiz, ctx) {
    // .pagina é recriada a cada desenho; inclui o botão do cabeçalho e o corpo.
    raiz.querySelector('.pagina').addEventListener('click', e => {
      const devolver = e.target.closest('[data-devolver]');
      if (devolver) {
        devolver.classList.add('carregando');
        ctx.acao('devolver-item', { itemId: Number(devolver.dataset.devolver) }, 'Devolução registrada.').catch(err => { avisar(err.message, 'erro'); devolver.classList.remove('carregando'); });
        return;
      }
      const alvo = e.target.closest('[data-l]');
      if (!alvo) return;
      const p = ctx.dadosAtuais().produtos.find(x => x.id === Number(alvo.dataset.id));
      if (alvo.dataset.l === 'novo') return salvarProduto(ctx, null, alvo.dataset.tipo);
      if (!p) return;
      if (alvo.dataset.l === 'editar') salvarProduto(ctx, p);
      if (alvo.dataset.l === 'entrada') entradaEstoque(ctx, p);
      if (alvo.dataset.l === 'contagem') ajustarEstoque(ctx, p);
    });
  }
};
