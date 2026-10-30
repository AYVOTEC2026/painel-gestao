import { esc, icone, dinheiro, dataCurta, dataLonga, mesNome, plural, telefone, linkWhatsapp, tamanhoArquivo, selo, vazio, avisar, abrirModal, confirmar, campo, campoDinheiro } from '../ui.js';
import { api } from '../api.js';
import { abas, abaAtual, seletorMes, fatos, campoForma, nomeForma } from './comum.js';

const ABAS = ['mapa', 'cobrancas', 'inadimplencia', 'contratos'];

/** Situação de um aluguel em palavras e cor. */
function situacao(b) {
  if (b.status === 'paga') return selo(`Recebido em ${dataCurta(b.pagoEm)}`, 'ok');
  if (b.status === 'cancelada') return selo('Cancelada', 'sem-ponto');
  if (b.situacao === 'vencida') return selo(`Vencido há ${plural(b.dias, 'dia', 'dias')}`, 'problema');
  if (b.situacao === 'vence_hoje') return selo('Vence hoje', 'atencao');
  return selo(`Vence em ${plural(b.dias, 'dia', 'dias')}`, b.dias <= 5 ? 'atencao' : 'info');
}

function seloContrato(c) {
  if (c.vencido > 0) return selo(`${dinheiro(c.vencido)} em atraso`, 'problema');
  if (c.diasParaFim != null && c.diasParaFim < 0) return selo(`Contrato vencido em ${dataCurta(c.fim)}`, 'problema');
  if (c.diasParaFim != null && c.diasParaFim <= 60) return selo(`Contrato termina em ${plural(c.diasParaFim, 'dia', 'dias')}`, 'atencao');
  if (c.emAberto > 0) return selo('Aluguel a vencer', 'info');
  return selo('Em dia', 'ok');
}

const mensagemCobranca = (c, cobrancas) => {
  const lista = cobrancas.map(b => `${b.descricao.toLowerCase()} (${dinheiro(b.valor)}, venceu em ${dataCurta(b.vencimento)})`).join('; ');
  return `Olá, ${(c.responsavel || c.locatario).split(' ')[0]}! Tudo bem? Consta em aberto no box ${c.box}: ${lista}. Total de ${dinheiro(c.vencido)}. Pode verificar, por favor?`;
};

/* -------------------------------------------------------------- modais */

function camposContrato(c) {
  return `
    ${campo({ nome: 'locatario', rotulo: 'Empresa locatária', valor: c ? c.locatario : '', obrigatorio: true, classe: 'inteira', placeholder: 'Nome do negócio. Ex.: Forno a Lenha Pizzaria' })}
    ${campo({ nome: 'atividade', rotulo: 'Ramo', valor: c ? c.atividade : '', placeholder: 'Ex.: pizzaria, açaí' })}
    ${campo({ nome: 'documento', rotulo: 'CNPJ ou CPF', valor: c ? c.documento : '' })}
    ${campo({ nome: 'responsavel', rotulo: 'Responsável', valor: c ? c.responsavel : '' })}
    ${campo({ nome: 'telefone', rotulo: 'WhatsApp', tipo: 'tel', valor: c ? c.telefone : '', placeholder: '(85) 99999-9999' })}
    ${campo({ nome: 'email', rotulo: 'E-mail', tipo: 'email', valor: c ? c.email : '', classe: 'inteira' })}
    ${campoDinheiro({ nome: 'valor', rotulo: 'Aluguel por mês', valor: c ? c.valor : '', obrigatorio: true })}
    ${campo({ nome: 'diaVencimento', rotulo: 'Dia do vencimento', tipo: 'number', valor: c ? c.diaVencimento : 10, obrigatorio: true, extra: 'min="1" max="31"', ajuda: 'Dia 31 vira o último dia nos meses mais curtos.' })}
    ${campo({ nome: 'inicio', rotulo: 'Início', tipo: 'date', valor: c ? c.inicio : '', obrigatorio: true })}
    ${campo({ nome: 'fim', rotulo: 'Fim', tipo: 'date', valor: c ? c.fim || '' : '', ajuda: 'Vazio para prazo indeterminado.' })}
    ${campoDinheiro({ nome: 'caucao', rotulo: 'Caução', valor: c ? c.caucao || '' : '', placeholder: '0,00', ajuda: c && ['recebida', 'devolvida'].includes(c.caucaoStatus) ? 'Já movimentada: não muda mais.' : 'Garantia paga no início do contrato.' })}
    ${campo({ nome: 'reajuste', rotulo: 'Reajuste', valor: c ? c.reajuste : 'IPCA a cada 12 meses' })}
    ${campo({ nome: 'observacoes', rotulo: 'Observações', tipo: 'textarea', valor: c ? c.observacoes : '', classe: 'inteira', placeholder: 'Energia e água, regras de uso, horário de funcionamento...' })}`;
}

function novoContrato(ctx, unidadeId) {
  const d = ctx.dadosAtuais();
  const livres = d.mapa.filter(u => !u.contrato);
  if (!livres.length) { avisar('Todos os boxes estão alugados. Cadastre um box novo primeiro.', 'erro'); return; }
  abrirModal({
    titulo: 'Novo contrato de locação',
    subtitulo: 'O aluguel de cada mês é lançado sozinho, com o vencimento no dia combinado.',
    largo: true,
    corpo: `<form class="grade-form">
      ${campo({ nome: 'unidadeId', rotulo: 'Box', valor: unidadeId || livres[0].id, classe: 'inteira', opcoes: livres.map(u => ({ valor: u.id, texto: `${u.tipoNome} ${u.numero}${u.area ? `, ${String(u.area).replace('.', ',')} m²` : ''}` })) })}
      ${camposContrato(null)}
    </form>`,
    botao: 'Salvar contrato',
    aoEnviar: async v => {
      const r = await ctx.acao('novo-contrato', v, 'Contrato salvo. Anexe o arquivo assinado no box.');
      if (r && r.contratoId) setTimeout(() => painelDoBox(ctx, Number(v.unidadeId)), 80);
    }
  });
}

function editarContrato(ctx, c) {
  abrirModal({
    titulo: `Contrato do box ${c.box}`,
    largo: true,
    corpo: `<form class="grade-form">${camposContrato(c)}<p class="nota inteira">Mudança no valor ou no dia de vencimento vale a partir do próximo aluguel lançado.</p></form>`,
    botao: 'Salvar contrato',
    aoEnviar: v => ctx.acao('editar-contrato', { ...v, contratoId: c.id }, 'Contrato atualizado.')
  });
}

function salvarUnidade(ctx, u) {
  const d = ctx.dadosAtuais();
  abrirModal({
    titulo: u ? `Box ${u.numero}` : 'Novo box',
    corpo: `<form class="grade-form">
      ${campo({ nome: 'numero', rotulo: 'Número ou nome', valor: u ? u.numero : '', obrigatorio: true, placeholder: 'Ex.: 09 ou Q3' })}
      ${campo({ nome: 'tipo', rotulo: 'Tipo', valor: u ? u.tipo : 'conteiner', opcoes: Object.entries(d.tipos).map(([valor, texto]) => ({ valor, texto })) })}
      ${campo({ nome: 'area', rotulo: 'Área (m²)', tipo: 'number', valor: u ? u.area || '' : '', extra: 'min="1" step="0.5"' })}
      ${campo({ nome: 'observacao', rotulo: 'Observação', valor: u ? u.observacao : '', placeholder: 'Ex.: ponto de água, perto do parque' })}
    </form>`,
    botao: u ? 'Salvar box' : 'Cadastrar box',
    aoEnviar: v => ctx.acao('salvar-unidade', { ...v, unidadeId: u ? u.id : undefined }, u ? 'Box atualizado.' : 'Box cadastrado.')
  });
}

function receber(ctx, b) {
  const d = ctx.dadosAtuais();
  const m = abrirModal({
    titulo: 'Registrar recebimento',
    subtitulo: `${b.locatario}, box ${b.box}: ${b.descricao.toLowerCase()}, ${dinheiro(b.valor)}.`,
    corpo: `<form class="grade-form">
      ${campoForma(d.formas, { valor: 'pix' })}
      ${campoDinheiro({ nome: 'acrescimo', rotulo: 'Multa e juros', placeholder: '0,00', ajuda: b.situacao === 'vencida' ? `Venceu há ${plural(b.dias, 'dia', 'dias')}. Opcional.` : 'Opcional.' })}
      <div class="recibo-linha total inteira" id="totalReceber"><span>Total recebido</span><span>${esc(dinheiro(b.valor))}</span></div>
    </form>`,
    botao: 'Registrar recebimento',
    aoEnviar: v => ctx.acao('receber-cobranca', { cobrancaId: b.id, forma: v.forma, acrescimo: v.acrescimo }, 'Recebimento registrado.')
  });
  m.fundo.querySelector('[name=acrescimo]').addEventListener('input', e => {
    const extra = Number(String(e.target.value).replace(',', '.')) || 0;
    m.fundo.querySelector('#totalReceber span:last-child').textContent = dinheiro(b.valor + extra);
  });
}

function ajustar(ctx, b) {
  abrirModal({
    titulo: 'Ajustar valor',
    subtitulo: `${b.locatario}: ${b.descricao.toLowerCase()}, hoje ${dinheiro(b.valor)}.`,
    corpo: `<form class="grade-form">
      ${campoDinheiro({ nome: 'valor', rotulo: 'Novo valor', valor: b.valor, obrigatorio: true, classe: 'inteira', ajuda: 'Para desconto, aluguel proporcional ou correção.' })}
      ${campo({ nome: 'motivo', rotulo: 'Motivo', classe: 'inteira', placeholder: 'Ex.: proporcional ao início no dia 15' })}
    </form>`,
    botao: 'Ajustar valor',
    aoEnviar: v => ctx.acao('ajustar-cobranca', { cobrancaId: b.id, valor: v.valor, motivo: v.motivo }, 'Valor ajustado.')
  });
}

async function cancelarCobranca(ctx, b) {
  const ok = await confirmar({ titulo: 'Cancelar cobrança?', texto: `${esc(b.descricao)} de ${esc(b.locatario)} (${dinheiro(b.valor)}) deixa de existir e sai da receita do mês.`, botao: 'Cancelar cobrança', perigo: true });
  if (ok) ctx.acao('cancelar-cobranca', { cobrancaId: b.id }, 'Cobrança cancelada.').catch(err => avisar(err.message, 'erro'));
}

function novaCobranca(ctx, c) {
  abrirModal({
    titulo: 'Cobrança avulsa',
    subtitulo: `Para ${c.locatario}, box ${c.box}.`,
    corpo: `<form class="grade-form">
      ${campo({ nome: 'descricao', rotulo: 'O que está sendo cobrado', obrigatorio: true, classe: 'inteira', placeholder: 'Ex.: Energia do box (medidor)' })}
      ${campoDinheiro({ nome: 'valor', rotulo: 'Valor', obrigatorio: true })}
      ${campo({ nome: 'vencimento', rotulo: 'Vencimento', tipo: 'date', obrigatorio: true })}
    </form>`,
    botao: 'Lançar cobrança',
    aoEnviar: v => ctx.acao('nova-cobranca', { ...v, contratoId: c.id }, 'Cobrança lançada.')
  });
}

function caucao(ctx, c, operacao) {
  const d = ctx.dadosAtuais();
  abrirModal({
    titulo: operacao === 'receber' ? 'Receber caução' : 'Devolver caução',
    subtitulo: `${c.locatario}: ${dinheiro(c.caucao)}.`,
    corpo: `<form>${campoForma(d.formas, { valor: operacao === 'receber' ? 'pix' : 'transferencia' })}</form>`,
    botao: operacao === 'receber' ? 'Registrar recebimento' : 'Registrar devolução',
    aoEnviar: v => ctx.acao('caucao', { contratoId: c.id, operacao, forma: v.forma }, operacao === 'receber' ? 'Caução recebida.' : 'Caução devolvida.')
  });
}

function encerrar(ctx, c) {
  abrirModal({
    titulo: `Encerrar contrato de ${c.locatario}`,
    subtitulo: `Box ${c.box} fica livre para um novo locatário.`,
    corpo: `<form>
      ${campo({ nome: 'data', rotulo: 'Data da saída', tipo: 'date', valor: ctx.dadosAtuais().agora.slice(0, 10), obrigatorio: true })}
      <p class="nota" style="margin-top:12px">Aluguéis de meses depois da saída são cancelados. O que estiver vencido continua em aberto para cobrar.${c.caucaoStatus === 'recebida' ? ' Lembre de devolver a caução.' : ''}</p>
    </form>`,
    botao: 'Encerrar contrato',
    botaoTipo: 'perigo cheio',
    aoEnviar: v => ctx.acao('encerrar-contrato', { contratoId: c.id, data: v.data }, 'Contrato encerrado. O box está livre.')
  });
}

/** Painel lateral do box: contrato, anexos, caução e histórico de pagamentos. */
function painelDoBox(ctx, unidadeId) {
  const conteudo = () => {
    const d = ctx.dadosAtuais();
    const u = d.mapa.find(x => x.id === unidadeId);
    if (!u) return '<p class="nota">Box não encontrado.</p>';
    const c = u.contrato;
    if (!c) {
      return `<div class="vazio"><div class="vazio-icone">${icone('boxes')}</div><h3>Box livre</h3><p>${esc(u.tipoNome)}${u.area ? `, ${String(u.area).replace('.', ',')} m²` : ''}. ${esc(u.observacao || '')}</p>
        <button type="button" class="botao primario" data-b="novo">Fechar contrato</button> <button type="button" class="botao" data-b="unidade">Editar box</button></div>`;
    }
    const zap = c.vencido > 0 ? linkWhatsapp(c.telefone, mensagemCobranca(c, c.historico.filter(b => b.situacao === 'vencida'))) : linkWhatsapp(c.telefone, `Olá, ${(c.responsavel || c.locatario).split(' ')[0]}! `);
    return `
      <div class="ficha">
        <div><span>Aluguel</span><b>${esc(dinheiro(c.valor))} por mês</b></div>
        <div><span>Vencimento</span><b>Todo dia ${c.diaVencimento}</b></div>
        <div><span>Prazo</span><b>${esc(dataLonga(c.inicio))} a ${c.fim ? esc(dataLonga(c.fim)) : 'indeterminado'}</b></div>
        <div><span>Situação</span><b>${seloContrato(c)}</b></div>
        <div><span>Responsável</span><b>${esc(c.responsavel || 'Não informado')}</b></div>
        <div><span>WhatsApp</span><b>${esc(telefone(c.telefone) || 'Não informado')}</b></div>
        <div><span>CNPJ ou CPF</span><b>${esc(c.documento || 'Não informado')}</b></div>
        <div><span>Reajuste</span><b>${esc(c.reajuste || 'Não informado')}</b></div>
      </div>
      ${c.observacoes ? `<p class="nota" style="margin-top:12px">${esc(c.observacoes)}</p>` : ''}
      <div class="cabecalho-acoes" style="margin-top:14px">
        ${zap ? `<a class="botao pequeno" href="${esc(zap)}" target="_blank" rel="noopener">${icone('whatsapp')}${c.vencido > 0 ? 'Cobrar no WhatsApp' : 'WhatsApp'}</a>` : ''}
        <button type="button" class="botao pequeno" data-b="editar">${icone('lapis')}Editar contrato</button>
        <button type="button" class="botao pequeno" data-b="avulsa">${icone('mais')}Cobrança avulsa</button>
        <button type="button" class="botao pequeno perigo" data-b="encerrar">Encerrar</button>
      </div>

      <div class="separador"></div>
      <h3 class="sub-titulo">Contrato assinado</h3>
      ${c.anexos.length ? `<ul class="anexos">${c.anexos.map(a => `<li>${icone('anexo')}<a href="${esc(api.anexo(a.id))}" target="_blank" rel="noopener">${esc(a.nome)}</a><small>${esc(tamanhoArquivo(a.tamanho))}, ${esc(dataCurta(a.criadoEm))}</small><button type="button" class="botao fantasma pequeno" data-b="remover-anexo" data-id="${a.id}" aria-label="Remover ${esc(a.nome)}">${icone('lixeira')}</button></li>`).join('')}</ul>` : '<p class="nota">Nenhum arquivo anexado ainda.</p>'}
      <label class="botao pequeno anexar">${icone('anexo')}Anexar arquivo<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" data-b="anexar" hidden></label>
      <p class="nota">PDF ou foto do contrato, até 10 MB.</p>

      ${c.caucao ? `<div class="separador"></div><h3 class="sub-titulo">Caução de ${esc(dinheiro(c.caucao))}</h3>
        <div class="cabecalho-acoes">${{ pendente: selo('A receber', 'atencao'), recebida: selo('Recebida', 'ok'), devolvida: selo('Devolvida', 'sem-ponto') }[c.caucaoStatus] || ''}
        ${c.caucaoStatus === 'pendente' ? '<button type="button" class="botao pequeno" data-b="caucao-receber">Registrar recebimento</button>' : ''}
        ${c.caucaoStatus === 'recebida' ? '<button type="button" class="botao pequeno" data-b="caucao-devolver">Registrar devolução</button>' : ''}</div>` : ''}

      <div class="separador"></div>
      <h3 class="sub-titulo">Aluguéis e cobranças</h3>
      ${c.historico.length ? `<div class="tabela-envolve"><table class="tabela compacta">
        <thead><tr><th>Cobrança</th><th class="num">Valor</th><th>Situação</th><th></th></tr></thead>
        <tbody>${c.historico.map(b => `<tr><td>${esc(b.descricao)}<small>vence ${esc(dataCurta(b.vencimento))}</small></td><td class="num">${esc(dinheiro(b.status === 'paga' ? b.valorPago : b.valor))}</td><td>${situacao(b)}</td>
          <td class="acoes">${b.status === 'aberta' ? `<button type="button" class="botao pequeno" data-b="receber" data-id="${b.id}">Receber</button>` : ''}</td></tr>`).join('')}</tbody>
      </table></div>` : '<p class="nota">Ainda não há cobranças.</p>'}`;
  };
  const d0 = ctx.dadosAtuais();
  const u0 = d0.mapa.find(x => x.id === unidadeId);
  if (!u0) return;
  const m = abrirModal({
    titulo: u0.contrato ? u0.contrato.locatario : `Box ${u0.numero}`,
    subtitulo: u0.contrato ? `Box ${u0.numero}${u0.contrato.atividade ? `, ${u0.contrato.atividade.toLowerCase()}` : ''}` : u0.tipoNome,
    lateral: true,
    cancelar: 'Fechar',
    corpo: `<div id="painelBox">${conteudo()}</div>`
  });
  const area = m.fundo.querySelector('#painelBox');
  const redesenhar = () => { if (m.fundo.isConnected) area.innerHTML = conteudo(); };
  const contrato = () => (ctx.dadosAtuais().mapa.find(x => x.id === unidadeId) || {}).contrato;

  area.addEventListener('change', async e => {
    if (e.target.dataset.b !== 'anexar' || !e.target.files.length) return;
    const arquivo = e.target.files[0];
    if (arquivo.size > 10 * 1024 * 1024) { avisar('Arquivo maior que 10 MB. Envie um PDF menor ou uma foto.', 'erro'); return; }
    const rotulo = e.target.closest('label');
    rotulo.classList.add('carregando');
    try {
      await api.enviarAnexo('contrato', contrato().id, arquivo);
      avisar('Arquivo anexado ao contrato.');
      await ctx.recarregar();
      redesenhar();
    } catch (err) {
      avisar(err.message, 'erro');
      rotulo.classList.remove('carregando');
    }
  });
  area.addEventListener('click', async e => {
    const b = e.target.closest('[data-b]');
    if (!b || b.dataset.b === 'anexar') return;
    const c = contrato();
    const acao = b.dataset.b;
    if (acao === 'remover-anexo') {
      if (!(await confirmar({ titulo: 'Remover arquivo?', texto: 'O arquivo sai do sistema. Esta ação não pode ser desfeita.', botao: 'Remover', perigo: true }))) return;
      try { await api.removerAnexo(b.dataset.id); avisar('Arquivo removido.'); await ctx.recarregar(); redesenhar(); } catch (err) { avisar(err.message, 'erro'); }
      return;
    }
    m.fechar();
    const u = ctx.dadosAtuais().mapa.find(x => x.id === unidadeId);
    if (acao === 'novo') novoContrato(ctx, unidadeId);
    if (acao === 'unidade') salvarUnidade(ctx, u);
    if (acao === 'editar') editarContrato(ctx, c);
    if (acao === 'avulsa') novaCobranca(ctx, c);
    if (acao === 'encerrar') encerrar(ctx, c);
    if (acao === 'caucao-receber') caucao(ctx, c, 'receber');
    if (acao === 'caucao-devolver') caucao(ctx, c, 'devolver');
    if (acao === 'receber') receber(ctx, { ...c.historico.find(x => x.id === Number(b.dataset.id)), locatario: c.locatario, box: c.box });
  });
}

/* ------------------------------------------------------------------ abas */

function mapa(d) {
  return `<div class="mapa">${d.mapa.map(u => {
    const c = u.contrato;
    if (!c) {
      return `<button type="button" class="box-placa livre" data-unidade="${u.id}">
        <span class="placa-numero"><small>${esc(u.tipoNome)}</small>${esc(u.numero)}</span>
        <span class="placa-info">Livre${u.area ? `, ${String(u.area).replace('.', ',')} m²` : ''}</span>
        <span class="mais">${icone('mais')}Fechar contrato</span>
      </button>`;
    }
    return `<button type="button" class="box-placa ocupado ${c.vencido > 0 ? 'atrasado' : ''}" data-unidade="${u.id}">
      <span class="placa-numero"><small>${esc(u.tipoNome)}</small>${esc(u.numero)}</span>
      <b>${esc(c.locatario)}</b>
      <span class="placa-info">${esc(dinheiro(c.valor))} por mês, vence dia ${c.diaVencimento}</span>
      ${seloContrato(c)}
    </button>`;
  }).join('')}</div>`;
}

function cobrancas(d) {
  const lista = d.cobrancas;
  const total = lista.filter(b => b.status !== 'cancelada').reduce((t, b) => t + b.valor, 0);
  return `<section class="bloco">
    <div class="bloco-cabeca"><div><h2>Aluguéis e cobranças de ${esc(mesNome(d.mes))}</h2><p>Inclui o que ficou em aberto de meses anteriores. Total de ${esc(dinheiro(total))}.</p></div></div>
    ${lista.length ? `<div class="tabela-envolve"><table class="tabela">
      <thead><tr><th>Box</th><th>Locatário</th><th class="so-largo">Cobrança</th><th class="so-largo">Vencimento</th><th class="num">Valor</th><th>Situação</th><th></th></tr></thead>
      <tbody>${lista.map(b => `<tr class="${b.status === 'cancelada' ? 'apagada' : ''}">
        <td><b>${esc(b.box)}</b></td><td>${esc(b.locatario)}</td><td class="so-largo">${esc(b.descricao)}</td><td class="num so-largo">${esc(dataCurta(b.vencimento))}</td>
        <td class="num"><b>${esc(dinheiro(b.status === 'paga' ? b.valorPago : b.valor))}</b></td><td>${situacao(b)}</td>
        <td class="acoes">${b.status === 'aberta' ? `<button type="button" class="botao pequeno" data-c="receber" data-id="${b.id}">Receber</button><button type="button" class="botao fantasma pequeno" data-c="ajustar" data-id="${b.id}" aria-label="Ajustar valor">${icone('lapis')}</button><button type="button" class="botao fantasma pequeno" data-c="cancelar" data-id="${b.id}" aria-label="Cancelar cobrança">${icone('fechar')}</button>` : ''}</td>
      </tr>`).join('')}</tbody>
    </table></div>` : vazio({ icone: 'recibo', titulo: 'Nenhuma cobrança neste mês', texto: 'Os aluguéis são lançados sozinhos para os contratos ativos.' })}
  </section>`;
}

function inadimplencia(d) {
  if (!d.inadimplentes.length) return `<div class="tudo-certo">${icone('certo')}Nenhum locatário em atraso. Todos os aluguéis vencidos foram recebidos.</div>`;
  return `<div class="inadimplentes">${d.inadimplentes.map(c => {
    const zap = linkWhatsapp(c.telefone, mensagemCobranca(c, c.cobrancas));
    return `<article class="bloco devedor">
      <div class="bloco-cabeca"><div><h2>${esc(c.locatario)}</h2><p>Box ${esc(c.box)}${c.responsavel ? `, ${esc(c.responsavel)}` : ''}${c.telefone ? `, ${esc(telefone(c.telefone))}` : ''}</p></div>
        <div class="devedor-total"><strong>${esc(dinheiro(c.vencido))}</strong><span>atraso de até ${plural(c.maiorAtraso, 'dia', 'dias')}</span></div></div>
      <ul class="devedor-lista">${c.cobrancas.map(b => `<li><span>${esc(b.descricao)}, venceu em ${esc(dataCurta(b.vencimento))}</span><b>${esc(dinheiro(b.valor))}</b><button type="button" class="botao pequeno" data-c="receber" data-id="${b.id}">Receber</button></li>`).join('')}</ul>
      <div class="cabecalho-acoes">${zap ? `<a class="botao" href="${esc(zap)}" target="_blank" rel="noopener">${icone('whatsapp')}Cobrar no WhatsApp</a>` : '<span class="nota">Sem WhatsApp cadastrado.</span>'}</div>
    </article>`;
  }).join('')}</div>`;
}

function contratos(d) {
  return `<section class="bloco">
    <div class="bloco-cabeca"><div><h2>Contratos</h2><p>Ativos e encerrados nos últimos 12 meses.</p></div></div>
    ${d.contratos.length ? `<div class="tabela-envolve"><table class="tabela">
      <thead><tr><th>Box</th><th>Locatário</th><th class="num">Aluguel</th><th class="so-largo">Prazo</th><th class="so-largo">Caução</th><th class="so-largo">Arquivo</th><th>Situação</th></tr></thead>
      <tbody>${d.contratos.map(c => `<tr class="${c.status === 'encerrado' ? 'apagada' : ''}">
        <td><b>${esc(c.box)}</b></td><td><a href="#" data-c="abrir" data-unidade="${c.unidadeId}">${esc(c.locatario)}</a><small>${esc(c.atividade)}</small></td>
        <td class="num">${esc(dinheiro(c.valor))}<small>dia ${c.diaVencimento}</small></td>
        <td class="so-largo">${esc(dataCurta(c.inicio))}/${esc(c.inicio.slice(2, 4))} a ${c.fim ? `${esc(dataCurta(c.fim))}/${esc(c.fim.slice(2, 4))}` : 'indeterminado'}</td>
        <td class="so-largo">${c.caucao ? `${esc(dinheiro(c.caucao))}<small>${esc({ pendente: 'a receber', recebida: 'recebida', devolvida: 'devolvida' }[c.caucaoStatus] || '')}</small>` : '—'}</td>
        <td class="so-largo">${c.anexos.length ? `${icone('anexo')} ${c.anexos.length}` : '<span class="nota">Falta anexar</span>'}</td>
        <td>${c.status === 'encerrado' ? selo(`Encerrado em ${dataCurta(c.encerradoEm)}`, 'sem-ponto') : seloContrato(c)}</td>
      </tr>`).join('')}</tbody>
    </table></div>` : vazio({ icone: 'boxes', titulo: 'Nenhum contrato ainda', texto: 'Toque num box livre no mapa para fechar o primeiro contrato.' })}
  </section>`;
}

/* ---------------------------------------------------------------- tela */

export default {
  tela: 'boxes',
  params: rota => ({ mes: rota.query.mes }),
  titulo: 'Boxes',
  descricao: 'Contêineres e quiosques alugados para outras empresas: contratos, aluguel de cada mês e quem está em atraso.',
  acoesCabecalho: () => `<button type="button" class="botao" id="novoBox">${icone('mais')}Novo box</button><button type="button" class="botao primario" id="novoContrato">${icone('mais')}Novo contrato</button>`,

  render(ctx) {
    const d = ctx.dados;
    const aba = abaAtual(ctx.rota, ABAS);
    const r = d.resumo;
    const percentual = r.previsto ? Math.round(r.recebido / r.previsto * 100) : 0;
    const conteudo = { mapa, cobrancas, inadimplencia, contratos }[aba](d);
    return `
      ${fatos([
        { rotulo: 'Boxes alugados', valor: `${r.ocupados} de ${r.total}`, sub: r.total - r.ocupados ? `${plural(r.total - r.ocupados, 'livre', 'livres')}` : 'Todos alugados' },
        { rotulo: 'Aluguel contratado', valor: dinheiro(r.aluguelMensal), sub: 'por mês, somando os contratos' },
        { rotulo: `Recebido em ${mesNome(d.mes).split(' ')[0]}`, valor: dinheiro(r.recebido), sub: `${percentual}% de ${dinheiro(r.previsto)} cobrados` },
        { rotulo: 'Em atraso', valor: dinheiro(r.emAtraso), sub: r.emAtraso ? `${plural(d.inadimplentes.length, 'locatário', 'locatários')}` : 'Ninguém em atraso', classe: r.emAtraso ? 'negativo' : '' }
      ])}
      <div class="abas-linha">
        ${abas('boxes', aba, [['mapa', 'Mapa'], ['cobrancas', 'Cobranças do mês'], ['inadimplencia', 'Inadimplência', d.inadimplentes.length], ['contratos', 'Contratos']], aba === 'cobrancas' ? `?mes=${d.mes}` : '')}
        ${aba === 'cobrancas' ? seletorMes(d.mes, d.agora.slice(0, 7), 'boxes/cobrancas') : ''}
      </div>
      ${conteudo}`;
  },

  ligar(raiz, ctx) {
    raiz.querySelector('#novoContrato').addEventListener('click', () => novoContrato(ctx));
    raiz.querySelector('#novoBox').addEventListener('click', () => salvarUnidade(ctx, null));
    raiz.querySelector('#corpoPagina').addEventListener('click', e => {
      const placa = e.target.closest('[data-unidade]');
      if (placa) { e.preventDefault(); painelDoBox(ctx, Number(placa.dataset.unidade)); return; }
      const alvo = e.target.closest('[data-c]');
      if (!alvo) return;
      const d = ctx.dadosAtuais();
      const todas = d.cobrancas.concat(...d.inadimplentes.map(c => c.cobrancas));
      const b = todas.find(x => x.id === Number(alvo.dataset.id));
      if (!b) return;
      if (alvo.dataset.c === 'receber') receber(ctx, b);
      if (alvo.dataset.c === 'ajustar') ajustar(ctx, b);
      if (alvo.dataset.c === 'cancelar') cancelarCobranca(ctx, b);
    });
  }
};
