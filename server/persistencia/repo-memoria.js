'use strict';

/**
 * Mesma interface do repositório Postgres, guardada na memória do processo.
 * Usada nos testes e quando o servidor sobe sem DATABASE_URL: tudo some ao reiniciar.
 */
function criarRepoMemoria() {
  const parques = new Map();
  const usuarios = new Map();
  const sessoes = new Map();
  const historico = [];
  let seqParque = 0;
  let seqUsuario = 0;
  let fila = Promise.resolve();

  const copia = v => structuredClone(v);

  return {
    modo: 'memoria',

    async iniciar() {},
    async fechar() {},
    async saudavel() { return true; },

    async primeiroParque() {
      const primeiro = [...parques.values()][0];
      return primeiro ? { id: primeiro.id, nome: primeiro.estado.park.name } : null;
    },

    async criarParque(estado) {
      seqParque += 1;
      parques.set(seqParque, { id: seqParque, estado: copia(estado), versao: 1 });
      return seqParque;
    },

    async lerParque(id) {
      const p = parques.get(id);
      return p ? { estado: copia(p.estado), versao: p.versao } : null;
    },

    // A fila faz o papel do FOR UPDATE: uma alteração por vez.
    comParque(id, fn) {
      const tarefa = fila.then(async () => {
        const p = parques.get(id);
        if (!p) throw new Error('Food park não encontrado.');
        const saida = (await fn(copia(p.estado))) || {};
        if (saida.estado) {
          p.estado = copia(saida.estado);
          p.versao += 1;
        }
        if (saida.historico) historico.unshift({ parqueId: id, ...saida.historico, criadoEm: new Date() });
        return saida.resultado;
      });
      fila = tarefa.catch(() => {});
      return tarefa;
    },

    usuarios: {
      async contar() { return usuarios.size; },
      async porEmail(email) {
        const alvo = String(email).toLowerCase();
        const u = [...usuarios.values()].find(x => x.email.toLowerCase() === alvo);
        return u ? copia(u) : null;
      },
      async porId(id) {
        const u = usuarios.get(Number(id));
        return u ? copia(u) : null;
      },
      async listar(parqueId) {
        return [...usuarios.values()].filter(u => u.parqueId === parqueId).map(copia);
      },
      async demos(parqueId) {
        return [...usuarios.values()].filter(u => u.parqueId === parqueId && u.demo && u.ativo).map(copia);
      },
      async criar(u) {
        if (await this.porEmail(u.email)) throw Object.assign(new Error('Já existe uma pessoa com esse e-mail.'), { status: 409, usuario: true });
        seqUsuario += 1;
        const novo = { id: seqUsuario, ativo: true, demo: !!u.demo, criadoEm: new Date(), ultimoAcesso: null, ...u };
        usuarios.set(novo.id, novo);
        return copia(novo);
      },
      async atualizar(id, campos) {
        const u = usuarios.get(Number(id));
        if (!u) return null;
        Object.keys(campos).forEach(k => { if (campos[k] !== undefined) u[k] = campos[k]; });
        return copia(u);
      },
      async desativarDemos(parqueId) {
        usuarios.forEach(u => { if (u.parqueId === parqueId && u.demo) u.ativo = false; });
      },
      async registrarAcesso(id) {
        const u = usuarios.get(Number(id));
        if (u) u.ultimoAcesso = new Date();
      }
    },

    sessoes: {
      async criar(tokenHash, usuarioId, expiraEm) {
        sessoes.set(tokenHash, { usuarioId, expiraEm });
      },
      async buscar(tokenHash) {
        const s = sessoes.get(tokenHash);
        if (!s || s.expiraEm < new Date()) return null;
        const u = usuarios.get(s.usuarioId);
        return u && u.ativo ? copia(u) : null;
      },
      async apagar(tokenHash) { sessoes.delete(tokenHash); },
      async apagarDoUsuario(usuarioId, excetoHash) {
        sessoes.forEach((s, chave) => { if (s.usuarioId === usuarioId && chave !== excetoHash) sessoes.delete(chave); });
      },
      async limparVencidas() {
        const agora = new Date();
        sessoes.forEach((s, chave) => { if (s.expiraEm < agora) sessoes.delete(chave); });
      }
    },

    historico: {
      async registrar(parqueId, h) {
        historico.unshift({ parqueId, ...h, criadoEm: new Date() });
      },
      async listar(parqueId, limite = 40) {
        return historico.filter(h => h.parqueId === parqueId).slice(0, limite)
          .map(h => ({ usuarioNome: h.usuarioNome, acao: h.acao, resumo: h.resumo, criadoEm: h.criadoEm }));
      }
    }
  };
}

module.exports = { criarRepoMemoria };
