/* Tema claro de dia e escuro à noite, pelo relógio do aparelho.
   Carregado como script comum no <head>, antes do CSS pintar a tela, para não piscar branco à noite.
   A escolha manual (claro ou escuro fixo) fica guardada neste navegador. */
(function () {
  const CHAVE = 'pepama.tema';
  const INICIO_DIA = 6;   // 06:00 passa para o claro
  const INICIO_NOITE = 18; // 18:00 passa para o escuro (o sol se põe por volta das 17h30 em Fortaleza)
  const COR_BARRA = { claro: '#33251f', escuro: '#15100d' };
  const OPCOES = ['auto', 'claro', 'escuro'];

  function escolha() {
    try {
      const v = localStorage.getItem(CHAVE);
      return OPCOES.includes(v) ? v : 'auto';
    } catch (err) {
      return 'auto';
    }
  }

  function pelaHora(agora) {
    const h = (agora || new Date()).getHours();
    return h >= INICIO_DIA && h < INICIO_NOITE ? 'claro' : 'escuro';
  }

  function aplicar() {
    const e = escolha();
    const tema = e === 'auto' ? pelaHora() : e;
    const raiz = document.documentElement;
    if (raiz.dataset.tema !== tema) raiz.dataset.tema = tema;
    raiz.dataset.temaEscolha = e;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', COR_BARRA[tema]);
    document.dispatchEvent(new CustomEvent('tema', { detail: { tema, escolha: e } }));
    return tema;
  }

  // Avança Automático → Claro → Escuro → Automático.
  function trocar() {
    const proxima = OPCOES[(OPCOES.indexOf(escolha()) + 1) % OPCOES.length];
    try { localStorage.setItem(CHAVE, proxima); } catch (err) { /* sem armazenamento: vale só nesta aba */ }
    aplicar();
    return proxima;
  }

  aplicar();
  // Confere a cada minuto para virar sozinho às 6h e às 18h com a tela aberta.
  setInterval(aplicar, 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) aplicar(); });

  window.PepamaTema = { aplicar, trocar, escolha, pelaHora, INICIO_DIA, INICIO_NOITE };
})();
