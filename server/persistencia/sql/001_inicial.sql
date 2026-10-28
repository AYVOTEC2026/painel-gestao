-- Protótipo: a operação inteira do food park (boxes, cardápio, vendas, caixa, livro contábil)
-- fica em um documento JSONB por parque, alterado sempre com a linha travada (FOR UPDATE).
-- Antes de produção com volume alto, vendas e lançamentos devem ir para tabelas próprias.
create table parques (
  id serial primary key,
  nome text not null,
  estado jsonb not null,
  versao integer not null default 1,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table usuarios (
  id serial primary key,
  parque_id integer not null references parques(id) on delete cascade,
  nome text not null,
  email text not null,
  senha_hash text not null,
  papel text not null check (papel in ('dono', 'caixa')),
  ativo boolean not null default true,
  demo boolean not null default false,
  criado_em timestamptz not null default now(),
  ultimo_acesso timestamptz
);
create unique index usuarios_email_unico on usuarios (lower(email));

create table sessoes (
  token_hash text primary key,
  usuario_id integer not null references usuarios(id) on delete cascade,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null
);
create index sessoes_por_usuario on sessoes (usuario_id);

-- Quem fez o quê: cada ação que altera o food park deixa uma linha aqui.
create table historico (
  id bigserial primary key,
  parque_id integer not null references parques(id) on delete cascade,
  usuario_id integer references usuarios(id) on delete set null,
  usuario_nome text not null default '',
  acao text not null,
  resumo text not null,
  criado_em timestamptz not null default now()
);
create index historico_por_parque on historico (parque_id, criado_em desc);
