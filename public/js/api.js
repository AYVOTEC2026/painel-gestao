/* Conversa com o servidor. Toda alteração passa por POST em JSON na mesma origem. */

let aoPerderSessao = () => {};
export const quandoPerderSessao = fn => { aoPerderSessao = fn; };

async function responder(res) {
  let dados = {};
  try { dados = await res.json(); } catch (_) { dados = {}; }
  if (res.status === 401 && dados.codigo === 'LOGIN') {
    aoPerderSessao();
    throw new Error(dados.erro || 'Entre novamente para continuar.');
  }
  if (!res.ok) throw new Error(dados.erro || 'Não foi possível concluir.');
  return dados;
}

export async function chamar(metodo, caminho, corpo) {
  let res;
  try {
    res = await fetch(caminho, {
      method: metodo,
      credentials: 'same-origin',
      headers: metodo === 'GET' || metodo === 'DELETE' ? {} : { 'Content-Type': 'application/json' },
      body: metodo === 'GET' || metodo === 'DELETE' ? undefined : JSON.stringify(corpo || {})
    });
  } catch (_) {
    throw new Error('Sem conexão com o servidor. Confira a internet e tente de novo.');
  }
  return responder(res);
}

/** Tipo do arquivo para o servidor. XML às vezes chega sem tipo ou como text/xml. */
export function tipoDoArquivo(arquivo) {
  const ext = (arquivo.name.split('.').pop() || '').toLowerCase();
  if (ext === 'xml') return 'application/xml';
  if (arquivo.type) return arquivo.type;
  return { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[ext] || '';
}

const consulta = params => {
  const q = new URLSearchParams(Object.entries(params || {}).filter(([, v]) => v != null && v !== ''));
  return q.toString() ? `?${q}` : '';
};

export const api = {
  publico: () => chamar('GET', '/api/publico'),
  sessao: () => chamar('GET', '/api/sessao'),
  entrar: (email, senha) => chamar('POST', '/api/entrar', { email, senha }),
  sair: () => chamar('POST', '/api/sair'),
  instalar: dados => chamar('POST', '/api/instalar', dados),
  tela: (nome, params) => chamar('GET', `/api/tela/${nome}${consulta(params)}`),
  acao: (nome, dados) => chamar('POST', `/api/acao/${nome}`, dados),
  equipe: () => chamar('GET', '/api/equipe'),
  novaPessoa: dados => chamar('POST', '/api/equipe', dados),
  alterarPessoa: (id, dados) => chamar('PATCH', `/api/equipe/${id}`, dados),
  minhaSenha: (atual, nova) => chamar('POST', '/api/minha-senha', { atual, nova }),
  operacaoReal: dados => chamar('POST', '/api/operacao-real', dados),
  carregarDemo: () => chamar('POST', '/api/carregar-demo', {}),
  exportar: (arquivo, mes) => `/api/exportar/${arquivo}?mes=${encodeURIComponent(mes)}`,
  pacote: (mes, completo) => `/api/exportar-pacote?mes=${encodeURIComponent(mes)}${completo ? '&completo=1' : ''}`,
  anexo: (id, baixar) => `/api/anexos/${id}${baixar ? '?baixar=1' : ''}`,
  removerAnexo: id => chamar('DELETE', `/api/anexos/${id}`),
  async enviarAnexo(tipo, id, arquivo) {
    let res;
    try {
      res = await fetch(`/api/anexos?tipo=${tipo}&id=${id}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': tipoDoArquivo(arquivo), 'X-Arquivo-Nome': encodeURIComponent(arquivo.name) },
        body: arquivo
      });
    } catch (_) {
      throw new Error('Sem conexão com o servidor. Confira a internet e tente de novo.');
    }
    return responder(res);
  }
};
