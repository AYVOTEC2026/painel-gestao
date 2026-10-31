/* Peças de interface usadas por todas as telas. */

export const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const dinheiro = v => brl.format(Number(v) || 0);
export const dinheiroCurto = v => {
  const n = Number(v) || 0;
  if (Math.abs(n) >= 1000) return 'R$ ' + (n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil';
  return 'R$ ' + Math.round(n);
};
export const porcento = v => (Number(v) || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '%';
export const hora = iso => String(iso || '').slice(11, 16);
export const dataCurta = iso => {
  const [, m, d] = String(iso || '').slice(0, 10).split('-');
  return d && m ? `${d}/${m}` : '';
};
export const dataHora = iso => `${dataCurta(iso)} às ${hora(iso)}`;
const comoData = dia => new Date(String(dia).slice(0, 10) + 'T12:00:00');
export const diaSemana = dia => comoData(dia).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
export const dataExtenso = dia => comoData(dia).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
export const mesNome = ym => comoData(ym + '-15').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
export const mesCurto = ym => comoData(ym + '-15').toLocaleDateString('pt-BR', { month: 'long' });
export const somarMes = (ym, n) => {
  const [a, m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 15));
  return d.toISOString().slice(0, 7);
};
export const telefone = v => {
  const d = String(v || '').replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return String(v || '');
};
export const iniciais = nome => String(nome || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
export const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
export const dataLonga = dia => {
  const [a, m, d] = String(dia || '').slice(0, 10).split('-');
  return d ? `${d}/${m}/${a}` : '';
};
export const somarDias = (dia, n) => {
  const d = new Date(`${String(dia).slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
/** "75" -> "1h15", "40" -> "40 min" */
export const duracao = minutos => {
  const m = Math.max(0, Math.round(Number(minutos) || 0));
  return m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `${m} min`;
};
export const tamanhoArquivo = bytes => (bytes >= 1048576 ? `${(bytes / 1048576).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
/** Link do WhatsApp com a mensagem já escrita. Telefone sem DDI ganha o 55 do Brasil. */
export const linkWhatsapp = (fone, mensagem) => {
  let d = String(fone || '').replace(/\D/g, '');
  if (d.length === 10 || d.length === 11) d = '55' + d;
  return d ? `https://wa.me/${d}?text=${encodeURIComponent(mensagem)}` : '';
};

/* ---------------------------------------------------------------- ícones */

const P = {
  inicio: '<path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>',
  caixa: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M7 8V5h10v3M7 13h4M15 13h2M7 16.5h10"/>',
  boxes: '<path d="M3 9h18l-1.5-4h-15z"/><path d="M4 9v11h16V9M9 20v-6h6v6"/>',
  financeiro: '<path d="M4 20h16M6 16V10M10 16V6M14 16v-4M18 16V8"/>',
  equipe: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0M16 4.5a3 3 0 0 1 0 6M18 20a6 6 0 0 0-3-5.2"/>',
  config: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  ajuda: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.8M12 17.2v.1"/>',
  sair: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  fechar: '<path d="M6 6l12 12M18 6 6 18"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
  menos: '<path d="M5 12h14"/>',
  certo: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  alerta: '<path d="M12 3 2 20h20zM12 10v4.5M12 17.5v.1"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.5v.1"/>',
  relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  dinheiro: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v5M18 9.5v5"/>',
  cartao: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19M6 15h4"/>',
  baixar: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
  seta: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  esquerda: '<path d="M15 6l-6 6 6 6"/>',
  direita: '<path d="M9 6l6 6-6 6"/>',
  recibo: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3"/>',
  troca: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
  livro: '<path d="M5 4h9a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h9"/>',
  lojista: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>',
  parque: '<path d="M3 21V10l9-6 9 6v11M8 21v-6h8v6"/>',
  pausa: '<path d="M9 6v12M15 6v12"/>',
  play: '<path d="M8 5.5v13l10-6.5z"/>',
  lapis: '<path d="M4 20l1-4L16 5l3 3L8 19z"/>',
  cadeado: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  painel: '<rect x="3.5" y="3.5" width="7" height="8" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="5" rx="1.5"/><rect x="13.5" y="11.5" width="7" height="9" rx="1.5"/><rect x="3.5" y="14.5" width="7" height="6" rx="1.5"/>',
  loja: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  quadra: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M12 5v14M3 12h18"/><circle cx="12" cy="12" r="2.5"/>',
  evento: '<path d="M5 21V10h14v11M3 10h18M12 10v11M7 10c-1.5-2-1-4.5 1-5s3.5 2 4 5c.5-3 2-5.5 4-5s2.5 3 1 5"/>',
  relatorio: '<path d="M6 3h9l4 4v14H6z"/><path d="M9 17v-3M12 17v-6M15 17v-4"/>',
  anexo: '<path d="M20 11.5 12 19.5a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7L9.7 17.2a1.7 1.7 0 0 1-2.4-2.4L15 7"/>',
  whatsapp: '<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/><path d="M9 9.5c.3 2 2.3 4.2 4.5 4.8l1.2-1.2 2 .9c-.2 1.3-1.3 2-2.6 1.8C11 15.3 8.4 12.8 8 10c-.1-1.3.6-2.3 1.8-2.6l.9 2z"/>',
  calendario: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  pulseira: '<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="4"/><path d="M12 4.5V2.5"/>',
  lixeira: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  olho: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  estoque: '<path d="M3 8l9-4 9 4-9 4z"/><path d="M3 8v8l9 4 9-4V8M12 12v8"/>',
  balanco: '<path d="M5 21V4M19 21V4M4 4h16M10 4v9M14 4v9M8.5 13h7v2.5h-7z"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
  lua: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  auto: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17A8.5 8.5 0 0 0 12 3.5z" fill="currentColor"/>'
};

export const icone = (nome, extra = '') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${P[nome] || ''}</svg>`;

// Tabelas longas mostram só as primeiras linhas; o botão (tratado em app.js) revela o resto.
export const LINHAS_VISIVEIS = 10;
export function classeLinha(i) { return i >= LINHAS_VISIVEIS ? 'linha-extra oculto' : ''; }
export function botaoMostrarTudo(total) {
  return total > LINHAS_VISIVEIS ? `<button type="button" class="botao fantasma pequeno mostrar-tudo" data-mostrar-tudo>Mostrar todas as ${total} linhas</button>` : '';
}

// Histórico que não precisa ficar à vista: vira uma barra com título e resumo, aberta num toque.
// Lembra se estava aberto, porque as telas se redesenham a cada ação.
const recolhiveisAbertos = new Set();
export function marcarRecolhivel(chave, aberto) { if (aberto) recolhiveisAbertos.add(chave); else recolhiveisAbertos.delete(chave); }
export function recolhivel({ chave, titulo, resumo = '', corpo }) {
  return `<details class="bloco recolhivel" data-recolhe="${esc(chave)}" ${recolhiveisAbertos.has(chave) ? 'open' : ''}>
    <summary><span><b>${esc(titulo)}</b>${resumo ? `<small>${esc(resumo)}</small>` : ''}</span></summary>
    <div class="recolhivel-corpo">${corpo}</div>
  </details>`;
}

// Selo da marca do cliente (Pepama Food Park), usado no menu lateral.
export const marcaSelo = '<img src="/marca/pepama-icone.png" alt="">';

/** "?" ao lado de um termo, com a explicação ao passar o mouse ou tocar. */
export const dica = texto =>
  `<span class="dica" tabindex="0" role="button" aria-label="O que é isso?">?<span class="dica-texto" role="tooltip">${esc(texto)}</span></span>`;

export const selo = (texto, tipo = '') => `<span class="selo ${tipo}">${esc(texto)}</span>`;

export const vazio = ({ icone: ic = 'info', titulo, texto, botao = '' }) =>
  `<div class="vazio"><div class="vazio-icone">${icone(ic)}</div><h3>${esc(titulo)}</h3><p>${esc(texto)}</p>${botao}</div>`;

/* ------------------------------------------------- arrastar e soltar */

const temArquivos = e => !!e.dataTransfer && [...e.dataTransfer.types].includes('Files');

// Arquivo solto fora de uma área de anexo não pode abrir no navegador e tirar a pessoa do sistema.
window.addEventListener('dragover', e => { if (temArquivos(e)) e.preventDefault(); });
window.addEventListener('drop', e => { if (temArquivos(e)) e.preventDefault(); });

/** Transforma um elemento numa área onde se soltam arquivos. */
export function zonaDeArquivos(el, aoSoltar) {
  let dentro = 0;
  el.addEventListener('dragenter', e => { if (!temArquivos(e)) return; e.preventDefault(); dentro += 1; el.classList.add('arrastando'); });
  el.addEventListener('dragover', e => { if (!temArquivos(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
  el.addEventListener('dragleave', () => { dentro = Math.max(0, dentro - 1); if (!dentro) el.classList.remove('arrastando'); });
  el.addEventListener('drop', e => {
    if (!temArquivos(e)) return;
    e.preventDefault();
    e.stopPropagation();
    dentro = 0;
    el.classList.remove('arrastando');
    aoSoltar([...e.dataTransfer.files]);
  });
}

/* --------------------------------------------------------------- avisos */

export function avisar(msg, tipo = 'ok') {
  const area = document.getElementById('avisos');
  const el = document.createElement('div');
  el.className = 'aviso' + (tipo === 'erro' ? ' erro' : '');
  el.innerHTML = `${icone(tipo === 'erro' ? 'alerta' : 'certo')}<span>${esc(msg)}</span>`;
  area.appendChild(el);
  setTimeout(() => { el.classList.add('saindo'); setTimeout(() => el.remove(), 250); }, tipo === 'erro' ? 5200 : 3200);
}

/* ---------------------------------------------------------------- modal */

/**
 * O navegador avisa campo inválido no idioma dele ("Please fill out this field").
 * Aqui a mensagem sai sempre em português, explicando o que corrigir.
 */
export function validarEmPortugues(form) {
  form.querySelectorAll('input, select, textarea').forEach(el => {
    el.addEventListener('invalid', () => {
      const v = el.validity;
      let msg = '';
      if (v.valueMissing) msg = el.type === 'radio' ? 'Escolha uma opção.' : 'Preencha este campo.';
      else if (v.typeMismatch && el.type === 'email') msg = 'Informe um e-mail válido, como nome@exemplo.com.';
      else if (v.tooShort) msg = `Use pelo menos ${el.minLength} caracteres.`;
      else if (v.rangeUnderflow) msg = `O valor mínimo é ${el.min}.`;
      else if (v.rangeOverflow) msg = `O valor máximo é ${el.max}.`;
      else if (v.badInput) msg = 'Digite só números.';
      else if (v.stepMismatch) msg = 'Use no máximo duas casas depois da vírgula.';
      el.setCustomValidity(msg);
    });
    const limpar = () => el.setCustomValidity('');
    el.addEventListener('input', limpar);
    el.addEventListener('change', limpar);
  });
}

const modaisAbertos = new Set();
export const temModalAberto = () => modaisAbertos.size > 0;
/** Trocar de tela fecha o que estiver aberto: um modal não pode sobreviver à página que o abriu. */
export const fecharTodosModais = () => [...modaisAbertos].forEach(fechar => fechar());

/**
 * Abre um modal. Se `aoEnviar` for dado, o corpo deve conter um <form>; o botão
 * principal envia o formulário, mostra "carregando" e exibe o erro dentro do modal.
 */
export function abrirModal({ titulo, subtitulo = '', corpo, botao = '', botaoTipo = 'primario', cancelar = 'Cancelar', largo = false, lateral = false, aoEnviar, aoAbrir }) {
  const anterior = document.activeElement;
  const fundo = document.createElement('div');
  fundo.className = 'modal-fundo' + (lateral ? ' de-lado' : '');
  const idTitulo = 'm' + Math.random().toString(36).slice(2, 8);
  fundo.innerHTML = `
    <div class="modal ${largo ? 'largo' : ''}" role="dialog" aria-modal="true" aria-labelledby="${idTitulo}">
      <div class="modal-cabeca">
        <div><h2 id="${idTitulo}">${esc(titulo)}</h2>${subtitulo ? `<p>${esc(subtitulo)}</p>` : ''}</div>
        <button type="button" class="modal-fechar" data-fechar aria-label="Fechar">${icone('fechar')}</button>
      </div>
      <div class="modal-corpo"><div class="erro-form oculto" role="alert"></div>${corpo}</div>
      ${botao || cancelar ? `<div class="modal-rodape">
        ${cancelar ? `<button type="button" class="botao" data-fechar>${esc(cancelar)}</button>` : ''}
        ${botao ? `<button type="button" class="botao ${botaoTipo}" data-enviar>${esc(botao)}</button>` : ''}
      </div>` : ''}
    </div>`;
  document.body.appendChild(fundo);

  const erroEl = fundo.querySelector('.erro-form');
  const enviarBtn = fundo.querySelector('[data-enviar]');
  const form = fundo.querySelector('form');
  if (form) validarEmPortugues(form);

  function fechar() {
    if (!fundo.isConnected) return;
    fundo.remove();
    modaisAbertos.delete(fechar);
    document.removeEventListener('keydown', teclas);
    if (anterior && anterior.focus) anterior.focus();
  }
  function teclas(e) {
    // Esc fecha só o modal de cima (o último aberto).
    if (e.key === 'Escape' && [...modaisAbertos].pop() === fechar) fechar();
  }
  function mostrarErro(msg) {
    erroEl.innerHTML = `${icone('alerta')}<span>${esc(msg)}</span>`;
    erroEl.classList.remove('oculto');
    erroEl.scrollIntoView({ block: 'nearest' });
  }
  async function enviar(e) {
    if (e) e.preventDefault();
    if (!aoEnviar || (enviarBtn && enviarBtn.classList.contains('carregando'))) return;
    erroEl.classList.add('oculto');
    if (form && !form.reportValidity()) return;
    if (enviarBtn) enviarBtn.classList.add('carregando');
    try {
      const dados = form ? Object.fromEntries(new FormData(form).entries()) : {};
      const ok = await aoEnviar(dados, { fundo, fechar, mostrarErro });
      if (ok !== false) fechar();
    } catch (err) {
      mostrarErro(err.message || 'Não foi possível concluir.');
    } finally {
      if (enviarBtn) enviarBtn.classList.remove('carregando');
    }
  }

  fundo.addEventListener('mousedown', e => { if (e.target === fundo) fechar(); });
  fundo.querySelectorAll('[data-fechar]').forEach(b => b.addEventListener('click', fechar));
  if (enviarBtn) enviarBtn.addEventListener('click', enviar);
  if (form) form.addEventListener('submit', enviar);
  document.addEventListener('keydown', teclas);
  modaisAbertos.add(fechar);

  // Painel lateral é para consulta: não abre com o cursor dentro de um campo.
  const primeiro = lateral
    ? fundo.querySelector('.modal-fechar')
    : fundo.querySelector('.modal-corpo input:not([type=hidden]):not([readonly]), .modal-corpo select, .modal-corpo textarea') || enviarBtn;
  if (primeiro) setTimeout(() => primeiro.focus(), 30);
  if (aoAbrir) aoAbrir(fundo);
  return { fundo, fechar, mostrarErro };
}

export function confirmar({ titulo, texto, botao = 'Confirmar', perigo = false }) {
  return new Promise(resolver => {
    let respondeu = false;
    const m = abrirModal({
      titulo,
      corpo: `<p class="nota" style="font-size:14.5px;color:var(--tinta-2)">${texto}</p>`,
      botao,
      botaoTipo: perigo ? 'perigo cheio' : 'primario',
      aoEnviar: async () => { respondeu = true; resolver(true); }
    });
    const observar = new MutationObserver(() => {
      if (!m.fundo.isConnected) { observar.disconnect(); if (!respondeu) resolver(false); }
    });
    observar.observe(document.body, { childList: true });
  });
}

/* ------------------------------------------------------------ formulário */

export const campo = ({ nome, rotulo, tipo = 'text', valor = '', ajuda = '', dica: textoDica = '', obrigatorio = false, extra = '', prefixo = '', sufixo = '', classe = '', opcoes = null, placeholder = '' }) => {
  const id = 'c-' + nome + '-' + Math.random().toString(36).slice(2, 6);
  let controle;
  if (opcoes) {
    controle = `<select id="${id}" name="${esc(nome)}" ${obrigatorio ? 'required' : ''} ${extra}>${opcoes.map(o => `<option value="${esc(o.valor)}" ${String(o.valor) === String(valor) ? 'selected' : ''}>${esc(o.texto)}</option>`).join('')}</select>`;
  } else if (tipo === 'textarea') {
    controle = `<textarea id="${id}" name="${esc(nome)}" placeholder="${esc(placeholder)}" ${obrigatorio ? 'required' : ''} ${extra}>${esc(valor)}</textarea>`;
  } else {
    controle = `<input id="${id}" name="${esc(nome)}" type="${tipo}" value="${esc(valor)}" placeholder="${esc(placeholder)}" ${obrigatorio ? 'required' : ''} ${extra}>`;
    if (prefixo) controle = `<div class="campo-prefixo"><span>${esc(prefixo)}</span>${controle}</div>`;
    if (sufixo) controle = `<div class="campo-sufixo">${controle}<span>${esc(sufixo)}</span></div>`;
  }
  return `<div class="campo ${classe}"><label for="${id}">${esc(rotulo)} ${textoDica ? dica(textoDica) : ''}</label>${controle}${ajuda ? `<span class="ajuda-campo">${esc(ajuda)}</span>` : ''}</div>`;
};

export const campoDinheiro = (o) => campo({ tipo: 'number', prefixo: 'R$', extra: 'min="0" step="0.01" inputmode="decimal"', ...o });
export const campoPorcento = (o) => campo({ tipo: 'number', sufixo: '%', extra: 'min="0" max="100" step="0.01" inputmode="decimal"', ...o });

export const opcoesPagamento = metodos => metodos.map(m => ({ valor: m.id, texto: m.label }));
