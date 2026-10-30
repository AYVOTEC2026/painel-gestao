-- O sistema passa a gerir o complexo inteiro: boxes alugados para outras empresas,
-- parque infantil por pulseira, loja e bilheteria, quadras e eventos.
-- O modelo anterior (repasse das vendas de comida dos boxes) sai: os dados dele eram
-- só de demonstração e a demonstração é recriada no novo formato.
--
-- Convenções:
--   dinheiro  -> bigint em centavos
--   data/hora -> hora local do complexo (timestamp sem fuso), como aparece na tela

alter table parques add column config jsonb not null default '{}'::jsonb;
alter table parques add column modo text not null default 'real';
alter table parques add column demo_dia date;
alter table parques add column demo_simulado_em timestamp;
update parques set modo = case when estado->>'mode' = 'demo' then 'demo' else 'real' end;
alter table parques drop column estado;
alter table parques drop column versao;
alter table parques add constraint parques_modo_check check (modo in ('demo', 'real'));

alter table usuarios drop constraint if exists usuarios_papel_check;
update usuarios set papel = 'recepcao' where papel = 'caixa';
alter table usuarios add constraint usuarios_papel_check check (papel in ('dono', 'recepcao', 'monitor'));

/* ------------------------------------------------------------- locações */

-- Contêineres, lojas e quiosques que o complexo aluga para outras empresas.
create table unidades (
  id serial primary key,
  parque_id integer not null references parques(id) on delete cascade,
  numero text not null,
  tipo text not null default 'conteiner' check (tipo in ('conteiner', 'loja', 'quiosque', 'sala')),
  area numeric(8, 2),
  observacao text not null default '',
  ativa boolean not null default true,
  unique (parque_id, numero)
);

create table contratos (
  id serial primary key,
  parque_id integer not null references parques(id) on delete cascade,
  unidade_id integer not null references unidades(id) on delete cascade,
  locatario text not null,
  atividade text not null default '',
  documento text not null default '',
  responsavel text not null default '',
  telefone text not null default '',
  email text not null default '',
  valor bigint not null check (valor >= 0),
  dia_vencimento integer not null check (dia_vencimento between 1 and 31),
  inicio date not null,
  fim date,
  caucao bigint not null default 0,
  caucao_status text not null default 'nao_ha' check (caucao_status in ('nao_ha', 'pendente', 'recebida', 'devolvida')),
  reajuste text not null default '',
  observacoes text not null default '',
  status text not null default 'ativo' check (status in ('ativo', 'encerrado')),
  encerrado_em date,
  criado_em timestamp not null
);
create unique index contrato_ativo_por_unidade on contratos (unidade_id) where status = 'ativo';

-- Aluguel de cada mês e cobranças avulsas (energia, água) feitas aos locatários.
create table cobrancas (
  id serial primary key,
  parque_id integer not null references parques(id) on delete cascade,
  contrato_id integer not null references contratos(id) on delete cascade,
  tipo text not null default 'aluguel' check (tipo in ('aluguel', 'avulsa')),
  descricao text not null,
  competencia char(7) not null,
  valor bigint not null check (valor >= 0),
  vencimento date not null,
  status text not null default 'aberta' check (status in ('aberta', 'paga', 'cancelada')),
  pago_em timestamp,
  valor_pago bigint,
  forma text,
  criado_em timestamp not null
);
create unique index aluguel_unico_no_mes on cobrancas (contrato_id, competencia) where tipo = 'aluguel' and status <> 'cancelada';
create index cobrancas_por_status on cobrancas (parque_id, status, vencimento);

-- Arquivos anexados (contrato de locação assinado, contrato de evento). Ficam no banco
-- para não depender de volume no Easypanel.
create table anexos (
  id serial primary key,
  parque_id integer not null references parques(id) on delete cascade,
  dono_tipo text not null check (dono_tipo in ('contrato', 'evento')),
  dono_id integer not null,
  nome text not null,
  mime text not null,
  tamanho integer not null,
  conteudo bytea not null,
  enviado_por text not null default '',
  criado_em timestamp not null
);
create index anexos_por_dono on anexos (dono_tipo, dono_id);

/* -------------------------------------------------------- caixa e vendas */

create table caixas (
  id serial primary key,
  parque_id integer not null references parques(id) on delete cascade,
  aberto_em timestamp not null,
  aberto_por text not null default '',
  fundo bigint not null default 0,
  fechado_em timestamp,
  fechado_por text,
  esperado jsonb,
  contado jsonb,
  diferenca bigint,
  observacao text not null default ''
);
create unique index um_caixa_aberto_por_parque on caixas (parque_id) where fechado_em is null;

create table movimentos_caixa (
  id serial primary key,
  parque_id integer not null references parques(id) on delete cascade,
  caixa_id integer not null references caixas(id) on delete cascade,
  tipo text not null check (tipo in ('sangria', 'suprimento')),
  valor bigint not null check (valor > 0),
  nota text not null default '',
  em timestamp not null,
  por text not null default ''
);

-- Produtos da loja (raquete, bolinha) e ingressos da bilheteria (day use).
create table produtos (
  id serial primary key,
  parque_id integer not null references parques(id) on delete cascade,
  tipo text not null check (tipo in ('loja', 'ingresso')),
  nome text not null,
  categoria text not null default '',
  preco bigint not null check (preco >= 0),
  controla_estoque boolean not null default false,
  estoque integer not null default 0,
  estoque_minimo integer not null default 0,
  ativo boolean not null default true,
  criado_em timestamp not null
);

create table vendas (
  id serial primary key,
  parque_id integer not null references parques(id) on delete cascade,
  numero integer not null,
  caixa_id integer references caixas(id),
  em timestamp not null,
  itens jsonb not null,
  subtotal bigint not null,
  desconto bigint not null default 0,
  total bigint not null,
  forma text not null,
  taxa bigint not null default 0,
  status text not null default 'paga' check (status in ('paga', 'cancelada')),
  motivo text,
  vendedor text not null default '',
  unique (parque_id, numero)
);
create index vendas_por_data on vendas (parque_id, em);

/* -------------------------------------------------------- parque infantil */

-- Cada pulseira vendida: a criança, quem a trouxe e o tempo contado desde a entrega.
create table entradas_parque (
  id serial primary key,
  parque_id integer not null references parques(id) on delete cascade,
  numero integer not null,
  crianca text not null,
  idade integer,
  responsavel text not null,
  telefone text not null default '',
  pulseira text not null default '',
  observacoes text not null default '',
  plano text not null,
  minutos integer,
  valor bigint not null,
  forma text not null,
  taxa bigint not null default 0,
  entrada timestamp not null,
  saida timestamp,
  excedente_minutos integer,
  excedente_valor bigint not null default 0,
  excedente_forma text,
  excedente_taxa bigint not null default 0,
  status text not null default 'dentro' check (status in ('dentro', 'saiu', 'cancelada')),
  caixa_id integer references caixas(id),
  atendente text not null default '',
  motivo text,
  unique (parque_id, numero)
);
create index entradas_por_data on entradas_parque (parque_id, entrada);
create index entradas_dentro on entradas_parque (parque_id) where status = 'dentro';

/* ---------------------------------------------------------------- quadras */

create table quadras (
  id serial primary key,
  parque_id integer not null references parques(id) on delete cascade,
  nome text not null,
  modalidade text not null default '',
  preco_hora bigint not null check (preco_hora >= 0),
  ativa boolean not null default true,
  ordem integer not null default 0
);

create table reservas (
  id serial primary key,
  parque_id integer not null references parques(id) on delete cascade,
  quadra_id integer not null references quadras(id) on delete cascade,
  data date not null,
  inicio time not null,
  fim time not null,
  cliente text not null,
  telefone text not null default '',
  valor bigint not null check (valor >= 0),
  status text not null default 'reservada' check (status in ('reservada', 'paga', 'cancelada')),
  grupo text,
  pago_em timestamp,
  forma text,
  taxa bigint not null default 0,
  caixa_id integer references caixas(id),
  criado_em timestamp not null,
  criado_por text not null default '',
  motivo text
);
create index reservas_por_dia on reservas (parque_id, data);

/* ---------------------------------------------------------------- eventos */

create table eventos (
  id serial primary key,
  parque_id integer not null references parques(id) on delete cascade,
  titulo text not null,
  tipo text not null default 'aniversario',
  contratante text not null,
  telefone text not null default '',
  email text not null default '',
  data date not null,
  inicio time,
  fim time,
  espaco text not null default '',
  convidados integer,
  valor bigint not null check (valor >= 0),
  sinal bigint not null default 0,
  itens text not null default '',
  observacoes text not null default '',
  status text not null default 'orcamento' check (status in ('orcamento', 'confirmado', 'realizado', 'cancelado')),
  motivo text,
  criado_em timestamp not null
);
create index eventos_por_data on eventos (parque_id, data);

/* -------------------------------------------------------------- financeiro */

-- Despesas a pagar e receitas avulsas a receber, lançadas pela gestão.
create table contas (
  id serial primary key,
  parque_id integer not null references parques(id) on delete cascade,
  sentido text not null check (sentido in ('pagar', 'receber')),
  descricao text not null,
  categoria text not null,
  pessoa text not null default '',
  valor bigint not null check (valor > 0),
  vencimento date not null,
  competencia char(7) not null,
  status text not null default 'aberta' check (status in ('aberta', 'paga', 'cancelada')),
  pago_em timestamp,
  forma text,
  criado_em timestamp not null,
  criado_por text not null default ''
);
create index contas_por_status on contas (parque_id, status, vencimento);

-- Todo dinheiro que entrou ou saiu, de qualquer área: é o extrato do financeiro
-- e a base da conferência do caixa.
create table movimentos (
  id bigserial primary key,
  parque_id integer not null references parques(id) on delete cascade,
  em timestamp not null,
  sentido text not null check (sentido in ('entrada', 'saida')),
  area text not null,
  origem_tipo text not null,
  origem_id integer not null,
  descricao text not null,
  forma text not null,
  valor bigint not null check (valor >= 0),
  taxa bigint not null default 0,
  caixa_id integer references caixas(id),
  por text not null default ''
);
create index movimentos_por_data on movimentos (parque_id, em);
create index movimentos_por_caixa on movimentos (caixa_id);
create index movimentos_por_origem on movimentos (origem_tipo, origem_id);

-- Livro contábil em partidas dobradas. Cada operação grava débitos e créditos iguais.
create table lancamentos (
  id bigserial primary key,
  parque_id integer not null references parques(id) on delete cascade,
  em timestamp not null,
  mes char(7) not null,
  conta text not null,
  debito bigint not null default 0 check (debito >= 0),
  credito bigint not null default 0 check (credito >= 0),
  historico text not null,
  origem_tipo text not null,
  origem_id integer
);
create index lancamentos_por_mes on lancamentos (parque_id, mes);
create index lancamentos_por_origem on lancamentos (origem_tipo, origem_id);
