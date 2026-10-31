-- Perfil para quem cuida só das festas e eventos.
alter table usuarios drop constraint if exists usuarios_papel_check;
alter table usuarios add constraint usuarios_papel_check check (papel in ('dono', 'recepcao', 'monitor', 'eventos'));
