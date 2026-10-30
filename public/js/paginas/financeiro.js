import { esc, icone, dinheiro, dinheiroCurto, dataCurta, hora, mesNome, plural, selo, vazio, avisar, abrirModal, confirmar, campo, campoDinheiro } from '../ui.js';
import { colunas, barras, verNumeros } from '../graficos.js';
import { abas, abaAtual, seletorMes, fatos, campoForma, nomeForma, NOMES_AREA } from './comum.js';

const ABAS = ['extrato', 'pagar', 'receber', 'caixas'];
let filtroExtrato = 'todos';

function novaConta(ctx, sentido) {
  const d = ctx.dadosAtuais();
  const pagar = sentido === 'pagar';
  const m = abrirModal({
    titulo: pagar ? 'Lançar despesa' : 'Lançar receita avulsa',
    subtitulo: pagar ? 'Energia, água, folha, manutenção, compras...' : 'Patrocínio, aluguel de espaço avulso, outras entradas.',
    largo: true,
    corpo: `<form class="grade-form">
      ${campo({ nome: 'descricao', rotulo: 'Descrição', obrigatorio: true, classe: 'inteira', placeholder: pagar ? 'Ex.: Energia das áreas comuns' : 'Ex.: Patrocínio da placa na quadra 1' })}
      ${pagar ? campo({ nome: 'categoria', rotulo: 'Categoria', valor: 'energia', opcoes: Object.entries(d.categorias).map(([valor, texto]) => ({ valor, texto })) }) : ''}
      ${campo({ nome: 'pessoa', rotulo: pagar ? 'Fornecedor' : 'Quem paga', classe: pagar ? '' : 'inteira' })}
      ${campoDinheiro({ nome: 'valor', rotulo: 'Valor', obrigatorio: true })}
      ${campo({ nome: 'vencimento', rotulo: 'Vencimento', tipo: 'date', valor: d.agora.slice(0, 10), obrigatorio: true })}
      <label class="escolha inteira"><input type="checkbox" name="jaPaga"><span><b>${pagar ? 'Já foi paga' : 'Já foi recebida'}</b><small>${pagar ? 'Se não marcar, fica em contas a pagar até a baixa.' : 'Se não marcar, fica em contas a receber.'}</small></span></label>
      <div class="inteira oculto" data-forma>${campoForma(d.formas, { valor: 'pix' })}</div>
    </form>`,
    botao: pagar ? 'Lançar despesa' : 'Lançar receita',
    aoEnviar: v => ctx.acao('nova-conta', { ...v, sentido, jaPaga: v.jaPaga === 'on' }, pagar ? 'Despesa lançada.' : 'Receita lançada.')
  });
  m.fundo.querySelector('[name=jaPaga]').addEventListener('change', e => m.fundo.querySelector('[data-forma]').classList.toggle('oculto', !e.target.checked));
}

function baixar(ctx, c) {
  abrirModal({
    titulo: c.sentido === 'pagar' ? 'Registrar pagamento' : 'Registrar recebimento',
    subtitulo: `${c.descricao}: ${dinheiro(c.valor)}.`,
    corpo: `<form>${campoForma(ctx.dadosAtuais().formas, { valor: c.sentido === 'pagar' ? 'transferencia' : 'pix' })}</form>`,
    botao: c.sentido === 'pagar' ? 'Registrar pagamento' : 'Registrar recebimento',
    aoEnviar: v => ctx.acao('baixar-conta', { contaId: c.id, forma: v.forma }, c.sentido === 'pagar' ? 'Pagamento registrado.' : 'Recebimento registrado.')
  });
}

function extrato(d) {
  const lista = d.movimentos.filter(m => filtroExtrato === 'todos' || (filtroExtrato === 'entradas' ? m.sentido === 'entrada' : m.sentido === 'saida'));
  const porDia = d.fluxo;
  return `
    <div class="duas-colunas" style="margin-top:0">
      <section class="bloco">
        <div class="bloco-cabeca"><div><h2>Entradas por dia</h2><p>Dinheiro recebido em cada dia do mês, de todas as áreas.</p></div></div>
        ${porDia.length ? colunas({ pontos: porDia.map((p, i) => ({ rotulo: p.dia.slice(8, 10), valor: p.entradas, destaque: i === porDia.length - 1 && p.dia === d.agora.slice(0, 10), dica: dataCurta(p.dia) })), formatarEixo: dinheiroCurto, formatarValor: dinheiro, rotuloDestaque: false, descricao: 'Entradas por dia no mês' }) : '<p class="nota">Sem movimento neste mês.</p>'}
        ${porDia.length ? verNumeros(['Dia', 'Entradas', 'Saídas'], porDia.map(p => [dataCurta(p.dia), dinheiro(p.entradas), dinheiro(p.saidas)])) : ''}
      </section>
      <section class="bloco">
        <div class="bloco-cabeca"><div><h2>De onde veio</h2><p>Entradas do mês por área.</p></div></div>
        ${d.porArea.length ? barras({ linhas: d.porArea.filter(a => a.valor > 0).map(a => ({ rotulo: NOMES_AREA[a.area] || a.area, valor: a.valor })), formatar: dinheiro }) : '<p class="nota">Sem entradas neste mês.</p>'}
        ${d.totais.taxas ? `<p class="nota" style="margin-top:14px">As maquininhas cobraram ${esc(dinheiro(d.totais.taxas))} de taxa neste mês. O valor já está nas despesas.</p>` : ''}
      </section>
    </div>
    <section class="bloco" style="margin-top:18px">
      <div class="bloco-cabeca"><div><h2>Extrato</h2><p>Cada entrada e saída do mês, com a forma de pagamento e quem registrou.</p></div>
        <div class="chips" role="group" aria-label="Filtrar extrato">${[['todos', 'Tudo'], ['entradas', 'Entradas'], ['saidas', 'Saídas']].map(([id, nome]) => `<button type="button" class="chip ${filtroExtrato === id ? 'ativo' : ''}" data-filtro="${id}" aria-pressed="${filtroExtrato === id}">${nome}</button>`).join('')}</div></div>
      ${lista.length ? `<div class="tabela-envolve"><table class="tabela">
        <thead><tr><th>Quando</th><th>Descrição</th><th class="so-largo">Área</th><th class="so-largo">Forma</th><th class="num">Valor</th></tr></thead>
        <tbody>${lista.slice(0, 300).map(m => `<tr>
          <td class="num">${esc(dataCurta(m.em))} ${esc(hora(m.em))}</td>
          <td>${esc(m.descricao)}<small>${esc(m.por)}</small></td>
          <td class="so-largo">${esc(NOMES_AREA[m.area] || m.area)}</td>
          <td class="so-largo">${esc(nomeForma(d.formas, m.forma))}</td>
          <td class="num ${m.sentido === 'saida' ? 'saida' : 'entrada'}"><b>${m.sentido === 'saida' ? '− ' : '+ '}${esc(dinheiro(m.valor))}</b></td>
        </tr>`).join('')}</tbody>
      </table></div>${lista.length > 300 ? '<p class="nota">Mostrando os 300 mais recentes. O mês completo está no extrato para o contador.</p>' : ''}` : '<p class="nota">Nada aqui neste mês.</p>'}
    </section>`;
}

function contasPagar(d) {
  const lista = d.pagar;
  const abertas = lista.filter(c => c.status === 'aberta');
  return `<section class="bloco">
    <div class="bloco-cabeca"><div><h2>Contas a pagar</h2><p>${abertas.length ? `${plural(abertas.length, 'conta em aberto', 'contas em aberto')}, ${esc(dinheiro(abertas.reduce((t, c) => t + c.valor, 0)))}.` : 'Nada em aberto.'} Também aparecem as pagas neste mês.</p></div>
      <button type="button" class="botao primario" data-f="despesa">${icone('mais')}Lançar despesa</button></div>
    ${lista.length ? `<div class="tabela-envolve"><table class="tabela">
      <thead><tr><th>Descrição</th><th class="so-largo">Categoria</th><th>Vencimento</th><th class="num">Valor</th><th>Situação</th><th></th></tr></thead>
      <tbody>${lista.map(c => `<tr class="${c.status === 'cancelada' ? 'apagada' : ''}">
        <td><b>${esc(c.descricao)}</b><small>${esc(c.pessoa)}</small></td><td class="so-largo">${esc(c.categoriaNome)}</td><td class="num">${esc(dataCurta(c.vencimento))}</td>
        <td class="num"><b>${esc(dinheiro(c.valor))}</b></td>
        <td>${c.status === 'paga' ? selo(`Paga em ${dataCurta(c.pagoEm)}`, 'ok') : c.status === 'cancelada' ? selo('Cancelada', 'sem-ponto') : c.vencida ? selo('Vencida', 'problema') : selo('Em aberto', 'atencao')}</td>
        <td class="acoes">${c.status === 'aberta' ? `<button type="button" class="botao pequeno" data-f="baixar" data-id="${c.id}">Pagar</button><button type="button" class="botao fantasma pequeno" data-f="cancelar" data-id="${c.id}" aria-label="Cancelar conta">${icone('fechar')}</button>` : ''}</td>
      </tr>`).join('')}</tbody>
    </table></div>` : vazio({ icone: 'recibo', titulo: 'Nenhuma despesa lançada', texto: 'Lance energia, água, folha e as outras despesas para o resultado do mês ficar certo.', botao: '<button type="button" class="botao primario" data-f="despesa">Lançar despesa</button>' })}
  </section>`;
}

function contasReceber(d) {
  const r = d.receber;
  const vencidos = r.alugueis.filter(a => a.situacao === 'vencida');
  return `
    <section class="bloco">
      <div class="bloco-cabeca"><div><h2>Aluguéis em aberto</h2><p>${vencidos.length ? `${plural(vencidos.length, 'vencido', 'vencidos')}, ${esc(dinheiro(vencidos.reduce((t, a) => t + a.valor, 0)))}.` : 'Nenhum aluguel vencido.'}</p></div><a class="botao pequeno" href="#/boxes/inadimplencia">Ver em Boxes</a></div>
      ${r.alugueis.length ? `<div class="tabela-envolve"><table class="tabela">
        <thead><tr><th>Box</th><th>Locatário</th><th class="so-largo">Cobrança</th><th>Vencimento</th><th class="num">Valor</th></tr></thead>
        <tbody>${r.alugueis.map(a => `<tr><td><b>${esc(a.box)}</b></td><td>${esc(a.locatario)}</td><td class="so-largo">${esc(a.descricao)}</td>
          <td>${a.situacao === 'vencida' ? selo(`Vencido há ${plural(a.dias, 'dia', 'dias')}`, 'problema') : esc(dataCurta(a.vencimento))}</td><td class="num"><b>${esc(dinheiro(a.valor))}</b></td></tr>`).join('')}</tbody>
      </table></div>` : '<p class="nota">Tudo recebido.</p>'}
    </section>
    <div class="duas-colunas">
      <section class="bloco">
        <div class="bloco-cabeca"><div><h2>Saldos de eventos</h2></div><a class="botao pequeno" href="#/eventos">Ver eventos</a></div>
        ${r.eventos.length ? `<ul class="agenda-lista">${r.eventos.map(e => `<li><time>${esc(dataCurta(e.data))}</time><div><b>${esc(e.titulo)}</b></div><b>${esc(dinheiro(e.saldo))}</b></li>`).join('')}</ul>` : '<p class="nota">Nenhum saldo de evento em aberto.</p>'}
      </section>
      <section class="bloco">
        <div class="bloco-cabeca"><div><h2>Outras receitas</h2></div><button type="button" class="botao pequeno" data-f="receita">${icone('mais')}Lançar</button></div>
        ${r.contas.length ? `<ul class="agenda-lista">${r.contas.map(c => `<li><time>${esc(dataCurta(c.vencimento))}</time><div><b>${esc(c.descricao)}</b><small>${esc(c.pessoa)}</small></div>${c.status === 'aberta' ? `<button type="button" class="botao pequeno" data-f="baixar" data-id="${c.id}">Receber ${esc(dinheiro(c.valor))}</button>` : selo(`Recebida, ${dinheiro(c.valor)}`, 'ok')}</li>`).join('')}</ul>` : '<p class="nota">Nenhuma receita avulsa.</p>'}
      </section>
    </div>`;
}

function caixas(d) {
  return `<section class="bloco">
    <div class="bloco-cabeca"><div><h2>Caixas da recepção</h2><p>Cada abertura e fechamento do mês. Diferença é o contado menos o esperado.</p></div></div>
    ${d.caixas.length ? `<div class="tabela-envolve"><table class="tabela">
      <thead><tr><th>Dia</th><th class="so-largo">Quem fechou</th><th class="num so-largo">Esperado</th><th class="num">Contado</th><th class="num">Diferença</th></tr></thead>
      <tbody>${d.caixas.map(c => `<tr>
        <td>${esc(dataCurta(c.abertoEm))}, ${esc(hora(c.abertoEm))}${c.fechadoEm ? ` às ${esc(hora(c.fechadoEm))}` : ''}${c.observacao ? `<small>${esc(c.observacao)}</small>` : ''}</td>
        <td class="so-largo">${esc(c.fechadoPor || '')}</td>
        <td class="num so-largo">${c.fechadoEm ? esc(dinheiro(c.esperado)) : ''}</td>
        <td class="num">${c.fechadoEm ? esc(dinheiro(c.contado)) : selo('Aberto', 'info')}</td>
        <td class="num ${!c.fechadoEm ? '' : c.diferenca === 0 ? 'dif-zero' : c.diferenca < 0 ? 'dif-neg' : 'dif-pos'}">${!c.fechadoEm ? '' : c.diferenca === 0 ? 'Sem diferença' : esc(dinheiro(c.diferenca))}</td>
      </tr>`).join('')}</tbody>
    </table></div>` : '<p class="nota">Nenhum caixa neste mês.</p>'}
  </section>`;
}

export default {
  tela: 'financeiro',
  params: rota => ({ mes: rota.query.mes }),
  titulo: 'Financeiro',
  descricao: 'O que entrou, o que saiu, o que falta pagar e receber.',
  acoesCabecalho: ctx => `${seletorMes(ctx.dados.mes, ctx.dados.agora.slice(0, 7), `financeiro/${abaAtual(ctx.rota, ABAS)}`)}<button type="button" class="botao primario" data-f="despesa">${icone('mais')}Lançar despesa</button>`,

  render(ctx) {
    const d = ctx.dados;
    const aba = abaAtual(ctx.rota, ABAS);
    const abertasPagar = d.pagar.filter(c => c.status === 'aberta');
    const vencidasPagar = abertasPagar.filter(c => c.vencida).length;
    const receberTotal = d.receber.alugueis.reduce((t, a) => t + a.valor, 0) + d.receber.eventos.reduce((t, e) => t + e.saldo, 0) + d.receber.contas.filter(c => c.status === 'aberta').reduce((t, c) => t + c.valor, 0);
    return `
      ${fatos([
        { rotulo: `Entrou em ${mesNome(d.mes).split(' ')[0]}`, valor: dinheiro(d.totais.entradas), sub: 'Recebido de todas as áreas' },
        { rotulo: 'Saiu', valor: dinheiro(d.totais.saidas), sub: 'Despesas pagas no mês' },
        { rotulo: 'Saldo do mês', valor: dinheiro(d.totais.saldo), sub: 'Entrou menos saiu', classe: d.totais.saldo < 0 ? 'negativo' : '' },
        { rotulo: 'A receber', valor: dinheiro(receberTotal), sub: `A pagar: ${dinheiro(abertasPagar.reduce((t, c) => t + c.valor, 0))}` }
      ])}
      ${abas('financeiro', aba, [['extrato', 'Entradas e saídas'], ['pagar', 'Contas a pagar', vencidasPagar], ['receber', 'A receber'], ['caixas', 'Caixas']], `?mes=${d.mes}`)}
      ${{ extrato, pagar: contasPagar, receber: contasReceber, caixas }[aba](d)}`;
  },

  ligar(raiz, ctx) {
    raiz.querySelector('.pagina').addEventListener('click', async e => {
      const f = e.target.closest('[data-filtro]');
      if (f) { filtroExtrato = f.dataset.filtro; ctx.desenhar(); return; }
      const alvo = e.target.closest('[data-f]');
      if (!alvo) return;
      const d = ctx.dadosAtuais();
      if (alvo.dataset.f === 'despesa') return novaConta(ctx, 'pagar');
      if (alvo.dataset.f === 'receita') return novaConta(ctx, 'receber');
      const conta = d.pagar.concat(d.receber.contas).find(c => c.id === Number(alvo.dataset.id));
      if (!conta) return;
      if (alvo.dataset.f === 'baixar') baixar(ctx, conta);
      if (alvo.dataset.f === 'cancelar') {
        if (!(await confirmar({ titulo: 'Cancelar conta?', texto: `"${esc(conta.descricao)}" (${dinheiro(conta.valor)}) sai das despesas do mês.`, botao: 'Cancelar conta', perigo: true }))) return;
        ctx.acao('cancelar-conta', { contaId: conta.id }, 'Conta cancelada.').catch(err => avisar(err.message, 'erro'));
      }
    });
  }
};
