'use strict';

const fs = require('fs');
const path = require('path');
const { Pool, types } = require('pg');

// bigint e numeric viram number (valores em centavos cabem com folga).
types.setTypeParser(20, v => (v === null ? null : Number(v)));
types.setTypeParser(1700, v => (v === null ? null : Number(v)));
// timestamp sem fuso e date voltam como texto na hora local do complexo,
// no mesmo formato que o servidor grava ("2026-10-28T14:30:00").
types.setTypeParser(1114, v => (v === null ? null : v.replace(' ', 'T').slice(0, 19)));
types.setTypeParser(1082, v => v);

const TRAVA_MIGRACAO = 5310427;

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

function conectar({ url, ssl }) {
  const pool = new Pool({
    connectionString: url,
    max: Number(process.env.DATABASE_POOL) || 10,
    ssl: ssl ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 30000
  });
  pool.on('error', err => console.error('[banco] conexão ociosa caiu:', err.message));

  return {
    pool,
    query: (sql, params) => pool.query(sql, params),
    migrar: () => migrar(pool),
    fechar: () => pool.end(),
    async transacao(fn) {
      const cliente = await pool.connect();
      try {
        await cliente.query('begin');
        const resultado = await fn(cliente);
        await cliente.query('commit');
        return resultado;
      } catch (err) {
        await cliente.query('rollback').catch(() => {});
        throw err;
      } finally {
        cliente.release();
      }
    }
  };
}

const paraBanco = v => (v !== null && typeof v === 'object' && !Buffer.isBuffer(v) ? JSON.stringify(v) : v);

/** INSERT de um registro. Nomes de tabela e coluna vêm sempre do código, nunca da tela. */
async function inserir(db, tabela, dados) {
  const colunas = Object.keys(dados);
  const { rows } = await db.query(
    `insert into ${tabela} (${colunas.join(', ')}) values (${colunas.map((_, i) => '$' + (i + 1)).join(', ')}) returning *`,
    colunas.map(c => paraBanco(dados[c]))
  );
  return rows[0];
}

/** INSERT de muitos registros de uma vez (usado pela demonstração). Todos com as mesmas chaves. */
async function inserirVarios(db, tabela, lista) {
  if (!lista.length) return;
  const colunas = Object.keys(lista[0]);
  for (let i = 0; i < lista.length; i += 2000) {
    const lote = lista.slice(i, i + 2000).map(r => {
      const o = {};
      colunas.forEach(c => { o[c] = r[c] === undefined ? null : r[c]; });
      return o;
    });
    await db.query(
      `insert into ${tabela} (${colunas.join(', ')}) select ${colunas.join(', ')} from json_populate_recordset(null::${tabela}, $1)`,
      [JSON.stringify(lote)]
    );
  }
}

async function atualizar(db, tabela, id, campos) {
  const colunas = Object.keys(campos);
  if (!colunas.length) return null;
  const { rows } = await db.query(
    `update ${tabela} set ${colunas.map((c, i) => `${c} = $${i + 2}`).join(', ')} where id = $1 returning *`,
    [id].concat(colunas.map(c => paraBanco(campos[c])))
  );
  return rows[0];
}

module.exports = { conectar, inserir, inserirVarios, atualizar };
