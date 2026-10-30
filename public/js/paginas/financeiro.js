import { esc, icone, dinheiro, dinheiroCurto, dataCurta, hora, mesNome, plural, selo, vazio, tamanhoArquivo, avisar, abrirModal, confirmar, campo, campoDinheiro, zonaDeArquivos, classeLinha, botaoMostrarTudo } from '../ui.js';
import { api } from '../api.js';
import { colunas, barras, verNumeros } from '../graficos.js';
import { abas, abaAtual, seletorMes, fatos, campoForma, nomeForma, NOMES_AREA, ACEITA_ARQUIVOS, enviarArquivos, zonaDaNota, ligarZonaDaNota } from './comum.js';

const ABAS = ['extrato', 'pagar', 'notas', 'receber', 'caixas'];
let filtroExtrato = 'todos';
let filtroNotas = 'faltando';

/* ------------------------------------------------- documento da despesa */

const SELO_DOC = {
  completa: (c) => selo(c.anexos.length === 1 ? '1 arquivo' : `${c.anexos.length} arquivos`, 'ok'),
  pendente: () => selo('Falta a nota', 'problema'),
  sem_documento: () => selo('Sem documento', 'sem-ponto')
};

/** "Nota fiscal (NF-e ou NFS-e)" vira "Nota fiscal" nas linhas, onde o espaço é curto. */
const nomeCurto = tipo => tipo.replace(/ \(.*\)$/, '');

const iconeArquivo = mime => (mime.endsWith('/xml') ? 'livro' : mime === 'application/pdf' ? 'recibo' : 'anexo');

function listaArquivos(anexos) {
  if (!anexos.length) return '';
  return `<ul class="anexos">${anexos.map(a => `<li>${icone(iconeArquivo(a.mime))}<a href="${esc(api.anexo(a.id))}" target="_blank" rel="noopener">${esc(a.nome)}</a><small>${esc(tamanhoArquivo(a.tamanho))}</small><button type="button" class="botao fantasma pequeno" data-arq="remover" data-id="${a.id}" aria-label="Remover ${esc(a.nome)}">${icone('lixeira')}</button></li>`).join('')}</ul>`;
}

function camposFiscais(d, c = {}) {
  return `
    ${campo({ nome: 'documentoTipo', rotulo: 'Documento que comprova', valor: c.documentoTipo || 'nota_fiscal', opcoes: Object.entries(d.documentos).map(([valor, texto]) => ({ valor, texto })) })}
    ${campo({ nome: 'documentoNumero', rotulo: 'Número do documento', valor: c.documentoNumero || '', placeholder: 'Ex.: 123456' })}
    ${campo({ nome: 'pessoaDocumento', rotulo: 'CNPJ ou CPF do fornecedor', valor: c.pessoaDocumento || '', placeholder: '00.000.000/0000-00' })}
    <div class="inteira ${c.documentoTipo === 'sem_documento' ? '' : 'oculto'}" data-justificativa>${campo({ nome: 'justificativa', rotulo: 'Por que não há documento', valor: c.justificativa || '', placeholder: 'Ex.: pagamento a autônomo sem recibo, o contador vai orientar' })}</div>`;
}

function ligarJustificativa(fundo) {
  const tipo = fundo.querySelector('[name=documentoTipo]');
  if (tipo) tipo.addEventListener('change', () => fundo.querySelector('[data-justificativa]').classList.toggle('oculto', tipo.value !== 'sem_documento'));
}

/* -------------------------------------------------------------- modais */

function novaConta(ctx, sentido) {
  const d = ctx.dadosAtuais();
  const pagar = sentido === 'pagar';
  let arquivos = () => [];
  const m = abrirModal({
    titulo: pagar ? 'Lançar despesa' : 'Lançar receita avulsa',
    subtitulo: pagar ? 'Solte a nota fiscal aqui e o sistema preenche para você.' : 'Patrocínio, aluguel de espaço avulso, outras entradas.',
    largo: true,
    corpo: `<form class="grade-form">
      ${pagar ? zonaDaNota('Nota fiscal e comprovantes', 'Arraste o XML da NF-e ou NFS-e, o PDF ou a foto da nota. Com o XML, os campos se preenchem sozinhos.') : ''}
      ${campo({ nome: 'descricao', rotulo: 'Descrição', obrigatorio: true, classe: 'inteira', placeholder: pagar ? 'Ex.: Energia das áreas comuns' : 'Ex.: Patrocínio da placa na quadra 1' })}
      ${pagar ? campo({ nome: 'categoria', rotulo: 'Categoria', valor: 'energia', opcoes: Object.entries(d.categorias).map(([valor, texto]) => ({ valor, texto })) }) : ''}
      ${campo({ nome: 'pessoa', rotulo: pagar ? 'Fornecedor' : 'Quem paga', classe: pagar ? '' : 'inteira' })}
      ${campoDinheiro({ nome: 'valor', rotulo: 'Valor', obrigatorio: true })}
      ${campo({ nome: 'vencimento', rotulo: 'Vencimento', tipo: 'date', valor: d.agora.slice(0, 10), obrigatorio: true })}
      ${pagar ? camposFiscais(d) : ''}
      <label class="escolha inteira"><input type="checkbox" name="jaPaga"><span><b>${pagar ? 'Já foi paga' : 'Já foi recebida'}</b><small>${pagar ? 'Se não marcar, fica em contas a pagar até a baixa.' : 'Se não marcar, fica em contas a receber.'}</small></span></label>
      <div class="inteira oculto" data-forma>${campoForma(d.formas, { valor: 'pix' })}</div>
    </form>`,
    botao: pagar ? 'Lançar despesa' : 'Lançar receita',
    aoEnviar: async v => {
      const r = await ctx.acao('nova-conta', { ...v, sentido, jaPaga: v.jaPaga === 'on' });
      const enviados = arquivos().length && r && r.contaId ? await enviarArquivos('conta', r.contaId, arquivos()) : 0;
      if (enviados) await ctx.recarregar();
      avisar(pagar ? `Despesa lançada${enviados ? ` com ${plural(enviados, 'arquivo', 'arquivos')}` : ''}.` : 'Receita lançada.');
    }
  });
  const f = m.fundo;
  f.querySelector('[name=jaPaga]').addEventListener('change', e => f.querySelector('[data-forma]').classList.toggle('oculto', !e.target.checked));
  if (!pagar) return;
  ligarJustificativa(f);

  // O XML da nota preenche fornecedor, CNPJ, número, valor e vencimento.
  arquivos = ligarZonaDaNota(f, (nota, preencher) => {
    preencher('descricao', nota.descricao || `${nota.modelo} nº ${nota.numero}`);
    preencher('pessoa', nota.emitente);
    preencher('pessoaDocumento', nota.documento);
    preencher('documentoNumero', nota.numero);
    preencher('documentoTipo', 'nota_fiscal');
    if (nota.valor) preencher('valor', nota.valor.toFixed(2));
    preencher('vencimento', nota.vencimento || nota.emissao);
    if (nota.tipo === 'produtos') preencher('categoria', 'compras');
  });
}

/** Painel da despesa: dados fiscais, arquivos e a área de soltar a nota. */
function painelDespesa(ctx, contaId) {
  const achar = () => {
    const d = ctx.dadosAtuais();
    return d.despesas.concat(d.pagar).find(c => c.id === contaId);
  };
  const conteudo = () => {
    const d = ctx.dadosAtuais();
    const c = achar();
    if (!c) return '<p class="nota">Despesa não encontrada.</p>';
    return `
      <div class="ficha">
        <div><span>Valor</span><b>${esc(dinheiro(c.valor))}</b></div>
        <div><span>Vencimento</span><b>${esc(dataCurta(c.vencimento))}${c.status === 'paga' ? `, paga em ${esc(dataCurta(c.pagoEm))}` : ', em aberto'}</b></div>
        <div><span>Categoria</span><b>${esc(c.categoriaNome)}</b></div>
        <div><span>Documentação</span><b>${SELO_DOC[c.documentacao](c)}</b></div>
      </div>
      <div class="separador"></div>
      <h3 class="sub-titulo">Nota fiscal e comprovantes</h3>
      ${listaArquivos(c.anexos)}
      <div class="zona-arquivos" data-zona>
        ${icone('anexo')}<div><b>${c.anexos.length ? 'Anexar mais um arquivo' : 'Anexe a nota desta despesa'}</b><small>Arraste aqui o PDF, a foto ou o XML da nota. Até 10 MB.</small></div>
        <label class="botao pequeno">Escolher arquivos<input type="file" multiple accept="${ACEITA_ARQUIVOS}" data-arquivos class="so-leitor"></label>
      </div>
      <div class="separador"></div>
      <h3 class="sub-titulo">Dados para o contador</h3>
      <form class="grade-form" data-fiscal>
        ${campo({ nome: 'pessoa', rotulo: 'Fornecedor', valor: c.pessoa, classe: 'inteira' })}
        ${camposFiscais(d, c)}
        <div class="inteira"><button type="submit" class="botao">Salvar dados</button></div>
      </form>`;
  };
  const c0 = achar();
  if (!c0) return;
  const m = abrirModal({ titulo: c0.descricao, subtitulo: c0.pessoa || 'Fornecedor não informado', lateral: true, cancelar: 'Fechar', corpo: `<div id="painelDespesa">${conteudo()}</div>` });
  const area = m.fundo.querySelector('#painelDespesa');
  const ligar = () => {
    zonaDeArquivos(area.querySelector('[data-zona]'), soltar);
    area.querySelector('[data-arquivos]').addEventListener('change', e => soltar([...e.target.files]));
    ligarJustificativa(area);
  };
  const redesenhar = () => { if (m.fundo.isConnected) { area.innerHTML = conteudo(); ligar(); } };
  async function soltar(lista) {
    if (!lista.length) return;
    const zona = area.querySelector('[data-zona]');
    zona.classList.add('enviando');
    try {
      const enviados = await enviarArquivos('conta', contaId, lista);
      if (enviados) avisar(`${plural(enviados, 'arquivo anexado', 'arquivos anexados')} à despesa.`);
      await ctx.recarregar();
      redesenhar();
    } catch (err) {
      avisar(err.message, 'erro');
      zona.classList.remove('enviando');
    }
  }
  ligar();
  area.addEventListener('submit', async e => {
    e.preventDefault();
    const botao = e.target.querySelector('button[type=submit]');
    botao.classList.add('carregando');
    try {
      await ctx.acao('dados-fiscais', { contaId, ...Object.fromEntries(new FormData(e.target).entries()) }, 'Dados da despesa salvos.');
      redesenhar();
    } catch (err) {
      avisar(err.message, 'erro');
      botao.classList.remove('carregando');
    }
  });
  area.addEventListener('click', async e => {
    const b = e.target.closest('[data-arq="remover"]');
    if (!b) return;
    if (!(await confirmar({ titulo: 'Remover arquivo?', texto: 'O arquivo sai desta despesa e do pacote do contador.', botao: 'Remover', perigo: true }))) return;
    try { await api.removerAnexo(b.dataset.id); avisar('Arquivo removido.'); await ctx.recarregar(); redesenhar(); } catch (err) { avisar(err.message, 'erro'); }
  });
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

/* ---------------------------------------------------------------- abas */

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
        <tbody>${lista.slice(0, 300).map((m, i) => `<tr class="${classeLinha(i)}">
          <td class="num">${esc(dataCurta(m.em))} ${esc(hora(m.em))}</td>
          <td>${esc(m.descricao)}<small>${esc(m.por)}</small></td>
          <td class="so-largo">${esc(NOMES_AREA[m.area] || m.area)}</td>
          <td class="so-largo">${esc(nomeForma(d.formas, m.forma))}</td>
          <td class="num ${m.sentido === 'saida' ? 'saida' : ''}"><b>${m.sentido === 'saida' ? '− ' : '+ '}${esc(dinheiro(m.valor))}</b></td>
        </tr>`).join('')}</tbody>
      </table></div>${botaoMostrarTudo(Math.min(lista.length, 300))}${lista.length > 300 ? '<p class="nota">Mostrando os 300 mais recentes. O mês completo está no extrato para o contador.</p>' : ''}` : '<p class="nota">Nada aqui neste mês.</p>'}
    </section>`;
}

function contasPagar(d) {
  const lista = d.pagar;
  const abertas = lista.filter(c => c.status === 'aberta');
  return `<section class="bloco">
    <div class="bloco-cabeca"><div><h2>Contas a pagar</h2><p>${abertas.length ? `${plural(abertas.length, 'conta em aberto', 'contas em aberto')}, ${esc(dinheiro(abertas.reduce((t, c) => t + c.valor, 0)))}.` : 'Nada em aberto.'} Também aparecem as pagas neste mês. Toque numa conta para anexar a nota.</p></div>
      <button type="button" class="botao primario" data-f="despesa">${icone('mais')}Lançar despesa</button></div>
    ${lista.length ? `<div class="tabela-envolve"><table class="tabela">
      <thead><tr><th>Descrição</th><th class="so-largo">Categoria</th><th>Vencimento</th><th class="num">Valor</th><th>Situação</th><th class="so-largo">Nota</th><th></th></tr></thead>
      <tbody>${lista.map(c => `<tr class="${c.status === 'cancelada' ? 'apagada' : ''}">
        <td><a href="#" data-f="abrir" data-id="${c.id}"><b>${esc(c.descricao)}</b></a><small>${esc(c.pessoa)}</small></td><td class="so-largo">${esc(c.categoriaNome)}</td><td class="num">${esc(dataCurta(c.vencimento))}</td>
        <td class="num"><b>${esc(dinheiro(c.valor))}</b></td>
        <td>${c.status === 'paga' ? selo(`Paga em ${dataCurta(c.pagoEm)}`, 'ok') : c.status === 'cancelada' ? selo('Cancelada', 'sem-ponto') : c.vencida ? selo('Vencida', 'problema') : selo('Em aberto', 'atencao')}</td>
        <td class="so-largo">${c.status === 'cancelada' ? '' : `<button type="button" class="chip-doc ${c.documentacao}" data-f="abrir" data-id="${c.id}">${icone(c.documentacao === 'completa' ? 'anexo' : c.documentacao === 'pendente' ? 'alerta' : 'info')}${c.documentacao === 'completa' ? c.anexos.length : c.documentacao === 'pendente' ? 'Anexar' : 'Sem doc.'}</button>`}</td>
        <td class="acoes">${c.status === 'aberta' ? `<button type="button" class="botao pequeno" data-f="baixar" data-id="${c.id}">Pagar</button><button type="button" class="botao fantasma pequeno" data-f="cancelar" data-id="${c.id}" aria-label="Cancelar conta">${icone('fechar')}</button>` : ''}</td>
      </tr>`).join('')}</tbody>
    </table></div>` : vazio({ icone: 'recibo', titulo: 'Nenhuma despesa lançada', texto: 'Lance energia, água, folha e as outras despesas para o resultado do mês ficar certo.', botao: '<button type="button" class="botao primario" data-f="despesa">Lançar despesa</button>' })}
  </section>`;
}

function notas(d) {
  const n = d.notas;
  const documentadas = n.completas + n.semDocumento;
  const percentual = n.total ? Math.round(documentadas / n.total * 100) : 100;
  const lista = d.despesas.filter(c => filtroNotas === 'todas' || (filtroNotas === 'faltando' ? c.documentacao === 'pendente' : c.documentacao !== 'pendente'));
  return `
    <section class="bloco painel-notas">
      <div class="notas-topo">
        <div class="notas-progresso">
          <span>Despesas de ${esc(mesNome(d.mes))} com documento</span>
          <strong>${documentadas} de ${n.total}</strong>
          <div class="medidor grande" role="meter" aria-valuemin="0" aria-valuemax="${n.total}" aria-valuenow="${documentadas}" aria-label="Despesas com documento"><i style="width:${percentual}%"></i></div>
          <small>${n.pendentes ? `Faltam ${plural(n.pendentes, 'nota', 'notas')}, ${esc(dinheiro(n.valorPendente))} sem comprovante. Solte o arquivo na linha da despesa.` : 'Tudo documentado. O pacote do contador está completo.'}</small>
        </div>
        <div class="notas-exportar">
          <a class="botao primario" href="${esc(api.pacote(d.mes, true))}" download>${icone('baixar')}Pacote completo para o contador</a>
          <a class="botao" href="${esc(api.pacote(d.mes, false))}" download>${icone('baixar')}Só despesas e notas</a>
          <small>Arquivo ZIP com as notas, a planilha de despesas e um resumo para abrir no navegador.</small>
        </div>
      </div>
    </section>
    <section class="bloco">
      <div class="bloco-cabeca"><div><h2>Despesas de ${esc(mesNome(d.mes))}</h2><p>Pelo mês a que pertencem. Arraste o arquivo da nota direto para a linha da despesa.</p></div>
        <div class="chips" role="group" aria-label="Filtrar despesas">${[['faltando', 'Faltando nota', n.pendentes], ['com', 'Com documento'], ['todas', 'Todas']].map(([id, nome, qtd]) => `<button type="button" class="chip ${filtroNotas === id ? 'ativo' : ''}" data-filtro-notas="${id}" aria-pressed="${filtroNotas === id}">${nome}${qtd ? ` <span>${qtd}</span>` : ''}</button>`).join('')}</div></div>
      ${lista.length ? `<div class="linhas-notas">${lista.map(c => `
        <div class="linha-nota ${c.documentacao}" data-soltar="${c.id}">
          <div class="linha-nota-info">
            <b>${esc(c.descricao)}</b>
            <small>${esc([c.pessoa, c.pessoaDocumento, `${nomeCurto(c.documentoTipoNome)}${c.documentoNumero ? ` nº ${c.documentoNumero}` : ''}`].filter(Boolean).join(', '))}</small>
          </div>
          <div class="linha-nota-valor"><b>${esc(dinheiro(c.valor))}</b><small>vence ${esc(dataCurta(c.vencimento))}</small></div>
          <div class="linha-nota-arquivos">${c.anexos.length ? c.anexos.slice(0, 3).map(a => `<a class="arquivo-mini" href="${esc(api.anexo(a.id))}" target="_blank" rel="noopener" title="${esc(a.nome)}">${icone(iconeArquivo(a.mime))}${esc(a.mime.endsWith('/xml') ? 'XML' : a.mime === 'application/pdf' ? 'PDF' : 'Foto')}</a>`).join('') : c.documentacao === 'sem_documento' ? `<small class="nota">${esc(c.justificativa)}</small>` : '<span class="soltar-aqui">Solte a nota aqui</span>'}</div>
          <div class="linha-nota-acoes">
            ${c.documentacao === 'pendente' ? `<label class="botao pequeno primario">${icone('anexo')}Anexar<input type="file" multiple accept="${ACEITA_ARQUIVOS}" data-anexar="${c.id}" class="so-leitor"></label>` : ''}
            <button type="button" class="botao pequeno fantasma" data-f="abrir" data-id="${c.id}">Detalhes</button>
          </div>
        </div>`).join('')}</div>`
        : filtroNotas === 'faltando' ? `<div class="tudo-certo">${icone('certo')}Nenhuma nota faltando em ${esc(mesNome(d.mes))}.</div>` : '<p class="nota">Nenhuma despesa aqui.</p>'}
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
  descricao: 'O que entrou, o que saiu, o que falta pagar e receber, e as notas fiscais das despesas.',
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
      ${abas('financeiro', aba, [['extrato', 'Entradas e saídas'], ['pagar', 'Contas a pagar', vencidasPagar], ['notas', 'Notas fiscais', d.notas.pendentes], ['receber', 'A receber'], ['caixas', 'Caixas']], `?mes=${d.mes}`)}
      ${{ extrato, pagar: contasPagar, notas, receber: contasReceber, caixas }[aba](d)}`;
  },

  ligar(raiz, ctx) {
    const pagina = raiz.querySelector('.pagina');
    async function anexar(linha, lista) {
      linha.classList.add('enviando');
      try {
        const enviados = await enviarArquivos('conta', Number(linha.dataset.soltar), lista);
        if (enviados) avisar(`${plural(enviados, 'arquivo anexado', 'arquivos anexados')}.`);
        await ctx.recarregar();
      } catch (err) {
        avisar(err.message, 'erro');
        linha.classList.remove('enviando');
      }
    }
    // Cada linha da aba de notas aceita o arquivo solto em cima dela.
    pagina.querySelectorAll('[data-soltar]').forEach(linha => zonaDeArquivos(linha, lista => anexar(linha, lista)));
    pagina.addEventListener('change', e => {
      const input = e.target.closest('[data-anexar]');
      if (input && input.files.length) anexar(input.closest('[data-soltar]'), [...input.files]);
    });
    pagina.addEventListener('click', async e => {
      const f = e.target.closest('[data-filtro]');
      if (f) { filtroExtrato = f.dataset.filtro; ctx.desenhar(); return; }
      const fn = e.target.closest('[data-filtro-notas]');
      if (fn) { filtroNotas = fn.dataset.filtroNotas; ctx.desenhar(); return; }
      const alvo = e.target.closest('[data-f]');
      if (!alvo) return;
      e.preventDefault();
      const d = ctx.dadosAtuais();
      if (alvo.dataset.f === 'despesa') return novaConta(ctx, 'pagar');
      if (alvo.dataset.f === 'receita') return novaConta(ctx, 'receber');
      if (alvo.dataset.f === 'abrir') return painelDespesa(ctx, Number(alvo.dataset.id));
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
