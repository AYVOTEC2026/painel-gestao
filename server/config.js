'use strict';

/**
 * Tudo o que muda de uma instalação para outra vem do ambiente (Easypanel > Environment).
 *
 *   DATABASE_URL        Postgres. Sem ela o sistema roda em memória e perde tudo ao reiniciar.
 *   SEED_DEMO=true      Banco vazio nasce com o food park de demonstração e dois acessos prontos.
 *   SENHA_DEMO          Senha dos acessos de demonstração (padrão: demo1234).
 *   CODIGO_INSTALACAO   Se preenchido, a tela de instalação pede este código.
 *   TZ                  Fuso do food park (padrão: America/Fortaleza).
 */
function lerConfig(env = process.env) {
  const semBanco = !env.DATABASE_URL;
  return {
    porta: Number(env.PORT) || 3000,
    host: env.HOST || '0.0.0.0',
    bancoUrl: env.DATABASE_URL || '',
    bancoSsl: env.DATABASE_SSL === '1',
    // Sem banco não há o que preservar: a demonstração entra sempre.
    seedDemo: semBanco || env.SEED_DEMO === 'true' || env.SEED_DEMO === '1',
    senhaDemo: env.SENHA_DEMO || 'demo1234',
    codigoInstalacao: env.CODIGO_INSTALACAO || '',
    fuso: env.TZ || 'America/Fortaleza',
    producao: env.NODE_ENV === 'production'
  };
}

module.exports = { lerConfig };
