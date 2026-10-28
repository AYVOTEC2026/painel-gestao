'use strict';

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const TRAVA_MIGRACAO = 5310427;

function usuarioDaLinha(r) {
  if (!r) return null;
  return {
    id: r.id,
    parqueId: r.parque_id,
    nome: r.nome,
    email: r.email,
    senhaHash: r.senha_hash,
    papel: r.papel,
    ativo: r.ativo,
    demo: r.demo,
    criadoEm: r.criado_em,
    ultimoAcesso: r.ultimo_acesso
  };
}

async function migrar(pool) {
  const pasta = path.join(__dirname, 'sql');
  const arquivos = fs.readdirSync(pasta).filter(f => /^\d+_.+\.sql$/.test(f)).sort();
  const cliente = await pool.connect();
  try {
    // Duas réplicas subindo juntas não aplicam a mesma migração duas vezes.
    await cliente.query('select pg_advisory_lock($1)', [TRAVA_MIGRACAO]);
    await cliente.query('create table if not exists migracoes (nome text primary key, aplicada_em timestamptz not null default now())');
    const { rows } = await cliente.query('select nome from migracoes');
    const feitas = new Set(rows.map(r => r.nome));
    for (const arquivo of arquivos) {
      if (feitas.has(arquivo)) continue;
      const sql = fs.readFileSync(path.join(pasta, arquivo), 'utf8');
      await cliente.query('begin');
      try {
        await cliente.query(sql);
        await cliente.query('insert into migracoes (nome) values ($1)', [arquivo]);
        await cliente.query('commit');
        console.log(`[banco] migração aplicada: ${arquivo}`);
      } catch (err) {
        await cliente.query('rollback').catch(() => {});
        throw new Error(`Migração ${arquivo} falhou: ${err.message}`);
      }
    }
  } finally {
    await cliente.query('select pg_advisory_unlock($1)', [TRAVA_MIGRACAO]).catch(() => {});
    cliente.release();
  }
}

function criarRepoPg({ url, ssl }) {
  const pool = new Pool({
    connectionString: url,
    max: Number(process.env.DATABASE_POOL) || 10,
    ssl: ssl ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 30000
  });
  pool.on('error', err => console.error('[banco] conexão ociosa caiu:', err.message));
  const q = (sql, params) => pool.query(sql, params);

  return {
    modo: 'postgres',

    iniciar: () => migrar(pool),
    fechar: () => pool.end(),
    async saudavel() {
      await q('select 1');
      return true;
    },

    async primeiroParque() {
      const { rows } = await q('select id, nome from parques order by id limit 1');
      return rows[0] || null;
    },

    async criarParque(estado) {
      const { rows } = await q('insert into parques (nome, estado) values ($1, $2::jsonb) returning id', [estado.park.name, JSON.stringify(estado)]);
      return rows[0].id;
    },

    async lerParque(id) {
      const { rows } = await q('select estado, versao from parques where id = $1', [id]);
      return rows[0] ? { estado: rows[0].estado, versao: rows[0].versao } : null;
    },

    /**
     * Lê o food park com a linha travada, deixa `fn` decidir o novo estado e grava tudo
     * na mesma transação. Dois caixas vendendo ao mesmo tempo entram em fila aqui.
     * `fn` devolve { estado?, historico?, resultado }.
     */
    async comParque(id, fn) {
      const cliente = await pool.connect();
      try {
        await cliente.query('begin');
        const { rows } = await cliente.query('select estado from parques where id = $1 for update', [id]);
        if (!rows[0]) throw new Error('Food park não encontrado.');
        const saida = (await fn(rows[0].estado)) || {};
        if (saida.estado) {
          await cliente.query(
            'update parques set estado = $2::jsonb, nome = $3, versao = versao + 1, atualizado_em = now() where id = $1',
            [id, JSON.stringify(saida.estado), saida.estado.park.name]
          );
        }
        if (saida.historico) {
          const h = saida.historico;
          await cliente.query(
            'insert into historico (parque_id, usuario_id, usuario_nome, acao, resumo) values ($1, $2, $3, $4, $5)',
            [id, h.usuarioId || null, h.usuarioNome || '', h.acao, h.resumo]
          );
        }
        await cliente.query('commit');
        return saida.resultado;
      } catch (err) {
        await cliente.query('rollback').catch(() => {});
        throw err;
      } finally {
        cliente.release();
      }
    },

    usuarios: {
      async contar() {
        const { rows } = await q('select count(*)::int as n from usuarios');
        return rows[0].n;
      },
      async porEmail(email) {
        const { rows } = await q('select * from usuarios where lower(email) = lower($1)', [email]);
        return usuarioDaLinha(rows[0]);
      },
      async porId(id) {
        const { rows } = await q('select * from usuarios where id = $1', [id]);
        return usuarioDaLinha(rows[0]);
      },
      async listar(parqueId) {
        const { rows } = await q('select * from usuarios where parque_id = $1 order by ativo desc, papel, nome', [parqueId]);
        return rows.map(usuarioDaLinha);
      },
      async demos(parqueId) {
        const { rows } = await q('select * from usuarios where parque_id = $1 and demo and ativo order by papel desc', [parqueId]);
        return rows.map(usuarioDaLinha);
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
        if (!sets.length) return this.porId(id);
        const { rows } = await q(`update usuarios set ${sets.join(', ')} where id = $1 returning *`, valores);
        return usuarioDaLinha(rows[0]);
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
        const { rows } = await q(
          `select u.* from sessoes s join usuarios u on u.id = s.usuario_id
           where s.token_hash = $1 and s.expira_em > now() and u.ativo`,
          [tokenHash]
        );
        return usuarioDaLinha(rows[0]);
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
        await q(
          'insert into historico (parque_id, usuario_id, usuario_nome, acao, resumo) values ($1, $2, $3, $4, $5)',
          [parqueId, h.usuarioId || null, h.usuarioNome || '', h.acao, h.resumo]
        );
      },
      async listar(parqueId, limite = 40) {
        const { rows } = await q(
          'select usuario_nome, acao, resumo, criado_em from historico where parque_id = $1 order by criado_em desc, id desc limit $2',
          [parqueId, limite]
        );
        return rows.map(r => ({ usuarioNome: r.usuario_nome, acao: r.acao, resumo: r.resumo, criadoEm: r.criado_em }));
      }
    }
  };
}

module.exports = { criarRepoPg };
