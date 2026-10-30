import { esc, icone, dinheiro, dinheiroCurto, hora, dataCurta, dataExtenso, diaSemana, mesCurto, plural } from '../ui.js';
import { colunas, barras, verNumeros } from '../graficos.js';
import { NOMES_AREA } from './comum.js';

const ICONE_ALERTA = { problema: 'alerta', atencao: 'relogio', info: 'info' };
const ORDEM_AREAS = ['parque', 'pdv', 'quadras', 'alugueis', 'eventos', 'outras'];

export default {
  tela: 'painel',
  aoVivo: true,
  titulo: ctx => `Olá, ${ctx.usuario.nome.split(' ')[0]}`,
  descricao: 'O complexo hoje: quanto entrou, o que está acontecendo agora e o que precisa de você.',

  render(ctx) {
    const d = ctx.dados;
    const hoje = d.agora.slice(0, 10);
    const partes = ORDEM_AREAS.filter(a => d.hoje.porArea[a]).map(a => `${NOMES_AREA[a].toLowerCase()} ${dinheiro(d.hoje.porArea[a])}`);
    const caixa = d.caixa
      ? `Aberto desde ${hora(d.caixa.abertoEm)}${d.caixa.abertoEm.slice(0, 10) < hoje ? ` de ${dataCurta(d.caixa.abertoEm)}` : ''}`
      : 'Fechado';
    const mesNome = mesCurto(d.agora.slice(0, 7));
    const areasMes = d.mes.porArea.filter(a => a.valor > 0).sort((a, b) => b.valor - a.valor);

    return `
      <section class="manchete">
        <small>${esc(dataExtenso(hoje))}, até as ${esc(hora(d.agora))}</small>
        <h2>${esc(dinheiro(d.hoje.total))} entraram hoje</h2>
        <p>${partes.length ? `Vieram de ${esc(partes.join(', ').replace(/, ([^,]*)$/, ' e $1'))}.` : 'Nenhum recebimento hoje ainda.'}</p>
      </section>

      <div class="fatos agora">
        <div class="fato"><span>${icone('balanco')}Crianças no parque</span><strong>${d.parque.dentro} de ${d.parque.capacidade}</strong>
          <em>${d.parque.passando ? `${plural(d.parque.passando, 'passou', 'passaram')} do tempo` : 'Todas dentro do tempo'}</em></div>
        <div class="fato"><span>${icone('quadra')}Quadras em jogo</span><strong>${d.quadras.emJogo} de ${d.quadras.total}</strong>
          <em>${plural(d.quadras.reservasHoje, 'reserva', 'reservas')} hoje</em></div>
        <div class="fato"><span>${icone('boxes')}Boxes alugados</span><strong>${d.boxes.ocupados} de ${d.boxes.total}</strong>
          <em class="${d.inadimplencia.total ? 'ruim' : ''}">${d.inadimplencia.total ? `${dinheiro(d.inadimplencia.total)} em atraso` : 'Aluguéis em dia'}</em></div>
        <div class="fato"><span>${icone('caixa')}Caixa da recepção</span><strong>${esc(d.caixa ? 'Aberto' : 'Fechado')}</strong><em>${esc(caixa)}</em></div>
      </div>

      <div class="duas-colunas">
        <section class="bloco">
          <div class="bloco-cabeca"><div><h2>Entradas dos últimos 14 dias</h2><p>Tudo o que foi recebido por dia, de todas as áreas.</p></div></div>
          ${colunas({
            pontos: d.serie.map((s, i) => ({ rotulo: s.dia.slice(8, 10), sub: i === d.serie.length - 1 ? 'hoje' : diaSemana(s.dia), valor: s.total, destaque: i === d.serie.length - 1, dica: `${diaSemana(s.dia)}, ${dataCurta(s.dia)}` })),
            formatarEixo: dinheiroCurto, formatarValor: dinheiro, descricao: 'Entradas por dia nos últimos 14 dias'
          })}
          ${verNumeros(['Dia', 'Entradas'], d.serie.map(s => [`${diaSemana(s.dia)}, ${dataCurta(s.dia)}`, dinheiro(s.total)]))}
        </section>
        <section class="bloco">
          <div class="bloco-cabeca"><div><h2>O que precisa de atenção</h2></div></div>
          ${d.alertas.length ? `<div class="lista-alertas">${d.alertas.map(a => `
            <div class="alerta ${esc(a.nivel)}">
              <div class="alerta-icone">${icone(ICONE_ALERTA[a.nivel] || 'info')}</div>
              <div><b>${esc(a.titulo)}</b><small>${esc(a.texto)}</small></div>
              <a class="botao pequeno" href="#/${esc(a.rota)}">${esc(a.botao)}</a>
            </div>`).join('')}</div>` : `<div class="tudo-certo">${icone('certo')}Tudo em dia. Nada pendente agora.</div>`}
        </section>
      </div>

      <div class="duas-colunas">
        <section class="bloco">
          <div class="bloco-cabeca"><div><h2>Resultado de ${esc(mesNome)}</h2><p>Receitas do mês menos as despesas lançadas.</p></div><a class="botao pequeno" href="#/contabilidade">Ver detalhes</a></div>
          <div class="trio">
            <div><span>Receitas</span><b>${esc(dinheiro(d.mes.totalReceitas))}</b></div>
            <div><span>Despesas</span><b>${esc(dinheiro(d.mes.totalDespesas))}</b></div>
            <div class="${d.mes.resultado < 0 ? 'ruim' : 'bom'}"><span>${d.mes.resultado < 0 ? 'Prejuízo' : 'Lucro'}</span><b>${esc(dinheiro(d.mes.resultado))}</b></div>
          </div>
          <h3 class="sub-titulo">Receita por área</h3>
          ${areasMes.length ? barras({ linhas: areasMes.map(a => ({ rotulo: a.nome, valor: a.valor })), formatar: dinheiro }) : '<p class="nota">Nenhuma receita no mês ainda.</p>'}
        </section>
        <section class="bloco">
          <div class="bloco-cabeca"><div><h2>Hoje na agenda</h2></div><a class="botao pequeno" href="#/quadras">Abrir agenda</a></div>
          ${d.quadras.proximas.length ? `<ul class="agenda-lista">${d.quadras.proximas.map(r => `
            <li><time>${esc(r.inicio)}</time><div><b>${esc(r.cliente)}</b><small>${esc(r.quadra)}, até ${esc(r.fim)}</small></div>${r.status === 'paga' ? '<span class="selo ok">Paga</span>' : '<span class="selo atencao">A pagar</span>'}</li>`).join('')}</ul>`
            : '<p class="nota">Sem mais reservas de quadra hoje.</p>'}
          <h3 class="sub-titulo">Próximos eventos</h3>
          ${d.eventos.length ? `<ul class="agenda-lista">${d.eventos.map(e => `
            <li><time>${esc(dataCurta(e.data))}</time><div><b>${esc(e.titulo)}</b><small>${esc([e.espaco, e.inicio ? `às ${e.inicio}` : '', e.convidados ? `${e.convidados} convidados` : ''].filter(Boolean).join(', '))}</small></div></li>`).join('')}</ul>`
            : '<p class="nota">Nenhum evento confirmado à frente.</p>'}
        </section>
      </div>`;
  }
};
