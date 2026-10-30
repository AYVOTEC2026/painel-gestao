import { esc, icone, dinheiro, dataCurta, dataLonga, dataExtenso, plural, telefone, tamanhoArquivo, selo, vazio, avisar, abrirModal, confirmar, campo, campoDinheiro } from '../ui.js';
import { zap, conversa, primeiroNome } from '../mensagens.js';
import { api } from '../api.js';
import { fatos, campoForma, nomeForma } from './comum.js';

const FILTROS = [
  ['proximos', 'Próximos'],
  ['orcamento', 'Orçamentos'],
  ['realizado', 'Realizados'],
  ['cancelado', 'Cancelados'],
  ['todos', 'Todos']
];
let filtro = 'proximos';

const TIPO_SELO = { orcamento: 'info', confirmado: 'ok', realizado: 'sem-ponto', cancelado: 'problema' };
const MES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

function filtrar(lista) {
  if (filtro === 'proximos') return lista.filter(e => e.dias >= 0 && ['orcamento', 'confirmado'].includes(e.status));
  if (filtro === 'todos') return lista.slice().reverse();
  return lista.filter(e => e.status === filtro).sort((a, b) => (filtro === 'orcamento' ? a.data.localeCompare(b.data) : b.data.localeCompare(a.data)));
}

function formulario(d, e) {
  return `<form class="grade-form">
    ${campo({ nome: 'titulo', rotulo: 'Nome do evento', valor: e ? e.titulo : '', obrigatorio: true, classe: 'inteira', placeholder: 'Ex.: Aniversário da Helena, 7 anos' })}
    ${campo({ nome: 'tipo', rotulo: 'Tipo', valor: e ? e.tipo : 'aniversario', opcoes: Object.entries(d.tipos).map(([valor, texto]) => ({ valor, texto })) })}
    ${campo({ nome: 'espaco', rotulo: 'Espaço', valor: e ? e.espaco : d.espacos[0], opcoes: d.espacos.map(x => ({ valor: x, texto: x })) })}
    ${campo({ nome: 'contratante', rotulo: 'Contratante', valor: e ? e.contratante : '', obrigatorio: true })}
    ${campo({ nome: 'telefone', rotulo: 'WhatsApp', tipo: 'tel', valor: e ? e.telefone : '', placeholder: '(85) 99999-9999' })}
    ${campo({ nome: 'data', rotulo: 'Data', tipo: 'date', valor: e ? e.data : '', obrigatorio: true })}
    ${campo({ nome: 'convidados', rotulo: 'Convidados', tipo: 'number', valor: e ? e.convidados || '' : '', extra: 'min="0"' })}
    ${campo({ nome: 'inicio', rotulo: 'Começa', tipo: 'time', valor: e ? e.inicio || '' : '15:00' })}
    ${campo({ nome: 'fim', rotulo: 'Termina', tipo: 'time', valor: e ? e.fim || '' : '19:00' })}
    ${campoDinheiro({ nome: 'valor', rotulo: 'Valor total', valor: e ? e.valor : '', obrigatorio: true })}
    ${campoDinheiro({ nome: 'sinal', rotulo: 'Sinal combinado', valor: e ? e.sinal || '' : '', placeholder: '0,00', ajuda: 'O evento é confirmado quando o primeiro pagamento entra.' })}
    ${campo({ nome: 'itens', rotulo: 'O que está incluso', tipo: 'textarea', valor: e ? e.itens : '', classe: 'inteira', placeholder: 'Espaço por 4 horas, mesas e cadeiras, parque infantil para os convidados...' })}
    ${campo({ nome: 'observacoes', rotulo: 'Observações', tipo: 'textarea', valor: e ? e.observacoes : '', classe: 'inteira', placeholder: 'Decoração, buffet terceirizado, restrições...' })}
  </form>`;
}

function novoEvento(ctx) {
  abrirModal({
    titulo: 'Novo orçamento de evento',
    subtitulo: 'Fica como orçamento até o primeiro pagamento.',
    largo: true,
    corpo: formulario(ctx.dadosAtuais(), null),
    botao: 'Salvar orçamento',
    aoEnviar: async v => {
      const r = await ctx.acao('novo-evento', v, 'Orçamento salvo.');
      if (r && r.eventoId) setTimeout(() => painel(ctx, r.eventoId), 80);
    }
  });
}

function pagamento(ctx, e) {
  abrirModal({
    titulo: 'Registrar pagamento',
    subtitulo: `${e.titulo}: saldo de ${dinheiro(e.saldo)}.`,
    corpo: `<form class="grade-form">
      ${campoDinheiro({ nome: 'valor', rotulo: 'Valor recebido', valor: e.status === 'orcamento' && e.sinal ? e.sinal : e.saldo, obrigatorio: true })}
      ${campoForma(ctx.dadosAtuais().formas)}
      ${e.status === 'orcamento' ? '<p class="nota inteira">Ao registrar este pagamento, o evento passa a confirmado.</p>' : ''}
    </form>`,
    botao: 'Registrar pagamento',
    aoEnviar: v => ctx.acao('pagamento-evento', { eventoId: e.id, valor: v.valor, forma: v.forma }, 'Pagamento registrado.')
  });
}

function cancelar(ctx, e) {
  abrirModal({
    titulo: `Cancelar "${e.titulo}"`,
    corpo: `<form class="grade-form">
      ${campo({ nome: 'motivo', rotulo: 'Motivo', classe: 'inteira', placeholder: 'Ex.: família mudou a data' })}
      ${e.pago ? `${campoDinheiro({ nome: 'devolver', rotulo: 'Quanto devolver', valor: 0, ajuda: `Foram pagos ${dinheiro(e.pago)}. Deixe zero se o sinal fica retido.` })}${campoForma(ctx.dadosAtuais().formas, { valor: 'pix' })}` : ''}
    </form>`,
    botao: 'Cancelar evento',
    botaoTipo: 'perigo cheio',
    cancelar: 'Voltar',
    aoEnviar: v => ctx.acao('status-evento', { eventoId: e.id, status: 'cancelado', motivo: v.motivo, devolver: v.devolver, forma: v.forma }, 'Evento cancelado.')
  });
}

/** A mensagem muda com a fase do evento: orçamento, saldo a acertar ou só o lembrete. */
function conversaDoEvento(e) {
  const dados = {
    nome: primeiroNome(e.contratante), evento: e.titulo, data: dataCurta(e.data), espaco: e.espaco || 'combinado',
    horario: e.inicio ? `das ${e.inicio} às ${e.fim || ''}`.trim() : 'no horário combinado',
    valor: dinheiro(e.valor), sinal: dinheiro(e.sinal || 0), saldo: dinheiro(e.saldo)
  };
  if (e.status === 'orcamento') return [zap('orcamento_evento', e.telefone, dados), 'Lembrar do orçamento'];
  if (e.status === 'confirmado') return e.saldo > 0 ? [zap('evento_saldo', e.telefone, dados), 'Lembrar do evento e do saldo'] : [zap('evento_lembrete', e.telefone, dados), 'Lembrar do evento'];
  return [conversa(e.telefone, e.contratante), 'WhatsApp'];
}

function painel(ctx, id) {
  const conteudo = () => {
    const e = ctx.dadosAtuais().eventos.find(x => x.id === id);
    if (!e) return '<p class="nota">Evento não encontrado.</p>';
    const pago = e.valor ? Math.min(100, e.pago / e.valor * 100) : 0;
    const [link, rotulo] = conversaDoEvento(e);
    return `
      <div class="ficha">
        <div><span>Data</span><b>${esc(dataLonga(e.data))}${e.inicio ? `, ${esc(e.inicio)} às ${esc(e.fim || '')}` : ''}</b></div>
        <div><span>Espaço</span><b>${esc(e.espaco || '—')}</b></div>
        <div><span>Contratante</span><b>${esc(e.contratante)}</b></div>
        <div><span>WhatsApp</span><b>${esc(telefone(e.telefone) || 'Não informado')}</b></div>
        <div><span>Convidados</span><b>${e.convidados || '—'}</b></div>
        <div><span>Situação</span><b>${selo(e.statusNome, TIPO_SELO[e.status])}</b></div>
      </div>
      <div class="pago-bloco">
        <div class="pago-linha"><span>Pago</span><b>${esc(dinheiro(e.pago))} de ${esc(dinheiro(e.valor))}</b></div>
        <div class="medidor"><i style="width:${pago}%"></i></div>
        ${e.saldo > 0 && e.status !== 'cancelado' ? `<p class="nota">Saldo a receber: <b>${esc(dinheiro(e.saldo))}</b>${e.sinal && !e.pago ? `. Sinal combinado: ${esc(dinheiro(e.sinal))}.` : '.'}</p>` : ''}
      </div>
      ${e.itens ? `<h3 class="sub-titulo">Incluso</h3><p class="texto-livre">${esc(e.itens)}</p>` : ''}
      ${e.observacoes ? `<h3 class="sub-titulo">Observações</h3><p class="texto-livre">${esc(e.observacoes)}</p>` : ''}
      ${e.motivo ? `<p class="nota">Motivo do cancelamento: ${esc(e.motivo)}</p>` : ''}
      <div class="cabecalho-acoes" style="margin-top:16px">
        ${e.status !== 'cancelado' && e.saldo > 0 ? '<button type="button" class="botao primario" data-e="pagar">Registrar pagamento</button>' : ''}
        ${e.status === 'confirmado' && e.dias <= 0 ? '<button type="button" class="botao" data-e="realizado">Marcar como realizado</button>' : ''}
        ${link ? `<a class="botao" href="${esc(link)}" target="_blank" rel="noopener">${icone('whatsapp')}${rotulo}</a>` : ''}
        ${e.status !== 'cancelado' && e.status !== 'realizado' ? '<button type="button" class="botao" data-e="editar">Editar</button><button type="button" class="botao perigo" data-e="cancelar">Cancelar</button>' : ''}
      </div>
      ${e.pagamentos.length ? `<div class="separador"></div><h3 class="sub-titulo">Pagamentos</h3><ul class="agenda-lista">${e.pagamentos.map(p => `<li><time>${esc(dataCurta(p.em))}</time><div><b>${p.sentido === 'saida' ? 'Devolução' : 'Recebido'}</b><small>${esc(nomeForma(ctx.dadosAtuais().formas, p.forma))}</small></div><b>${p.sentido === 'saida' ? '− ' : ''}${esc(dinheiro(p.valor))}</b></li>`).join('')}</ul>` : ''}
      <div class="separador"></div>
      <h3 class="sub-titulo">Contrato e arquivos</h3>
      ${e.anexos.length ? `<ul class="anexos">${e.anexos.map(a => `<li>${icone('anexo')}<a href="${esc(api.anexo(a.id))}" target="_blank" rel="noopener">${esc(a.nome)}</a><small>${esc(tamanhoArquivo(a.tamanho))}</small><button type="button" class="botao fantasma pequeno" data-e="remover-anexo" data-id="${a.id}" aria-label="Remover ${esc(a.nome)}">${icone('lixeira')}</button></li>`).join('')}</ul>` : '<p class="nota">Nenhum arquivo.</p>'}
      <label class="botao pequeno anexar">${icone('anexo')}Anexar arquivo<input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" data-e="anexar" class="so-leitor"></label>`;
  };
  const e0 = ctx.dadosAtuais().eventos.find(x => x.id === id);
  if (!e0) return;
  const m = abrirModal({ titulo: e0.titulo, subtitulo: `${e0.tipoNome}, ${dataExtenso(e0.data)}`, lateral: true, cancelar: 'Fechar', corpo: `<div id="painelEvento">${conteudo()}</div>` });
  const area = m.fundo.querySelector('#painelEvento');
  const redesenhar = () => { if (m.fundo.isConnected) area.innerHTML = conteudo(); };
  area.addEventListener('change', async ev => {
    if (ev.target.dataset.e !== 'anexar' || !ev.target.files.length) return;
    const arquivo = ev.target.files[0];
    if (arquivo.size > 10 * 1024 * 1024) { avisar('Arquivo maior que 10 MB.', 'erro'); return; }
    try { await api.enviarAnexo('evento', id, arquivo); avisar('Arquivo anexado.'); await ctx.recarregar(); redesenhar(); } catch (err) { avisar(err.message, 'erro'); }
  });
  area.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-e]');
    if (!b || b.dataset.e === 'anexar') return;
    const e = ctx.dadosAtuais().eventos.find(x => x.id === id);
    if (b.dataset.e === 'remover-anexo') {
      if (!(await confirmar({ titulo: 'Remover arquivo?', texto: 'O arquivo sai do sistema.', botao: 'Remover', perigo: true }))) return;
      try { await api.removerAnexo(b.dataset.id); await ctx.recarregar(); redesenhar(); } catch (err) { avisar(err.message, 'erro'); }
      return;
    }
    m.fechar();
    if (b.dataset.e === 'pagar') pagamento(ctx, e);
    if (b.dataset.e === 'cancelar') cancelar(ctx, e);
    if (b.dataset.e === 'editar') abrirModal({ titulo: `Editar "${e.titulo}"`, largo: true, corpo: formulario(ctx.dadosAtuais(), e), botao: 'Salvar', aoEnviar: v => ctx.acao('editar-evento', { ...v, eventoId: e.id }, 'Evento atualizado.') });
    if (b.dataset.e === 'realizado') ctx.acao('status-evento', { eventoId: e.id, status: 'realizado' }, 'Evento marcado como realizado.').catch(err => avisar(err.message, 'erro'));
  });
}

export default {
  tela: 'eventos',
  titulo: 'Eventos e festas',
  descricao: 'Aniversários, confraternizações e torneios: do orçamento ao saldo final.',
  acoesCabecalho: () => `<button type="button" class="botao primario" id="novoEvento">${icone('mais')}Novo evento</button>`,

  render(ctx) {
    const d = ctx.dados;
    const proximos30 = d.eventos.filter(e => e.status === 'confirmado' && e.dias >= 0 && e.dias <= 30);
    const aReceber = d.eventos.filter(e => ['confirmado', 'realizado'].includes(e.status)).reduce((t, e) => t + Math.max(0, e.saldo), 0);
    const mes = d.agora.slice(0, 7);
    const realizadosMes = d.eventos.filter(e => e.status === 'realizado' && e.data.startsWith(mes));
    const lista = filtrar(d.eventos);
    const contagem = { proximos: d.eventos.filter(e => e.dias >= 0 && ['orcamento', 'confirmado'].includes(e.status)).length, orcamento: d.eventos.filter(e => e.status === 'orcamento').length };
    return `
      ${fatos([
        { rotulo: 'Confirmados nos próximos 30 dias', valor: String(proximos30.length), sub: proximos30.length ? `${plural(proximos30.reduce((t, e) => t + (e.convidados || 0), 0), 'convidado', 'convidados')} no total` : 'Nenhum evento à frente' },
        { rotulo: 'Saldos a receber', valor: dinheiro(aReceber), sub: 'de eventos confirmados e realizados' },
        { rotulo: 'Realizados no mês', valor: String(realizadosMes.length), sub: dinheiro(realizadosMes.reduce((t, e) => t + e.valor, 0)) }
      ])}
      <div class="chips" role="group" aria-label="Filtrar eventos">${FILTROS.map(([id, nome]) => `<button type="button" class="chip ${id === filtro ? 'ativo' : ''}" data-filtro="${id}" aria-pressed="${id === filtro}">${esc(nome)}${contagem[id] ? ` <span>${contagem[id]}</span>` : ''}</button>`).join('')}</div>
      ${lista.length ? `<div class="eventos">${lista.map(e => `
        <button type="button" class="evento ${e.status}" data-evento="${e.id}">
          <span class="evento-data"><b>${esc(e.data.slice(8, 10))}</b><small>${MES_ABREV[Number(e.data.slice(5, 7)) - 1]}</small></span>
          <span class="evento-info"><b>${esc(e.titulo)}</b><small>${esc([e.contratante, e.espaco, e.inicio ? `às ${e.inicio}` : '', e.convidados ? `${e.convidados} convidados` : ''].filter(Boolean).join(', '))}</small></span>
          <span class="evento-valor"><b>${esc(dinheiro(e.valor))}</b><small>${e.status === 'cancelado' ? 'Cancelado' : e.saldo > 0 ? `falta ${esc(dinheiro(e.saldo))}` : 'Quitado'}</small></span>
          ${selo(e.statusNome, TIPO_SELO[e.status])}
        </button>`).join('')}</div>`
        : vazio({ icone: 'evento', titulo: 'Nenhum evento aqui', texto: filtro === 'proximos' ? 'Cadastre o primeiro orçamento. Ele vira confirmado quando o sinal entrar.' : 'Nada nesta situação.', botao: filtro === 'proximos' ? '<button type="button" class="botao primario" data-novo>Novo evento</button>' : '' })}`;
  },

  ligar(raiz, ctx) {
    raiz.querySelector('#novoEvento').addEventListener('click', () => novoEvento(ctx));
    raiz.querySelector('#corpoPagina').addEventListener('click', e => {
      const f = e.target.closest('[data-filtro]');
      if (f) { filtro = f.dataset.filtro; ctx.desenhar(); return; }
      if (e.target.closest('[data-novo]')) return novoEvento(ctx);
      const ev = e.target.closest('[data-evento]');
      if (ev) painel(ctx, Number(ev.dataset.evento));
    });
  }
};
