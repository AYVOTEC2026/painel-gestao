/* Conversa com o servidor. Toda alteração passa por POST em JSON na mesma origem. */

let aoPerderSessao = () => {};
export const quandoPerderSessao = fn => { aoPerderSessao = fn; };

export async function chamar(metodo, caminho, corpo) {
  let res;
  try {
    res = await fetch(caminho, {
      method: metodo,
      credentials: 'same-origin',
      headers: corpo !== undefined || metodo !== 'GET' ? { 'Content-Type': 'application/json' } : {},
      body: corpo !== undefined ? JSON.stringify(corpo) : metodo !== 'GET' ? '{}' : undefined
    });
  } catch (_) {
    throw new Error('Sem conexão com o servidor. Confira a internet e tente de novo.');
  }
  let dados = {};
  try { dados = await res.json(); } catch (_) { dados = {}; }
  if (res.status === 401 && dados.codigo === 'LOGIN') {
    aoPerderSessao();
    throw new Error(dados.erro || 'Entre novamente para continuar.');
  }
  if (!res.ok) throw new Error(dados.erro || 'Não foi possível concluir.');
  return dados;
}

export const api = {
  publico: () => chamar('GET', '/api/publico'),
  sessao: () => chamar('GET', '/api/sessao'),
  entrar: (email, senha) => chamar('POST', '/api/entrar', { email, senha }),
  sair: () => chamar('POST', '/api/sair'),
  instalar: dados => chamar('POST', '/api/instalar', dados),
  visao: mes => chamar('GET', '/api/visao' + (mes ? '?mes=' + encodeURIComponent(mes) : '')),
  acao: (nome, dados, mes) => chamar('POST', `/api/acao/${nome}` + (mes ? '?mes=' + encodeURIComponent(mes) : ''), dados || {}),
  equipe: () => chamar('GET', '/api/equipe'),
  novaPessoa: dados => chamar('POST', '/api/equipe', dados),
  alterarPessoa: (id, dados) => chamar('PATCH', `/api/equipe/${id}`, dados),
  minhaSenha: (atual, nova) => chamar('POST', '/api/minha-senha', { atual, nova }),
  operacaoReal: dados => chamar('POST', '/api/operacao-real', dados),
  exportar: (arquivo, mes) => `/api/exportar/${arquivo}?mes=${encodeURIComponent(mes)}`
};
