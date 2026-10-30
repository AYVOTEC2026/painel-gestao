/*
 * Lê o XML de uma nota fiscal e devolve o que interessa para lançar a despesa:
 * quem emitiu, CNPJ, número, data, valor e o que foi comprado.
 * Entende a NF-e (produtos, modelo 55) e a NFS-e (serviços: padrão ABRASF usado
 * pelas prefeituras e o padrão nacional). Devolve null se não reconhecer a nota.
 */

const texto = v => String(v == null ? '' : v)
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'")
  .trim();

/** Conteúdo da primeira tag com esse nome (com ou sem prefixo de namespace). */
function tag(xml, nome) {
  const m = String(xml || '').match(new RegExp(`<(?:[\\w-]+:)?${nome}(?:\\s[^>]*)?>([^<]*)</(?:[\\w-]+:)?${nome}>`));
  return m ? texto(m[1]) : '';
}

/** O bloco inteiro de uma tag (para buscar dentro do emitente, do prestador...). */
function bloco(xml, nome) {
  const m = String(xml || '').match(new RegExp(`<(?:[\\w-]+:)?${nome}(?:\\s[^>]*)?>[\\s\\S]*?</(?:[\\w-]+:)?${nome}>`));
  return m ? m[0] : '';
}

const todos = (xml, nome) => [...String(xml || '').matchAll(new RegExp(`<(?:[\\w-]+:)?${nome}(?:\\s[^>]*)?>([^<]*)</(?:[\\w-]+:)?${nome}>`, 'g'))].map(m => texto(m[1]));
const numero = v => { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null; };
const dia = v => (/^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : '');

export function formatarDocumento(v) {
  const d = String(v || '').replace(/\D/g, '');
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  return String(v || '');
}

function resumoDosItens(itens) {
  if (!itens.length) return '';
  return itens.length === 1 ? itens[0] : `${itens[0]} e mais ${itens.length - 1} ${itens.length === 2 ? 'item' : 'itens'}`;
}

export function lerNotaFiscal(xml) {
  const conteudo = String(xml || '');
  if (!conteudo.trim().startsWith('<') && !conteudo.includes('<?xml')) return null;

  // NF-e: nota de produtos (modelo 55), a da maioria das compras de mercadoria.
  if (/<(?:[\w-]+:)?infNFe[\s>]/.test(conteudo)) {
    const ide = bloco(conteudo, 'ide');
    const emit = bloco(conteudo, 'emit');
    const total = bloco(conteudo, 'ICMSTot');
    const cobranca = bloco(conteudo, 'cobr');
    const itens = todos(conteudo, 'xProd');
    const chave = (conteudo.match(/Id="NFe(\d{44})"/) || [])[1] || tag(conteudo, 'chNFe');
    return {
      modelo: 'NF-e',
      numero: tag(ide, 'nNF'),
      serie: tag(ide, 'serie'),
      emissao: dia(tag(ide, 'dhEmi') || tag(ide, 'dEmi')),
      vencimento: dia(tag(cobranca, 'dVenc')),
      emitente: tag(emit, 'xFant') || tag(emit, 'xNome'),
      razaoSocial: tag(emit, 'xNome'),
      documento: formatarDocumento(tag(emit, 'CNPJ') || tag(emit, 'CPF')),
      valor: numero(tag(total, 'vNF')),
      descricao: resumoDosItens(itens),
      chave,
      tipo: 'produtos'
    };
  }

  // NFS-e: nota de serviço (manutenção, limpeza, marketing). Padrão ABRASF ou nacional.
  if (/<(?:[\w-]+:)?(?:CompNfse|Nfse|InfNfse|NFSe|infNFSe)[\s>]/.test(conteudo)) {
    const prestador = bloco(conteudo, 'PrestadorServico') || bloco(conteudo, 'Prestador') || bloco(conteudo, 'emit');
    const identificacao = bloco(prestador, 'IdentificacaoPrestador') || prestador;
    return {
      modelo: 'NFS-e',
      numero: tag(conteudo, 'Numero') || tag(conteudo, 'nNFSe'),
      serie: '',
      emissao: dia(tag(conteudo, 'DataEmissao') || tag(conteudo, 'dhEmi') || tag(conteudo, 'dhProc')),
      vencimento: '',
      emitente: tag(prestador, 'NomeFantasia') || tag(prestador, 'RazaoSocial') || tag(prestador, 'xNome'),
      razaoSocial: tag(prestador, 'RazaoSocial') || tag(prestador, 'xNome'),
      documento: formatarDocumento(tag(identificacao, 'Cnpj') || tag(identificacao, 'CNPJ') || tag(identificacao, 'Cpf') || tag(identificacao, 'CPF')),
      valor: numero(tag(conteudo, 'ValorServicos') || tag(conteudo, 'vServ') || tag(conteudo, 'vLiq') || tag(conteudo, 'ValorLiquidoNfse')),
      descricao: (tag(conteudo, 'Discriminacao') || tag(conteudo, 'xDescServ')).split(/\r?\n/)[0].slice(0, 120),
      chave: tag(conteudo, 'CodigoVerificacao') || tag(conteudo, 'chNFSe'),
      tipo: 'servicos'
    };
  }
  return null;
}
