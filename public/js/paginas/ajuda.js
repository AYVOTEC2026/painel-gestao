import { esc, icone } from '../ui.js';
import { GLOSSARIO, ROTINA_DIA, ROTINA_MES, PERGUNTAS } from '../ajuda-conteudo.js';

// Recepção e monitor veem só o que é do dia a dia deles.
const TERMOS_EQUIPE = ['Pulseira', 'Tempo excedente', 'Day use', 'Item de aluguel', 'Devolução', 'Grupo fixo', 'Fundo de troco', 'Sangria', 'Fechamento do caixa', 'Quebra de caixa'];
const PERGUNTAS_EQUIPE = [0, 1, 2, 5, 10];

const roteiro = itens => `<ol class="roteiro">${itens.map(([t, d]) => `<li><b>${esc(t)}</b><p>${esc(d)}</p></li>`).join('')}</ol>`;

export default {
  titulo: 'Ajuda',
  descricao: 'Como o sistema funciona, em linguagem do dia a dia.',

  render(ctx) {
    const gestao = ctx.ehGestao;
    const termos = gestao ? GLOSSARIO : GLOSSARIO.filter(g => TERMOS_EQUIPE.includes(g[0]));
    const perguntas = gestao ? PERGUNTAS : PERGUNTAS.filter((_, i) => PERGUNTAS_EQUIPE.includes(i));
    return `
      ${gestao ? `<section class="bloco">
        <div class="bloco-cabeca"><div><h2>Como o complexo ganha dinheiro</h2><p>Cada área registra o que recebe. Tudo se junta no financeiro e na contabilidade.</p></div></div>
        <div class="fluxo-areas">
          <div class="fluxo-no"><b>${icone('boxes')} Boxes alugados</b><small>Aluguel de cada mês, cobranças avulsas e caução.</small></div>
          <div class="fluxo-no"><b>${icone('balanco')} Parque infantil</b><small>Pulseira por tempo e o excedente na saída.</small></div>
          <div class="fluxo-no"><b>${icone('loja')} Loja e bilheteria</b><small>Produtos e day use vendidos no PDV.</small></div>
          <div class="fluxo-no"><b>${icone('quadra')} Quadras</b><small>Reservas por hora e grupos fixos.</small></div>
          <div class="fluxo-no"><b>${icone('evento')} Eventos e festas</b><small>Sinal e saldo de cada festa.</small></div>
        </div>
        <div class="fluxo-seta baixo">${icone('seta')}</div>
        <div class="fluxo-dinheiro" style="grid-template-columns:1fr 1fr">
          <div class="fluxo-no escuro"><b>Financeiro</b><small>O dinheiro de verdade: o que entrou, o que saiu, o que falta pagar e receber.</small></div>
          <div class="fluxo-no destaque"><b>Contabilidade</b><small>O resultado de cada mês e as planilhas para o contador.</small></div>
        </div>
      </section>` : ''}

      <div class="${gestao ? 'ajuda-grade' : ''}" style="margin-top:18px">
        <section class="bloco">
          <div class="bloco-cabeca"><div><h2>Rotina do dia</h2><p>Recepção e parque.</p></div></div>
          ${roteiro(ROTINA_DIA)}
        </section>
        ${gestao ? `<section class="bloco" style="margin-top:0">
          <div class="bloco-cabeca"><div><h2>Rotina do mês</h2><p>Gestão, de preferência na primeira semana.</p></div></div>
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
