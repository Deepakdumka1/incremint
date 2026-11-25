-- Account-owned business tools and administrator-managed referral destinations.
begin;
create table public.sigma_workspaces (
  owner_id uuid primary key references public.sigma_profiles(id),
  data jsonb not null default '{}'::jsonb check(jsonb_typeof(data)='object'),
  version bigint not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.sigma_workspaces enable row level security;
revoke all on public.sigma_workspaces from anon,authenticated;
grant select on public.sigma_workspaces to authenticated;
create policy sigma_workspace_read on public.sigma_workspaces for select to authenticated using(owner_id=auth.uid());
create function public.sigma_save_workspace(p_data jsonb,p_version bigint) returns public.sigma_workspaces
language plpgsql security definer set search_path='' as $$
declare saved public.sigma_workspaces;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>2097152 then raise exception 'Workspace must be an object smaller than 2 MB'; end if;
  insert into public.sigma_workspaces(owner_id) values(auth.uid()) on conflict do nothing;
  select * into saved from public.sigma_workspaces where owner_id=auth.uid() for update;
  if saved.version<>coalesce(p_version,1) then raise exception 'Workspace changed in another tab. Download your unsaved backup, then reload before editing.'; end if;
  update public.sigma_workspaces set data=p_data,version=version+1,updated_at=now() where owner_id=auth.uid() returning * into saved;
  return saved;
end $$;
revoke all on function public.sigma_save_workspace(jsonb,bigint) from public;
grant execute on function public.sigma_save_workspace(jsonb,bigint) to authenticated;

create table public.sigma_referral_settings (
  id boolean primary key default true check(id),
  data jsonb not null default '{"links":{}}'::jsonb,
  version bigint not null default 1,
  updated_by uuid references public.sigma_profiles(id),
  updated_at timestamptz not null default now()
);
insert into public.sigma_referral_settings(id) values(true);
alter table public.sigma_referral_settings enable row level security;
revoke all on public.sigma_referral_settings from anon,authenticated;
grant select on public.sigma_referral_settings to authenticated;
create policy sigma_referral_read on public.sigma_referral_settings for select to authenticated using(true);
create function public.sigma_save_referral_settings(p_data jsonb,p_version bigint) returns public.sigma_referral_settings
language plpgsql security definer set search_path='' as $$
declare saved public.sigma_referral_settings; entry record;
begin
  if not public.sigma_is_admin() then raise exception 'Admin access required'; end if;
  if p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>65536 or jsonb_typeof(p_data->'links') is distinct from 'object' then raise exception 'Invalid link settings'; end if;
  for entry in select key,value from jsonb_each_text(p_data->'links') loop
    if entry.value<>'' and (entry.value !~ '^https://[^[:space:]]+$' or length(entry.value)>4000) then raise exception 'Only HTTPS destinations are allowed'; end if;
  end loop;
  if coalesce(p_data->>'supportPhone','') !~ '^[+0-9 ()-]{0,25}$' then raise exception 'Invalid support number'; end if;
  select * into saved from public.sigma_referral_settings where id=true for update;
  if saved.version is distinct from p_version then raise exception 'Links changed in another tab. Reload before saving.'; end if;
  update public.sigma_referral_settings set data=p_data,version=version+1,updated_by=auth.uid(),updated_at=now() where id=true returning * into saved;
  return saved;
end $$;
revoke all on function public.sigma_save_referral_settings(jsonb,bigint) from public;
grant execute on function public.sigma_save_referral_settings(jsonb,bigint) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit)
values('sigma-workspace-files','sigma-workspace-files',false,10485760);
create policy sigma_workspace_file_upload on storage.objects for insert to authenticated
with check(bucket_id='sigma-workspace-files' and (storage.foldername(name))[1]=auth.uid()::text);
create policy sigma_workspace_file_read on storage.objects for select to authenticated
using(bucket_id='sigma-workspace-files' and (storage.foldername(name))[1]=auth.uid()::text);
commit;
