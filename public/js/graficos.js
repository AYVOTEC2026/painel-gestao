/*
 * Gráficos simples e legíveis: colunas e barras de uma série só, finas (até 24 px),
 * com a ponta arredondada e a base reta, grade em linha fina contínua, dica ao
 * passar o mouse ou focar pelo teclado, e sempre uma tabela com os números.
 */

import { esc } from './ui.js';

function escala(max) {
  if (!(max > 0)) return 1;
  const mag = 10 ** Math.floor(Math.log10(max));
  return [1, 2, 2.5, 5, 10].find(p => p * mag >= max) * mag;
}

/** Coluna com o topo arredondado e a base reta (negativa: arredonda embaixo). */
function coluna(x, base, w, h, r = 4) {
  if (!h) return '';
  const alto = Math.abs(h);
  const raio = Math.min(r, alto, w / 2);
  if (h > 0) {
    const y = base - alto;
    return `M${x},${base}V${y + raio}Q${x},${y} ${x + raio},${y}H${x + w - raio}Q${x + w},${y} ${x + w},${y + raio}V${base}Z`;
  }
  const y = base + alto;
  return `M${x},${base}V${y - raio}Q${x},${y} ${x + raio},${y}H${x + w - raio}Q${x + w},${y} ${x + w},${y - raio}V${base}Z`;
}

/**
 * Colunas verticais. pontos: [{ rotulo, sub, valor, destaque, dica }]
 * Com `destaque`, a coluna destacada fica na cor de ênfase e as outras recuam.
 */
export function colunas({ pontos, altura = 230, formatarEixo, formatarValor, rotuloDestaque = true, descricao, meiaLargura = false }) {
  // O desenho é feito na largura em que vai aparecer, para o texto não encolher no celular.
  const tela = window.innerWidth;
  const W = tela < 760 ? Math.max(300, tela - 64) : meiaLargura ? 440 : 660;
  const topo = 26;
  const base = altura - 44;
  const esq = 56;
  const valores = pontos.map(p => p.valor);
  const max = escala(Math.max(0, ...valores));
  const min = Math.min(0, ...valores) < 0 ? -escala(-Math.min(...valores)) : 0;
  const total = max - min || 1;
  const y = v => topo + (max - v) / total * (base - topo);
  const zero = y(0);
  const passo = (W - esq - 8) / pontos.length;
  const largura = Math.min(24, passo * 0.62);
  const cabeSub = passo >= 30;
  const algumDestaque = pontos.some(p => p.destaque);
  const grade = (min < 0 ? [min, 0, max] : [0, max / 2, max]).map(v =>
    `<line class="g-grade" x1="${esq}" x2="${W}" y1="${y(v)}" y2="${y(v)}"/><text class="g-eixo" x="${esq - 8}" y="${y(v) + 4}" text-anchor="end">${esc(formatarEixo(v))}</text>`).join('');
  const marcas = pontos.map((p, i) => {
    const x = esq + i * passo + (passo - largura) / 2;
    const h = zero - y(p.valor);
    const classe = algumDestaque ? (p.destaque ? 'g-marca destaque' : 'g-marca apagada') : 'g-marca';
    const rotulo = rotuloDestaque && p.destaque && p.valor ? `<text class="g-rotulo" x="${x + largura / 2}" y="${p.valor >= 0 ? zero - h - 8 : zero - h + 16}" text-anchor="middle">${esc(formatarEixo(p.valor))}</text>` : '';
    return `<g class="g-alvo" tabindex="0" role="img" aria-label="${esc(`${p.dica || p.rotulo}: ${formatarValor(p.valor)}`)}" data-dica-titulo="${esc(p.dica || p.rotulo)}" data-dica-valor="${esc(formatarValor(p.valor))}">
      <rect x="${esq + i * passo}" y="${topo}" width="${passo}" height="${base - topo}" fill="transparent"/>
      <path class="${classe}" d="${coluna(x, zero, largura, h)}"/>
      ${rotulo}
      <text class="g-eixo" x="${x + largura / 2}" y="${base + 18}" text-anchor="middle">${esc(p.rotulo)}</text>
      ${p.sub && (cabeSub || p.destaque) ? `<text class="g-eixo suave" x="${x + largura / 2}" y="${base + 32}" text-anchor="middle">${esc(p.sub)}</text>` : ''}
    </g>`;
  }).join('');
  return `<svg class="grafico" viewBox="0 0 ${W} ${altura}" role="group" aria-label="${esc(descricao || '')}">
    ${grade}<line class="g-base" x1="${esq}" x2="${W}" y1="${zero}" y2="${zero}"/>${marcas}
  </svg>`;
}

/**
 * Barras horizontais de uma série, em HTML (se ajustam à largura da tela).
 * linhas: [{ rotulo, sub, valor, texto, destaque }]; `maximo` fixa a escala (ex.: 100%).
 */
export function barras({ linhas, maximo, formatar }) {
  const max = maximo || Math.max(0, ...linhas.map(l => l.valor)) || 1;
  return `<div class="g-barras">${linhas.map(l => `
    <div class="g-barra-linha" tabindex="0" data-dica-titulo="${esc(l.rotulo)}" data-dica-valor="${esc(l.texto || formatar(l.valor))}">
      <div class="g-barra-nome"><b>${esc(l.rotulo)}</b>${l.sub ? `<small>${esc(l.sub)}</small>` : ''}</div>
      <div class="g-barra-trilho"><i class="${l.destaque === false ? 'apagada' : ''}" style="width:${Math.max(0, Math.min(100, l.valor / max * 100))}%"></i></div>
      <div class="g-barra-valor">${esc(l.texto || formatar(l.valor))}</div>
    </div>`).join('')}</div>`;
}

/**
 * Colunas miúdas para comparar várias áreas lado a lado (pequenos múltiplos).
 * O último ponto (o mês atual) fica em destaque.
 */
export function miniColunas(pontos, formatar, max) {
  const W = 168;
  const H = 46;
  const teto = max || Math.max(1, ...pontos.map(p => p.valor));
  const passo = W / pontos.length;
  const largura = Math.min(16, passo * 0.6);
  return `<svg class="grafico mini" viewBox="0 0 ${W} ${H + 2}" role="img" aria-label="${esc(pontos.map(p => `${p.rotulo}: ${formatar(p.valor)}`).join(', '))}">
    <line class="g-base" x1="0" x2="${W}" y1="${H}" y2="${H}"/>
    ${pontos.map((p, i) => {
      const h = Math.max(p.valor > 0 ? 2 : 0, (p.valor / teto) * (H - 4));
      const x = i * passo + (passo - largura) / 2;
      return `<g class="g-alvo" tabindex="0" data-dica-titulo="${esc(p.rotulo)}" data-dica-valor="${esc(formatar(p.valor))}"><rect x="${i * passo}" y="0" width="${passo}" height="${H}" fill="transparent"/><path class="g-marca ${i === pontos.length - 1 ? 'destaque' : 'apagada'}" d="${coluna(x, H, largura, h, 3)}"/></g>`;
    }).join('')}
  </svg>`;
}

/** A tabela com os números do gráfico: o mesmo dado, sem depender de passar o mouse. */
export function verNumeros(cabecalho, linhas) {
  return `<details class="ver-numeros"><summary>Ver os números</summary>
    <div class="tabela-envolve"><table class="tabela compacta">
      <thead><tr>${cabecalho.map((c, i) => `<th class="${i ? 'num' : ''}">${esc(c)}</th>`).join('')}</tr></thead>
      <tbody>${linhas.map(l => `<tr>${l.map((c, i) => `<td class="${i ? 'num' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div></details>`;
}

let balao = null;
/** Dica dos gráficos: um balão só, preenchido com textContent. */
export function ligarDicas(raiz) {
  if (raiz.dataset.dicasLigadas) return;
  raiz.dataset.dicasLigadas = '1';
  if (!balao) {
    balao = document.createElement('div');
    balao.className = 'g-balao';
    balao.setAttribute('role', 'tooltip');
    balao.innerHTML = '<strong></strong><span></span>';
    document.body.appendChild(balao);
  }
  const mostrar = alvo => {
    balao.querySelector('strong').textContent = alvo.dataset.dicaValor;
    balao.querySelector('span').textContent = alvo.dataset.dicaTitulo;
    const caixa = alvo.getBoundingClientRect();
    balao.classList.add('visivel');
    const larg = balao.offsetWidth;
    const esquerda = Math.min(window.innerWidth - larg - 8, Math.max(8, caixa.left + caixa.width / 2 - larg / 2));
    balao.style.left = `${esquerda + window.scrollX}px`;
    balao.style.top = `${caixa.top + window.scrollY - balao.offsetHeight - 8}px`;
  };
  const esconder = () => balao.classList.remove('visivel');
  raiz.addEventListener('pointerover', e => { const a = e.target.closest('[data-dica-valor]'); if (a) mostrar(a); });
  raiz.addEventListener('pointerout', e => { if (e.target.closest('[data-dica-valor]')) esconder(); });
  raiz.addEventListener('focusin', e => { const a = e.target.closest('[data-dica-valor]'); if (a) mostrar(a); });
  raiz.addEventListener('focusout', esconder);
  return esconder;
}
