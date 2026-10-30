import { esc, dinheiro, dinheiroCurto, mesNome, duracao, plural } from '../ui.js';
import { colunas, barras, miniColunas, verNumeros } from '../graficos.js';
import { fatos } from './comum.js';

const MES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const abrev = mes => `${MES_ABREV[Number(mes.slice(5, 7)) - 1]}/${mes.slice(2, 4)}`;

export default {
  tela: 'relatorios',
  params: rota => ({ meses: rota.query.meses }),
  titulo: 'Relatórios',
  descricao: 'Como cada área do complexo está indo, mês a mês.',
  acoesCabecalho: ctx => `<div class="seg" role="group" aria-label="Período">${[3, 6, 12].map(n => `<a href="#/relatorios?meses=${n}" class="${ctx.dados.meses === n ? 'ativo' : ''}" ${ctx.dados.meses === n ? 'aria-current="true"' : ''}>${n} meses</a>`).join('')}</div>`,

  render(ctx) {
    const d = ctx.dados;
    const mesAtual = d.agora.slice(0, 7);
    const areas = d.porMes[0].porArea.map(a => a.area).filter(area => d.porMes.some(m => m.porArea.find(x => x.area === area).valor > 0));
    const maiorArea = Math.max(1, ...d.porMes.flatMap(m => m.porArea.map(a => a.valor)));
    const p = d.parque;
    const pico = p.porHora.reduce((m, h) => (h.entradas > (m ? m.entradas : -1) ? h : m), null);
    const horas = [];
    for (let h = 8; h <= 21; h += 1) horas.push({ hora: h, entradas: (p.porHora.find(x => x.hora === h) || { entradas: 0 }).entradas });
    const ordemDias = [1, 2, 3, 4, 5, 6, 0];
    const alugueis = d.boxes.alugueis;

    return `
      <section class="bloco">
        <div class="bloco-cabeca"><div><h2>Resultado mês a mês</h2><p>Receitas menos despesas de cada mês. O mês atual ainda está em andamento.</p></div></div>
        ${colunas({ pontos: d.porMes.map(m => ({ rotulo: abrev(m.mes), valor: m.resultado, destaque: m.mes === mesAtual, dica: mesNome(m.mes) })), formatarEixo: dinheiroCurto, formatarValor: dinheiro, descricao: 'Resultado por mês' })}
        ${verNumeros(['Mês', 'Receitas', 'Despesas', 'Resultado'], d.porMes.map(m => [mesNome(m.mes), dinheiro(m.receitas), dinheiro(m.despesas), dinheiro(m.resultado)]))}
      </section>

      <section class="bloco">
        <div class="bloco-cabeca"><div><h2>Receita de cada área</h2><p>Uma área por quadro, todas na mesma escala. A coluna em destaque é o mês atual.</p></div></div>
        <div class="multiplos">${areas.map(area => {
          const pontos = d.porMes.map(m => ({ rotulo: mesNome(m.mes), valor: m.porArea.find(a => a.area === area).valor }));
          const nome = d.porMes[0].porArea.find(a => a.area === area).nome;
          return `<div class="multiplo"><b>${esc(nome)}</b><strong>${esc(dinheiro(pontos[pontos.length - 1].valor))}</strong><small>neste mês, ${esc(dinheiro(pontos.reduce((t, x) => t + x.valor, 0)))} no período</small>${miniColunas(pontos, dinheiro, maiorArea)}</div>`;
        }).join('') || '<p class="nota">Sem receitas no período.</p>'}</div>
        ${verNumeros(['Área'].concat(d.porMes.map(m => abrev(m.mes))), areas.map(area => [d.porMes[0].porArea.find(a => a.area === area).nome].concat(d.porMes.map(m => dinheiro(m.porArea.find(a => a.area === area).valor)))))}
      </section>

      <section class="bloco">
        <div class="bloco-cabeca"><div><h2>Parque infantil em ${esc(mesNome(mesAtual).split(' ')[0])}</h2><p>Quando as crianças chegam e quanto tempo ficam.</p></div></div>
        ${fatos([
          { rotulo: 'Pulseiras vendidas', valor: String(p.entradas), sub: `${p.mediaPorDia} por dia, em média` },
          { rotulo: 'Permanência média', valor: duracao(p.tempoMedio), sub: 'da entrega da pulseira à saída' },
          { rotulo: 'Passaram do tempo', valor: p.entradas ? `${Math.round(p.excederam / p.entradas * 100)}%` : '0%', sub: `${plural(p.excederam, 'criança pagou', 'crianças pagaram')} excedente` }
        ])}
        <div class="duas-colunas">
          <div>
            <h3 class="sub-titulo">Entradas por horário${pico ? `: pico às ${pico.hora}h` : ''}</h3>
            ${colunas({ pontos: horas.map(h => ({ rotulo: `${h.hora}h`, valor: h.entradas, destaque: pico && h.hora === pico.hora, dica: `Das ${h.hora}h às ${h.hora + 1}h` })), formatarEixo: v => String(Math.round(v)), formatarValor: v => plural(v, 'entrada', 'entradas'), altura: 200, meiaLargura: true, descricao: 'Entradas no parque por hora do dia' })}
          </div>
          <div>
            <h3 class="sub-titulo">Crianças por dia da semana</h3>
            ${barras({ linhas: ordemDias.map(dia => ({ rotulo: DIAS[dia].replace(/^./, c => c.toUpperCase()), valor: (p.porDiaSemana.find(x => x.dia === dia) || { media: 0 }).media })), formatar: v => `${v} em média` })}
          </div>
        </div>
      </section>

      <div class="duas-colunas">
        <section class="bloco">
          <div class="bloco-cabeca"><div><h2>Ocupação das quadras</h2><p>Horas reservadas sobre as horas de funcionamento, no mês até hoje.</p></div></div>
          ${barras({ linhas: d.quadras.map(q => ({ rotulo: q.nome, sub: `${q.modalidade}, ${String(q.horas).replace('.', ',')} h, ${dinheiro(q.recebido)} recebidos`, valor: q.ocupacao, texto: `${q.ocupacao}%` })), maximo: 100, formatar: v => `${v}%` })}
        </section>
        <section class="bloco">
          <div class="bloco-cabeca"><div><h2>Aluguéis recebidos</h2><p>${d.boxes.ocupados} de ${d.boxes.total} boxes alugados. Quanto do que foi cobrado em cada mês já entrou.</p></div></div>
          ${alugueis.length ? barras({ linhas: alugueis.map(a => ({ rotulo: mesNome(a.mes).replace(/^./, c => c.toUpperCase()), sub: `${dinheiro(a.recebido)} de ${dinheiro(a.previsto)}${a.atrasado ? `, ${dinheiro(a.atrasado)} em atraso` : ''}`, valor: a.previsto ? Math.round(a.recebido / a.previsto * 100) : 0 })), maximo: 100, formatar: v => `${v}%` }) : '<p class="nota">Nenhum aluguel no período.</p>'}
        </section>
      </div>

      <section class="bloco">
        <div class="bloco-cabeca"><div><h2>Mais vendidos no PDV em ${esc(mesNome(mesAtual).split(' ')[0])}</h2></div></div>
        ${d.produtos.length ? `<div class="tabela-envolve"><table class="tabela">
          <thead><tr><th>Item</th><th class="so-largo">Tipo</th><th class="num">Quantidade</th><th class="num">Valor</th></tr></thead>
          <tbody>${d.produtos.map(x => `<tr><td>${esc(x.nome)}</td><td class="so-largo">${x.tipo === 'ingresso' ? 'Bilheteria' : 'Loja'}</td><td class="num">${x.qtd}</td><td class="num"><b>${esc(dinheiro(x.valor))}</b></td></tr>`).join('')}</tbody>
        </table></div>` : '<p class="nota">Nenhuma venda no mês.</p>'}
      </section>`;
  }
};
