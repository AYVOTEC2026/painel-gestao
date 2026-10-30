import { esc, icone, dinheiro, hora, duracao, plural, telefone, vazio, avisar, abrirModal, campo } from '../ui.js';
import { zap, conversa, primeiroNome } from '../mensagens.js';
import { campoForma, nomeForma, abrirCaixa, avisoCaixaFechado } from './comum.js';

/* ------------------------------------------------------------- relógio */

// Diferença entre o relógio do servidor (hora do complexo) e o deste aparelho.
let deslocamento = 0;
const lerLocal = t => new Date(String(t).slice(0, 19)).getTime();
const agoraDoComplexo = () => Date.now() + deslocamento;
const minutosDesde = entrada => Math.max(0, Math.floor((agoraDoComplexo() - lerLocal(entrada)) / 60000));

function situacao(e, alerta) {
  const decorridos = minutosDesde(e.entrada);
  if (e.minutos == null) return { decorridos, restantes: null, situacao: 'livre' };
  const restantes = e.minutos - decorridos;
  return { decorridos, restantes, situacao: restantes < 0 ? 'passou' : restantes <= alerta ? 'acabando' : 'no_tempo' };
}

function excedente(e, cfg) {
  const s = situacao(e, cfg.alerta);
  if (e.minutos == null) return { ...s, excedidos: 0, valor: 0 };
  const excedidos = Math.max(0, s.decorridos - e.minutos);
  const blocos = excedidos > cfg.tolerancia ? Math.ceil(excedidos / cfg.bloco) : 0;
  return { ...s, excedidos, blocos, valor: blocos * cfg.valorBloco };
}

function htmlTempo(e, alerta) {
  const s = situacao(e, alerta);
  if (s.situacao === 'livre') return `<div class="tempo livre"><strong>${duracao(s.decorridos)}</strong><span>no parque, dia livre</span></div>`;
  if (s.situacao === 'passou') return `<div class="tempo passou"><strong>+${duracao(-s.restantes)}</strong><span>passou do tempo</span></div>`;
  return `<div class="tempo ${s.situacao}"><strong>${duracao(s.restantes)}</strong><span>${s.situacao === 'acabando' ? 'acabando' : 'restantes'}</span></div>`;
}

/* -------------------------------------------------------------- modais */

/** Venda da pulseira com o cadastro da criança. Usada também pelo PDV. */
export function abrirEntrada(ctx, { planos, formas, aoConcluir }) {
  abrirModal({
    titulo: 'Nova entrada no parque',
    subtitulo: 'O tempo começa a contar quando a pulseira for entregue.',
    largo: true,
    corpo: `<form class="grade-form">
      ${campo({ nome: 'crianca', rotulo: 'Nome da criança', obrigatorio: true, extra: 'autocomplete="off"' })}
      ${campo({ nome: 'idade', rotulo: 'Idade', tipo: 'number', extra: 'min="0" max="17" inputmode="numeric"' })}
      ${campo({ nome: 'responsavel', rotulo: 'Responsável', obrigatorio: true, extra: 'autocomplete="off"' })}
      ${campo({ nome: 'telefone', rotulo: 'WhatsApp do responsável', tipo: 'tel', placeholder: '(85) 99999-9999' })}
      <div class="campo inteira"><span class="rotulo">Tempo da pulseira</span>
        <div class="escolhas planos">${planos.map((p, i) => `
          <label class="escolha"><input type="radio" name="planoId" value="${esc(p.id)}" ${i === 1 || planos.length === 1 ? 'checked' : ''} required>
            <span><b>${esc(p.nome)}</b><small>${esc(dinheiro(p.preco))}</small></span></label>`).join('')}</div>
      </div>
      ${campo({ nome: 'pulseira', rotulo: 'Número da pulseira', placeholder: 'Opcional', extra: 'inputmode="numeric" autocomplete="off"' })}
      ${campoForma(formas)}
      ${campo({ nome: 'observacoes', rotulo: 'Observações', tipo: 'textarea', classe: 'inteira', placeholder: 'Alergias, remédios, quem pode buscar a criança...' })}
    </form>`,
    botao: 'Liberar entrada',
    aoEnviar: async d => {
      await ctx.acao('entrada-parque', d, `Entrada de ${d.crianca.split(' ')[0]} liberada. O tempo está contando.`);
      if (aoConcluir) aoConcluir();
    }
  });
}

function abrirSaida(ctx, e) {
  const d = ctx.dadosAtuais();
  const calc = excedente(e, d.config);
  const cobra = calc.valor > 0;
  abrirModal({
    titulo: `Saída de ${e.crianca}`,
    subtitulo: `Entrou às ${hora(e.entrada)} com pulseira de ${e.plano}.`,
    corpo: `<form>
      <div class="recibo">
        <div class="recibo-linha"><span>Tempo no parque</span><span>${esc(duracao(calc.decorridos))}</span></div>
        <div class="recibo-linha"><span>Tempo da pulseira</span><span>${e.minutos == null ? 'Dia livre' : esc(duracao(e.minutos))}</span></div>
        ${e.minutos != null ? `<div class="recibo-linha"><span>Passou do tempo</span><span>${calc.excedidos ? esc(duracao(calc.excedidos)) : 'Não'}</span></div>` : ''}
        ${cobra ? `<div class="recibo-linha total"><span>Excedente a cobrar</span><span>${esc(dinheiro(calc.valor))}</span></div>` : ''}
      </div>
      ${cobra ? `<p class="nota" style="margin:10px 0">Tolerância de ${d.config.tolerancia} min; depois, ${dinheiro(d.config.valorBloco)} a cada ${d.config.bloco} min começados.</p>
        <label class="escolha"><input type="checkbox" name="cobrar" checked><span><b>Cobrar o excedente</b><small>Desmarque para liberar sem cobrar. Fica registrado no histórico.</small></span></label>
        <div style="margin-top:12px">${campoForma(d.formas, { valor: e.forma })}</div>` : `<p class="nota" style="margin-top:12px">${calc.excedidos ? 'Dentro da tolerância: não há o que cobrar.' : 'Dentro do tempo: não há o que cobrar.'}</p>`}
      ${e.observacoes ? `<div class="aviso-crianca">${icone('alerta')}<span>${esc(e.observacoes)}</span></div>` : ''}
    </form>`,
    botao: 'Registrar saída',
    aoEnviar: dadosForm => ctx.acao('saida-parque', { entradaId: e.id, cobrar: cobra ? dadosForm.cobrar === 'on' : true, forma: dadosForm.forma },
      r => (r && r.cobrado ? `Saída registrada. Excedente de ${dinheiro(r.cobrado)} recebido.` : 'Saída registrada.'))
  });
}

function abrirCancelamento(ctx, e) {
  abrirModal({
    titulo: `Cancelar a pulseira de ${e.crianca}`,
    subtitulo: `${dinheiro(e.valor)} pago no ${nomeForma(ctx.dadosAtuais().formas, e.forma)}. O valor é devolvido pela mesma forma.`,
    corpo: `<form>${campo({ nome: 'motivo', rotulo: 'Motivo', obrigatorio: true, placeholder: 'Ex.: vendida por engano', extra: 'minlength="3"' })}</form>`,
    botao: 'Cancelar pulseira',
    botaoTipo: 'perigo cheio',
    cancelar: 'Voltar',
    aoEnviar: d => ctx.acao('cancelar-entrada', { entradaId: e.id, motivo: d.motivo }, 'Pulseira cancelada e valor devolvido.')
  });
}

/* ---------------------------------------------------------------- tela */

function cartao(e, cfg, podeCancelar) {
  const fone = telefone(e.telefone);
  // Pulseira sem limite (dia livre) não tem hora para acabar: abre só a conversa.
  const link = e.termina
    ? zap('parque_tempo', e.telefone, { nome: primeiroNome(e.responsavel), crianca: primeiroNome(e.crianca), termina: e.termina, pulseira: e.plano })
    : conversa(e.telefone, e.responsavel);
  return `<article class="crianca" data-id="${e.id}">
    <div data-tempo="${e.id}">${htmlTempo(e, cfg.alerta)}</div>
    <div class="crianca-dados">
      <h3>${esc(e.crianca)}${e.idade != null ? `<small>, ${e.idade} ${e.idade === 1 ? 'ano' : 'anos'}</small>` : ''}</h3>
      <p>${esc(e.plano)}, entrou às ${esc(hora(e.entrada))}${e.pulseira ? `, pulseira ${esc(e.pulseira)}` : ''}</p>
      <p>${esc(e.responsavel)}${fone ? `, ${esc(fone)}` : ''}${link ? ` <a class="link-zap" href="${esc(link)}" target="_blank" rel="noopener" aria-label="Chamar ${esc(e.responsavel)} no WhatsApp">${icone('whatsapp')}</a>` : ''}</p>
      ${e.observacoes ? `<p class="aviso-crianca">${icone('alerta')}<span>${esc(e.observacoes)}</span></p>` : ''}
    </div>
    <div class="crianca-acoes">
      <button type="button" class="botao primario" data-p="saida" data-id="${e.id}">Registrar saída</button>
      ${podeCancelar ? `<button type="button" class="botao fantasma pequeno" data-p="cancelar" data-id="${e.id}">Cancelar pulseira</button>` : ''}
    </div>
  </article>`;
}

export default {
  tela: 'parque',
  aoVivo: true,
  titulo: 'Parque infantil',
  descricao: 'Cada pulseira é uma criança cadastrada, com o tempo contando desde a entrega.',
  acoesCabecalho: () => `<button type="button" class="botao primario grande" id="novaEntrada">${icone('pulseira')}Nova entrada</button>`,

  render(ctx) {
    const d = ctx.dados;
    deslocamento = lerLocal(d.agora) - Date.now();
    const lotacao = d.dentro.length / d.config.capacidade;
    const passaram = d.dentro.filter(e => situacao(e, d.config.alerta).situacao === 'passou').length;
    const podeCancelar = ctx.ehGestao || !!d.caixa;
    const saidas = d.hoje;
    return `
      ${d.caixa ? '' : avisoCaixaFechado()}
      <div class="lotacao">
        <div class="lotacao-numero"><strong>${d.dentro.length}</strong><span>de ${d.config.capacidade} crianças agora</span></div>
        <div class="lotacao-barra" role="meter" aria-valuemin="0" aria-valuemax="${d.config.capacidade}" aria-valuenow="${d.dentro.length}" aria-label="Lotação do parque">
          <i class="${lotacao >= 0.9 ? 'cheio' : lotacao >= 0.7 ? 'alto' : ''}" style="width:${Math.min(100, lotacao * 100)}%"></i>
        </div>
        <ul class="lotacao-fatos">
          <li><b>${d.resumo.entradas}</b> entradas hoje</li>
          <li><b>${d.resumo.tempoMedio != null ? esc(duracao(d.resumo.tempoMedio)) : '—'}</b> de permanência média</li>
          ${passaram ? `<li class="ruim"><b>${passaram}</b> ${passaram === 1 ? 'passou' : 'passaram'} do tempo</li>` : ''}
          ${d.resumo.receita != null ? `<li><b>${esc(dinheiro(d.resumo.receita))}</b> recebidos hoje</li>` : ''}
        </ul>
      </div>

      <section class="bloco-solto">
        <div class="bloco-cabeca"><div><h2>Dentro do parque</h2><p>Em ordem de quem precisa sair primeiro.</p></div></div>
        ${d.dentro.length
          ? `<div class="criancas">${d.dentro.map(e => cartao(e, d.config, podeCancelar)).join('')}</div>`
          : vazio({ icone: 'balanco', titulo: 'Nenhuma criança no parque agora', texto: 'Ao vender uma pulseira, a criança aparece aqui com o tempo contando.', botao: '<button type="button" class="botao primario" data-p="nova">Nova entrada</button>' })}
      </section>

      <section class="bloco" style="margin-top:22px">
        <div class="bloco-cabeca"><div><h2>Saídas de hoje</h2><p>${plural(saidas.filter(e => e.status === 'saiu').length, 'criança já saiu', 'crianças já saíram')}.</p></div></div>
        ${saidas.length ? `<div class="tabela-envolve"><table class="tabela">
          <thead><tr><th>Criança</th><th>Entrada</th><th>Saída</th><th class="so-largo">Tempo</th><th>Ficou</th><th class="num">Excedente</th></tr></thead>
          <tbody>${saidas.map(e => `<tr class="${e.status === 'cancelada' ? 'apagada' : ''}">
            <td><b>${esc(e.crianca)}</b><small>${esc(e.responsavel)}</small></td>
            <td class="num">${esc(hora(e.entrada))}</td>
            <td class="num">${e.saida ? esc(hora(e.saida)) : ''}</td>
            <td class="so-largo">${esc(e.plano)}</td>
            <td class="num">${e.status === 'cancelada' ? 'Cancelada' : esc(duracao(Math.round((lerLocal(e.saida) - lerLocal(e.entrada)) / 60000)))}</td>
            <td class="num">${e.excedenteValor ? esc(dinheiro(e.excedenteValor)) : '—'}</td>
          </tr>`).join('')}</tbody></table></div>` : '<p class="nota">Ninguém saiu ainda hoje.</p>'}
      </section>`;
  },

  ligar(raiz, ctx) {
    const nova = () => {
      const d = ctx.dadosAtuais();
      abrirEntrada(ctx, { planos: d.planos, formas: d.formas });
    };
    raiz.querySelector('#novaEntrada').addEventListener('click', nova);
    raiz.querySelector('#corpoPagina').addEventListener('click', e => {
      if (e.target.closest('[data-abrir-caixa]')) return abrirCaixa(ctx);
      const alvo = e.target.closest('[data-p]');
      if (!alvo) return;
      if (alvo.dataset.p === 'nova') return nova();
      const crianca = ctx.dadosAtuais().dentro.find(x => String(x.id) === alvo.dataset.id);
      if (!crianca) return;
      if (alvo.dataset.p === 'saida') abrirSaida(ctx, crianca);
      if (alvo.dataset.p === 'cancelar') abrirCancelamento(ctx, crianca);
    });
    // O cronômetro anda sozinho entre uma atualização e outra.
    const relogio = setInterval(() => {
      const d = ctx.dadosAtuais();
      if (!d || !d.dentro) return;
      d.dentro.forEach(e => {
        const el = raiz.querySelector(`[data-tempo="${e.id}"]`);
        if (el) el.innerHTML = htmlTempo(e, d.config.alerta);
      });
    }, 15000);
    return () => clearInterval(relogio);
  }
};
