'use strict';

const L = require('./dominio/ledger');
const { hashSenha } = require('./acesso');

const USUARIOS_DEMO = [
  { nome: 'Carla Mendes', email: 'proprietaria@foodpark.demo', papel: 'dono' },
  { nome: 'Rafael Souza', email: 'caixa@foodpark.demo', papel: 'caixa' }
];

/**
 * Banco vazio + SEED_DEMO: cria o food park de demonstração e os dois acessos prontos.
 * Banco com dados: não toca em nada.
 */
async function semearDemo(repo, cfg, agora) {
  if (await repo.primeiroParque()) return false;
  const estado = L.demo(agora());
  if (cfg.nomeDemo) estado.park.name = cfg.nomeDemo;
  const id = await repo.criarParque(estado);
  for (const u of USUARIOS_DEMO) {
    await repo.usuarios.criar({ parqueId: id, ...u, senhaHash: hashSenha(cfg.senhaDemo), demo: true });
  }
  await repo.historico.registrar(id, { acao: 'instalacao', resumo: 'Food park de demonstração criado.' });
  return true;
}

module.exports = { semearDemo, USUARIOS_DEMO };
