begin;
create table public.sigma_form_sync_keys(id boolean primary key default true check(id),key_hash text not null check(key_hash ~ '^[a-f0-9]{64}$'),updated_by uuid not null references public.sigma_profiles(id),updated_at timestamptz not null default now());
alter table public.sigma_form_sync_keys enable row level security;
revoke all on public.sigma_form_sync_keys from anon,authenticated;
grant select on public.sigma_form_sync_keys to service_role;
create function public.sigma_set_form_sync_key(p_hash text) returns void language plpgsql security definer set search_path='' as $$ begin
 if not public.sigma_is_admin() then raise exception 'Admin access required'; end if;
 if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid sync key'; end if;
 insert into public.sigma_form_sync_keys(id,key_hash,updated_by) values(true,p_hash,auth.uid()) on conflict(id) do update set key_hash=excluded.key_hash,updated_by=auth.uid(),updated_at=now();
end $$;
revoke all on function public.sigma_set_form_sync_key(text) from public;
grant execute on function public.sigma_set_form_sync_key(text) to authenticated;
create table public.sigma_form_enquiries(
 id uuid primary key default gen_random_uuid(),form_id text not null,response_id text not null,product text not null,
 submitted_at timestamptz not null,received_at timestamptz not null default now(),
 claimed_partner_email text not null default '',customer_name text not null default '',customer_mobile text not null default '',
 answers jsonb not null check(jsonb_typeof(answers)='array' and octet_length(answers::text)<=100000),
 owner_id uuid references public.sigma_profiles(id),assigned_by uuid references public.sigma_profiles(id),assigned_at timestamptz,
 unique(form_id,response_id)
);
alter table public.sigma_form_enquiries enable row level security;
revoke all on public.sigma_form_enquiries from anon,authenticated;
grant select on public.sigma_form_enquiries to authenticated;
grant select,insert on public.sigma_form_enquiries to service_role;
create policy sigma_enquiry_read on public.sigma_form_enquiries for select to authenticated using(public.sigma_is_admin() or owner_id=auth.uid());
create function public.sigma_assign_form_enquiry(p_id uuid,p_owner uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 if not public.sigma_is_admin() then raise exception 'Admin access required'; end if;
 if not exists(select 1 from public.sigma_profiles where id=p_owner and role='partner') then raise exception 'Choose an existing partner'; end if;
 update public.sigma_form_enquiries set owner_id=p_owner,assigned_by=auth.uid(),assigned_at=now() where id=p_id;
 if not found then raise exception 'Enquiry not found'; end if;
end $$;
revoke all on function public.sigma_assign_form_enquiry(uuid,uuid) from public;
grant execute on function public.sigma_assign_form_enquiry(uuid,uuid) to authenticated;
commit;
