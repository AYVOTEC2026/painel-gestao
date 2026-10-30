import { api, quandoPerderSessao } from './api.js';
import { esc, icone, marcaSelo, iniciais, avisar, abrirModal, temModalAberto, fecharTodosModais } from './ui.js';
import { telaDeEntrada } from './entrada.js';
import { usarMensagens } from './mensagens.js';
import { AJUDA } from './ajuda-conteudo.js';
import { ligarDicas } from './graficos.js';
import painel from './paginas/painel.js';
import pdv from './paginas/pdv.js';
import boxes from './paginas/boxes.js';
import parque from './paginas/parque.js';
import loja from './paginas/loja.js';
import quadras from './paginas/quadras.js';
import eventos from './paginas/eventos.js';
import contabilidade from './paginas/contabilidade.js';
import financeiro from './paginas/financeiro.js';
import relatorios from './paginas/relatorios.js';
import admin from './paginas/admin.js';
import ajuda from './paginas/ajuda.js';

const TELAS = {
  painel: { rotulo: 'Painel executivo', icone: 'painel', grupo: 'Visão geral', modulo: painel },
  pdv: { rotulo: 'PDV', icone: 'caixa', grupo: 'Operação', modulo: pdv },
  boxes: { rotulo: 'Boxes', icone: 'boxes', grupo: 'Operação', modulo: boxes },
  parque: { rotulo: 'Parque infantil', icone: 'balanco', grupo: 'Operação', modulo: parque },
  loja: { rotulo: 'Loja e bilheteria', icone: 'loja', grupo: 'Operação', modulo: loja },
  quadras: { rotulo: 'Quadras', icone: 'quadra', grupo: 'Operação', modulo: quadras },
  eventos: { rotulo: 'Eventos e festas', icone: 'evento', grupo: 'Operação', modulo: eventos },
  contabilidade: { rotulo: 'Contabilidade', icone: 'livro', grupo: 'Gestão', modulo: contabilidade },
  financeiro: { rotulo: 'Financeiro', icone: 'financeiro', grupo: 'Gestão', modulo: financeiro },
  relatorios: { rotulo: 'Relatórios', icone: 'relatorio', grupo: 'Gestão', modulo: relatorios },
  admin: { rotulo: 'Administração', icone: 'config', grupo: 'Administração', modulo: admin },
  ajuda: { rotulo: 'Ajuda', icone: 'ajuda', grupo: 'rodape', modulo: ajuda }
};

const raiz = document.getElementById('app');
let sessao = null;
let dados = null;
let chaveDados = '';
let carregando = false;
let limparPagina = null;

function lerRota() {
  const bruto = location.hash.replace(/^#\/?/, '');
  const [caminho, busca = ''] = bruto.split('?');
  const [tela = '', sub = ''] = caminho.split('/');
  return { tela, sub, query: Object.fromEntries(new URLSearchParams(busca)) };
}

const ir = caminho => { location.hash = '#/' + caminho.replace(/^#?\/?/, ''); };
const telaPermitida = tela => !!(sessao && TELAS[tela] && sessao.usuario.telas.includes(tela));

function contexto() {
  const rota = lerRota();
  const def = TELAS[rota.tela];
  return {
    usuario: sessao.usuario,
    ehGestao: sessao.usuario.papel === 'dono',
    parque: sessao.parque,
    dados,
    rota,
    ir,
    /** Executa uma ação, recarrega a tela e redesenha. Devolve o resultado da ação. */
    async acao(nome, corpo, mensagem) {
      const r = await api.acao(nome, corpo);
      if (mensagem) avisar(typeof mensagem === 'function' ? mensagem(r.resultado) : mensagem);
      // A ação já foi gravada: se só a atualização da tela falhar, isso não pode parecer erro da ação.
      try {
        await carregar(true);
      } catch (_) {
        avisar('Registrado, mas a tela não atualizou. Recarregue a página para ver.', 'erro');
      }
      desenharPagina();
      return r.resultado;
    },
    dadosAtuais: () => dados,
    recarregar: async () => { await carregar(true); desenharPagina(); },
    desenhar: () => desenharPagina(),
    atualizarSessao: async () => {
      sessao = await lerSessao();
      if (!sessao) return iniciar();
      desenharTudo();
    },
    modulo: def && def.modulo
  };
}

/** Busca os dados da tela atual no servidor (cada tela pede o que precisa). */
async function carregar(forcar) {
  const rota = lerRota();
  const pagina = TELAS[rota.tela] && TELAS[rota.tela].modulo;
  if (!pagina || !pagina.tela) { dados = null; chaveDados = ''; return; }
  const params = pagina.params ? pagina.params(rota) : {};
  const chave = `${pagina.tela}|${JSON.stringify(params)}`;
  if (!forcar && chave === chaveDados && dados) return;
  carregando = true;
  try {
    dados = await api.tela(pagina.tela, params);
    chaveDados = chave;
  } finally {
    carregando = false;
  }
}

/* ------------------------------------------------------------------ casca */

function htmlLateral(telaAtual) {
  const u = sessao.usuario;
  const grupos = [];
  u.telas.forEach(t => {
    const def = TELAS[t];
    if (!def || def.grupo === 'rodape') return;
    let g = grupos.find(x => x.nome === def.grupo);
    if (!g) { g = { nome: def.grupo, telas: [] }; grupos.push(g); }
    g.telas.push(t);
  });
  const link = t => `<a href="#/${t}" class="${t === telaAtual ? 'ativo' : ''}" ${t === telaAtual ? 'aria-current="page"' : ''}>${icone(TELAS[t].icone)}<span>${esc(TELAS[t].rotulo)}</span></a>`;
  return `
    <aside class="lateral" id="lateral">
      <div class="marca"><div class="marca-selo">${marcaSelo}</div><div><b>${esc(sessao.parque.nome)}</b><small>AYVO Gestão</small></div></div>
      <nav class="nav" aria-label="Principal">
        ${grupos.map(g => `${grupos.length > 1 ? `<div class="nav-grupo">${esc(g.nome)}</div>` : ''}${g.telas.map(link).join('')}`).join('')}
      </nav>
      <div class="lateral-pe">
        <nav class="nav" aria-label="Ajuda">${link('ajuda')}</nav>
        <div class="usuario-chip">
          <div class="avatar">${esc(iniciais(u.nome))}</div>
          <div><b>${esc(u.nome)}</b><small>${esc(u.papelNome)}</small></div>
          <button type="button" id="botaoSair" title="Sair" aria-label="Sair do sistema">${icone('sair')}</button>
        </div>
      </div>
    </aside>`;
}

function htmlFaixa() {
  if (sessao.parque.modo !== 'demo') return '';
  return sessao.usuario.papel === 'dono'
    ? `<div class="faixa-demo">${icone('info')}<span><b>Demonstração.</b> Boxes, crianças, vendas e contas são fictícios e recriados todo dia. Pode testar à vontade.</span><a class="botao pequeno" href="#/admin/demonstracao">Começar operação real</a></div>`
    : `<div class="faixa-demo">${icone('info')}<span><b>Demonstração.</b> Os dados são fictícios. Pode testar à vontade.</span></div>`;
}

function desenharTudo() {
  const rota = lerRota();
  raiz.innerHTML = `
    <div class="shell" id="shell">
      ${htmlLateral(rota.tela)}
      <div class="area">
        <header class="topo-movel">
          <button type="button" id="abrirMenu" aria-label="Abrir menu">${icone('menu')}</button>
          <div><b id="topoTitulo">${esc(TELAS[rota.tela] ? TELAS[rota.tela].rotulo : '')}</b><small>${esc(sessao.parque.nome)}</small></div>
        </header>
        <main class="conteudo" id="conteudo"></main>
      </div>
    </div>`;
  document.getElementById('botaoSair').addEventListener('click', sair);
  const shell = document.getElementById('shell');
  document.getElementById('abrirMenu').addEventListener('click', () => shell.classList.add('menu-aberto'));
  shell.addEventListener('click', e => { if (shell.classList.contains('menu-aberto') && e.target.closest('.nav a')) shell.classList.remove('menu-aberto'); });
  shell.addEventListener('click', e => {
    const mais = e.target.closest('[data-mostrar-tudo]');
    if (!mais) return;
    mais.closest('section').querySelectorAll('.linha-extra').forEach(tr => tr.classList.remove('oculto'));
    mais.remove();
  });
  shell.addEventListener('pointerdown', e => { if (shell.classList.contains('menu-aberto') && !e.target.closest('.lateral')) shell.classList.remove('menu-aberto'); });
  ligarDicas(document.body);
  desenharPagina();
}

function desenharPagina() {
  const conteudo = document.getElementById('conteudo');
  if (!conteudo) return;
  const ctx = contexto();
  const pagina = ctx.modulo;
  if (!pagina) return;
  if (typeof limparPagina === 'function') limparPagina();
  limparPagina = null;
  const ajudaTela = AJUDA[ctx.rota.tela];
  const titulo = typeof pagina.titulo === 'function' ? pagina.titulo(ctx) : pagina.titulo;
  const descricao = typeof pagina.descricao === 'function' ? pagina.descricao(ctx) : pagina.descricao;
  const rolagem = window.scrollY;
  conteudo.innerHTML = `
    ${htmlFaixa()}
    <div class="pagina">
      <div class="cabecalho">
        <div><h1>${esc(titulo)}</h1>${descricao ? `<p>${esc(descricao)}</p>` : ''}</div>
        <div class="cabecalho-acoes">
          ${pagina.acoesCabecalho ? pagina.acoesCabecalho(ctx) : ''}
          ${ajudaTela ? `<button type="button" class="botao fantasma" id="comoFunciona">${icone('ajuda')}Como funciona?</button>` : ''}
        </div>
      </div>
      <div id="corpoPagina">${pagina.render(ctx)}</div>
    </div>`;
  window.scrollTo(0, rolagem);
  // No celular a faixa de abas rola de lado: a aba aberta não pode ficar escondida na borda.
  const abaAberta = conteudo.querySelector('.abas .aba.ativa');
  if (abaAberta) {
    const faixa = abaAberta.parentElement;
    const a = abaAberta.getBoundingClientRect();
    const f = faixa.getBoundingClientRect();
    if (a.right > f.right) faixa.scrollLeft = a.left - f.left - (f.width - a.width) / 2;
  }
  if (ajudaTela) document.getElementById('comoFunciona').addEventListener('click', () => abrirModal({ titulo: ajudaTela.titulo, lateral: true, cancelar: 'Entendi', corpo: `<div class="ajuda-texto">${ajudaTela.html}</div>` }));
  limparPagina = pagina.ligar ? pagina.ligar(conteudo, ctx) : null;
}

async function mudouRota() {
  if (!sessao) return;
  const rota = lerRota();
  fecharTodosModais();
  if (!telaPermitida(rota.tela)) { ir(sessao.usuario.inicio); return; }
  document.querySelectorAll('#lateral .nav a').forEach(a => {
    const ativo = a.getAttribute('href') === '#/' + rota.tela;
    a.classList.toggle('ativo', ativo);
    if (ativo) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  const topo = document.getElementById('topoTitulo');
  if (topo) topo.textContent = TELAS[rota.tela].rotulo;
  const conteudo = document.getElementById('conteudo');
  // Mantém a tela anterior esmaecida enquanto busca a nova, sem piscar.
  if (conteudo) conteudo.classList.add('buscando');
  try {
    await carregar(false);
  } catch (err) {
    avisar(err.message, 'erro');
  } finally {
    if (conteudo) conteudo.classList.remove('buscando');
  }
  desenharPagina();
  window.scrollTo(0, 0);
}

async function sair() {
  try { await api.sair(); } catch (_) { /* sai mesmo sem resposta */ }
  sessao = null;
  dados = null;
  chaveDados = '';
  location.hash = '';
  iniciar();
}

async function lerSessao() {
  const s = await api.sessao();
  if (!s || !s.usuario) return null;
  usarMensagens(s.parque.mensagens);
  return s;
}

async function entrou() {
  sessao = await lerSessao();
  if (!sessao) return iniciar();
  dados = null;
  chaveDados = '';
  if (!telaPermitida(lerRota().tela)) history.replaceState(null, '', '#/' + sessao.usuario.inicio);
  try { await carregar(true); } catch (err) { avisar(err.message, 'erro'); }
  desenharTudo();
}

async function iniciar() {
  try {
    sessao = await lerSessao();
  } catch (_) {
    sessao = null;
  }
  if (!sessao) {
    raiz.innerHTML = '';
    await telaDeEntrada(raiz, entrou);
    return;
  }
  await entrou();
}

quandoPerderSessao(() => {
  if (!sessao) return;
  sessao = null;
  dados = null;
  avisar('Sua sessão terminou. Entre novamente.', 'erro');
  iniciar();
});

window.addEventListener('hashchange', mudouRota);

// Telas ao vivo (painel, parque, PDV) se atualizam sozinhas, sem atrapalhar quem está digitando.
setInterval(async () => {
  if (!sessao || carregando || document.visibilityState !== 'visible' || temModalAberto()) return;
  const pagina = TELAS[lerRota().tela] && TELAS[lerRota().tela].modulo;
  if (!pagina || !pagina.aoVivo) return;
  const foco = document.activeElement;
  if (foco && /INPUT|TEXTAREA|SELECT/.test(foco.tagName)) return;
  if (pagina.podeAtualizar && !pagina.podeAtualizar()) return;
  try {
    await carregar(true);
    desenharPagina();
  } catch (_) { /* tenta de novo no próximo ciclo */ }
}, 30000);

iniciar();
