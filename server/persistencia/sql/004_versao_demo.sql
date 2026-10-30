-- Versão do gerador da demonstração. Quando a demonstração ganha dados novos
-- (como as notas fiscais das despesas), o complexo de demonstração se refaz
-- no próximo ciclo, sem esperar a virada do dia.
alter table parques add column demo_versao integer not null default 0;
