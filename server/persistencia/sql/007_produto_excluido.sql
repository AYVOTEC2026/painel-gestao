-- Produto excluído some da loja e do PDV, mas a linha fica: vendas e aluguéis antigos apontam para ela.
alter table produtos add column if not exists excluido_em timestamp;
