'use strict';

const { inserir, atualizar } = require('../persistencia/banco');
const C = require('../dominio/contabil');
const D = require('../dominio/datas');
const { texto, textoObrigatorio, valorEmCentavos, inteiro, data, formatar, ErroUsuario } = require('./contexto');
const { criarConta, baixarConta } = require('./financeiro');

/* Catálogo da loja e da bilheteria, quadras e configurações do complexo. */

async function produtoDoParque(ctx, id) {
  const r = await ctx.tx.query('select * from produtos where parque_id = $1 and id = $2', [ctx.parqueId, Number(id)]);
  if (!r.rows[0]) throw new ErroUsuario('Produto não encontrado.');
  return r.rows[0];
}

const porcentagemValida = (v, rotulo) => {
  const n = Number(String(v).replace(',', '.'));
  if (!(n >= 0 && n <= 20)) throw new ErroUsuario(`Informe ${rotulo} entre 0 e 20%.`);
  return Math.round(n * 100) / 100;
};

const ACOES = {
  'salvar-produto': {
    papeis: ['dono'],
    async executar(ctx, d) {
      const campos = {
        tipo: d.tipo === 'ingresso' ? 'ingresso' : 'loja',
        nome: textoObrigatorio(d.nome, 'o nome'),
        categoria: texto(d.categoria, 60),
        preco: valorEmCentavos(d.preco, 'o preço'),
        controla_estoque: !!d.controlaEstoque,
        estoque_minimo: inteiro(d.estoqueMinimo, 'o estoque mínimo', { min: 0, max: 100000, vazio: 0 }),
        ativo: d.ativo !== false
      };
      if (d.produtoId) {
        const p = await produtoDoParque(ctx, d.produtoId);
        await atualizar(ctx.tx, 'produtos', p.id, campos);
        const preco = Number(p.preco) !== campos.preco ? ` Preço de ${formatar(p.preco)} para ${formatar(campos.preco)}.` : '';
        return { resumo: `Atualizou ${campos.nome}.${preco}` };
      }
      const estoque = campos.controla_estoque ? inteiro(d.estoque, 'o estoque inicial', { min: 0, max: 100000, vazio: 0 }) : 0;
      const p = await inserir(ctx.tx, 'produtos', { parque_id: ctx.parqueId, ...campos, estoque, criado_em: ctx.agora });
      return { resumo: `Cadastrou ${p.nome} por ${formatar(p.preco)}${p.controla_estoque ? ` com ${estoque} em estoque` : ''}.`, resultado: { produtoId: p.id } };
    }
  },

  'entrada-estoque': {
    papeis: ['dono'],
    async executar(ctx, d) {
      const p = await produtoDoParque(ctx, d.produtoId);
      if (!p.controla_estoque) throw new ErroUsuario('Este produto não controla estoque. Ative o controle no cadastro.');
      const qtd = inteiro(d.quantidade, 'a quantidade que chegou', { min: 1, max: 100000 });
      await ctx.tx.query('update produtos set estoque = estoque + $2 where id = $1', [p.id, qtd]);
      let extra = '';
      const custo = valorEmCentavos(d.custo, 'o custo da compra', { zeroOk: true, vazio: 0 });
      if (custo > 0) {
        // O custo vira uma despesa de compra, paga agora ou a pagar no vencimento.
        const conta = await criarConta(ctx, {
          sentido: 'pagar', categoria: 'compras', descricao: `Compra: ${qtd}× ${p.nome}`, pessoa: d.fornecedor,
          valor: custo / 100, vencimento: d.vencimento || ctx.hoje
        });
        if (d.jaPaga) await baixarConta(ctx, conta, d.forma);
        extra = ` Custo de ${formatar(custo)} lançado como despesa${d.jaPaga ? ' paga' : ' a pagar'}.`;
      }
      return { resumo: `Deu entrada em ${qtd} unidades de ${p.nome} (agora ${p.estoque + qtd}).${extra}` };
    }
  },

  'ajustar-estoque': {
    papeis: ['dono'],
    async executar(ctx, d) {
      const p = await produtoDoParque(ctx, d.produtoId);
      const contagem = inteiro(d.contagem, 'a quantidade contada', { min: 0, max: 100000 });
      await atualizar(ctx.tx, 'produtos', p.id, { estoque: contagem, controla_estoque: true });
      return { resumo: `Ajustou o estoque de ${p.nome} de ${p.estoque} para ${contagem} após contagem.` };
    }
  },

  'salvar-quadra': {
    papeis: ['dono'],
    async executar(ctx, d) {
      const campos = {
        nome: textoObrigatorio(d.nome, 'o nome da quadra', 1),
        modalidade: texto(d.modalidade, 60),
        preco_hora: valorEmCentavos(d.precoHora, 'o preço por hora', { zeroOk: true }),
        ativa: d.ativa !== false
      };
      if (d.quadraId) {
        const r = await ctx.tx.query('select id from quadras where parque_id = $1 and id = $2', [ctx.parqueId, Number(d.quadraId)]);
        if (!r.rows[0]) throw new ErroUsuario('Quadra não encontrada.');
        await atualizar(ctx.tx, 'quadras', r.rows[0].id, campos);
        return { resumo: `Atualizou a ${campos.nome} (${formatar(campos.preco_hora)} por hora).` };
      }
      const ordem = await ctx.tx.query('select coalesce(max(ordem), 0) + 1 as n from quadras where parque_id = $1', [ctx.parqueId]);
      await inserir(ctx.tx, 'quadras', { parque_id: ctx.parqueId, ...campos, ordem: ordem.rows[0].n });
      return { resumo: `Cadastrou a ${campos.nome} (${formatar(campos.preco_hora)} por hora).` };
    }
  },

  'editar-complexo': {
    papeis: ['dono'],
    async executar(ctx, d) {
      const nome = textoObrigatorio(d.nome, 'o nome do complexo');
      const abre = String(d.abre || '').slice(0, 5);
      const fecha = String(d.fecha || '').slice(0, 5);
      if (!D.horaValida(abre) || !D.horaValida(fecha)) throw new ErroUsuario('Informe o horário de funcionamento.');
      if (fecha !== '00:00' && D.paraMinutos(fecha) <= D.paraMinutos(abre)) throw new ErroUsuario('O fechamento precisa ser depois da abertura.');
      const config = Object.assign({}, ctx.config, {
        cidade: texto(d.cidade, 80), cnpj: texto(d.cnpj, 30), telefone: texto(d.telefone, 30),
        horario: { abre, fecha },
        taxas: { debito: porcentagemValida(d.taxaDebito, 'a taxa do débito'), credito: porcentagemValida(d.taxaCredito, 'a taxa do crédito') }
      });
      await ctx.tx.query('update parques set nome = $2 where id = $1', [ctx.parqueId, nome]);
      await ctx.salvarConfig(config);
      return { resumo: 'Atualizou os dados, o horário e as taxas do complexo.' };
    }
  },

  'config-parque': {
    papeis: ['dono'],
    async executar(ctx, d) {
      const planos = (Array.isArray(d.planos) ? d.planos : []).map((p, i) => {
        const minutos = p.minutos === '' || p.minutos == null ? null : inteiro(p.minutos, 'os minutos de cada plano', { min: 5, max: 720 });
        return {
          id: texto(p.id, 20) || `p${Date.now().toString(36)}${i}`,
          nome: textoObrigatorio(p.nome, 'o nome de cada plano', 1),
          minutos,
          preco: valorEmCentavos(p.preco, 'o preço de cada plano', { zeroOk: true })
        };
      });
      if (!planos.length) throw new ErroUsuario('Cadastre pelo menos um tempo de pulseira.');
      const parque = {
        capacidade: inteiro(d.capacidade, 'a capacidade', { min: 1, max: 1000 }),
        tolerancia: inteiro(d.tolerancia, 'a tolerância', { min: 0, max: 60 }),
        bloco: inteiro(d.bloco, 'o tamanho do bloco excedente', { min: 5, max: 60 }),
        valorBloco: valorEmCentavos(d.valorBloco, 'o valor de cada bloco excedente', { zeroOk: true }),
        alerta: inteiro(d.alerta, 'o aviso de tempo acabando', { min: 0, max: 60 }),
        planos
      };
      await ctx.salvarConfig(Object.assign({}, ctx.config, { parque }));
      return { resumo: `Atualizou o parque infantil: ${planos.length} tempos de pulseira, capacidade de ${parque.capacidade} crianças.` };
    }
  },

  'editar-espacos': {
    papeis: ['dono'],
    async executar(ctx, d) {
      const espacos = (Array.isArray(d.espacos) ? d.espacos : String(d.espacos || '').split('\n')).map(e => texto(e, 60)).filter(Boolean);
      if (!espacos.length) throw new ErroUsuario('Cadastre pelo menos um espaço para eventos.');
      await ctx.salvarConfig(Object.assign({}, ctx.config, { espacos }));
      return { resumo: `Atualizou os espaços de eventos: ${espacos.join(', ')}.` };
    }
  }
};

module.exports = { ACOES, C };
