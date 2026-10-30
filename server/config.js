'use strict';

/**
 * Tudo o que muda de uma instalação para outra vem do ambiente (Easypanel > Ambiente).
 *
 *   DATABASE_URL        Postgres (obrigatória).
 *   SEED_DEMO=true      Banco vazio nasce com o complexo de demonstração e três acessos prontos.
 *   SENHA_DEMO          Senha dos acessos de demonstração (padrão: demo1234).
 *   NOME_DEMO           Nome do complexo na demonstração (padrão: Complexo Central).
 *   CODIGO_INSTALACAO   Se preenchido, a tela de instalação pede este código.
 *   TZ                  Fuso do complexo (padrão: America/Fortaleza).
 */
function lerConfig(env = process.env) {
  return {
    porta: Number(env.PORT) || 3000,
    host: env.HOST || '0.0.0.0',
    bancoUrl: env.DATABASE_URL || '',
    bancoSsl: env.DATABASE_SSL === '1',
    seedDemo: env.SEED_DEMO === 'true' || env.SEED_DEMO === '1',
    senhaDemo: env.SENHA_DEMO || 'demo1234',
    nomeDemo: String(env.NOME_DEMO || '').trim(),
    codigoInstalacao: env.CODIGO_INSTALACAO || '',
    fuso: env.TZ || 'America/Fortaleza',
    producao: env.NODE_ENV === 'production'
  };
}

module.exports = { lerConfig };
