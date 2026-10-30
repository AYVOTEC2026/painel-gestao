'use strict';

/* Pessoas, sessões de login e histórico de quem fez o quê. */

function usuarioDaLinha(r) {
  if (!r) return null;
  return {
    id: r.id, parqueId: r.parque_id, nome: r.nome, email: r.email, senhaHash: r.senha_hash, papel: r.papel,
    ativo: r.ativo, demo: r.demo, criadoEm: r.criado_em, ultimoAcesso: r.ultimo_acesso
  };
}

function criarAcessos(db) {
  const q = (sql, params) => db.query(sql, params);
  return {
    usuarios: {
      async porEmail(email) {
        return usuarioDaLinha((await q('select * from usuarios where lower(email) = lower($1)', [email])).rows[0]);
      },
      async porId(id) {
        return usuarioDaLinha((await q('select * from usuarios where id = $1', [id])).rows[0]);
      },
      async listar(parqueId) {
        return (await q('select * from usuarios where parque_id = $1 order by ativo desc, papel, nome', [parqueId])).rows.map(usuarioDaLinha);
      },
      async demos(parqueId) {
        return (await q("select * from usuarios where parque_id = $1 and demo and ativo order by case papel when 'dono' then 0 when 'recepcao' then 1 else 2 end", [parqueId])).rows.map(usuarioDaLinha);
      },
      async criar(u) {
        try {
          const { rows } = await q(
            'insert into usuarios (parque_id, nome, email, senha_hash, papel, demo) values ($1, $2, $3, $4, $5, $6) returning *',
            [u.parqueId, u.nome, u.email, u.senhaHash, u.papel, !!u.demo]
          );
          return usuarioDaLinha(rows[0]);
        } catch (err) {
          if (err.code === '23505') throw Object.assign(new Error('Já existe uma pessoa com esse e-mail.'), { status: 409, usuario: true });
          throw err;
        }
      },
      async atualizar(id, campos) {
        const mapa = { nome: 'nome', papel: 'papel', ativo: 'ativo', senhaHash: 'senha_hash' };
        const sets = [];
        const valores = [id];
        Object.keys(mapa).forEach(chave => {
          if (campos[chave] === undefined) return;
          valores.push(campos[chave]);
          sets.push(`${mapa[chave]} = $${valores.length}`);
        });
        if (!sets.length) return null;
        return usuarioDaLinha((await q(`update usuarios set ${sets.join(', ')} where id = $1 returning *`, valores)).rows[0]);
      },
      async desativarDemos(parqueId) {
        await q('update usuarios set ativo = false where parque_id = $1 and demo', [parqueId]);
      },
      async registrarAcesso(id) {
        await q('update usuarios set ultimo_acesso = now() where id = $1', [id]);
      }
    },

    sessoes: {
      async criar(tokenHash, usuarioId, expiraEm) {
        await q('insert into sessoes (token_hash, usuario_id, expira_em) values ($1, $2, $3)', [tokenHash, usuarioId, expiraEm]);
      },
      async buscar(tokenHash) {
        return usuarioDaLinha((await q(
          'select u.* from sessoes s join usuarios u on u.id = s.usuario_id where s.token_hash = $1 and s.expira_em > now() and u.ativo',
          [tokenHash]
        )).rows[0]);
      },
      async apagar(tokenHash) {
        await q('delete from sessoes where token_hash = $1', [tokenHash]);
      },
      async apagarDoUsuario(usuarioId, excetoHash) {
        await q('delete from sessoes where usuario_id = $1 and token_hash <> $2', [usuarioId, excetoHash || '']);
      },
      async limparVencidas() {
        await q('delete from sessoes where expira_em < now()');
      }
    },

    historico: {
      async registrar(parqueId, h) {
        await q('insert into historico (parque_id, usuario_id, usuario_nome, acao, resumo) values ($1, $2, $3, $4, $5)', [parqueId, h.usuarioId || null, h.usuarioNome || '', h.acao, h.resumo]);
      },
      async listar(parqueId, limite = 60) {
        return (await q('select usuario_nome, acao, resumo, criado_em from historico where parque_id = $1 order by criado_em desc, id desc limit $2', [parqueId, limite]))
          .rows.map(r => ({ usuarioNome: r.usuario_nome, acao: r.acao, resumo: r.resumo, criadoEm: r.criado_em }));
      }
    },

    parques: {
      async primeiro() {
        return (await q('select id, nome, modo from parques order by id limit 1')).rows[0] || null;
      },
      async ler(id) {
        return (await q('select id, nome, modo, config from parques where id = $1', [id])).rows[0] || null;
      },
      async todos() {
        return (await q('select id, modo from parques')).rows;
      }
    }
  };
}

module.exports = { criarAcessos };
