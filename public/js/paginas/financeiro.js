import { esc, icone, dinheiro, porcento, dataCurta, dataHora, mesNome, mesCurto, somarMes, plural, selo, vazio, dica, avisar, abrirModal, campo, campoDinheiro, opcoesPagamento } from '../ui.js';
import { api } from '../api.js';

const ABAS = [
  ['resumo', 'Resumo do mês'],
  ['repasses', 'Acerto com lojistas'],
  ['alugueis', 'Aluguéis'],
  ['contas', 'Contas'],
  ['livro', 'Livro contábil'],
  ['contador', 'Para o contador']
];

const CATEGORIAS = { energia: 'Energia', agua: 'Água', marketing: 'Marketing', manutencao: 'Manutenção', folha: 'Folha e encargos', outras: 'Outras' };

const abaAtual = ctx => (ABAS.some(a => a[0] === ctx.rota.sub) ? ctx.rota.sub : 'resumo');
const doisDigitos = n => String(n).padStart(2, '0');

function linkAba(ctx, aba) {
  return `#/financeiro/${aba}?mes=${ctx.visao.mes}`;
}

/* ---------------------------------------------------------------- abas */

function resumo(ctx) {
  const v = ctx.visao;
  const f = v.financeiro;
  const d = f.dre;
  const receitas = d.lines.filter(l => l.nature === 'receita');
  const despesas = d.lines.filter(l => l.nature === 'despesa');
  const comValor = despesas.filter(l => l.amount !== 0);
  const totalMetodos = Object.values(f.porMetodo).reduce((t, x) => t + x, 0) || 1;
  return `
    <div class="duas-colunas" style="margin-top:0">
      <section class="bloco">
        <div class="bloco-cabeca"><div><h2>Resultado de ${esc(mesNome(v.mes))}</h2><p>O que é do food park: aluguéis e taxas, menos as despesas da praça.</p></div></div>
        <div class="dre">
          <div class="dre-grupo">Entrou para o food park</div>
          ${receitas.map(l => `<div class="dre-linha ${l.amount ? '' : 'zero'}"><span>${esc(l.label)}</span><span class="num">${esc(dinheiro(l.amount))}</span></div>`).join('')}
          <div class="dre-linha subtotal"><span>Total de receitas</span><span class="num">${esc(dinheiro(d.revenue))}</span></div>
          <div class="dre-grupo">Saiu</div>
          ${comValor.length ? comValor.map(l => `<div class="dre-linha"><span>${esc(l.label)}</span><span class="num">− ${esc(dinheiro(l.amount))}</span></div>`).join('') : '<div class="dre-linha zero"><span>Nenhuma despesa lançada</span><span class="num">R$ 0,00</span></div>'}
          <div class="dre-linha subtotal"><span>Total de despesas</span><span class="num">− ${esc(dinheiro(d.expense))}</span></div>
        </div>
        <div class="dre-resultado ${d.result < 0 ? 'negativo' : ''}"><span>${d.result < 0 ? 'Prejuízo do mês' : 'Lucro do mês'}</span><strong>${esc(dinheiro(d.result))}</strong></div>
      </section>
      <section class="bloco">
        <div class="bloco-cabeca"><div><h2>Faturamento dos boxes ${dica('Tudo o que os clientes pagaram. A maior parte é dos lojistas, por isso não entra como receita do food park.')}</h2><p>Dinheiro que passou pelo caixa em ${esc(mesCurto(v.mes))}.</p></div></div>
        <div class="fato" style="padding:0 0 14px"><strong style="font-size:32px">${esc(dinheiro(d.grossSales))}</strong><em>${esc(plural(d.tickets, 'pedido', 'pedidos'))}, ticket médio de ${esc(dinheiro(d.averageTicket))}</em></div>
        <div class="ranking">${v.metodos.map(m => {
          const valor = f.porMetodo[m.id] || 0;
          return `<div class="ranking-linha" style="grid-template-columns:minmax(0,1fr) auto">
            <div><b>${esc(m.label)}</b><div class="ranking-trilho"><i style="width:${Math.round((valor / totalMetodos) * 100)}%;background:${m.holder === 'lojista' ? 'var(--pinho-3)' : 'var(--brasa)'}"></i></div></div>
            <div class="num">${esc(dinheiro(valor))}<small>${m.holder === 'lojista' ? 'fica no box' : 'entra no food park'}</small></div>
          </div>`;
        }).join('')}</div>
        <p class="nota" style="margin-top:14px">Os lojistas pagaram ${esc(dinheiro(d.cardFeesOnStalls))} de maquininha neste mês. Esse custo é descontado deles, não do food park.</p>
      </section>
    </div>`;
}

function repasses(ctx) {
  const v = ctx.visao;
  const linhas = v.financeiro.repasse;
  const pendentes = linhas.filter(r => r.direction !== 'zerado');
  return `
    <div class="explica">
      <div>${icone('dinheiro')}<b>Dinheiro em espécie fica no box</b><p>O lojista fica devendo a taxa do food park sobre essas vendas.</p></div>
      <div>${icone('cartao')}<b>Pix e cartão entram no food park</b><p>O food park guarda a parte do lojista, já sem taxa e sem maquininha.</p></div>
      <div>${icone('troca')}<b>O acerto compensa tudo</b><p>Uma conta só por lojista, com o aluguel em aberto descontado.</p></div>
    </div>
    <section class="bloco">
      <div class="bloco-cabeca"><div><h2>Acerto de ${esc(mesNome(v.mes))}</h2><p>${pendentes.length ? `${plural(pendentes.length, 'lojista com acerto pendente', 'lojistas com acerto pendente')}.` : 'Todos os lojistas estão acertados neste mês.'} Costuma ser feito no começo do mês seguinte.</p></div></div>
      ${linhas.length ? `<div class="tabela-envolve"><table class="tabela">
        <thead><tr><th>Box</th><th class="num so-largo">Vendido</th><th class="num so-largo">Taxas descontadas</th><th class="num so-largo">Aluguel em aberto</th><th>Acerto</th><th></th></tr></thead>
        <tbody>${linhas.map(r => `<tr>
          <td><b>${esc(r.name)}</b><small>Box ${esc(doisDigitos(r.box))}, ${esc(plural(r.sales, 'venda', 'vendas'))}</small></td>
          <td class="num so-largo">${esc(dinheiro(r.gross))}</td>
          <td class="num so-largo">${esc(dinheiro(r.adminFee + r.cardFee))}<small>food park ${esc(dinheiro(r.adminFee))}</small></td>
          <td class="num so-largo">${esc(dinheiro(r.rentOpen))}</td>
          <td>${r.direction === 'zerado' ? selo('Acertado', 'ok') : r.direction === 'pagar_lojista' ? `<b>Pagar ${esc(dinheiro(r.amount))}</b><small>ao lojista</small>` : `<b>Receber ${esc(dinheiro(r.amount))}</b><small>do lojista</small>`}</td>
          <td class="acoes">${r.direction === 'zerado' ? '' : `<button class="botao pequeno primario" data-f="acerto" data-id="${esc(r.stallId)}">Fazer acerto</button>`}</td>
        </tr>`).join('')}</tbody>
      </table></div>` : vazio({ icone: 'boxes', titulo: 'Nenhum lojista', texto: 'Cadastre os lojistas em Boxes e lojistas para o acerto aparecer aqui.' })}
    </section>`;
}

function alugueis(ctx) {
  const v = ctx.visao;
  const lista = v.financeiro.alugueis;
  return `<section class="bloco">
    <div class="bloco-cabeca"><div><h2>Aluguéis</h2><p>Os de ${esc(mesNome(v.mes))} e os que ainda estão em aberto de outros meses. Também podem ser descontados no acerto com o lojista.</p></div></div>
    ${lista.length ? `<div class="tabela-envolve"><table class="tabela">
      <thead><tr><th>Box</th><th class="so-largo">Mês</th><th class="so-largo">Vencimento</th><th class="num">Valor</th><th>Situação</th><th></th></tr></thead>
      <tbody>${lista.map(c => `<tr>
        <td><b>${esc(c.boxNome)}</b><small>Box ${esc(c.box)}</small></td>
        <td class="so-largo">${esc(mesCurto(c.competencia))}</td>
        <td class="num so-largo">${esc(dataCurta(c.vencimento))}</td>
        <td class="num"><b>${esc(dinheiro(c.valor))}</b></td>
        <td>${c.status === 'pago' ? selo(c.forma === 'repasse' ? 'Descontado no acerto' : 'Recebido em ' + dataCurta(c.pagoEm), 'ok') : c.vencida ? selo('Vencido', 'problema') : selo('A receber', 'atencao')}</td>
        <td class="acoes">${c.status === 'aberto' ? `<button class="botao pequeno" data-f="aluguel" data-id="${esc(c.id)}">Registrar recebimento</button>` : ''}</td>
      </tr>`).join('')}</tbody>
    </table></div>` : vazio({ icone: 'recibo', titulo: 'Nenhum aluguel neste mês', texto: 'Os aluguéis são lançados sozinhos no começo de cada mês para os boxes com aluguel.' })}
  </section>`;
}

function contas(ctx) {
  const lista = ctx.visao.financeiro.contas;
  return `<section class="bloco">
    <div class="bloco-cabeca"><div><h2>Contas a pagar e a receber</h2><p>Despesas da praça (energia, água, manutenção) e receitas avulsas, como um evento. Entram no resultado no mês em que são lançadas.</p></div>
      <button class="botao primario" data-f="nova-conta">${icone('mais')}Lançar conta</button></div>
    ${lista.length ? `<div class="tabela-envolve"><table class="tabela">
      <thead><tr><th>Descrição</th><th class="so-largo">Categoria</th><th class="so-largo">Vencimento</th><th class="num">Valor</th><th>Situação</th><th></th></tr></thead>
      <tbody>${lista.map(b => `<tr>
        <td><b>${esc(b.descricao)}</b><small>${b.tipo === 'pagar' ? 'A pagar' : 'A receber'}</small></td>
        <td class="so-largo">${esc(b.tipo === 'pagar' ? CATEGORIAS[b.categoria] || 'Outras' : 'Receita')}</td>
        <td class="num so-largo">${esc(dataCurta(b.vencimento))}</td>
        <td class="num"><b>${b.tipo === 'pagar' ? '− ' : ''}${esc(dinheiro(b.valor))}</b></td>
        <td>${b.status === 'pago' ? selo(b.tipo === 'pagar' ? 'Paga' : 'Recebida', 'ok') : b.vencida ? selo('Vencida', 'problema') : selo('Em aberto', 'atencao')}</td>
        <td class="acoes">${b.status === 'aberto' ? `<button class="botao pequeno" data-f="baixar" data-id="${esc(b.id)}">${b.tipo === 'pagar' ? 'Registrar pagamento' : 'Registrar recebimento'}</button>` : ''}</td>
      </tr>`).join('')}</tbody>
    </table></div>` : vazio({ icone: 'recibo', titulo: 'Nenhuma conta lançada', texto: 'Lance energia, água e outras despesas para o resultado do mês ficar correto.', botao: `<button class="botao primario" data-f="nova-conta">${icone('mais')}Lançar conta</button>` })}
  </section>`;
}

function livro(ctx) {
  const v = ctx.visao;
  const f = v.financeiro;
  return `<section class="bloco">
    <div class="bloco-cabeca"><div><h2>Livro contábil de ${esc(mesNome(v.mes))}</h2><p>Cada operação gera um débito e um crédito do mesmo valor (partidas dobradas). Você não precisa mexer aqui: é o registro que o contador confere.</p></div>
      ${f.equilibrado ? `<span class="livro-ok">${icone('certo')}Débitos e créditos conferem</span>` : selo('Livro desbalanceado: avise a AYVO', 'problema')}</div>
    ${f.livro.length ? `<div class="tabela-envolve"><table class="tabela">
      <thead><tr><th>Data</th><th>Conta</th><th>Histórico</th><th class="num">Débito</th><th class="num">Crédito</th></tr></thead>
      <tbody>${f.livro.map(l => `<tr>
        <td class="num">${esc(dataHora(l.em))}</td><td>${esc(l.conta)}</td><td>${esc(l.historico)}</td>
        <td class="num">${l.debito ? esc(dinheiro(l.debito)) : ''}</td><td class="num">${l.credito ? esc(dinheiro(l.credito)) : ''}</td>
      </tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="3">Total do mês (${esc(plural(f.livroTotal, 'lançamento', 'lançamentos'))})</td><td class="num">${esc(dinheiro(f.debitos))}</td><td class="num">${esc(dinheiro(f.creditos))}</td></tr></tfoot>
    </table></div>
    ${f.livroTotal > f.livro.length ? `<p class="nota" style="margin-top:10px">Mostrando os ${f.livro.length} lançamentos mais recentes. O mês completo está no arquivo de lançamentos, na aba Para o contador.</p>` : ''}` : vazio({ icone: 'livro', titulo: 'Nenhum lançamento neste mês', texto: 'Vendas, aluguéis e contas geram lançamentos automaticamente.' })}
  </section>`;
}

function contador(ctx) {
  const mes = ctx.visao.mes;
  const arquivos = [
    ['vendas', 'Vendas', 'Cada pedido do mês com box, forma de pagamento, taxas e o valor líquido do lojista.'],
    ['lancamentos', 'Lançamentos', 'O livro contábil completo do mês, com débito e crédito.'],
    ['dre', 'Resultado (DRE)', 'Receitas e despesas do food park por conta, e o resultado final.'],
    ['repasses', 'Acerto com lojistas', 'O que cada lojista vendeu, as taxas, o aluguel e o valor do acerto.']
  ];
  return `<section class="bloco">
    <div class="bloco-cabeca"><div><h2>Arquivos de ${esc(mesNome(mes))} para o contador</h2><p>Planilhas CSV (separadas por ponto e vírgula) que abrem no Excel e no Google Planilhas. Baixe as quatro e envie por e-mail ou WhatsApp.</p></div></div>
    <div class="downloads">${arquivos.map(([id, nome, texto]) => `
      <a class="download" href="${esc(api.exportar(id, mes))}" download>
        <span class="icone">${icone('baixar')}</span>
        <span><b>${esc(nome)}</b><small>${esc(texto)}</small></span>
      </a>`).join('')}</div>
  </section>`;
}

const CONTEUDO = { resumo, repasses, alugueis, contas, livro, contador };

/* -------------------------------------------------------------- modais */

const campoForma = (rotulo = 'Forma de pagamento') => metodos => campo({ nome: 'metodo', rotulo, valor: 'pix', opcoes: opcoesPagamento(metodos.filter(m => m.id !== 'voucher')) });

function fazerAcerto(ctx, boxId) {
  const v = ctx.visaoAtual();
  const r = v.financeiro.repasse.find(x => x.stallId === boxId);
  if (!r) return;
  const pagar = r.direction === 'pagar_lojista';
  abrirModal({
    titulo: `Acerto com ${r.name}`,
    subtitulo: `Box ${doisDigitos(r.box)}, ${mesNome(v.mes)}.`,
    corpo: `<form>
      <div class="acerto-conta">
        <div><span>Vendas no Pix, cartão e voucher, já sem taxas ${dica('O food park recebeu esse dinheiro e ele é do lojista.')}</span><span class="num">${esc(dinheiro(r.liability))}</span></div>
        <div><span>Taxa do food park sobre vendas em dinheiro ${dica('O lojista recebeu esse dinheiro em espécie e deve a taxa ao food park.')}</span><span class="num">− ${esc(dinheiro(r.cashFee))}</span></div>
        <div><span>Aluguel em aberto</span><span class="num">− ${esc(dinheiro(r.rentOpen))}</span></div>
        <div class="total"><span>${pagar ? 'Food park paga ao lojista' : 'Lojista paga ao food park'}</span><span class="num">${esc(dinheiro(r.amount))}</span></div>
      </div>
      <div style="margin-top:14px">${campoForma(pagar ? 'Como vai pagar' : 'Como vai receber')(v.metodos)}</div>
      <p class="nota" style="margin-top:12px">Depois do acerto, as vendas incluídas não podem mais ser canceladas e o aluguel em aberto fica quitado.</p>
    </form>`,
    botao: pagar ? `Registrar pagamento de ${dinheiro(r.amount)}` : `Registrar recebimento de ${dinheiro(r.amount)}`,
    aoEnviar: d => ctx.acao('lancar-repasse', { boxId, mes: v.mes, metodo: d.metodo }, `Acerto com ${r.name} registrado.`)
  });
}

function receberAluguel(ctx, id) {
  const v = ctx.visaoAtual();
  const c = v.financeiro.alugueis.find(x => x.id === id);
  abrirModal({
    titulo: 'Registrar recebimento de aluguel',
    subtitulo: `${c.boxNome}, ${mesCurto(c.competencia)}: ${dinheiro(c.valor)}.`,
    corpo: `<form>${campoForma('Como foi pago')(v.metodos)}</form>`,
    botao: 'Registrar recebimento',
    aoEnviar: d => ctx.acao('receber-aluguel', { cobrancaId: id, metodo: d.metodo }, 'Aluguel recebido.')
  });
}

function novaConta(ctx) {
  const v = ctx.visaoAtual();
  const m = abrirModal({
    titulo: 'Lançar conta',
    corpo: `<form class="grade-form">
      <div class="campo inteira"><span class="rotulo">Tipo</span>
        <div class="escolhas" style="grid-template-columns:1fr 1fr">
          <label class="escolha"><input type="radio" name="tipo" value="pagar" checked><span><b>A pagar</b><small>Uma despesa do food park</small></span></label>
          <label class="escolha"><input type="radio" name="tipo" value="receber"><span><b>A receber</b><small>Uma receita avulsa</small></span></label>
        </div>
      </div>
      ${campo({ nome: 'descricao', rotulo: 'Descrição', obrigatorio: true, classe: 'inteira', placeholder: 'Ex.: Energia das áreas comuns' })}
      ${campo({ nome: 'categoria', rotulo: 'Categoria', valor: 'energia', opcoes: Object.entries(CATEGORIAS).map(([valor, texto]) => ({ valor, texto })) })}
      ${campoDinheiro({ nome: 'valor', rotulo: 'Valor', obrigatorio: true })}
      ${campo({ nome: 'vencimento', rotulo: 'Vencimento', tipo: 'date', valor: v.hoje, obrigatorio: true })}
    </form>`,
    botao: 'Lançar conta',
    aoEnviar: d => ctx.acao('nova-conta', d, 'Conta lançada.')
  });
  const categoria = m.fundo.querySelector('select[name=categoria]').closest('.campo');
  m.fundo.querySelectorAll('input[name=tipo]').forEach(r => r.addEventListener('change', () => {
    categoria.classList.toggle('oculto', m.fundo.querySelector('input[name=tipo]:checked').value === 'receber');
  }));
}

function baixarConta(ctx, id) {
  const v = ctx.visaoAtual();
  const b = v.financeiro.contas.find(x => x.id === id);
  abrirModal({
    titulo: b.tipo === 'pagar' ? 'Registrar pagamento' : 'Registrar recebimento',
    subtitulo: `${b.descricao}: ${dinheiro(b.valor)}.`,
    corpo: `<form>${campoForma(b.tipo === 'pagar' ? 'Pago com' : 'Recebido em')(v.metodos)}</form>`,
    botao: b.tipo === 'pagar' ? 'Registrar pagamento' : 'Registrar recebimento',
    aoEnviar: d => ctx.acao('baixar-conta', { contaId: id, metodo: d.metodo }, b.tipo === 'pagar' ? 'Pagamento registrado.' : 'Recebimento registrado.')
  });
}

/* ----------------------------------------------------------------- tela */

export default {
  titulo: 'Financeiro',
  descricao: 'Quanto o food park ganhou, o acerto com cada lojista e os arquivos do contador.',
  ajuda: 'financeiro',

  acoesCabecalho(ctx) {
    const v = ctx.visao;
    const aba = abaAtual(ctx);
    const futuro = v.mes >= v.mesAtual;
    return `<div class="seletor-mes" role="group" aria-label="Mês">
      <button type="button" data-mes="${esc(somarMes(v.mes, -1))}" aria-label="Mês anterior" data-aba="${aba}">${icone('esquerda')}</button>
      <b>${esc(mesNome(v.mes).replace(/^./, c => c.toUpperCase()))}</b>
      <button type="button" data-mes="${esc(somarMes(v.mes, 1))}" aria-label="Próximo mês" data-aba="${aba}" ${futuro ? 'disabled' : ''}>${icone('direita')}</button>
    </div>`;
  },

  render(ctx) {
    const aba = abaAtual(ctx);
    const f = ctx.visao.financeiro;
    const pendentes = f.repasse.filter(r => r.direction !== 'zerado').length;
    const alugAbertos = f.alugueis.filter(c => c.status === 'aberto').length;
    const contasAbertas = f.contas.filter(c => c.status === 'aberto').length;
    const contadores = { repasses: pendentes, alugueis: alugAbertos, contas: contasAbertas };
    return `
      <nav class="abas" aria-label="Seções do financeiro">${ABAS.map(([id, nome]) => `<a class="aba ${id === aba ? 'ativa' : ''}" href="${linkAba(ctx, id)}" ${id === aba ? 'aria-current="page"' : ''}>${esc(nome)}${contadores[id] ? `<span class="contador">${contadores[id]}</span>` : ''}</a>`).join('')}</nav>
      ${CONTEUDO[aba](ctx)}`;
  },

  ligar(raiz, ctx) {
    raiz.querySelectorAll('[data-mes]').forEach(b => b.addEventListener('click', () => {
      ctx.ir(`financeiro/${b.dataset.aba}?mes=${b.dataset.mes}`);
    }));
    raiz.querySelector('#corpoPagina').addEventListener('click', e => {
      const alvo = e.target.closest('[data-f]');
      if (!alvo) return;
      const f = alvo.dataset.f;
      try {
        if (f === 'acerto') fazerAcerto(ctx, alvo.dataset.id);
        else if (f === 'aluguel') receberAluguel(ctx, alvo.dataset.id);
        else if (f === 'nova-conta') novaConta(ctx);
        else if (f === 'baixar') baixarConta(ctx, alvo.dataset.id);
      } catch (err) {
        avisar(err.message, 'erro');
      }
    });
  }
};
