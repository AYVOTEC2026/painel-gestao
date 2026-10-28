import { esc, icone } from '../ui.js';
import { GLOSSARIO, ROTINA_DIA, ROTINA_MES, PERGUNTAS } from '../ajuda-conteudo.js';

// O caixa vê só o que é do dia a dia dele.
const TERMOS_CAIXA = ['Box', 'Lojista', 'Taxa sobre as vendas', 'Taxa da maquininha', 'Fundo de troco', 'Sangria', 'Suprimento', 'Fechamento do caixa', 'Quebra de caixa'];
const PERGUNTAS_CAIXA = [0, 2, 5];

const roteiro = itens => `<ol class="roteiro">${itens.map(([t, d]) => `<li><b>${esc(t)}</b><p>${esc(d)}</p></li>`).join('')}</ol>`;

export default {
  titulo: 'Ajuda',
  descricao: 'Como o sistema funciona, em linguagem do dia a dia.',

  render(ctx) {
    const gestao = ctx.ehGestao;
    const termos = gestao ? GLOSSARIO : GLOSSARIO.filter(g => TERMOS_CAIXA.includes(g[0]));
    const perguntas = gestao ? PERGUNTAS : PERGUNTAS.filter((_, i) => PERGUNTAS_CAIXA.includes(i));
    return `
      <section class="bloco">
        <div class="bloco-cabeca"><div><h2>Como o dinheiro circula</h2><p>A ideia central do sistema. Entendendo isto, o resto fica fácil.</p></div></div>
        <div class="fluxo-dinheiro">
          <div class="fluxo-no escuro"><b>O cliente paga no box</b><small>O caixa registra o pedido e escolhe a forma de pagamento.</small></div>
          <div class="fluxo-seta">${icone('seta')}</div>
          <div class="fluxo-ramos">
            <div class="fluxo-no"><b>Dinheiro em espécie</b><small>Fica com o lojista. A taxa do food park sobre essa venda fica a receber.</small></div>
            <div class="fluxo-no"><b>Pix, cartão ou voucher</b><small>Entra na conta do food park, que guarda a parte do lojista.</small></div>
          </div>
        </div>
        <div class="fluxo-dinheiro" style="margin-top:14px;grid-template-columns:1fr">
          <div class="fluxo-no destaque"><b>No fim do mês, o acerto</b><small>Para cada lojista, o sistema junta o que o food park guardou, a taxa que ele deve e o aluguel em aberto. Sobra um único valor: pagar ou receber.</small></div>
        </div>
      </section>

      <div class="${gestao ? 'ajuda-grade' : ''}" style="margin-top:18px">
        <section class="bloco">
          <div class="bloco-cabeca"><div><h2>Rotina do dia</h2><p>Na tela Caixa.</p></div></div>
          ${roteiro(ROTINA_DIA)}
        </section>
        ${gestao ? `<section class="bloco" style="margin-top:0">
          <div class="bloco-cabeca"><div><h2>Rotina do mês</h2><p>Na tela Financeiro, de preferência na primeira semana.</p></div></div>
          ${roteiro(ROTINA_MES)}
        </section>` : ''}
      </div>

      <section class="bloco">
        <div class="bloco-cabeca"><div><h2>Palavras que aparecem no sistema</h2></div></div>
        <dl class="glossario">${termos.map(([t, d]) => `<div><dt>${esc(t)}</dt><dd>${esc(d)}</dd></div>`).join('')}</dl>
      </section>

      <section class="bloco perguntas">
        <div class="bloco-cabeca"><div><h2>Perguntas frequentes</h2></div></div>
        ${perguntas.map(([q, r]) => `<details><summary>${esc(q)}</summary><p>${esc(r)}</p></details>`).join('')}
      </section>`;
  }
};
