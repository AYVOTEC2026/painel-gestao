'use strict';

const D = require('../dominio/datas');
const { criarContexto } = require('./contexto');
const { gerarAlugueis } = require('./locacoes');

/**
 * Antes de mostrar uma tela: a demonstração precisa ser de hoje, o parque da
 * demonstração precisa ter crianças, e o aluguel do mês precisa estar lançado.
 * Só escreve no banco quando falta alguma dessas coisas.
 */
async function prepararParque(banco, { parqueId, agora, senhaDemo, simular = false }) {
  const demo = require('../demo');
  const p = (await banco.query('select modo, demo_dia, demo_versao, demo_simulado_em from parques where id = $1', [parqueId])).rows[0];
  if (!p) return;
  if (p.modo === 'demo' && (p.demo_dia !== D.diaDe(agora) || p.demo_versao !== demo.VERSAO_DEMO)) {
    await demo.recriarDemo(banco, { parqueId, agora, senha: senhaDemo, somenteSeVelha: true });
    return;
  }
  if (p.modo === 'demo' && simular && (!p.demo_simulado_em || D.minutosEntre(p.demo_simulado_em, agora) >= 5)) {
    await demo.simularParque(banco, { parqueId, agora });
  }
  const mes = D.mesDe(agora);
  const falta = await banco.query(
    `select 1 from contratos c
      where c.parque_id = $1 and c.status = 'ativo' and c.inicio <= $3 and (c.fim is null or c.fim >= $2)
        and not exists (select 1 from cobrancas b where b.contrato_id = c.id and b.competencia = $4 and b.tipo = 'aluguel' and b.status <> 'cancelada')
      limit 1`,
    [parqueId, `${mes}-01`, D.diaNoMes(mes, 31), mes]
  );
  if (falta.rows.length) {
    await banco.transacao(async tx => {
      const ctx = await criarContexto(tx, { parqueId, usuario: null, agora });
      await gerarAlugueis(ctx);
    });
  }
}

module.exports = { prepararParque };
