'use strict';

const { lerConfig } = require('./config');
const { relogio } = require('./tempo');
const { criarApp } = require('./app');
const { criarRepoPg } = require('./persistencia/repo-pg');
const { criarRepoMemoria } = require('./persistencia/repo-memoria');
const { semearDemo } = require('./seed');

async function iniciar() {
  const cfg = lerConfig();
  const agora = relogio(cfg.fuso);
  const repo = cfg.bancoUrl ? criarRepoPg({ url: cfg.bancoUrl, ssl: cfg.bancoSsl }) : criarRepoMemoria();
  if (!cfg.bancoUrl) {
    console.warn('[aviso] DATABASE_URL não definida: rodando em memória com a demonstração. Nada fica salvo ao reiniciar.');
  }
  await repo.iniciar();
  if (cfg.seedDemo && await semearDemo(repo, cfg, agora)) console.log('[demo] food park de demonstração criado');

  const app = criarApp({ cfg, repo, agora });
  const servidor = app.listen(cfg.porta, cfg.host, () => {
    console.log(`AYVO Food Park no ar em http://localhost:${cfg.porta} (banco: ${repo.modo}, fuso: ${cfg.fuso})`);
  });
  setInterval(() => repo.sessoes.limparVencidas().catch(() => {}), 6 * 60 * 60 * 1000).unref();

  const encerrar = () => {
    servidor.close(() => repo.fechar().finally(() => process.exit(0)));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGTERM', encerrar);
  process.on('SIGINT', encerrar);
}

iniciar().catch(err => {
  console.error('[fatal]', err);
  process.exit(1);
});
