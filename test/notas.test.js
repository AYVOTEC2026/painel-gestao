'use strict';

const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const { PassThrough } = require('node:stream');
const { EscritorZip, nomeDeArquivo } = require('../server/zip');
const { lerZip } = require('./ler-zip');

const NFE = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00"><NFe><infNFe Id="NFe23261012345678000195550010000048211000048217" versao="4.00">
<ide><cUF>23</cUF><natOp>Venda de mercadoria</natOp><mod>55</mod><serie>1</serie><nNF>4821</nNF><dhEmi>2026-10-14T10:32:00-03:00</dhEmi></ide>
<emit><CNPJ>12345678000195</CNPJ><xNome>Beach Pro Distribuidora de Artigos Esportivos LTDA</xNome><xFant>Beach Pro</xFant></emit>
<dest><CNPJ>98765432000110</CNPJ><xNome>Pepama Complexo de Lazer</xNome></dest>
<det nItem="1"><prod><xProd>Raquete de beach tennis Carbon 3K</xProd><qCom>6</qCom></prod></det>
<det nItem="2"><prod><xProd>Bola de beach tennis (tubo com 3)</xProd><qCom>12</qCom></prod></det>
<total><ICMSTot><vProd>3240.00</vProd><vNF>3240.00</vNF></ICMSTot></total>
<cobr><dup><nDup>001</nDup><dVenc>2026-11-13</dVenc><vDup>3240.00</vDup></dup></cobr>
</infNFe></NFe></nfeProc>`;

const NFSE_ABRASF = `<?xml version="1.0" encoding="UTF-8"?>
<CompNfse xmlns="http://www.abrasf.org.br/nfse.xsd"><Nfse versao="2.04"><InfNfse Id="nfse-981">
<Numero>981</Numero><CodigoVerificacao>A1B2-C3D4</CodigoVerificacao><DataEmissao>2026-10-20T09:00:00</DataEmissao>
<ValoresNfse><BaseCalculo>1200.00</BaseCalculo><ValorLiquidoNfse>1200.00</ValorLiquidoNfse></ValoresNfse>
<PrestadorServico><IdentificacaoPrestador><CpfCnpj><Cnpj>11222333000181</Cnpj></CpfCnpj></IdentificacaoPrestador>
<RazaoSocial>Areia &amp; Rede Manutenção Esportiva LTDA</RazaoSocial><NomeFantasia>Areia &amp; Rede</NomeFantasia><Endereco><Numero>120</Numero></Endereco></PrestadorServico>
<DeclaracaoPrestacaoServico><InfDeclaracaoPrestacaoServico><Servico><Valores><ValorServicos>1200.00</ValorServicos></Valores>
<Discriminacao>Troca da rede e nivelamento da areia da quadra 2
Material incluso</Discriminacao></Servico></InfDeclaracaoPrestacaoServico></DeclaracaoPrestacaoServico>
</InfNfse></Nfse></CompNfse>`;

const NFSE_NACIONAL = `<?xml version="1.0" encoding="UTF-8"?>
<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00"><infNFSe Id="NFS2304400233444555000166000000000005726100000000001">
<nNFSe>57</nNFSe><dhProc>2026-10-09T16:20:00-03:00</dhProc>
<emit><CNPJ>33444555000166</CNPJ><xNome>Agência Digital Litoral LTDA</xNome></emit>
<valores><vLiq>1500.00</vLiq></valores>
<DPS><infDPS><serv><cServ><xDescServ>Gestão de redes sociais em outubro</xDescServ></cServ></serv><valores><vServPrest><vServ>1500.00</vServ></vServPrest></valores></infDPS></DPS>
</infNFSe></NFSe>`;

test('NF-e de produtos: fornecedor, CNPJ, número, valor, vencimento da duplicata e itens', async () => {
  const { lerNotaFiscal } = await import('../public/js/nota-fiscal.js');
  const n = lerNotaFiscal(NFE);
  assert.strictEqual(n.modelo, 'NF-e');
  assert.strictEqual(n.tipo, 'produtos');
  assert.strictEqual(n.numero, '4821');
  assert.strictEqual(n.serie, '1');
  assert.strictEqual(n.emitente, 'Beach Pro', 'nome fantasia do emitente, não do destinatário');
  assert.strictEqual(n.razaoSocial, 'Beach Pro Distribuidora de Artigos Esportivos LTDA');
  assert.strictEqual(n.documento, '12.345.678/0001-95');
  assert.strictEqual(n.valor, 3240);
  assert.strictEqual(n.emissao, '2026-10-14');
  assert.strictEqual(n.vencimento, '2026-11-13');
  assert.strictEqual(n.descricao, 'Raquete de beach tennis Carbon 3K e mais 1 item');
  assert.strictEqual(n.chave, '23261012345678000195550010000048211000048217');
});

test('NFS-e de serviço no padrão ABRASF e no padrão nacional', async () => {
  const { lerNotaFiscal } = await import('../public/js/nota-fiscal.js');
  const a = lerNotaFiscal(NFSE_ABRASF);
  assert.strictEqual(a.modelo, 'NFS-e');
  assert.strictEqual(a.tipo, 'servicos');
  assert.strictEqual(a.numero, '981', 'número da nota, não o do endereço');
  assert.strictEqual(a.emitente, 'Areia & Rede');
  assert.strictEqual(a.documento, '11.222.333/0001-81');
  assert.strictEqual(a.valor, 1200);
  assert.strictEqual(a.emissao, '2026-10-20');
  assert.strictEqual(a.descricao, 'Troca da rede e nivelamento da areia da quadra 2');

  const b = lerNotaFiscal(NFSE_NACIONAL);
  assert.strictEqual(b.numero, '57');
  assert.strictEqual(b.emitente, 'Agência Digital Litoral LTDA');
  assert.strictEqual(b.documento, '33.444.555/0001-66');
  assert.strictEqual(b.valor, 1500);
  assert.strictEqual(b.emissao, '2026-10-09');
  assert.strictEqual(b.descricao, 'Gestão de redes sociais em outubro');
});

test('arquivo que não é nota fiscal não preenche nada', async () => {
  const { lerNotaFiscal, formatarDocumento } = await import('../public/js/nota-fiscal.js');
  assert.strictEqual(lerNotaFiscal('<html><body>oi</body></html>'), null);
  assert.strictEqual(lerNotaFiscal('%PDF-1.4'), null);
  assert.strictEqual(lerNotaFiscal(''), null);
  assert.strictEqual(lerNotaFiscal(null), null);
  assert.strictEqual(formatarDocumento('12345678901'), '123.456.789-01');
  assert.strictEqual(formatarDocumento('não informado'), 'não informado');
});

test('ZIP: nomes com acento, texto comprimido, PDF guardado como está e CRC conferido', async () => {
  const saida = new PassThrough();
  const partes = [];
  saida.on('data', p => partes.push(p));
  const zip = new EscritorZip(saida);
  const csv = '﻿descricao;valor\r\n' + 'Energia das áreas comuns;1.234,56\r\n'.repeat(400);
  const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), crypto.randomBytes(70000)]);
  await zip.adicionar('contador Pepama 2026-10/LEIA-ME.html', '<h1>Despesas de outubro</h1>');
  await zip.adicionar('contador Pepama 2026-10/despesas-2026-10.csv', csv);
  await zip.adicionar('contador Pepama 2026-10/notas/2026-10-05 - Energia - Concessionária - NF 77.pdf', pdf);
  await zip.finalizar();
  saida.end();

  const arquivos = lerZip(Buffer.concat(partes));
  assert.deepStrictEqual([...arquivos.keys()], [
    'contador Pepama 2026-10/LEIA-ME.html',
    'contador Pepama 2026-10/despesas-2026-10.csv',
    'contador Pepama 2026-10/notas/2026-10-05 - Energia - Concessionária - NF 77.pdf'
  ]);
  const planilha = arquivos.get('contador Pepama 2026-10/despesas-2026-10.csv');
  assert.strictEqual(planilha.metodo, 8, 'texto vai comprimido');
  assert.strictEqual(planilha.dados.toString('utf8'), csv);
  const nota = arquivos.get('contador Pepama 2026-10/notas/2026-10-05 - Energia - Concessionária - NF 77.pdf');
  assert.strictEqual(nota.metodo, 0, 'PDF já é comprimido');
  assert.ok(nota.dados.equals(pdf));
});

test('nome de arquivo do pacote abre em qualquer computador', () => {
  assert.strictEqual(nomeDeArquivo('Açaí & Cia / Box 3: NF 12'), 'Acai Cia Box 3 NF 12');
  assert.strictEqual(nomeDeArquivo('../../etc/senha'), '.. .. etc senha', 'sem barra, não sai da pasta');
  assert.strictEqual(nomeDeArquivo(''), 'arquivo');
  assert.ok(nomeDeArquivo('x'.repeat(300)).length <= 90);
});

