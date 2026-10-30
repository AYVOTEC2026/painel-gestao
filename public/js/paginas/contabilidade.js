import { esc, icone, dinheiro, dataCurta, hora, mesNome, plural, selo, vazio } from '../ui.js';
import { barras } from '../graficos.js';
import { api } from '../api.js';
import { abas, abaAtual, seletorMes } from './comum.js';

const ABAS = ['resultado', 'saldos', 'livro', 'contador'];

function resultado(d) {
  const r = d.dre;
  const receitas = r.receitas.filter(l => l.valor !== 0);
  const despesas = r.despesas.filter(l => l.valor !== 0);
  const areas = r.porArea.filter(a => a.valor > 0).sort((a, b) => b.valor - a.valor);
  return `<div class="duas-colunas" style="margin-top:0">
    <section class="bloco">
      <div class="bloco-cabeca"><div><h2>Resultado de ${esc(mesNome(d.mes))}</h2><p>Pelo mês a que cada valor pertence: o aluguel de outubro conta em outubro, mesmo pago depois.</p></div></div>
      <div class="dre">
        <div class="dre-grupo">Receitas</div>
        ${receitas.length ? receitas.map(l => `<div class="dre-linha"><span>${esc(l.nome)}</span><span class="num">${esc(dinheiro(l.valor))}</span></div>`).join('') : '<div class="dre-linha zero"><span>Nenhuma receita no mês</span><span class="num">R$ 0,00</span></div>'}
        <div class="dre-linha subtotal"><span>Total de receitas</span><span class="num">${esc(dinheiro(r.totalReceitas))}</span></div>
        <div class="dre-grupo">Despesas</div>
        ${despesas.length ? despesas.map(l => `<div class="dre-linha"><span>${esc(l.nome)}</span><span class="num">− ${esc(dinheiro(l.valor))}</span></div>`).join('') : '<div class="dre-linha zero"><span>Nenhuma despesa lançada</span><span class="num">R$ 0,00</span></div>'}
        <div class="dre-linha subtotal"><span>Total de despesas</span><span class="num">− ${esc(dinheiro(r.totalDespesas))}</span></div>
      </div>
      <div class="dre-resultado ${r.resultado < 0 ? 'negativo' : ''}"><span>${r.resultado < 0 ? 'Prejuízo do mês' : 'Lucro do mês'}</span><strong>${esc(dinheiro(r.resultado))}</strong></div>
    </section>
    <section class="bloco">
      <div class="bloco-cabeca"><div><h2>Quanto cada área rendeu</h2><p>Receita de ${esc(mesNome(d.mes).split(' ')[0])} por área do complexo.</p></div></div>
      ${areas.length ? barras({ linhas: areas.map(a => ({ rotulo: a.nome, sub: r.totalReceitas ? `${Math.round(a.valor / r.totalReceitas * 100)}% da receita` : '', valor: a.valor })), formatar: dinheiro }) : '<p class="nota">Sem receita neste mês.</p>'}
    </section>
  </div>`;
}

function saldos(d) {
  const grupo = (titulo, texto, lista) => `<section class="bloco">
    <div class="bloco-cabeca"><div><h2>${titulo}</h2><p>${texto}</p></div></div>
    <div class="dre">${lista.map(s => `<div class="dre-linha ${s.saldo === 0 ? 'zero' : ''}"><span>${esc(s.nome)}</span><span class="num">${esc(dinheiro(s.saldo))}</span></div>`).join('')}
      <div class="dre-linha subtotal"><span>Total</span><span class="num">${esc(dinheiro(lista.reduce((t, s) => t + s.saldo, 0)))}</span></div></div>
  </section>`;
  return `<div class="duas-colunas" style="margin-top:0">
    ${grupo('O que o complexo tem', `Dinheiro e valores a receber no fim de ${esc(mesNome(d.mes))}.`, d.saldos.filter(s => s.grupo === 'ativo'))}
    ${grupo('O que o complexo deve', 'Contas a pagar e cauções que voltam aos locatários.', d.saldos.filter(s => s.grupo === 'passivo'))}
  </div>
  <p class="nota" style="margin-top:14px">Os saldos começam do zero na data em que o sistema entrou em uso. Para o contador, eles mostram a movimentação registrada aqui.</p>`;
}

function livro(d) {
  return `<section class="bloco">
    <div class="bloco-cabeca"><div><h2>Livro contábil de ${esc(mesNome(d.mes))}</h2><p>Cada operação gera débito e crédito do mesmo valor. É o registro que o contador confere.</p></div>
      ${d.equilibrado ? `<span class="livro-ok">${icone('certo')}Débitos e créditos conferem</span>` : selo('Livro desbalanceado: avise a AYVO', 'problema')}</div>
    ${d.livro.length ? `<div class="tabela-envolve"><table class="tabela">
      <thead><tr><th>Quando</th><th>Conta</th><th class="so-largo">Histórico</th><th class="num">Débito</th><th class="num">Crédito</th></tr></thead>
      <tbody>${d.livro.map(l => `<tr><td class="num">${esc(dataCurta(l.em))} ${esc(hora(l.em))}</td><td>${esc(l.conta)}<small class="so-celular-bloco">${esc(l.historico)}</small></td><td class="so-largo">${esc(l.historico)}</td>
        <td class="num">${l.debito ? esc(dinheiro(l.debito)) : ''}</td><td class="num">${l.credito ? esc(dinheiro(l.credito)) : ''}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="2">Total do mês (${esc(plural(d.totais.lancamentos, 'lançamento', 'lançamentos'))})</td><td class="so-largo"></td><td class="num">${esc(dinheiro(d.totais.debitos))}</td><td class="num">${esc(dinheiro(d.totais.creditos))}</td></tr></tfoot>
    </table></div>${d.totais.lancamentos > d.livro.length ? `<p class="nota" style="margin-top:10px">Mostrando os ${d.livro.length} mais recentes. O mês completo está na planilha de lançamentos.</p>` : ''}` : vazio({ icone: 'livro', titulo: 'Nenhum lançamento neste mês', texto: 'Vendas, pulseiras, reservas, aluguéis e despesas geram lançamentos sozinhos.' })}
  </section>`;
}

function contador(d) {
  const arquivos = [
    ['lancamentos', 'Lançamentos', 'O livro contábil completo do mês, com débito e crédito de cada operação.'],
    ['dre', 'Resultado (DRE)', 'Receitas por área, despesas por categoria e o resultado do mês.'],
    ['extrato', 'Extrato de entradas e saídas', 'Todo dinheiro que entrou e saiu, com a forma de pagamento e a taxa do cartão.'],
    ['alugueis', 'Aluguéis dos boxes', 'Cada aluguel e cobrança do mês, por locatário, com o que foi recebido.']
  ];
  const n = d.notas;
  return `<section class="bloco pacote">
    <div class="pacote-info">
      <h2>Pacote de ${esc(mesNome(d.mes))} para o contador</h2>
      <p>Um arquivo ZIP com o mês inteiro: as notas fiscais das despesas, a planilha de despesas, o livro contábil, o resultado, o extrato e os aluguéis. Dentro dele, o arquivo LEIA-ME abre no navegador com o resumo e um link para cada nota.</p>
      ${n.pendentes ? `<div class="alerta atencao">
        <div class="alerta-icone">${icone('alerta')}</div>
        <div><b>${n.pendentes === 1 ? '1 despesa está sem nota' : `${n.pendentes} despesas estão sem nota`}</b><small>Anexe antes de enviar. O pacote sai assim mesmo, com a pendência marcada no resumo.</small></div>
        <a class="botao pequeno" href="#/financeiro/notas?mes=${esc(d.mes)}">Anexar notas</a>
      </div>` : n.total ? `<div class="tudo-certo">${icone('certo')}${n.total === 1 ? 'A despesa do mês tem documento.' : `As ${n.total} despesas do mês têm documento.`}</div>` : ''}
    </div>
    <div class="pacote-acoes">
      <a class="botao primario grande" href="${esc(api.pacote(d.mes, true))}" download>${icone('baixar')}Baixar pacote completo</a>
      <a class="botao" href="${esc(api.pacote(d.mes, false))}" download>Só despesas e notas</a>
    </div>
  </section>
  <section class="bloco">
    <div class="bloco-cabeca"><div><h2>Planilhas avulsas</h2><p>Os mesmos relatórios do pacote, um de cada vez, em CSV (separado por ponto e vírgula). Abrem no Excel e no Google Planilhas.</p></div></div>
    <div class="downloads">${arquivos.map(([id, nome, texto]) => `
      <a class="download" href="${esc(api.exportar(id, d.mes))}" download>
        <span class="icone">${icone('baixar')}</span><span><b>${esc(nome)}</b><small>${esc(texto)}</small></span>
      </a>`).join('')}</div>
  </section>`;
}

export default {
  tela: 'contabilidade',
  params: rota => ({ mes: rota.query.mes }),
  titulo: 'Contabilidade',
  descricao: 'O resultado de cada mês, os saldos, o livro contábil e o pacote do contador com as notas.',
  acoesCabecalho: ctx => seletorMes(ctx.dados.mes, ctx.dados.agora.slice(0, 7), `contabilidade/${abaAtual(ctx.rota, ABAS)}`),

  render(ctx) {
    const d = ctx.dados;
    const aba = abaAtual(ctx.rota, ABAS);
    return `
      ${abas('contabilidade', aba, [['resultado', 'Resultado'], ['saldos', 'Saldos'], ['livro', 'Livro contábil'], ['contador', 'Para o contador']], `?mes=${d.mes}`)}
      ${{ resultado, saldos, livro, contador }[aba](d)}`;
  }
};
