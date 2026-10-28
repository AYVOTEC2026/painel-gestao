import { api, quandoPerderSessao } from './api.js';
import { esc, icone, marcaSvg, iniciais, avisar, abrirModal, temModalAberto, fecharTodosModais } from './ui.js';
import { telaDeEntrada } from './entrada.js';
import { AJUDA } from './ajuda-conteudo.js';
import inicio from './paginas/inicio.js';
import caixa from './paginas/caixa.js';
import boxes from './paginas/boxes.js';
import financeiro from './paginas/financeiro.js';
import equipe from './paginas/equipe.js';
import config from './paginas/config.js';
import ajuda from './paginas/ajuda.js';

const TELAS = {
  inicio: { rotulo: 'Início', icone: 'inicio', grupo: 'Operação', modulo: inicio },
  caixa: { rotulo: 'Caixa', icone: 'caixa', grupo: 'Operação', modulo: caixa },
  boxes: { rotulo: 'Boxes e lojistas', icone: 'boxes', grupo: 'Operação', modulo: boxes },
  financeiro: { rotulo: 'Financeiro', icone: 'financeiro', grupo: 'Gestão', modulo: financeiro },
  equipe: { rotulo: 'Equipe', icone: 'equipe', grupo: 'Gestão', modulo: equipe },
  config: { rotulo: 'Configurações', icone: 'config', grupo: 'Gestão', modulo: config },
  ajuda: { rotulo: 'Ajuda', icone: 'ajuda', grupo: 'rodape', modulo: ajuda }
};

const raiz = document.getElementById('app');
let sessao = null;
let visao = null;
let carregando = false;

function lerRota() {
  const bruto = location.hash.replace(/^#\/?/, '');
  const [caminho, busca = ''] = bruto.split('?');
  const [tela = '', sub = ''] = caminho.split('/');
  return { tela, sub, query: Object.fromEntries(new URLSearchParams(busca)) };
}

const ir = caminho => { location.hash = '#/' + caminho.replace(/^#?\/?/, ''); };

function contexto() {
  const rota = lerRota();
  return {
    usuario: sessao.usuario,
    ehGestao: sessao.usuario.papel === 'dono',
    visao,
    rota,
    ir,
    mes: rota.query.mes || (visao && visao.mesAtual),
    /** Executa uma ação no servidor e redesenha a tela com o resultado. */
    async acao(nome, dados, mensagem) {
      const r = await api.acao(nome, dados, rota.tela === 'financeiro' ? rota.query.mes : undefined);
      visao = r.visao;
      if (mensagem) avisar(mensagem);
      desenharPagina();
      return r.resultado;
    },
    /** Visão mais recente (depois de uma ação, a `visao` deste contexto já ficou velha). */
    visaoAtual: () => visao,
    recarregar: () => carregarVisao(true),
    desenhar: () => desenharPagina(),
    atualizarSessao: async () => {
      sessao = await lerSessao();
      if (!sessao) return iniciar();
      desenharTudo();
    }
  };
}

async function carregarVisao(forcar) {
  const rota = lerRota();
  // Só o Financeiro olha meses passados; as outras telas usam o mês corrente.
  const mes = rota.tela === 'financeiro' ? (rota.query.mes || (visao && visao.mesAtual)) : undefined;
  if (!forcar && visao && (!mes || visao.mes === mes)) return;
  carregando = true;
  try {
    visao = await api.visao(mes);
  } finally {
    carregando = false;
  }
}

function telaPermitida(tela) {
  return sessao.usuario.telas.includes(tela) && TELAS[tela];
}

/* ------------------------------------------------------------------ casca */

function htmlLateral(telaAtual) {
  const u = sessao.usuario;
  const grupos = {};
  u.telas.forEach(t => {
    const def = TELAS[t];
    if (!def || def.grupo === 'rodape') return;
    (grupos[def.grupo] = grupos[def.grupo] || []).push(t);
  });
  const link = t => `<a href="#/${t}" class="${t === telaAtual ? 'ativo' : ''}" ${t === telaAtual ? 'aria-current="page"' : ''}>${icone(TELAS[t].icone)}<span>${esc(TELAS[t].rotulo)}</span></a>`;
  const nomeGrupos = Object.keys(grupos);
  return `
    <aside class="lateral" id="lateral">
      <div class="marca"><div class="marca-selo">${marcaSvg}</div><div><b>${esc(sessao.parque.nome)}</b><small>AYVO Food Park</small></div></div>
      <nav class="nav" aria-label="Principal">
        ${nomeGrupos.map(g => `${nomeGrupos.length > 1 ? `<div class="nav-grupo">${esc(g)}</div>` : ''}${grupos[g].map(link).join('')}`).join('')}
      </nav>
      <div class="lateral-pe">
        <nav class="nav" aria-label="Ajuda">${link('ajuda')}</nav>
        <div class="usuario-chip">
          <div class="avatar">${esc(iniciais(u.nome))}</div>
          <div><b>${esc(u.nome)}</b><small>Perfil ${esc(u.papelNome)}</small></div>
          <button type="button" id="botaoSair" title="Sair" aria-label="Sair do sistema">${icone('sair')}</button>
        </div>
      </div>
    </aside>`;
}

function htmlFaixas() {
  let html = '';
  if (sessao.semBanco) {
    html += `<div class="faixa-demo faixa-sem-banco">${icone('alerta')}<span><b>Sem banco de dados.</b> Este servidor está rodando em memória: tudo some quando ele reiniciar. Configure a DATABASE_URL.</span></div>`;
  }
  if (visao && visao.parque.modo === 'demo') {
    html += sessao.usuario.papel === 'dono'
      ? `<div class="faixa-demo">${icone('info')}<span><b>Demonstração.</b> Lojistas, vendas e contas são fictícios e são recriados todo dia. Pode testar à vontade.</span><a class="botao pequeno" href="#/config/operacao">Começar operação real</a></div>`
      : `<div class="faixa-demo">${icone('info')}<span><b>Demonstração.</b> As vendas são fictícias. Pode testar à vontade.</span></div>`;
  }
  return html;
}

function desenharTudo() {
  const rota = lerRota();
  raiz.innerHTML = `
    <div class="shell" id="shell">
      ${htmlLateral(rota.tela)}
      <div>
        <header class="topo-movel">
          <button type="button" id="abrirMenu" aria-label="Abrir menu">${icone('menu')}</button>
          <div><b>${esc(TELAS[rota.tela] ? TELAS[rota.tela].rotulo : '')}</b><small>${esc(sessao.parque.nome)}</small></div>
        </header>
        <main class="conteudo" id="conteudo"></main>
      </div>
    </div>`;
  document.getElementById('botaoSair').addEventListener('click', sair);
  const shell = document.getElementById('shell');
  document.getElementById('abrirMenu').addEventListener('click', () => shell.classList.add('menu-aberto'));
  shell.addEventListener('click', e => {
    if (shell.classList.contains('menu-aberto') && (e.target === shell || e.target.closest('.nav a'))) shell.classList.remove('menu-aberto');
  });
  shell.addEventListener('pointerdown', e => {
    if (shell.classList.contains('menu-aberto') && !e.target.closest('.lateral')) shell.classList.remove('menu-aberto');
  });
  desenharPagina();
}

let limparPagina = null;

function desenharPagina() {
  const conteudo = document.getElementById('conteudo');
  if (!conteudo || !visao) return;
  const ctx = contexto();
  const def = TELAS[ctx.rota.tela];
  const pagina = def.modulo;
  if (typeof limparPagina === 'function') limparPagina();
  const ajudaTela = AJUDA[pagina.ajuda || ctx.rota.tela];
  const titulo = typeof pagina.titulo === 'function' ? pagina.titulo(ctx) : pagina.titulo;
  const descricao = typeof pagina.descricao === 'function' ? pagina.descricao(ctx) : pagina.descricao;
  conteudo.innerHTML = `
    ${htmlFaixas()}
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
  if (ajudaTela) document.getElementById('comoFunciona').addEventListener('click', () => abrirAjuda(ajudaTela));
  limparPagina = pagina.ligar ? pagina.ligar(conteudo, ctx) : null;
}

function abrirAjuda(conteudo) {
  abrirModal({
    titulo: conteudo.titulo,
    lateral: true,
    cancelar: 'Entendi',
    corpo: `<div class="ajuda-texto">${conteudo.html}</div>`
  });
}

async function mudouRota() {
  const rota = lerRota();
  if (!sessao) return;
  fecharTodosModais();
  if (!telaPermitida(rota.tela)) {
    ir(sessao.usuario.inicio);
    return;
  }
  const lateralAtual = document.getElementById('lateral');
  try {
    await carregarVisao(false);
  } catch (err) {
    avisar(err.message, 'erro');
    return;
  }
  if (!lateralAtual) { desenharTudo(); window.scrollTo(0, 0); return; }
  // Troca só o destaque do menu e o conteúdo, sem redesenhar a moldura inteira.
  lateralAtual.querySelectorAll('.nav a').forEach(a => {
    const ativo = a.getAttribute('href') === '#/' + rota.tela;
    a.classList.toggle('ativo', ativo);
    if (ativo) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  const topo = document.querySelector('.topo-movel b');
  if (topo) topo.textContent = TELAS[rota.tela].rotulo;
  desenharPagina();
  window.scrollTo(0, 0);
}

async function sair() {
  try { await api.sair(); } catch (_) { /* sai mesmo sem resposta */ }
  sessao = null;
  visao = null;
  location.hash = '';
  iniciar();
}

async function lerSessao() {
  const s = await api.sessao();
  return s && s.usuario ? s : null;
}

async function entrou() {
  sessao = await lerSessao();
  if (!sessao) return iniciar();
  visao = null;
  const rota = lerRota();
  if (!telaPermitida(rota.tela)) {
    history.replaceState(null, '', '#/' + sessao.usuario.inicio);
  }
  await carregarVisao(true);
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
  visao = null;
  avisar('Sua sessão terminou. Entre novamente.', 'erro');
  iniciar();
});

window.addEventListener('hashchange', mudouRota);

// O Início acompanha as vendas feitas em outros aparelhos sem precisar recarregar.
setInterval(async () => {
  if (!sessao || carregando || document.visibilityState !== 'visible' || temModalAberto()) return;
  if (lerRota().tela !== 'inicio') return;
  try {
    await carregarVisao(true);
    desenharPagina();
  } catch (_) { /* tenta de novo no próximo ciclo */ }
}, 45000);

iniciar();
