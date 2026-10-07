-- INVITACIONES: pendiente de aprobación. No ejecutado.
-- Requiere las migraciones de elección y retiro anteriores.
begin;
lock table public.flexible_sumative_projects,public.flexible_sumative_members,public.flexible_sumative_activation in share row exclusive mode;
alter table public.flexible_sumative_projects add column if not exists invitante_asignatura text;
create table if not exists public.flexible_sumative_invitation_events(id uuid primary key default gen_random_uuid(),project_id uuid not null,event_type text not null,actor_id uuid,created_at timestamptz not null default now(),configuracion_anterior jsonb not null);
alter table public.flexible_sumative_invitation_events enable row level security;
revoke all on public.flexible_sumative_invitation_events from anon,authenticated;

create or replace function public.teacher_sumative_choice(p_course_id uuid,p_asignatura text,p_trimestre smallint)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_year text;v_subjects jsonb;v_group jsonb;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and activo) or not public.can_manage_grade_assignment(p_course_id,p_asignatura) or not public.subject_participates_project(p_course_id,p_asignatura) then raise exception 'Acceso no autorizado'; end if;
 if p_trimestre is null or p_trimestre not between 1 and 3 then raise exception 'Trimestre inválido';end if;
 select i.anio_lectivo into v_year from public.institution_settings i where i.id=1;
 if v_year is null or length(btrim(v_year))<4 then raise exception 'Configure el año lectivo institucional';end if;
 select coalesce(jsonb_agg(jsonb_build_object('nombre',s.nombre,'clave',s.clave) order by s.nombre),'[]'::jsonb) into v_subjects
 from (select public.normalizar_asignatura(sc.asignatura) clave,min(sc.asignatura) nombre from public.schedules sc where sc.course_id=p_course_id and sc.activo and public.subject_participates_project(p_course_id,sc.asignatura) group by public.normalizar_asignatura(sc.asignatura)) s;
 select jsonb_build_object('id',p.id,'nombre',p.nombre,'confirmado',p.confirmado,'mi_confirmacion',own.aceptado,'invitante',coalesce(p.invitante_asignatura,(select string_agg(m.asignatura,' y ' order by m.asignatura) from public.flexible_sumative_members m where m.project_id=p.id and m.aceptado)),'participantes',(select jsonb_agg(jsonb_build_object('nombre',m.asignatura,'aceptado',m.aceptado) order by m.asignatura) from public.flexible_sumative_members m where m.project_id=p.id)) into v_group
 from public.flexible_sumative_projects p join public.flexible_sumative_members own on own.project_id=p.id
 where p.course_id=p_course_id and p.anio_lectivo=v_year and p.trimestre=p_trimestre and public.normalizar_asignatura(own.asignatura)=public.normalizar_asignatura(p_asignatura);
 return jsonb_build_object('anio_lectivo',v_year,'asignatura_clave',public.normalizar_asignatura(p_asignatura),'asignaturas',v_subjects,'grupo',v_group,'activado',exists(select 1 from public.flexible_sumative_activation a where a.course_id=p_course_id and a.trimestre=p_trimestre));
end;
$$;

create or replace function public.teacher_propose_sumative_project(p_course_id uuid,p_asignatura text,p_trimestre smallint,p_nombre text,p_asignaturas text[])
returns uuid language plpgsql security definer set search_path='' as $$
declare v_year text;v_id uuid;v_subject text;v_count integer;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and activo) or not public.can_manage_grade_assignment(p_course_id,p_asignatura) or not public.subject_participates_project(p_course_id,p_asignatura) then raise exception 'Acceso no autorizado';end if;
 select i.anio_lectivo into v_year from public.institution_settings i where i.id=1;
 if v_year is null or length(btrim(v_year))<4 or p_trimestre is null or p_trimestre not between 1 and 3 or p_nombre is null or length(btrim(p_nombre)) not between 1 and 180 then raise exception 'Datos inválidos';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_course_id::text||v_year||p_trimestre::text,0));
 if exists(select 1 from public.flexible_sumative_activation a where a.course_id=p_course_id and a.trimestre=p_trimestre) then raise exception 'El período ya está activado y bloqueado';end if;
 select count(distinct public.normalizar_asignatura(x)) into v_count from unnest(p_asignaturas) x where nullif(btrim(x),'') is not null;
 if v_count=0 or v_count<>cardinality(p_asignaturas) or not exists(select 1 from unnest(p_asignaturas) x where public.normalizar_asignatura(x)=public.normalizar_asignatura(p_asignatura)) then raise exception 'Incluya su materia y seleccione participantes únicos';end if;
 foreach v_subject in array p_asignaturas loop
 if not public.subject_participates_project(p_course_id,v_subject) or not exists(select 1 from public.schedules s where s.course_id=p_course_id and s.activo and public.normalizar_asignatura(s.asignatura)=public.normalizar_asignatura(v_subject)) then raise exception 'Materia inválida: %',v_subject;end if;
 if exists(select 1 from public.flexible_sumative_members m where m.course_id=p_course_id and m.anio_lectivo=v_year and m.trimestre=p_trimestre and public.normalizar_asignatura(m.asignatura)=public.normalizar_asignatura(v_subject)) then raise exception 'La asignatura % ya pertenece a un proyecto; revise la invitación o coordine con administración',v_subject;end if;
 end loop;
 insert into public.flexible_sumative_projects(course_id,anio_lectivo,trimestre,nombre,confirmado,invitante_asignatura) values(p_course_id,v_year,p_trimestre,btrim(p_nombre),v_count=1,p_asignatura) returning id into v_id;
 insert into public.flexible_sumative_members(project_id,course_id,anio_lectivo,trimestre,asignatura,aceptado)
 select v_id,p_course_id,v_year,p_trimestre,x,public.normalizar_asignatura(x)=public.normalizar_asignatura(p_asignatura) from unnest(p_asignaturas) x;
 return v_id;
end;
$$;

-- Helper compartido: denegar libera solo la invitación propia;
-- retirarse cancela además todas las invitaciones sin respuesta del grupo.
create or replace function public.teacher_leave_sumative_group(
 p_course_id uuid,p_asignatura text,p_trimestre smallint,p_project_id uuid,p_decline boolean
) returns void language plpgsql security definer set search_path='' as $$
declare v_year text;v_project public.flexible_sumative_projects%rowtype;
 v_before jsonb;v_count integer;v_complete boolean;v_own_accepted boolean;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and activo)
 or not public.can_manage_grade_assignment(p_course_id,p_asignatura) then raise exception 'Acceso no autorizado';end if;
 select i.anio_lectivo into v_year from public.institution_settings i where i.id=1;
 if v_year is null or p_trimestre is null or p_trimestre not between 1 and 3 or p_project_id is null or p_decline is null then raise exception 'Selección inválida';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_course_id::text||v_year||p_trimestre::text,0));
 if exists(select 1 from public.flexible_sumative_activation a where a.course_id=p_course_id and a.trimestre=p_trimestre) then raise exception 'El cálculo está activado; solicite revisión administrativa';end if;
 select p.* into v_project from public.flexible_sumative_projects p where p.id=p_project_id and p.course_id=p_course_id and p.anio_lectivo=v_year and p.trimestre=p_trimestre for update;
 if not found then raise exception 'La invitación ya fue cancelada o el proyecto no existe';end if;
 select m.aceptado into v_own_accepted from public.flexible_sumative_members m where m.project_id=p_project_id and public.normalizar_asignatura(m.asignatura)=public.normalizar_asignatura(p_asignatura);
 if not found then raise exception 'Su materia ya no pertenece a este proyecto';end if;
 if p_decline and v_own_accepted then raise exception 'Ya aceptó: utilice Retirarme del proyecto';end if;
 select jsonb_build_object('proyecto',to_jsonb(v_project),'participantes',coalesce(jsonb_agg(to_jsonb(m)),'[]'::jsonb)) into v_before from public.flexible_sumative_members m where m.project_id=p_project_id;
 insert into public.flexible_sumative_invitation_events(project_id,event_type,actor_id,configuracion_anterior) values(p_project_id,case when p_decline then 'DENEGADA' else 'RETIRO_CANCELA_PENDIENTES' end,auth.uid(),v_before);
 delete from public.flexible_sumative_members m where m.project_id=p_project_id and public.normalizar_asignatura(m.asignatura)=public.normalizar_asignatura(p_asignatura);
 if not p_decline then delete from public.flexible_sumative_members where project_id=p_project_id and not aceptado;end if;
 -- Nunca conservar una invitación si ya no queda quien haya aceptado participar.
 if not exists(select 1 from public.flexible_sumative_members where project_id=p_project_id and aceptado) then delete from public.flexible_sumative_members where project_id=p_project_id;end if;
 select count(*),coalesce(bool_and(aceptado),false) into v_count,v_complete from public.flexible_sumative_members where project_id=p_project_id;
 if v_count=0 then delete from public.flexible_sumative_projects where id=p_project_id;
 else update public.flexible_sumative_projects set confirmado=v_complete where id=p_project_id;end if;
end;
$$;
revoke all on function public.teacher_leave_sumative_group(uuid,text,smallint,uuid,boolean) from public,anon,authenticated;
create or replace function public.teacher_withdraw_sumative_project(p_course_id uuid,p_asignatura text,p_trimestre smallint,p_project_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin perform public.teacher_leave_sumative_group(p_course_id,p_asignatura,p_trimestre,p_project_id,false);end;
$$;
create or replace function public.teacher_decline_sumative_project(p_course_id uuid,p_asignatura text,p_trimestre smallint,p_project_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin perform public.teacher_leave_sumative_group(p_course_id,p_asignatura,p_trimestre,p_project_id,true);end;
$$;
revoke all on function public.teacher_withdraw_sumative_project(uuid,text,smallint,uuid) from public,anon;
revoke all on function public.teacher_decline_sumative_project(uuid,text,smallint,uuid) from public,anon;
grant execute on function public.teacher_withdraw_sumative_project(uuid,text,smallint,uuid) to authenticated;
grant execute on function public.teacher_decline_sumative_project(uuid,text,smallint,uuid) to authenticated;

-- Corrige grupos huérfanos existentes como el de la captura.
-- Solo grupos NO activados donde no existe ninguna materia aceptada.
-- Archiva su configuración antes de liberar sus reservas. No toca project_grades.
do $$
declare v_project public.flexible_sumative_projects%rowtype;v_before jsonb;
begin
 for v_project in select p.* from public.flexible_sumative_projects p
 where not exists(select 1 from public.flexible_sumative_activation a where a.course_id=p.course_id and a.trimestre=p.trimestre)
 and not exists(select 1 from public.flexible_sumative_members m where m.project_id=p.id and m.aceptado)
 for update loop
 select jsonb_build_object('proyecto',to_jsonb(v_project),'participantes',coalesce(jsonb_agg(to_jsonb(m)),'[]'::jsonb)) into v_before from public.flexible_sumative_members m where m.project_id=v_project.id;
 insert into public.flexible_sumative_invitation_events(project_id,event_type,actor_id,configuracion_anterior) values(v_project.id,'LIMPIEZA_HUERFANA',auth.uid(),v_before);
 delete from public.flexible_sumative_members where project_id=v_project.id;
 delete from public.flexible_sumative_projects where id=v_project.id;
 end loop;
end;
$$;
commit;
