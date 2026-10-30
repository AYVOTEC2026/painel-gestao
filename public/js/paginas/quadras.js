import { esc, icone, dinheiro, dataCurta, dataExtenso, diaSemana, somarDias, plural, telefone, abrirModal, campo, campoDinheiro } from '../ui.js';
import { zap, primeiroNome } from '../mensagens.js';
import { campoForma, nomeForma, abrirCaixa } from './comum.js';

const paraMin = t => { const [h, m] = String(t).slice(0, 5).split(':').map(Number); return h * 60 + m; };
const deMin = n => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
const fimDoDia = fecha => (paraMin(fecha) === 0 ? 1440 : paraMin(fecha));

function slots(horario) {
  const lista = [];
  for (let m = paraMin(horario.abre); m < fimDoDia(horario.fecha); m += 30) lista.push(m);
  return lista;
}

function htmlAgenda(d) {
  const hoje = d.agora.slice(0, 10);
  const agoraMin = d.dia === hoje ? paraMin(d.agora.slice(11, 16)) : d.dia < hoje ? 1e9 : -1;
  const lista = slots(d.horario);
  const abre = paraMin(d.horario.abre);
  const linha = m => Math.floor((m - abre) / 30) + 2;
  const celulas = [];
  lista.forEach((m, i) => {
    celulas.push(`<div class="ag-hora ${m % 60 ? 'meia' : ''}" style="grid-row:${i + 2};grid-column:1">${m % 60 ? '' : deMin(m)}</div>`);
    d.quadras.forEach((q, c) => {
      const passou = m + 30 <= agoraMin;
      celulas.push(passou
        ? `<div class="ag-vazio passou" style="grid-row:${i + 2};grid-column:${c + 2}"></div>`
        : `<button type="button" class="ag-vazio" style="grid-row:${i + 2};grid-column:${c + 2}" data-q="nova" data-quadra="${q.id}" data-inicio="${deMin(m)}" aria-label="Reservar ${esc(q.nome)} às ${deMin(m)}"></button>`);
    });
  });
  const blocos = d.reservas.map(r => {
    const c = d.quadras.findIndex(q => q.id === r.quadraId);
    if (c < 0) return '';
    const ini = Math.max(abre, paraMin(r.inicio));
    const fim = Math.min(fimDoDia(d.horario.fecha), paraMin(r.fim));
    const aPagar = r.status === 'reservada';
    return `<button type="button" class="ag-reserva ${r.status}" style="grid-row:${linha(ini)} / ${linha(fim - 1) + 1};grid-column:${c + 2}" data-q="ver" data-id="${r.id}">
      <b>${esc(r.cliente)}</b>
      <span>${esc(r.inicio)} às ${esc(r.fim)}${r.grupo ? ', toda semana' : ''}</span>
      <span class="ag-status">${aPagar ? 'A pagar' : 'Paga'}</span>
    </button>`;
  }).join('');
  return `<div class="agenda-rolagem"><div class="agenda" style="--quadras:${d.quadras.length};grid-template-rows:44px repeat(${lista.length}, 30px)">
    <div class="ag-canto"></div>
    ${d.quadras.map((q, c) => `<div class="ag-quadra" style="grid-column:${c + 2}"><b>${esc(q.nome)}</b><small>${esc(q.modalidade)}, ${esc(dinheiro(q.precoHora))}/h</small></div>`).join('')}
    ${celulas.join('')}${blocos}
  </div></div>`;
}

function novaReserva(ctx, preenchido = {}) {
  const d = ctx.dadosAtuais();
  if (!d.quadras.length) return;
  const hoje = d.agora.slice(0, 10);
  const horarios = slots(d.horario).filter(m => m + 60 <= fimDoDia(d.horario.fecha)).map(m => ({ valor: deMin(m), texto: deMin(m) }));
  const quadra = d.quadras.find(q => q.id === Number(preenchido.quadraId)) || d.quadras[0];
  const m = abrirModal({
    titulo: 'Nova reserva de quadra',
    largo: true,
    corpo: `<form class="grade-form">
      ${campo({ nome: 'quadraId', rotulo: 'Quadra', valor: quadra.id, opcoes: d.quadras.map(q => ({ valor: q.id, texto: `${q.nome} (${q.modalidade})` })) })}
      ${campo({ nome: 'data', rotulo: 'Data', tipo: 'date', valor: preenchido.data || d.dia, obrigatorio: true, extra: `min="${hoje}"` })}
      ${campo({ nome: 'inicio', rotulo: 'Início', valor: preenchido.inicio || horarios[0].valor, opcoes: horarios })}
      ${campo({ nome: 'duracao', rotulo: 'Duração', valor: 60, opcoes: [[60, '1 hora'], [90, '1h30'], [120, '2 horas'], [150, '2h30'], [180, '3 horas']].map(([v, t]) => ({ valor: v, texto: t })) })}
      ${campo({ nome: 'cliente', rotulo: 'Quem reservou', obrigatorio: true, placeholder: 'Nome ou turma' })}
      ${campo({ nome: 'telefone', rotulo: 'WhatsApp', tipo: 'tel', placeholder: '(85) 99999-9999' })}
      ${campoDinheiro({ nome: 'valor', rotulo: 'Valor', valor: quadra.precoHora.toFixed(2), ajuda: 'Calculado pelo preço da hora. Pode alterar.' })}
      ${campo({ nome: 'semanas', rotulo: 'Repetir', valor: 1, opcoes: [[1, 'Só esta data'], [4, 'Toda semana, por 4 semanas'], [8, 'Toda semana, por 8 semanas'], [12, 'Toda semana, por 12 semanas']].map(([v, t]) => ({ valor: v, texto: t })) })}
      <label class="escolha inteira"><input type="checkbox" name="pagarAgora"><span><b>Receber agora</b><small>Se não marcar, a reserva fica "a pagar" e aparece em A receber.</small></span></label>
      <div class="inteira oculto" data-forma>${campoForma(d.formas)}</div>
    </form>`,
    botao: 'Reservar',
    aoEnviar: dados => ctx.acao('nova-reserva', { ...dados, pagarAgora: dados.pagarAgora === 'on' }, r => (r && r.quantidade > 1 ? `${r.quantidade} reservas criadas, uma por semana.` : 'Reserva criada.'))
  });
  const f = m.fundo;
  let valorEditado = false;
  const recalcular = () => {
    if (valorEditado) return;
    const q = d.quadras.find(x => x.id === Number(f.querySelector('[name=quadraId]').value));
    const dur = Number(f.querySelector('[name=duracao]').value);
    f.querySelector('[name=valor]').value = (q.precoHora * dur / 60).toFixed(2);
  };
  f.querySelector('[name=valor]').addEventListener('input', () => { valorEditado = true; });
  f.querySelector('[name=quadraId]').addEventListener('change', recalcular);
  f.querySelector('[name=duracao]').addEventListener('change', recalcular);
  f.querySelector('[name=pagarAgora]').addEventListener('change', e => f.querySelector('[data-forma]').classList.toggle('oculto', !e.target.checked));
}

function receber(ctx, r) {
  const d = ctx.dadosAtuais();
  abrirModal({
    titulo: 'Receber reserva',
    subtitulo: `${r.cliente}: ${dataCurta(r.data)} das ${r.inicio} às ${r.fim}, ${dinheiro(r.valor)}.`,
    corpo: `<form>${campoForma(d.formas)}${d.caixa ? '' : '<p class="nota" style="margin-top:10px">O caixa está fechado: para receber em dinheiro, abra o caixa no PDV.</p>'}</form>`,
    botao: `Receber ${dinheiro(r.valor)}`,
    aoEnviar: dados => ctx.acao('pagar-reserva', { reservaId: r.id, forma: dados.forma }, 'Pagamento registrado.')
  });
}

function cancelar(ctx, r) {
  abrirModal({
    titulo: 'Cancelar reserva',
    subtitulo: `${r.cliente}: ${dataCurta(r.data)} das ${r.inicio} às ${r.fim}.`,
    corpo: `<form>
      ${r.status === 'paga' ? `<p class="nota" style="margin-bottom:12px">Esta reserva já foi paga (${dinheiro(r.valor)}). O valor será devolvido pela mesma forma.</p>` : ''}
      ${campo({ nome: 'motivo', rotulo: 'Motivo', placeholder: 'Ex.: chuva, cliente desmarcou' })}
      ${r.grupo ? '<label class="escolha" style="margin-top:12px"><input type="checkbox" name="todas"><span><b>Cancelar também as próximas semanas</b><small>Desfaz o grupo fixo a partir desta data.</small></span></label>' : ''}
    </form>`,
    botao: 'Cancelar reserva',
    botaoTipo: 'perigo cheio',
    cancelar: 'Voltar',
    aoEnviar: dados => ctx.acao('cancelar-reserva', { reservaId: r.id, motivo: dados.motivo, todasDoGrupo: dados.todas === 'on' }, 'Reserva cancelada.')
  });
}

function detalhe(ctx, id) {
  const d = ctx.dadosAtuais();
  const r = d.reservas.concat(d.aReceber).find(x => x.id === Number(id));
  if (!r) return;
  const q = d.quadras.find(x => x.id === r.quadraId);
  const link = zap('quadra_reserva', r.telefone, {
    nome: primeiroNome(r.cliente), quadra: q ? q.nome : 'quadra', data: `${diaSemana(r.data)}, ${dataCurta(r.data)}`, horario: `${r.inicio} às ${r.fim}`, valor: dinheiro(r.valor)
  });
  const m = abrirModal({
    titulo: r.cliente,
    subtitulo: `${q ? q.nome : r.quadra}, ${dataExtenso(r.data)}`,
    corpo: `<div class="ficha">
        <div><span>Horário</span><b>${esc(r.inicio)} às ${esc(r.fim)}</b></div>
        <div><span>Valor</span><b>${esc(dinheiro(r.valor))}</b></div>
        <div><span>Situação</span><b>${r.status === 'paga' ? `Paga no ${esc(nomeForma(d.formas, r.forma))}` : 'A pagar'}</b></div>
        <div><span>WhatsApp</span><b>${esc(telefone(r.telefone) || 'Não informado')}</b></div>
      </div>
      ${r.grupo ? '<p class="nota" style="margin-top:12px">Faz parte de um grupo fixo: a mesma hora toda semana.</p>' : ''}
      <div class="cabecalho-acoes" style="margin-top:16px">
        ${r.status === 'reservada' ? '<button type="button" class="botao primario" data-r="receber">Receber pagamento</button>' : ''}
        ${link ? `<a class="botao" href="${esc(link)}" target="_blank" rel="noopener">${icone('whatsapp')}Confirmar no WhatsApp</a>` : ''}
        <button type="button" class="botao perigo" data-r="cancelar">Cancelar reserva</button>
      </div>`,
    cancelar: 'Fechar'
  });
  m.fundo.addEventListener('click', e => {
    const b = e.target.closest('[data-r]');
    if (!b) return;
    m.fechar();
    if (b.dataset.r === 'receber') receber(ctx, r);
    if (b.dataset.r === 'cancelar') cancelar(ctx, r);
  });
}

export default {
  tela: 'quadras',
  params: rota => ({ data: rota.query.data }),
  titulo: 'Quadras',
  descricao: 'Agenda do dia: toque num horário livre para reservar ou numa reserva para receber e cancelar.',
  acoesCabecalho: () => `<button type="button" class="botao primario" id="novaReserva">${icone('mais')}Nova reserva</button>`,

  render(ctx) {
    const d = ctx.dados;
    const hoje = d.agora.slice(0, 10);
    if (!d.quadras.length) {
      return `<div class="vazio"><div class="vazio-icone">${icone('quadra')}</div><h3>Nenhuma quadra cadastrada</h3><p>${ctx.ehGestao ? 'Cadastre as quadras e o preço da hora em Administração.' : 'Peça à gestão para cadastrar as quadras.'}</p>${ctx.ehGestao ? '<a class="botao primario" href="#/admin/quadras">Cadastrar quadras</a>' : ''}</div>`;
    }
    const aPagar = d.reservas.filter(r => r.status === 'reservada').length;
    return `
      <div class="barra-dia">
        <div class="navega-dia">
          <a class="seta" href="#/quadras?data=${somarDias(d.dia, -1)}" aria-label="Dia anterior">${icone('esquerda')}</a>
          <b>${esc(dataExtenso(d.dia).replace(/^./, c => c.toUpperCase()))}</b>
          <a class="seta" href="#/quadras?data=${somarDias(d.dia, 1)}" aria-label="Próximo dia">${icone('direita')}</a>
          ${d.dia !== hoje ? `<a class="botao pequeno" href="#/quadras">Hoje</a>` : ''}
        </div>
        <div class="semana" aria-label="Semana">${d.semana.map(s => `<a href="#/quadras?data=${s.dia}" class="${s.dia === d.dia ? 'ativo' : ''} ${s.dia === hoje ? 'hoje' : ''}"><span>${esc(diaSemana(s.dia))}</span><b>${esc(s.dia.slice(8, 10))}</b><small>${s.reservas || ''}</small></a>`).join('')}</div>
      </div>
      <p class="resumo-dia">${esc(plural(d.reservas.length, 'reserva', 'reservas'))}, ${d.ocupacao}% das horas ocupadas${aPagar ? `, ${aPagar} a pagar` : ''}.</p>
      ${htmlAgenda(d)}
      ${d.aReceber.length ? `<section class="bloco" style="margin-top:22px">
        <div class="bloco-cabeca"><div><h2>A receber</h2><p>Jogos que já aconteceram e ainda não foram pagos.</p></div></div>
        <div class="tabela-envolve"><table class="tabela">
          <thead><tr><th>Quando</th><th>Quem</th><th class="so-largo">Quadra</th><th class="num">Valor</th><th></th></tr></thead>
          <tbody>${d.aReceber.map(r => `<tr><td>${esc(dataCurta(r.data))}, ${esc(r.inicio)}</td><td>${esc(r.cliente)}</td><td class="so-largo">${esc(r.quadra)}</td><td class="num"><b>${esc(dinheiro(r.valor))}</b></td>
            <td class="acoes"><button type="button" class="botao pequeno" data-q="receber" data-id="${r.id}">Receber</button></td></tr>`).join('')}</tbody>
        </table></div>
      </section>` : ''}`;
  },

  ligar(raiz, ctx) {
    const botao = raiz.querySelector('#novaReserva');
    if (botao) botao.addEventListener('click', () => novaReserva(ctx));
    raiz.querySelector('#corpoPagina').addEventListener('click', e => {
      if (e.target.closest('[data-abrir-caixa]')) return abrirCaixa(ctx);
      const alvo = e.target.closest('[data-q]');
      if (!alvo) return;
      const d = ctx.dadosAtuais();
      if (alvo.dataset.q === 'nova') novaReserva(ctx, { quadraId: alvo.dataset.quadra, inicio: alvo.dataset.inicio, data: d.dia });
      if (alvo.dataset.q === 'ver') detalhe(ctx, alvo.dataset.id);
      if (alvo.dataset.q === 'receber') receber(ctx, d.aReceber.find(r => r.id === Number(alvo.dataset.id)));
    });
  }
};
