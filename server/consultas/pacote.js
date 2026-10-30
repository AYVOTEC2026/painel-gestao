'use strict';

const C = require('../dominio/contabil');
const { NOMES_CATEGORIA, DOCUMENTOS } = require('../servicos/financeiro');
const { ARQUIVOS } = require('./exportar');
const { EscritorZip, nomeDeArquivo } = require('../zip');

/*
 * Pacote do contador: um ZIP por mês com as despesas, as notas fiscais anexadas e
 * uma página de resumo (LEIA-ME.html) com links para cada arquivo. No pacote
 * completo vão também o livro contábil, o resultado, o extrato e os aluguéis.
 */

/** Como o número aparece no nome do arquivo: "NF 4821", "Fatura 32331", "Guia 0912". */
const PREFIXO_NUMERO = { nota_fiscal: 'NF', cupom_fiscal: 'Cupom', recibo: 'Recibo', fatura: 'Fatura', guia: 'Guia', folha: 'Folha' };
const EXTENSAO = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/xml': 'xml', 'text/xml': 'xml' };
const reais = c => (Math.round(Number(c) || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const valorCsv = c => (Math.round(Number(c) || 0) / 100).toFixed(2).replace('.', ',');
const dataBr = t => (t ? `${String(t).slice(8, 10)}/${String(t).slice(5, 7)}/${String(t).slice(0, 4)}` : '');
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const celula = v => { const t = v == null ? '' : String(v); return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
const nomeDoMes = mes => new Date(`${mes}-15T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Situação da documentação de uma despesa: tem arquivo, foi justificada ou está pendente. */
function documentacao(conta, anexos) {
  if (anexos.length) return 'completa';
  if (conta.documento_tipo === 'sem_documento') return 'sem_documento';
  return 'pendente';
}

async function despesasDoMes(db, parqueId, mes) {
  const contas = (await db.query(
    "select * from contas where parque_id = $1 and sentido = 'pagar' and competencia = $2 and status <> 'cancelada' order by vencimento, id",
    [parqueId, mes]
  )).rows;
  const anexos = contas.length ? (await db.query(
    "select id, dono_id, nome, mime, tamanho, criado_em from anexos where parque_id = $1 and dono_tipo = 'conta' and dono_id = any($2::int[]) order by id",
    [parqueId, contas.map(c => c.id)]
  )).rows : [];
  return contas.map(c => {
    const meus = anexos.filter(a => a.dono_id === c.id);
    return { ...c, anexos: meus, documentacao: documentacao(c, meus) };
  });
}

function planilha(despesas, arquivos) {
  const cabecalho = ['vencimento', 'pago_em', 'competencia', 'fornecedor', 'cnpj_cpf_fornecedor', 'descricao', 'categoria', 'tipo_documento', 'numero_documento', 'valor', 'situacao', 'forma_pagamento', 'documentacao', 'arquivos'];
  const linhas = despesas.map(c => [
    dataBr(c.vencimento), dataBr(c.pago_em), c.competencia, c.pessoa, c.pessoa_documento, c.descricao, NOMES_CATEGORIA[c.categoria] || c.categoria,
    DOCUMENTOS[c.documento_tipo], c.documento_numero, valorCsv(c.valor), c.status === 'paga' ? 'Paga' : 'Em aberto',
    c.forma ? (C.formaPorId(c.forma) || { nome: c.forma }).nome : '',
    { completa: 'Com documento', sem_documento: `Sem documento: ${c.justificativa}`, pendente: 'Falta o documento' }[c.documentacao],
    (arquivos.get(c.id) || []).map(a => a.caminho).join(' | ')
  ]);
  return '﻿' + [cabecalho].concat(linhas).map(l => l.map(celula).join(';')).join('\r\n');
}

function leiaMe({ parque, mes, despesas, arquivos, completo, geradoEm }) {
  const total = despesas.reduce((t, c) => t + Number(c.valor), 0);
  const com = despesas.filter(c => c.documentacao === 'completa');
  const pendentes = despesas.filter(c => c.documentacao === 'pendente');
  const sem = despesas.filter(c => c.documentacao === 'sem_documento');
  const porCategoria = {};
  despesas.forEach(c => { porCategoria[c.categoria] = (porCategoria[c.categoria] || 0) + Number(c.valor); });
  const percentual = despesas.length ? Math.round(com.length / despesas.length * 100) : 100;
  const link = a => `<a href="${esc(encodeURI(a.caminho))}">${esc(a.caminho.split('/').pop())}</a>`;
  const situacao = c => ({
    completa: '<span class="ok">Com documento</span>',
    sem_documento: `<span class="aviso">Sem documento</span><small>${esc(c.justificativa)}</small>`,
    pendente: '<span class="falta">Falta o documento</span>'
  }[c.documentacao]);
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Despesas de ${esc(nomeDoMes(mes))} - ${esc(parque.nome)}</title>
<style>
  body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #172420; margin: 0; background: #f3f5f2; line-height: 1.45; }
  main { max-width: 1080px; margin: 0 auto; padding: 32px 24px 48px; }
  header { border-bottom: 3px solid #f28c18; padding-bottom: 14px; margin-bottom: 22px; }
  h1 { font-size: 26px; margin: 0; }
  h2 { font-size: 18px; margin: 30px 0 10px; }
  p, small { color: #5c6b66; }
  .cartoes { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
  .cartoes div { background: #fff; border: 1px solid #dfe5e1; border-radius: 10px; padding: 12px 14px; }
  .cartoes b { display: block; font-size: 20px; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #dfe5e1; font-size: 13.5px; }
  th { text-align: left; background: #12332f; color: #fff; padding: 8px 10px; font-weight: 600; }
  td { padding: 8px 10px; border-top: 1px solid #e6ebe8; vertical-align: top; }
  td.num, th.num { text-align: right; white-space: nowrap; }
  td small { display: block; }
  .ok { color: #15784f; font-weight: 700; } .falta { color: #b8352a; font-weight: 700; } .aviso { color: #96590a; font-weight: 700; }
  a { color: #a94f06; }
  footer { margin-top: 30px; font-size: 12.5px; color: #84928d; }
  @media print { body { background: #fff; } main { padding: 0; } a { color: inherit; } }
</style></head><body><main>
<header>
  <h1>Despesas de ${esc(nomeDoMes(mes))}</h1>
  <p>${esc(parque.nome)}${parque.cnpj ? `, CNPJ ${esc(parque.cnpj)}` : ''}${parque.cidade ? `, ${esc(parque.cidade)}` : ''}. Despesas pelo mês de competência.</p>
</header>
<div class="cartoes">
  <div><small>Despesas</small><b>${despesas.length}</b></div>
  <div><small>Valor total</small><b>${esc(reais(total))}</b></div>
  <div><small>Com documento</small><b>${com.length} (${percentual}%)</b></div>
  <div><small>Falta documento</small><b>${pendentes.length}</b></div>
</div>

<h2>Por categoria</h2>
<table><thead><tr><th>Categoria</th><th class="num">Valor</th></tr></thead><tbody>
${Object.entries(porCategoria).sort((a, b) => b[1] - a[1]).map(([cat, v]) => `<tr><td>${esc(NOMES_CATEGORIA[cat] || cat)}</td><td class="num">${esc(reais(v))}</td></tr>`).join('')}
<tr><td><b>Total</b></td><td class="num"><b>${esc(reais(total))}</b></td></tr>
</tbody></table>

<h2>Despesas e documentos</h2>
<table><thead><tr><th>Vencimento</th><th>Fornecedor</th><th>Descrição</th><th>Documento</th><th class="num">Valor</th><th>Situação</th><th>Arquivos</th></tr></thead><tbody>
${despesas.map(c => `<tr>
  <td>${esc(dataBr(c.vencimento))}${c.pago_em ? `<small>paga em ${esc(dataBr(c.pago_em))}</small>` : '<small>em aberto</small>'}</td>
  <td>${esc(c.pessoa || '')}${c.pessoa_documento ? `<small>${esc(c.pessoa_documento)}</small>` : ''}</td>
  <td>${esc(c.descricao)}<small>${esc(NOMES_CATEGORIA[c.categoria] || c.categoria)}</small></td>
  <td>${esc(DOCUMENTOS[c.documento_tipo])}${c.documento_numero ? `<small>nº ${esc(c.documento_numero)}</small>` : ''}</td>
  <td class="num">${esc(reais(c.valor))}</td>
  <td>${situacao(c)}</td>
  <td>${(arquivos.get(c.id) || []).map(link).join('<br>') || '—'}</td>
</tr>`).join('')}
</tbody></table>

${pendentes.length ? `<h2>Pendências</h2><p>Estas despesas ainda não têm documento anexado no sistema:</p><ul>${pendentes.map(c => `<li>${esc(dataBr(c.vencimento))}: ${esc(c.descricao)} (${esc(c.pessoa || 'sem fornecedor')}), ${esc(reais(c.valor))}</li>`).join('')}</ul>` : ''}
${sem.length ? `<h2>Despesas sem documento, com justificativa</h2><ul>${sem.map(c => `<li>${esc(c.descricao)}, ${esc(reais(c.valor))}: ${esc(c.justificativa)}</li>`).join('')}</ul>` : ''}

<h2>O que há neste pacote</h2>
<ul>
  <li><b>despesas-${esc(mes)}.csv</b>: a mesma lista em planilha, com fornecedor, CNPJ, documento, valor, pagamento e o nome de cada arquivo.</li>
  <li><b>notas/</b>: as notas fiscais e comprovantes anexados, com nome no formato <i>vencimento - categoria - fornecedor - número</i>.</li>
  ${completo ? '<li><b>relatorios/</b>: livro contábil, resultado do mês (DRE), extrato de entradas e saídas e aluguéis dos boxes, em planilha.</li>' : ''}
</ul>
<footer>Gerado em ${esc(geradoEm)} pelo AYVO Gestão.</footer>
</main></body></html>`;
}

/** Escreve o pacote do mês em `saida` (a resposta HTTP), um arquivo por vez. */
async function gerarPacote(db, { parqueId, mes, completo, saida, agora }) {
  const p = (await db.query('select nome, config from parques where id = $1', [parqueId])).rows[0];
  const parque = { nome: p.nome, cnpj: (p.config || {}).cnpj || '', cidade: (p.config || {}).cidade || '' };
  const despesas = await despesasDoMes(db, parqueId, mes);
  const pasta = `contador ${nomeDeArquivo(parque.nome, 40)} ${mes}`;

  // Nome de cada arquivo no pacote: data, categoria, fornecedor e número da nota.
  const arquivos = new Map();
  const usados = new Set();
  despesas.forEach(c => {
    arquivos.set(c.id, c.anexos.map(a => {
      const ext = EXTENSAO[a.mime] || (a.nome.includes('.') ? a.nome.split('.').pop().toLowerCase() : 'pdf');
      const base = nomeDeArquivo([c.vencimento, NOMES_CATEGORIA[c.categoria] || c.categoria, c.pessoa || c.descricao, c.documento_numero ? `${PREFIXO_NUMERO[c.documento_tipo] || 'Doc'} ${c.documento_numero}` : ''].filter(Boolean).join(' - '));
      let caminho = `notas/${base}.${ext}`;
      for (let n = 2; usados.has(caminho); n += 1) caminho = `notas/${base} (${n}).${ext}`;
      usados.add(caminho);
      return { id: a.id, caminho };
    }));
  });

  const zip = new EscritorZip(saida);
  const geradoEm = `${agora.slice(8, 10)}/${agora.slice(5, 7)}/${agora.slice(0, 4)} às ${agora.slice(11, 16)}`;
  await zip.adicionar(`${pasta}/LEIA-ME.html`, leiaMe({ parque, mes, despesas, arquivos, completo, geradoEm }));
  await zip.adicionar(`${pasta}/despesas-${mes}.csv`, planilha(despesas, arquivos));
  if (completo) {
    const relatorios = [['lancamentos', 'livro-contabil'], ['dre', 'resultado-dre'], ['extrato', 'extrato-entradas-e-saidas'], ['alugueis', 'alugueis-dos-boxes']];
    for (const [arquivo, nome] of relatorios) {
      await zip.adicionar(`${pasta}/relatorios/${nome}-${mes}.csv`, '﻿' + await ARQUIVOS[arquivo](db, parqueId, mes));
    }
  }
  for (const lista of arquivos.values()) {
    for (const a of lista) {
      const r = await db.query('select conteudo, criado_em from anexos where id = $1', [a.id]);
      await zip.adicionar(`${pasta}/${a.caminho}`, r.rows[0].conteudo);
    }
  }
  await zip.finalizar();
  return { despesas: despesas.length, arquivos: usados.size };
}

module.exports = { gerarPacote, despesasDoMes, documentacao };
