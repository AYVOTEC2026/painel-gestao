-- Produto vendido (sai e não volta) ou alugado (sai e volta): raquete, guarda-sol, cadeira.
alter table produtos drop constraint if exists produtos_tipo_check;
alter table produtos add constraint produtos_tipo_check check (tipo in ('loja', 'ingresso', 'aluguel'));
-- Como o aluguel é cobrado. Para item de aluguel, o estoque é o que está livre na prateleira.
alter table produtos add column periodo text check (periodo in ('hora', 'dia', 'uso'));

-- Cada item alugado no PDV: quem levou, quando saiu, até quando volta e a devolução.
create table itens_alugados (
  id serial primary key,
  parque_id integer not null references parques(id) on delete cascade,
  venda_id integer not null references vendas(id),
  produto_id integer not null references produtos(id),
  nome text not null,
  qtd integer not null check (qtd > 0),
  periodos integer not null default 1 check (periodos > 0),
  cliente text not null,
  telefone text not null default '',
  saiu_em timestamp not null,
  devolver_ate timestamp,
  devolvido_em timestamp,
  recebido_por text,
  status text not null default 'fora' check (status in ('fora', 'devolvido', 'cancelado')),
  por text not null default ''
);
create index itens_alugados_fora on itens_alugados (parque_id, status);
