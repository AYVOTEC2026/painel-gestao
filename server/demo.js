'use strict';

/*
 * Demonstração do complexo: ~50 dias de operação gerados em memória, com as mesmas
 * regras de lançamento do sistema, e gravados em lote (leva cerca de um segundo).
 * É recriada todo dia para a apresentação sempre mostrar "hoje" vivo, e o parque
 * recebe e libera crianças sozinho a cada poucos minutos (simularParque).
 */

const { inserir, inserirVarios } = require('./persistencia/banco');
const { hashSenha } = require('./acesso');
const C = require('./dominio/contabil');
const D = require('./dominio/datas');
const R = require('./dominio/regras');
const { PADRAO, completar } = require('./dominio/configuracao');
const { criarContexto } = require('./servicos/contexto');
const { registrarEntrada, registrarSaida } = require('./servicos/parque');

const USUARIOS_DEMO = [
  { nome: 'Carla Mendes', email: 'proprietaria@foodpark.demo', papel: 'dono' },
  { nome: 'Rafael Souza', email: 'caixa@foodpark.demo', papel: 'recepcao' },
  { nome: 'Bianca Lima', email: 'monitor@foodpark.demo', papel: 'monitor' }
];

const TABELAS = [
  'unidades', 'contratos', 'cobrancas', 'anexos', 'caixas', 'movimentos_caixa', 'produtos', 'vendas',
  'entradas_parque', 'quadras', 'reservas', 'eventos', 'contas', 'movimentos', 'lancamentos'
];

function sorteador(semente) {
  let a = semente >>> 0;
  const r = () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.entre = (min, max) => min + Math.floor(r() * (max - min + 1));
  r.um = lista => lista[Math.floor(r() * lista.length)];
  r.pesado = pares => {
    const total = pares.reduce((t, p) => t + p[1], 0);
    let x = r() * total;
    for (const [v, p] of pares) { x -= p; if (x <= 0) return v; }
    return pares[pares.length - 1][0];
  };
  return r;
}

const CRIANCAS = ['Lucas', 'Helena', 'Miguel', 'Alice', 'Theo', 'Laura', 'Davi', 'Valentina', 'Gael', 'Sofia', 'Arthur', 'Cecília', 'Bento', 'Maitê', 'Heitor', 'Lívia', 'Benício', 'Antonella', 'Samuel', 'Maria Clara', 'Noah', 'Isis', 'Ravi', 'Eloá'];
const SOBRENOMES = ['Almeida', 'Costa', 'Oliveira', 'Sousa', 'Lima', 'Pereira', 'Rocha', 'Barbosa', 'Freitas', 'Monteiro', 'Cavalcante', 'Teixeira', 'Nogueira', 'Pinheiro'];
const ADULTOS = ['Mariana', 'Renato', 'Juliana', 'Fábio', 'Patrícia', 'Diego', 'Camila', 'Eduardo', 'Aline', 'Bruno', 'Larissa', 'Thiago', 'Natália', 'Rodrigo'];
const CLIENTES_QUADRA = ['Marcos Vieira', 'Turma da Orla', 'Paula e amigas', 'Leandro Castro', 'Beach Fit', 'Carlos Menezes', 'Equipe Sol Nascente', 'Vanessa Prado', 'Grupo Areia Fina', 'Igor Matos'];

const telefone = r => `(85) 9${r.entre(8100, 9999)}-${r.entre(1000, 9999)}`;

/** PDF de uma página com o texto dado, para a demonstração ter um contrato anexado de verdade. */
function pdfSimples(linhas) {
  const esc = s => s.replace(/[\\()]/g, m => '\\' + m).normalize('NFD').replace(/[̀-ͯ]/g, '');
  const conteudo = ['BT', '/F1 13 Tf', '60 780 Td', '18 TL']
    .concat(linhas.map((l, i) => `${i ? 'T* ' : ''}(${esc(l)}) Tj`)).concat(['ET']).join('\n');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(conteudo)} >>\nstream\n${conteudo}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ];
  let pdf = '%PDF-1.4\n';
  const pos = [];
  objs.forEach((o, i) => { pos.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${pos.map(p => String(p).padStart(10, '0') + ' 00000 n \n').join('')}`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

/* ================================================================ gerador */

async function gerarDemo(tx, parqueId, agora) {
  const hoje = D.diaDe(agora);
  const r = sorteador(Number(hoje.replace(/-/g, '')));
  const nomeComplexo = ((await tx.query('select nome from parques where id = $1', [parqueId])).rows[0] || {}).nome || 'Complexo';
  const config = completar(Object.assign({}, PADRAO, { cidade: 'Fortaleza, CE', cnpj: '12.345.678/0001-90', telefone: '(85) 3333-2100' }));
  const taxas = config.taxas;
  const inicio = `${D.somarMeses(D.mesDe(hoje), -1)}-01`;
  const recepcao = USUARIOS_DEMO[1].nome;
  const monitor = USUARIOS_DEMO[2].nome;

  const prox = {};
  for (const t of TABELAS) {
    const m = await tx.query(`select coalesce(max(id), 0) + 1 as n from ${t}`);
    prox[t] = Number(m.rows[0].n);
  }
  const novoId = t => prox[t]++;
  const linhas = {};
  TABELAS.forEach(t => { linhas[t] = []; });
  const add = (t, obj) => { const o = Object.assign({ id: novoId(t), parque_id: parqueId }, obj); linhas[t].push(o); return o; };

  const lancar = (ls, { origem, id, em, mes }) => {
    C.conferir(ls).forEach(l => add('lancamentos', {
      em, mes: mes || D.mesDe(em), conta: l.conta, debito: l.debito, credito: l.credito, historico: l.historico, origem_tipo: origem, origem_id: id
    }));
  };
  const receber = ({ area, origem, id, descricao, valor, forma, creditos, em, caixaId = null, por = recepcao }) => {
    const taxa = C.taxaDaForma(valor, forma, taxas);
    lancar(C.recebimento({ valor, forma, taxa, creditos, historico: descricao }), { origem, id, em });
    add('movimentos', { em, sentido: 'entrada', area, origem_tipo: origem, origem_id: id, descricao, forma, valor, taxa, caixa_id: caixaId, por });
    return taxa;
  };
  const pagar = ({ area, origem, id, descricao, valor, forma, debito, em }) => {
    lancar(C.pagamento({ valor, forma, debito, historico: descricao }), { origem, id, em });
    add('movimentos', { em, sentido: 'saida', area, origem_tipo: origem, origem_id: id, descricao, forma, valor, taxa: 0, caixa_id: null, por: USUARIOS_DEMO[0].nome });
  };
  const hora = (dia, h, m = 0) => `${dia}T${D.pad(h)}:${D.pad(m)}:00`;
  const jaAconteceu = em => em <= agora;

  /* --------------------------------------------------------- cadastros */

  const produtos = [
    ['loja', 'Raquete de beach tennis Pro', 'Raquetes', 28900, 4, 2],
    ['loja', 'Raquete de beach tennis Iniciante', 'Raquetes', 15900, 7, 2],
    ['loja', 'Bola de beach tennis (tubo com 3)', 'Bolas', 4900, 18, 6],
    ['loja', 'Viseira esportiva', 'Acessórios', 3900, 2, 3],
    ['loja', 'Garrafa térmica 750 ml', 'Acessórios', 5900, 11, 3],
    ['loja', 'Água mineral 500 ml', 'Bebidas', 500, 86, 24],
    ['loja', 'Isotônico', 'Bebidas', 900, 34, 12],
    ['ingresso', 'Day use adulto', 'Day use', 3000, 0, 0],
    ['ingresso', 'Day use criança', 'Day use', 2000, 0, 0],
    ['ingresso', 'Day use família (2 adultos e 2 crianças)', 'Day use', 8000, 0, 0]
  ].map(([tipo, nome, categoria, preco, estoque, minimo]) => add('produtos', {
    tipo, nome, categoria, preco, controla_estoque: tipo === 'loja', estoque, estoque_minimo: minimo, ativo: true, criado_em: hora(inicio, 9)
  }));

  const quadras = [
    ['Quadra 1', 'Beach tennis', 12000], ['Quadra 2', 'Beach tennis', 12000], ['Quadra 3', 'Futevôlei', 10000], ['Quadra 4', 'Society', 18000]
  ].map(([nome, modalidade, preco], i) => add('quadras', { nome, modalidade, preco_hora: preco, ativa: true, ordem: i + 1 }));

  const unidades = [
    ['01', 'conteiner', 24], ['02', 'conteiner', 18], ['03', 'conteiner', 24], ['04', 'conteiner', 18],
    ['05', 'conteiner', 24], ['06', 'conteiner', 18], ['07', 'conteiner', 24], ['08', 'conteiner', 18],
    ['Q1', 'quiosque', 9], ['Q2', 'quiosque', 9]
  ].map(([numero, tipo, area]) => add('unidades', { numero, tipo, area, observacao: '', ativa: true }));
  const unidade = n => unidades.find(u => u.numero === n);

  // [box, locatário, atividade, responsável, aluguel, dia, início, fim, caução, situação]
  const contratos = [
    ['01', 'Forno a Lenha Pizzaria', 'Pizzaria', 'Ricardo Lima', 420000, 5, '2025-03-01', '2027-02-28', 840000, 'em_dia'],
    ['02', 'Açaí da Praça', 'Açaíteria', 'Helena Dias', 280000, 10, '2025-06-01', '2027-05-31', 0, 'em_dia'],
    ['03', 'Smash Burger Co.', 'Hamburgueria', 'Marina Alves', 390000, 5, '2025-05-01', '2027-04-30', 780000, 'inadimplente'],
    ['04', 'Pastelaria do Zé', 'Pastelaria', 'José Ribamar', 320000, 15, '2025-08-01', '2027-07-31', 0, 'em_dia'],
    ['05', 'Japa Express', 'Comida japonesa', 'Kenji Sato', 360000, 10, '2024-12-01', D.somarDias(hoje, 20), 720000, 'em_dia'],
    ['06', 'Gelato Mio', 'Sorveteria', 'Camila Rocha', 290000, 10, '2025-09-01', '2027-08-31', 0, 'atrasado'],
    ['08', 'Espetinho do Cearense', 'Espetaria', 'Antônio Bezerra', 310000, 5, '2025-04-01', '2027-03-31', 620000, 'em_dia'],
    ['Q1', 'Café Grão Nobre', 'Cafeteria', 'Fernanda Luz', 180000, 15, `${D.mesDe(inicio)}-10`, null, 360000, 'novo']
  ].map(([n, locatario, atividade, responsavel, valor, dia, ini, fim, caucao, situacao]) => {
    const novo = situacao === 'novo';
    const c = add('contratos', {
      unidade_id: unidade(n).id, locatario, atividade, documento: `${r.entre(10, 99)}.${r.entre(100, 999)}.${r.entre(100, 999)}/0001-${r.entre(10, 99)}`,
      responsavel, telefone: telefone(r), email: `contato@${locatario.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')}.com.br`,
      valor, dia_vencimento: dia, inicio: ini, fim, caucao, caucao_status: caucao ? 'recebida' : 'nao_ha',
      reajuste: 'IPCA a cada 12 meses', observacoes: 'Energia por medidor individual, cobrada à parte.', status: 'ativo', encerrado_em: null,
      criado_em: novo ? hora(ini, 10) : hora(inicio, 8)
    });
    c.numero = n;
    c.situacao = situacao;
    // Caução de contratos antigos entrou antes do sistema; a do contrato novo entra no dia da assinatura.
    if (caucao && novo) receber({ area: 'caucao', origem: 'caucao', id: c.id, descricao: `Caução do box ${n}: ${locatario}`, valor: caucao, forma: 'transferencia', creditos: [{ conta: 'caucoes', valor: caucao }], em: hora(ini, 10, 30), por: USUARIOS_DEMO[0].nome });
    else if (caucao) lancar(C.reconhecimento('bancos', 'caucoes', caucao, `Caução recebida antes do sistema: box ${n}`), { origem: 'caucao', id: c.id, em: hora(inicio, 8) });
    return c;
  });

  const anexo = pdfSimples([
    'CONTRATO DE LOCACAO DE ESPACO COMERCIAL', '',
    'Locador: complexo de lazer (demonstracao)', 'Locataria: Forno a Lenha Pizzaria', 'Objeto: Box 01, conteiner de 24 m2',
    'Aluguel mensal: R$ 4.200,00, vencimento todo dia 5', 'Prazo: 01/03/2025 a 28/02/2027', 'Caucao: R$ 8.400,00', 'Reajuste: IPCA a cada 12 meses', '',
    'Documento ficticio criado para a demonstracao do sistema.'
  ]);
  add('anexos', { dono_tipo: 'contrato', dono_id: contratos[0].id, nome: 'Contrato de locação - Box 01.pdf', mime: 'application/pdf', tamanho: anexo.length, conteudo: '\\x' + anexo.toString('hex'), enviado_por: USUARIOS_DEMO[0].nome, criado_em: hora(inicio, 9) });

  /* ----------------------------------------- aluguéis, contas e eventos */

  const meses = [D.mesDe(inicio), D.mesDe(hoje)];
  const cobrancas = [];
  for (const mes of meses) {
    for (const c of contratos) {
      if (!R.contratoVigenteNoMes(c, mes) || mes < D.mesDe(c.criado_em)) continue;
      const venc = D.diaNoMes(mes, c.dia_vencimento);
      const cob = add('cobrancas', {
        contrato_id: c.id, tipo: 'aluguel', descricao: `Aluguel de ${new Date(`${mes}-15T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })}`,
        competencia: mes, valor: c.valor, vencimento: venc, status: 'aberta', pago_em: null, valor_pago: null, forma: null, criado_em: hora(`${mes}-01`, 0)
      });
      lancar(C.reconhecimento('alugueis_receber', 'receita_alugueis', c.valor, `Aluguel ${mes}: box ${c.numero}, ${c.locatario}`), { origem: 'cobranca', id: cob.id, em: hora(`${mes}-01`, 0), mes });
      cobrancas.push({ cob, c, atraso: c.situacao === 'inadimplente' ? null : c.situacao === 'atrasado' && mes === D.mesDe(hoje) ? null : r.entre(-3, 2) });
    }
    for (const n of ['01', '03', '04']) {
      const c = contratos.find(x => x.numero === n);
      const valor = r.entre(380, 620) * 100;
      const venc = `${mes}-25`;
      const criado = hora(`${mes}-18`, 9);
      if (!jaAconteceu(criado)) continue;
      const cob = add('cobrancas', { contrato_id: c.id, tipo: 'avulsa', descricao: 'Energia do box (medidor)', competencia: mes, valor, vencimento: venc, status: 'aberta', pago_em: null, valor_pago: null, forma: null, criado_em: criado });
      lancar(C.reconhecimento('alugueis_receber', 'receita_cobrancas', valor, `Energia do box (medidor): box ${n}, ${c.locatario}`), { origem: 'cobranca', id: cob.id, em: criado, mes });
      cobrancas.push({ cob, c, atraso: c.situacao === 'inadimplente' ? null : r.entre(-2, 3) });
    }
  }
  // Recebimentos dos aluguéis: quem paga em dia paga perto do vencimento; o inadimplente não pagou.
  cobrancas.forEach(({ cob, c, atraso }) => {
    if (atraso == null) return;
    const dia = D.somarDias(cob.vencimento, atraso);
    const em = hora(dia, 10, r.entre(0, 59));
    if (!jaAconteceu(em)) return;
    const forma = r.pesado([['pix', 6], ['transferencia', 4]]);
    receber({ area: 'alugueis', origem: 'cobranca', id: cob.id, descricao: `${cob.descricao}: box ${c.numero}, ${c.locatario}`, valor: cob.valor, forma, creditos: [{ conta: 'alugueis_receber', valor: cob.valor }], em, por: USUARIOS_DEMO[0].nome });
    Object.assign(cob, { status: 'paga', pago_em: em, valor_pago: cob.valor, forma });
  });

  // [categoria, descrição, valor, dia, fornecedor, CNPJ, tipo de documento]
  const despesas = [
    ['folha', 'Folha de pagamento e encargos', 2140000, 5, 'Equipe do complexo', '', 'folha'],
    ['limpeza', 'Limpeza e segurança terceirizadas', 520000, 10, 'Prime Serviços', '23.415.887/0001-04', 'nota_fiscal'],
    ['energia', 'Energia das áreas comuns', 785000, 12, 'Concessionária de energia', '11.222.333/0001-81', 'fatura'],
    ['agua', 'Água e esgoto', 148000, 15, 'Companhia de água e esgoto', '22.333.444/0001-72', 'fatura'],
    ['impostos', 'Impostos do mês (Simples Nacional)', 360000, 20, 'Simples Nacional (DAS)', '', 'guia'],
    ['manutencao', 'Manutenção das quadras e do parque', 210000, 21, 'Areia & Rede Manutenção', '34.556.778/0001-90', 'nota_fiscal'],
    ['marketing', 'Anúncios nas redes sociais', 150000, 25, 'Agência Digital Litoral', '45.667.889/0001-23', 'nota_fiscal']
  ];
  const TITULOS = { nota_fiscal: 'NOTA FISCAL DE SERVICOS ELETRONICA - NFS-e', fatura: 'FATURA DE CONSUMO', guia: 'DOCUMENTO DE ARRECADACAO DO SIMPLES NACIONAL', folha: 'RESUMO DA FOLHA DE PAGAMENTO' };
  const valorTexto = c => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const anexar = (conta, nome, mime, conteudo) => add('anexos', {
    dono_tipo: 'conta', dono_id: conta.id, nome, mime, tamanho: conteudo.length, conteudo: '\\x' + conteudo.toString('hex'),
    enviado_por: USUARIOS_DEMO[0].nome, criado_em: conta.criado_em
  });
  // Notas que ficam faltando de propósito, para a demonstração mostrar o aviso e o anexo.
  const faltando = new Set([`marketing|${meses[0]}`, `manutencao|${meses[1]}`]);
  for (const mes of meses) {
    despesas.forEach(([categoria, descricao, base, dia, pessoa, cnpj, tipo]) => {
      const valor = categoria === 'energia' || categoria === 'agua' ? Math.round(base * (0.9 + r() * 0.2) / 100) * 100 : base;
      const venc = `${mes}-${D.pad(dia)}`;
      const criado = hora(`${mes}-01`, 8);
      const numero = tipo === 'nota_fiscal' || tipo === 'fatura' ? String(r.entre(10000, 99999)) : '';
      const conta = add('contas', {
        sentido: 'pagar', descricao, categoria, pessoa, valor, vencimento: venc, competencia: mes, status: 'aberta', pago_em: null, forma: null,
        criado_em: criado, criado_por: USUARIOS_DEMO[0].nome, documento_tipo: tipo, documento_numero: numero, pessoa_documento: cnpj, justificativa: ''
      });
      lancar(C.reconhecimento(C.CATEGORIAS_DESPESA[categoria], 'contas_pagar', valor, descricao), { origem: 'conta', id: conta.id, em: criado, mes });
      const em = hora(venc, 9, 30);
      if (jaAconteceu(em)) {
        pagar({ area: 'despesas', origem: 'conta', id: conta.id, descricao, valor, forma: 'transferencia', debito: 'contas_pagar', em });
        Object.assign(conta, { status: 'paga', pago_em: em, forma: 'transferencia' });
      }
      if (faltando.has(`${categoria}|${mes}`)) return;
      const pdf = pdfSimples([
        `${TITULOS[tipo]} (DEMONSTRACAO)`, '',
        `Emitente: ${pessoa}`, cnpj ? `CNPJ: ${cnpj}` : '', `Tomador: ${nomeComplexo}`,
        numero ? `Numero: ${numero}` : '', `Competencia: ${mes.slice(5, 7)}/${mes.slice(0, 4)}`,
        `Descricao: ${descricao}`, `Valor: ${valorTexto(valor)}`, `Vencimento: ${venc.split('-').reverse().join('/')}`, '',
        'Documento ficticio gerado para a demonstracao do sistema.'
      ].filter(l => l !== null));
      anexar(conta, `${{ nota_fiscal: 'NFS-e', fatura: 'Fatura', guia: 'DAS', folha: 'Folha' }[tipo]} ${numero || mes} - ${pessoa}.pdf`, 'application/pdf', pdf);
    });
  }
  // Compra de mercadoria para a loja, com a NF-e em PDF e em XML, e uma receita avulsa de patrocínio.
  [['Compra: 6× Raquete de beach tennis Pro', 104000, `${D.mesDe(inicio)}-08`, 'Raquete de beach tennis Pro', 6], ['Compra: 48× Bola de beach tennis (tubo com 3)', 115200, `${D.mesDe(hoje)}-03`, 'Bola de beach tennis (tubo com 3)', 48]].forEach(([descricao, valor, dia, produto, qtd]) => {
    const em = hora(dia, 11);
    if (!jaAconteceu(em)) return;
    const numero = String(r.entre(100000, 999999));
    const conta = add('contas', {
      sentido: 'pagar', descricao, categoria: 'compras', pessoa: 'Beach Pro Distribuidora', valor, vencimento: dia, competencia: D.mesDe(dia),
      status: 'paga', pago_em: em, forma: 'pix', criado_em: em, criado_por: USUARIOS_DEMO[0].nome,
      documento_tipo: 'nota_fiscal', documento_numero: numero, pessoa_documento: '56.778.990/0001-12', justificativa: ''
    });
    lancar(C.reconhecimento('despesa_compras', 'contas_pagar', valor, descricao), { origem: 'conta', id: conta.id, em });
    pagar({ area: 'despesas', origem: 'conta', id: conta.id, descricao, valor, forma: 'pix', debito: 'contas_pagar', em });
    const chave = `23${dia.slice(2, 4)}${dia.slice(5, 7)}56778990000112550010${numero.padStart(9, '0')}1${String(r.entre(10000000, 99999999))}`.slice(0, 44).padEnd(44, '0');
    const xml = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><NFe><infNFe Id="NFe${chave}" versao="4.00"><ide><cUF>23</cUF><natOp>VENDA DE MERCADORIA</natOp><mod>55</mod><serie>1</serie><nNF>${numero}</nNF><dhEmi>${dia}T10:30:00-03:00</dhEmi></ide><emit><CNPJ>56778990000112</CNPJ><xNome>BEACH PRO DISTRIBUIDORA LTDA (DEMONSTRACAO)</xNome><xFant>Beach Pro Distribuidora</xFant></emit><dest><xNome>${nomeComplexo}</xNome></dest><det nItem="1"><prod><cProd>BT-${qtd}</cProd><xProd>${produto}</xProd><qCom>${qtd}.0000</qCom><vProd>${(valor / 100).toFixed(2)}</vProd></prod></det><total><ICMSTot><vNF>${(valor / 100).toFixed(2)}</vNF></ICMSTot></total></infNFe></NFe></nfeProc>`, 'utf8');
    anexar(conta, `NF-e ${numero} - Beach Pro Distribuidora.xml`, 'application/xml', xml);
    anexar(conta, `DANFE NF-e ${numero} - Beach Pro Distribuidora.pdf`, 'application/pdf', pdfSimples([
      'DANFE - DOCUMENTO AUXILIAR DA NF-e (DEMONSTRACAO)', '', 'Emitente: Beach Pro Distribuidora LTDA', 'CNPJ: 56.778.990/0001-12',
      `Destinatario: ${nomeComplexo}`, `NF-e numero ${numero}, serie 1`, `Produto: ${qtd} x ${produto}`, `Valor total: ${valorTexto(valor)}`, '',
      'Documento ficticio gerado para a demonstracao do sistema.'
    ]));
  });
  {
    const em = hora(`${D.mesDe(inicio)}-15`, 14);
    const conta = add('contas', {
      sentido: 'receber', descricao: 'Patrocínio: placa na quadra 1', categoria: 'outras', pessoa: 'Arena Sports', valor: 120000, vencimento: D.diaDe(em), competencia: D.mesDe(em),
      status: 'paga', pago_em: em, forma: 'pix', criado_em: em, criado_por: USUARIOS_DEMO[0].nome, documento_tipo: 'nota_fiscal', documento_numero: '', pessoa_documento: '', justificativa: ''
    });
    lancar(C.reconhecimento('contas_receber', 'receita_outras', 120000, conta.descricao), { origem: 'conta', id: conta.id, em });
    receber({ area: 'outras', origem: 'conta', id: conta.id, descricao: conta.descricao, valor: 120000, forma: 'pix', creditos: [{ conta: 'contas_receber', valor: 120000 }], em, por: USUARIOS_DEMO[0].nome });
  }

  // [título, tipo, contratante, dias a partir de hoje, espaço, convidados, valor, sinal, situação]
  const eventos = [
    ['Aniversário do Theo, 5 anos', 'aniversario', 'Patrícia Nogueira', -38, 'Salão de festas', 40, 320000, 100000, 'realizado'],
    ['Confraternização Construtora Atlântico', 'corporativo', 'Construtora Atlântico', -29, 'Quiosque gourmet', 80, 680000, 200000, 'realizado'],
    ['Aniversário da Helena, 7 anos', 'aniversario', 'Renato Costa', -9, 'Área kids', 45, 295000, 150000, 'realizado'],
    ['Aniversário do Miguel, 10 anos', 'aniversario', 'Juliana Freitas', 4, 'Salão de festas', 50, 420000, 150000, 'confirmado'],
    ['Festa da Escola Pequeno Príncipe', 'confraternizacao', 'Escola Pequeno Príncipe', 12, 'Área kids', 120, 950000, 300000, 'confirmado'],
    ['Torneio de beach tennis da Associação', 'esportivo', 'Associação Beach Ceará', 19, 'Quiosque gourmet', 60, 540000, 180000, 'confirmado'],
    ['Aniversário da Sofia, 6 anos', 'aniversario', 'Aline Teixeira', 26, 'Salão de festas', 35, 280000, 100000, 'orcamento'],
    ['Chá revelação da família Nunes', 'outro', 'Bruno Nunes', 8, 'Quiosque gourmet', 30, 180000, 60000, 'cancelado']
  ];
  eventos.forEach(([titulo, tipo, contratante, dias, espaco, convidados, valor, sinal, status]) => {
    const dataEvento = D.somarDias(hoje, dias);
    const criado = hora(D.somarDias(dataEvento, -r.entre(20, 35)), 15);
    const e = add('eventos', {
      titulo, tipo, contratante, telefone: telefone(r), email: '', data: dataEvento, inicio: tipo === 'corporativo' ? '19:00' : '15:00', fim: tipo === 'corporativo' ? '23:00' : '19:00',
      espaco, convidados, valor, sinal, itens: 'Espaço reservado por 4 horas, mesas e cadeiras, acesso ao parque infantil para os convidados, 1 hora de quadra.',
      observacoes: '', status, motivo: status === 'cancelado' ? 'Família mudou a data para outro mês' : null, criado_em: criado
    });
    if (status === 'orcamento' || status === 'cancelado') return;
    const emSinal = hora(D.diaDe(criado), 16);
    if (jaAconteceu(emSinal)) receber({ area: 'eventos', origem: 'evento', id: e.id, descricao: `Evento: ${titulo}`, valor: sinal, forma: 'pix', creditos: [{ conta: 'receita_eventos', valor: sinal }], em: emSinal, por: USUARIOS_DEMO[0].nome });
    const emSaldo = hora(dataEvento, 14);
    if (status === 'realizado' && jaAconteceu(emSaldo)) receber({ area: 'eventos', origem: 'evento', id: e.id, descricao: `Evento: ${titulo}`, valor: valor - sinal, forma: r.um(['pix', 'credito']), creditos: [{ conta: 'receita_eventos', valor: valor - sinal }], em: emSaldo, por: USUARIOS_DEMO[0].nome });
  });

  /* ----------------------------------------------------------- reservas */

  const fixos = [
    { quadra: 0, dias: [1, 3], inicio: '19:00', fim: '20:30', cliente: 'Turma do Beach (prof. André)' },
    { quadra: 3, dias: [4], inicio: '20:00', fim: '21:00', cliente: 'Pelada dos Amigos' },
    { quadra: 1, dias: [6], inicio: '08:00', fim: '10:00', cliente: 'Clínica de beach tennis' }
  ];
  const ocupado = new Map();
  const livre = (q, dia, ini, fim) => !(ocupado.get(`${q}|${dia}`) || []).some(x => R.sobrepoe(x, { inicio: ini, fim }));
  const reservar = (qi, dia, ini, fim, cliente, grupo) => {
    const q = quadras[qi];
    if (!livre(qi, dia, ini, fim)) return null;
    const minutos = D.paraMinutos(fim) - D.paraMinutos(ini);
    const res = add('reservas', {
      quadra_id: q.id, data: dia, inicio: ini, fim, cliente, telefone: telefone(r), valor: R.valorDaReserva(q.preco_hora, minutos),
      status: 'reservada', grupo, pago_em: null, forma: null, taxa: 0, caixa_id: null, criado_em: hora(D.somarDias(dia, -r.entre(1, 6)), 12), criado_por: recepcao, motivo: null
    });
    if (!ocupado.has(`${qi}|${dia}`)) ocupado.set(`${qi}|${dia}`, []);
    ocupado.get(`${qi}|${dia}`).push({ inicio: ini, fim });
    res.quadraNome = q.nome;
    return res;
  };
  const ultimoDia = D.somarDias(hoje, 14);
  for (let dia = inicio; dia <= ultimoDia; dia = D.somarDias(dia, 1)) {
    const sem = D.diaDaSemana(dia);
    fixos.forEach((f, i) => { if (f.dias.includes(sem)) reservar(f.quadra, dia, f.inicio, f.fim, f.cliente, `fixo${i}`); });
    const fimDeSemana = sem === 0 || sem === 6;
    const futuro = dia > hoje;
    const quantas = futuro ? r.entre(1, 4) : fimDeSemana ? r.entre(8, 12) : r.entre(4, 8);
    for (let n = 0; n < quantas; n += 1) {
      const qi = r.entre(0, 3);
      const h = fimDeSemana ? r.entre(8, 19) : r.entre(16, 21);
      const dur = r.pesado([[60, 6], [90, 3], [120, 2]]);
      const ini = `${D.pad(h)}:${r() < 0.5 ? '00' : '30'}`;
      const fimMin = D.paraMinutos(ini) + dur;
      if (fimMin > 22 * 60) continue;
      reservar(qi, dia, ini, D.deMinutos(fimMin), r.um(CLIENTES_QUADRA), null);
    }
  }

  /* ------------------------------------------- operação de cada dia */

  for (let dia = inicio; dia <= hoje; dia = D.somarDias(dia, 1)) {
    const ehHoje = dia === hoje;
    const sem = D.diaDaSemana(dia);
    const fimDeSemana = sem === 0 || sem === 6;
    const abertura = ehHoje && agora < hora(dia, 8, 30) ? D.somarMinutos(agora, -30) : hora(dia, 8, 30);
    const caixa = add('caixas', { aberto_em: abertura, aberto_por: recepcao, fundo: 20000, fechado_em: null, fechado_por: null, esperado: null, contado: null, diferenca: null, observacao: '' });
    lancar(C.reconhecimento('caixa', 'bancos', 20000, 'Troco colocado na gaveta ao abrir o caixa'), { origem: 'caixa', id: caixa.id, em: abertura });
    const ops = [];

    // Pulseiras do parque: entrada e saída de cada criança.
    const criancas = fimDeSemana ? r.entre(34, 52) : r.entre(16, 28);
    for (let n = 0; n < criancas; n += 1) {
      const plano = r.pesado([[config.parque.planos[0], 2], [config.parque.planos[1], 4], [config.parque.planos[2], 2.5], [config.parque.planos[3], 1.5]]);
      const entrada = hora(dia, r.entre(9, 19), r.entre(0, 59));
      const fica = plano.minutos == null ? r.entre(120, 300) : plano.minutos + r.pesado([[-r.entre(1, 10), 6], [r.entre(1, 5), 2], [r.entre(6, 35), 2]]);
      ops.push({ em: entrada, tipo: 'entrada', plano, saida: D.somarMinutos(entrada, Math.max(10, fica)) });
    }
    // Hoje, há crianças dentro do parque agora, entradas há poucos minutos.
    if (ehHoje) {
      for (let n = 0; n < r.entre(9, 12); n += 1) {
        const plano = r.pesado([[config.parque.planos[1], 4], [config.parque.planos[2], 3], [config.parque.planos[3], 1], [config.parque.planos[0], 1]]);
        const atras = plano.minutos == null ? r.entre(20, 140) : r.entre(4, Math.min(plano.minutos + 12, 125));
        ops.push({ em: D.somarMinutos(agora, -atras), tipo: 'entrada', plano, saida: '9999-12-31T00:00:00' });
      }
    }
    // Vendas do PDV: bebidas o dia todo, day use, e de vez em quando raquete e bola.
    const vendas = fimDeSemana ? r.entre(22, 34) : r.entre(10, 18);
    for (let n = 0; n < vendas; n += 1) ops.push({ em: hora(dia, r.entre(9, 21), r.entre(0, 59)), tipo: 'venda' });
    // Reservas de quadra pagas na hora do jogo; algumas ficam para pagar depois.
    linhas.reservas.filter(x => x.data === dia).forEach(res => {
      const em = `${dia}T${res.inicio}:00`;
      if (r() < (res.grupo ? 0.99 : 0.975)) ops.push({ em, tipo: 'reserva', res });
    });
    if (fimDeSemana || r() < 0.4) ops.push({ em: hora(dia, 17, 10), tipo: 'sangria' });

    ops.sort((a, b) => (a.em < b.em ? -1 : a.em > b.em ? 1 : 0));
    const entradas = [];
    for (const op of ops) {
      if (!jaAconteceu(op.em)) continue;
      if (op.tipo === 'entrada') {
        const forma = r.pesado([['pix', 45], ['credito', 20], ['debito', 20], ['dinheiro', 15]]);
        const nome = `${r.um(CRIANCAS)} ${r.um(SOBRENOMES)}`;
        const e = add('entradas_parque', {
          numero: linhas.entradas_parque.length + 1, crianca: nome, idade: r.entre(2, 11), responsavel: `${r.um(ADULTOS)} ${nome.split(' ').pop()}`,
          telefone: telefone(r), pulseira: String(r.entre(1, 300)).padStart(3, '0'),
          observacoes: r() < 0.12 ? r.um(['Alergia a amendoim', 'Só pode sair com a mãe', 'Usa bombinha para asma', 'Retirada autorizada: avó Lúcia']) : '',
          plano: op.plano.nome, minutos: op.plano.minutos, valor: op.plano.preco, forma, taxa: 0, entrada: op.em, saida: null,
          excedente_minutos: null, excedente_valor: 0, excedente_forma: null, excedente_taxa: 0, status: 'dentro', caixa_id: caixa.id,
          atendente: r() < 0.6 ? monitor : recepcao, motivo: null
        });
        e.taxa = receber({ area: 'parque', origem: 'entrada', id: e.id, descricao: `Pulseira ${op.plano.nome}: ${nome}`, valor: op.plano.preco, forma, creditos: [{ conta: 'receita_parque', valor: op.plano.preco }], em: op.em, caixaId: caixa.id, por: e.atendente });
        entradas.push({ e, saida: op.saida });
      } else if (op.tipo === 'venda') {
        const pedido = r.pesado([['bebida', 6], ['dayuse', 3], ['bola', 1], ['raquete', 0.35], ['acessorio', 0.6]]);
        const escolher = nome => produtos.find(p => p.nome.startsWith(nome));
        let itens;
        if (pedido === 'bebida') itens = [[escolher(r.um(['Água', 'Água', 'Isotônico'])), r.entre(1, 3)]];
        else if (pedido === 'dayuse') itens = r() < 0.3 ? [[escolher('Day use família'), 1]] : [[escolher('Day use adulto'), r.entre(1, 3)], [escolher('Day use criança'), r.entre(0, 2)]];
        else if (pedido === 'bola') itens = [[escolher('Bola'), r.entre(1, 2)]];
        else if (pedido === 'raquete') itens = [[escolher(r.um(['Raquete de beach tennis Pro', 'Raquete de beach tennis Iniciante'])), 1], [escolher('Bola'), 1]];
        else itens = [[escolher(r.um(['Viseira', 'Garrafa'])), 1]];
        itens = itens.filter(([, q]) => q > 0).map(([p, qtd]) => ({ produtoId: p.id, nome: p.nome, tipo: p.tipo, qtd, preco: p.preco }));
        const total = itens.reduce((t, i) => t + i.preco * i.qtd, 0);
        const forma = r.pesado([['pix', 40], ['credito', 25], ['debito', 20], ['dinheiro', 15]]);
        const v = add('vendas', { numero: linhas.vendas.length + 1, caixa_id: caixa.id, em: op.em, itens, subtotal: total, desconto: 0, total, forma, taxa: 0, status: 'paga', motivo: null, vendedor: recepcao });
        const loja = itens.filter(i => i.tipo === 'loja').reduce((t, i) => t + i.preco * i.qtd, 0);
        v.taxa = receber({
          area: 'pdv', origem: 'venda', id: v.id, descricao: `Venda ${String(v.numero).padStart(4, '0')}: ${itens.map(i => `${i.qtd}× ${i.nome}`).join(', ')}`,
          valor: total, forma, creditos: [{ conta: 'receita_loja', valor: loja }, { conta: 'receita_bilheteria', valor: total - loja }], em: op.em, caixaId: caixa.id
        });
      } else if (op.tipo === 'reserva') {
        const res = op.res;
        const forma = r.pesado([['pix', 50], ['credito', 20], ['debito', 20], ['dinheiro', 10]]);
        const taxa = receber({ area: 'quadras', origem: 'reserva', id: res.id, descricao: `${res.quadraNome}: ${res.cliente} em ${dia.split('-').reverse().slice(0, 2).join('/')} às ${res.inicio}`, valor: res.valor, forma, creditos: [{ conta: 'receita_quadras', valor: res.valor }], em: op.em, caixaId: caixa.id });
        Object.assign(res, { status: 'paga', pago_em: op.em, forma, taxa, caixa_id: caixa.id });
      } else if (op.tipo === 'sangria') {
        add('movimentos_caixa', { caixa_id: caixa.id, tipo: 'sangria', valor: 30000, nota: 'Levado ao cofre', em: op.em, por: recepcao });
        lancar(C.reconhecimento('bancos', 'caixa', 30000, 'Retirada do caixa: Levado ao cofre'), { origem: 'caixa', id: caixa.id, em: op.em });
      }
      // Saídas do parque que aconteceram até este momento.
      entradas.filter(x => x.e.status === 'dentro' && x.saida <= op.em).forEach(x => sair(x));
    }
    entradas.filter(x => x.e.status === 'dentro' && jaAconteceu(x.saida)).forEach(x => sair(x));

    function sair({ e, saida }) {
      const p = config.parque;
      const calc = R.excedenteDoParque({ entrada: e.entrada, agora: saida, minutos: e.minutos, tolerancia: p.tolerancia, bloco: p.bloco, valorBloco: p.valorBloco });
      Object.assign(e, { saida, status: 'saiu', excedente_minutos: calc.excedidos, excedente_valor: calc.valor });
      if (calc.valor > 0) {
        e.excedente_forma = e.forma;
        e.excedente_taxa = receber({ area: 'parque', origem: 'entrada', id: e.id, descricao: `Tempo excedente: ${e.crianca} (${calc.excedidos} min)`, valor: calc.valor, forma: e.forma, creditos: [{ conta: 'receita_parque', valor: calc.valor }], em: saida, caixaId: caixa.id, por: e.atendente });
      }
    }

    if (!ehHoje) {
      // Fechamento: conferido, com uma pequena diferença em alguns dias.
      const esperado = {};
      C.FORMAS.forEach(f => { esperado[f.id] = 0; });
      linhas.movimentos.filter(m => m.caixa_id === caixa.id).forEach(m => { esperado[m.forma] += m.sentido === 'entrada' ? m.valor : -m.valor; });
      esperado.dinheiro += 20000 - linhas.movimentos_caixa.filter(m => m.caixa_id === caixa.id).reduce((t, m) => t + m.valor, 0);
      const contado = Object.assign({}, esperado);
      if (r() < 0.12) contado.dinheiro -= r.um([500, 1000, 2000]);
      const diferenca = contado.dinheiro - esperado.dinheiro;
      const fecha = hora(dia, 22, 10);
      const ls = [];
      if (diferenca < 0) ls.push(...C.reconhecimento('quebra_caixa', 'caixa', -diferenca, 'Falta no fechamento do caixa (Dinheiro)'));
      if (contado.dinheiro > 0) ls.push(...C.reconhecimento('bancos', 'caixa', contado.dinheiro, 'Dinheiro recolhido no fechamento do caixa'));
      lancar(ls, { origem: 'caixa', id: caixa.id, em: fecha });
      Object.assign(caixa, { fechado_em: fecha, fechado_por: recepcao, esperado, contado, diferenca, observacao: diferenca ? 'Diferença no troco do fim da tarde.' : '' });
    }
  }

  // Campos auxiliares do gerador não são colunas: saem antes de gravar.
  for (const t of TABELAS) {
    const lista = linhas[t].map(o => {
      const c = Object.assign({}, o);
      delete c.situacao;
      delete c.quadraNome;
      if (t === 'contratos') delete c.numero;
      return c;
    });
    await inserirVarios(tx, t, lista);
    await tx.query(`select setval(pg_get_serial_sequence('${t}', 'id'), greatest((select coalesce(max(id), 0) from ${t}), 1))`);
  }
  return config;
}

/* ===================================================== ciclo da demonstração */

async function garantirUsuariosDemo(tx, parqueId, senha) {
  for (const u of USUARIOS_DEMO) {
    const existe = await tx.query('select id from usuarios where lower(email) = lower($1)', [u.email]);
    if (existe.rows[0]) {
      await tx.query('update usuarios set nome = $2, papel = $3, demo = true, ativo = true where id = $1', [existe.rows[0].id, u.nome, u.papel]);
    } else {
      await inserir(tx, 'usuarios', { parque_id: parqueId, nome: u.nome, email: u.email, senha_hash: hashSenha(senha), papel: u.papel, demo: true });
    }
  }
}

async function apagarOperacao(tx, parqueId) {
  for (const t of ['lancamentos', 'movimentos', 'anexos', 'cobrancas', 'contratos', 'unidades', 'vendas', 'movimentos_caixa', 'entradas_parque', 'reservas', 'quadras', 'eventos', 'contas', 'produtos', 'caixas']) {
    await tx.query(`delete from ${t} where parque_id = $1`, [parqueId]);
  }
}

/** Sobe quando a demonstração ganha dados novos: a de hoje se refaz no próximo ciclo. */
const VERSAO_DEMO = 1;

/** Apaga tudo do complexo e monta a demonstração de hoje, mantendo o nome e os acessos. */
async function recriarDemo(banco, { parqueId, agora, senha, somenteSeVelha = false }) {
  await banco.transacao(async tx => {
    const atual = (await tx.query('select demo_dia, demo_versao from parques where id = $1 for update', [parqueId])).rows[0];
    // Duas telas abertas na virada do dia: a segunda espera a primeira e não refaz o trabalho.
    if (somenteSeVelha && atual && atual.demo_dia === D.diaDe(agora) && atual.demo_versao === VERSAO_DEMO) return;
    await apagarOperacao(tx, parqueId);
    const config = await gerarDemo(tx, parqueId, agora);
    await tx.query(
      'update parques set config = $2, modo = $3, demo_dia = $4, demo_simulado_em = $5, demo_versao = $6 where id = $1',
      [parqueId, JSON.stringify(config), 'demo', D.diaDe(agora), agora, VERSAO_DEMO]
    );
    if (senha) await garantirUsuariosDemo(tx, parqueId, senha);
    await inserir(tx, 'historico', { parque_id: parqueId, usuario_nome: 'Sistema', acao: 'demo', resumo: 'Dados de demonstração preparados para hoje.' });
  });
}

/**
 * Mantém o parque da demonstração vivo: libera quem já passou bem do tempo e,
 * se ficou vazio, recebe novas crianças com entrada há poucos minutos.
 */
async function simularParque(banco, { parqueId, agora }) {
  await banco.transacao(async tx => {
    const ctx = await criarContexto(tx, { parqueId, usuario: { id: null, nome: USUARIOS_DEMO[2].nome, papel: 'monitor' }, agora });
    if (ctx.parque.modo !== 'demo') return;
    const r = sorteador(Number(agora.replace(/\D/g, '').slice(0, 12)));
    const dentro = (await tx.query("select * from entradas_parque where parque_id = $1 and status = 'dentro' order by entrada", [parqueId])).rows;
    let ficaram = dentro.length;
    for (const e of dentro) {
      const passou = D.minutosEntre(e.entrada, agora) - (e.minutos == null ? 240 : e.minutos);
      if (passou > 12) { await registrarSaida(ctx, e, { cobrar: true, forma: e.forma === 'dinheiro' ? 'pix' : e.forma }); ficaram -= 1; }
    }
    const planos = ctx.config.parque.planos;
    for (let n = ficaram; n < 9; n += 1) {
      const plano = r.um(planos.slice(0, 3));
      const nome = `${r.um(CRIANCAS)} ${r.um(SOBRENOMES)}`;
      await registrarEntrada(ctx, {
        crianca: nome, idade: r.entre(2, 11), responsavel: `${r.um(ADULTOS)} ${nome.split(' ').pop()}`, telefone: telefone(r),
        pulseira: String(r.entre(1, 300)).padStart(3, '0'), planoId: plano.id, forma: r.um(['pix', 'credito', 'debito'])
      }, { em: D.somarMinutos(agora, -r.entre(2, Math.min(plano.minutos, 70))) });
    }
    await tx.query('update parques set demo_simulado_em = $2 where id = $1', [parqueId, agora]);
  });
}

/** Banco vazio + SEED_DEMO: cria o complexo de demonstração. */
async function semearDemo(banco, cfg, agora) {
  const existe = await banco.query('select id from parques limit 1');
  if (existe.rows[0]) return false;
  const p = await banco.query("insert into parques (nome, modo) values ($1, 'demo') returning id", [cfg.nomeDemo || 'Complexo Central']);
  const parqueId = p.rows[0].id;
  await banco.transacao(tx => garantirUsuariosDemo(tx, parqueId, cfg.senhaDemo));
  await recriarDemo(banco, { parqueId, agora: agora(), senha: cfg.senhaDemo });
  return true;
}

module.exports = { USUARIOS_DEMO, VERSAO_DEMO, recriarDemo, simularParque, semearDemo, apagarOperacao, gerarDemo };
