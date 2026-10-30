'use strict';

const { lerConfig } = require('./config');
const { relogio } = require('./tempo');
const { criarApp } = require('./app');
const { conectar } = require('./persistencia/banco');
const { semearDemo } = require('./demo');
const { prepararParque } = require('./servicos/preparo');

async function iniciar() {
  const cfg = lerConfig();
  if (!cfg.bancoUrl) {
    console.error('[fatal] Defina DATABASE_URL com a conexão do Postgres (no Easypanel: Ambiente do app).');
    process.exit(1);
  }
  const agora = relogio(cfg.fuso);
  const banco = conectar({ url: cfg.bancoUrl, ssl: cfg.bancoSsl });
  await banco.migrar();
  if (cfg.seedDemo && await semearDemo(banco, cfg, agora)) console.log('[demo] complexo de demonstração criado');

  const { app, acessos } = criarApp({ cfg, banco, agora });
  const servidor = app.listen(cfg.porta, cfg.host, () => {
    console.log(`AYVO Gestão no ar em http://localhost:${cfg.porta} (fuso: ${cfg.fuso})`);
  });

  // Mantém a demonstração de hoje pronta e o aluguel do mês lançado, mesmo sem ninguém abrir o sistema.
  const manter = async () => {
    for (const p of await acessos.parques.todos()) {
      await prepararParque(banco, { parqueId: p.id, agora: agora(), senhaDemo: cfg.senhaDemo }).catch(err => console.error('[preparo]', err.message));
    }
  };
  manter().catch(() => {});
  setInterval(() => manter().catch(() => {}), 10 * 60 * 1000).unref();
  setInterval(() => acessos.sessoes.limparVencidas().catch(() => {}), 6 * 60 * 60 * 1000).unref();

  const encerrar = () => {
    servidor.close(() => banco.fechar().finally(() => process.exit(0)));
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGTERM', encerrar);
  process.on('SIGINT', encerrar);
}

iniciar().catch(err => {
  console.error('[fatal]', err);
  process.exit(1);
});
