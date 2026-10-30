-- Notas fiscais das despesas: cada conta a pagar guarda o tipo de documento que a
-- comprova (nota, cupom, recibo, fatura, guia, folha) e pode ter arquivos anexados
-- (PDF, foto ou o XML da NF-e/NFS-e). O contador recebe tudo num pacote por mês.

alter table contas add column documento_tipo text not null default 'nota_fiscal';
alter table contas add column documento_numero text not null default '';
alter table contas add column pessoa_documento text not null default '';
alter table contas add column justificativa text not null default '';
alter table contas add constraint contas_documento_tipo_check
  check (documento_tipo in ('nota_fiscal', 'cupom_fiscal', 'recibo', 'fatura', 'guia', 'folha', 'sem_documento'));

alter table anexos drop constraint if exists anexos_dono_tipo_check;
alter table anexos add constraint anexos_dono_tipo_check check (dono_tipo in ('contrato', 'evento', 'conta'));
