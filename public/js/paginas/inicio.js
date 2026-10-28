import { esc, icone, dinheiro, dinheiroCurto, hora, dataCurta, dataExtenso, diaSemana, mesCurto, plural, selo } from '../ui.js';

function escala(max) {
  if (max <= 0) return 100;
  const mag = 10 ** Math.floor(Math.log10(max));
  const passos = [1, 2, 2.5, 5, 10];
  const fator = passos.find(p => p * mag >= max);
  return fator * mag;
}

function grafico(serie) {
  const W = 660;
  const H = 236;
  const topo = 24;
  const base = 192;
  const esq = 52;
  const teto = escala(Math.max(...serie.map(d => d.total)));
  const larg = (W - esq - 6) / serie.length;
  const y = v => base - (v / teto) * (base - topo);
  const linhas = [0, teto / 2, teto].map(v =>
    `<line class="grade" x1="${esq}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/><text class="eixo" x="${esq - 8}" y="${y(v) + 4}" text-anchor="end">${esc(dinheiroCurto(v))}</text>`).join('');
  const barras = serie.map((d, i) => {
    const ehHoje = i === serie.length - 1;
    const x = esq + i * larg + larg * 0.16;
    const w = larg * 0.68;
    const h = Math.max(d.total > 0 ? 2 : 0, base - y(d.total));
    const rotulo = ehHoje && d.total > 0 ? `<text class="rotulo-hoje" x="${x + w / 2}" y="${base - h - 7}" text-anchor="middle">${esc(dinheiroCurto(d.total))}</text>` : '';
    return `<g>
      <rect class="barra ${ehHoje ? 'hoje' : ''}" x="${x}" y="${base - h}" width="${w}" height="${h}" rx="4"><title>${esc(dataCurta(d.dia))}: ${esc(dinheiro(d.total))} em ${plural(d.pedidos, 'pedido', 'pedidos')}</title></rect>
      ${rotulo}
      <text class="eixo" x="${x + w / 2}" y="${base + 17}" text-anchor="middle">${esc(d.dia.slice(8, 10))}</text>
      <text class="eixo" x="${x + w / 2}" y="${base + 31}" text-anchor="middle" opacity=".7">${esc(ehHoje ? 'hoje' : diaSemana(d.dia))}</text>
    </g>`;
  }).join('');
  return `<svg class="grafico" viewBox="0 0 ${W} ${H}" role="img" aria-label="Vendas por dia nos últimos 14 dias">${linhas}${barras}</svg>`;
}

const ICONE_ALERTA = { problema: 'alerta', atencao: 'relogio', info: 'info' };

function passos(lista) {
  return `<ol class="passos">${lista.map(p => `
    <li class="passo ${p.feito ? 'feito' : ''}">
      <div><b>${esc(p.titulo)}</b><small>${esc(p.texto)}</small></div>
      ${p.feito ? selo('Feito', 'ok') : `<a class="botao pequeno" href="#/${esc(p.rota)}">Fazer agora</a>`}
    </li>`).join('')}</ol>`;
}

export default {
  titulo: ctx => `Olá, ${ctx.usuario.nome.split(' ')[0]}`,
  descricao: 'O dia do food park em um lugar: vendas, resultado e o que precisa de você.',
  ajuda: 'inicio',

  render(ctx) {
    const v = ctx.visao;
    const p = v.painel;
    const semLojista = v.boxes.length === 0;

    if (semLojista) {
      return `
        <section class="bloco">
          <div class="bloco-cabeca"><div><h2>Primeiros passos</h2><p>Siga a ordem abaixo. Em poucos minutos o caixa já pode vender.</p></div></div>
          ${passos(p.passos)}
        </section>`;
    }

    const caixa = v.caixa;
    const linhaCaixa = caixa
      ? `Caixa aberto desde ${hora(caixa.abertoEm)}${caixa.abertoEm.slice(0, 10) < v.hoje ? ' de ' + dataCurta(caixa.abertoEm) : ''}.`
      : 'O caixa está fechado.';
    const livres = v.parque.boxes - p.ocupados;

    return `
      <section class="manchete">
        <small>${esc(dataExtenso(v.hoje))}, até as ${esc(hora(v.agora))}</small>
        <h2>${esc(dinheiro(p.hoje.total))} vendidos em ${esc(plural(p.hoje.pedidos, 'pedido', 'pedidos'))}</h2>
        <p>${p.hoje.pedidos ? `${esc(dinheiro(p.hoje.taxa))} ficam com o food park em taxas. Ticket médio de ${esc(dinheiro(p.hoje.ticket))}.` : 'Nenhuma venda registrada hoje ainda.'} ${esc(linhaCaixa)}</p>
      </section>

      <div class="fatos">
        <div class="fato"><span>Vendido em ${esc(mesCurto(v.mesAtual))}</span><strong>${esc(dinheiro(p.mes.total))}</strong><em>${esc(plural(p.mes.pedidos, 'pedido', 'pedidos'))} nos boxes</em></div>
        <div class="fato"><span>Resultado do food park no mês</span><strong class="${p.mes.resultado < 0 ? 'negativo' : ''}">${esc(dinheiro(p.mes.resultado))}</strong><em>Aluguéis e taxas menos as despesas</em></div>
        <div class="fato"><span>Boxes ocupados</span><strong>${p.ocupados} de ${v.parque.boxes}</strong><em>${livres > 0 ? esc(plural(livres, 'box livre', 'boxes livres')) : 'Praça cheia'}</em></div>
      </div>

      ${p.passos ? `<section class="bloco" style="margin-top:18px"><div class="bloco-cabeca"><div><h2>Falta pouco para começar</h2><p>Complete os passos abaixo.</p></div></div>${passos(p.passos)}</section>` : ''}

      <div class="duas-colunas">
        <section class="bloco">
          <div class="bloco-cabeca"><div><h2>Vendas dos últimos 14 dias</h2><p>Toque em uma barra para ver o valor do dia.</p></div></div>
          ${grafico(p.serie)}
        </section>
        <section class="bloco">
          <div class="bloco-cabeca"><div><h2>O que precisa de atenção</h2></div></div>
          ${p.alertas.length ? `<div class="lista-alertas">${p.alertas.map(a => `
            <div class="alerta ${esc(a.nivel)}">
              <div class="alerta-icone">${icone(ICONE_ALERTA[a.nivel] || 'info')}</div>
              <div><b>${esc(a.titulo)}</b><small>${esc(a.texto)}</small></div>
              <a class="botao pequeno" href="#/${esc(a.rota)}">${esc(a.botao)}</a>
            </div>`).join('')}</div>` : `<div class="tudo-certo">${icone('certo')}Tudo em dia. Nada pendente agora.</div>`}
        </section>
      </div>

      <div class="duas-colunas">
        <section class="bloco">
          <div class="bloco-cabeca"><div><h2>Boxes que mais venderam em ${esc(mesCurto(v.mesAtual))}</h2><p>O valor é o total pago pelos clientes; ao lado, a taxa do food park.</p></div></div>
          <div class="ranking">${(() => {
            const max = Math.max(...p.ranking.map(r => r.total), 1);
            return p.ranking.map(r => `
              <div class="ranking-linha">
                <span class="placa-mini">${esc(r.box)}</span>
                <div><b>${esc(r.nome)}</b><div class="ranking-trilho"><i style="width:${Math.round((r.total / max) * 100)}%"></i></div></div>
                <div class="num">${esc(dinheiro(r.total))}<small>taxa ${esc(dinheiro(r.taxa))}</small></div>
              </div>`).join('');
          })()}</div>
        </section>
        <section class="bloco">
          <div class="bloco-cabeca"><div><h2>Últimas vendas</h2></div><a class="botao pequeno" href="#/caixa">Ir para o caixa</a></div>
          ${p.ultimas.length ? `<div class="tabela-envolve"><table class="tabela">
            <thead><tr><th>Hora</th><th>Box</th><th class="so-largo">Pagamento</th><th class="num">Total</th></tr></thead>
            <tbody>${p.ultimas.map(s => `<tr><td class="num">${esc(s.em.slice(0, 10) === v.hoje ? hora(s.em) : dataCurta(s.em))}</td><td>${esc(s.boxNome)}</td><td class="so-largo">${esc(s.pagamentoNome)}</td><td class="num"><b>${esc(dinheiro(s.total))}</b></td></tr>`).join('')}</tbody>
          </table></div>` : '<p class="nota">Nenhuma venda ainda.</p>'}
        </section>
      </div>`;
  }
};
