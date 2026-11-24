-- Phase 1: authenticated uploads, admin review and immutable credit ledger.
-- Apply once using the owner SQL editor in your own Supabase project.
begin;

create table public.sigma_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) between 1 and 100),
  email text not null,
  phone text not null default '',
  role text not null default 'partner' check (role in ('partner','admin')),
  created_at timestamptz not null default now()
);

create function public.sigma_is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.sigma_profiles where id=auth.uid() and role='admin'
  );
$$;
revoke all on function public.sigma_is_admin() from public;
grant execute on function public.sigma_is_admin() to authenticated;

create function public.sigma_new_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.sigma_profiles(id,full_name,email,phone)
  values(new.id,coalesce(nullif(left(trim(new.raw_user_meta_data->>'full_name'),100),''),'Partner'),
    coalesce(new.email,''),left(coalesce(new.raw_user_meta_data->>'phone',''),20));
  return new;
end;
$$;
revoke all on function public.sigma_new_profile() from public;
create trigger sigma_on_signup after insert on auth.users
  for each row execute function public.sigma_new_profile();

create table public.sigma_policies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.sigma_profiles(id),
  customer_name text not null check (length(trim(customer_name)) between 1 and 150),
  customer_mobile text not null check (customer_mobile ~ '^[6-9][0-9]{9}$'),
  product text not null check (length(product) between 1 and 80),
  insurer text not null default '' check (length(insurer)<=150),
  policy_number text not null default '' check (length(policy_number)<=120),
  premium_paise bigint not null default 0 check (premium_paise between 0 and 100000000000),
  start_date date,
  expiry_date date,
  original_file_name text not null check (length(original_file_name) between 1 and 200),
  file_type text not null check (file_type in ('application/pdf','image/jpeg','image/png','image/webp')),
  file_size bigint not null check (file_size between 1 and 10485760),
  storage_path text unique not null,
  status text not null default 'Uploading' check (status in ('Uploading','Pending','Approved','Rejected')),
  review_note text not null default '' check (length(review_note)<=2000),
  reviewed_by uuid references public.sigma_profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  constraint sigma_dates_valid check (expiry_date is null or start_date is null or expiry_date>start_date),
  constraint sigma_file_path check (storage_path=owner_id::text||'/'||id::text||'/policy.'||
    case file_type when 'application/pdf' then 'pdf' when 'image/jpeg' then 'jpg'
      when 'image/png' then 'png' when 'image/webp' then 'webp' end)
);
create index sigma_policies_owner_date on public.sigma_policies(owner_id,created_at desc);
create index sigma_policies_status_date on public.sigma_policies(status,created_at desc);

create table public.sigma_ledger (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.sigma_profiles(id),
  policy_id uuid unique not null references public.sigma_policies(id),
  points bigint not null default 0 check (points between 0 and 1000000000),
  amount_paise bigint not null default 0 check (amount_paise between 0 and 100000000000),
  note text not null default '' check (length(note)<=2000),
  credited_by uuid not null references public.sigma_profiles(id),
  created_at timestamptz not null default now(),
  check (points>0 or amount_paise>0)
);
create index sigma_ledger_owner_date on public.sigma_ledger(owner_id,created_at desc);

create table public.sigma_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.sigma_profiles(id),
  policy_id uuid not null references public.sigma_policies(id),
  action text not null check (action in ('Submitted','Approved','Rejected','Credited')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.sigma_profiles enable row level security;
alter table public.sigma_policies enable row level security;
alter table public.sigma_ledger enable row level security;
alter table public.sigma_audit enable row level security;

revoke all on public.sigma_profiles,public.sigma_policies,public.sigma_ledger,public.sigma_audit from anon,authenticated;
grant select on public.sigma_profiles,public.sigma_policies,public.sigma_ledger,public.sigma_audit to authenticated;
grant update(full_name,phone) on public.sigma_profiles to authenticated;
grant insert(id,owner_id,customer_name,customer_mobile,product,insurer,policy_number,premium_paise,
  start_date,expiry_date,original_file_name,file_type,file_size,storage_path) on public.sigma_policies to authenticated;

create policy sigma_profile_read on public.sigma_profiles for select to authenticated
  using (id=auth.uid() or public.sigma_is_admin());
create policy sigma_profile_edit on public.sigma_profiles for update to authenticated
  using (id=auth.uid()) with check (id=auth.uid());
create policy sigma_policy_read on public.sigma_policies for select to authenticated
  using (owner_id=auth.uid() or public.sigma_is_admin());
create policy sigma_policy_create on public.sigma_policies for insert to authenticated
  with check (owner_id=auth.uid() and status='Uploading' and review_note='' and reviewed_by is null
    and reviewed_at is null and submitted_at is null);
create policy sigma_ledger_read on public.sigma_ledger for select to authenticated
  using (owner_id=auth.uid() or public.sigma_is_admin());
create policy sigma_audit_read on public.sigma_audit for select to authenticated
  using (public.sigma_is_admin() or exists (
    select 1 from public.sigma_policies p where p.id=policy_id and p.owner_id=auth.uid()));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('sigma-policies','sigma-policies',false,10485760,
  array['application/pdf','image/jpeg','image/png','image/webp']);

create policy sigma_document_upload on storage.objects for insert to authenticated
  with check (bucket_id='sigma-policies' and exists (
    select 1 from public.sigma_policies p where p.owner_id=auth.uid()
      and p.status='Uploading' and p.storage_path=name));
create policy sigma_document_read on storage.objects for select to authenticated
  using (bucket_id='sigma-policies' and exists (
    select 1 from public.sigma_policies p where p.storage_path=name
      and (p.owner_id=auth.uid() or public.sigma_is_admin())));
create policy sigma_document_discard on storage.objects for delete to authenticated
  using (bucket_id='sigma-policies' and exists (
    select 1 from public.sigma_policies p where p.owner_id=auth.uid()
      and p.status='Uploading' and p.storage_path=name));

create function public.sigma_submit_policy(p_policy_id uuid) returns public.sigma_policies
language plpgsql security definer set search_path = '' as $$
declare p public.sigma_policies;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into p from public.sigma_policies where id=p_policy_id for update;
  if p.id is null or p.owner_id<>auth.uid() then raise exception 'Policy not available'; end if;
  if p.status<>'Uploading' then
    if p.status='Pending' then return p; end if;
    raise exception 'This policy has already been reviewed';
  end if;
  if not exists (select 1 from storage.objects where bucket_id='sigma-policies' and name=p.storage_path)
    then raise exception 'Upload the policy document before submitting'; end if;
  update public.sigma_policies set status='Pending',submitted_at=now() where id=p.id returning * into p;
  insert into public.sigma_audit(actor_id,policy_id,action) values(auth.uid(),p.id,'Submitted');
  return p;
end;
$$;

create function public.sigma_review_policy(p_policy_id uuid,p_decision text,p_note text default '')
returns public.sigma_policies language plpgsql security definer set search_path = '' as $$
declare p public.sigma_policies;
begin
  if not public.sigma_is_admin() then raise exception 'Admin access required'; end if;
  if p_decision not in ('Approved','Rejected') then raise exception 'Invalid review decision'; end if;
  if length(coalesce(p_note,''))>2000 then raise exception 'Note is too long'; end if;
  if p_decision='Rejected' and length(trim(coalesce(p_note,'')))<5 then
    raise exception 'Give a rejection reason of at least 5 characters'; end if;
  select * into p from public.sigma_policies where id=p_policy_id for update;
  if p.id is null then raise exception 'Policy not available'; end if;
  if p.status<>'Pending' then raise exception 'Only pending policies can be reviewed'; end if;
  update public.sigma_policies set status=p_decision,review_note=coalesce(p_note,''),
    reviewed_by=auth.uid(),reviewed_at=now() where id=p.id returning * into p;
  insert into public.sigma_audit(actor_id,policy_id,action,details)
    values(auth.uid(),p.id,p_decision,jsonb_build_object('note',coalesce(p_note,'')));
  return p;
end;
$$;

create function public.sigma_credit_policy(p_policy_id uuid,p_points bigint,p_amount_paise bigint,p_note text default '')
returns public.sigma_ledger language plpgsql security definer set search_path = '' as $$
declare p public.sigma_policies; entry public.sigma_ledger;
begin
  if not public.sigma_is_admin() then raise exception 'Admin access required'; end if;
  if p_points is null or p_amount_paise is null or p_points<0 or p_amount_paise<0
    or p_points>1000000000 or p_amount_paise>100000000000 or (p_points=0 and p_amount_paise=0)
    then raise exception 'Enter valid nonnegative points and amount, with at least one positive value'; end if;
  if length(coalesce(p_note,''))>2000 then raise exception 'Note is too long'; end if;
  select * into p from public.sigma_policies where id=p_policy_id for update;
  if p.id is null or p.status<>'Approved' then raise exception 'Approve the policy before crediting'; end if;
  if exists(select 1 from public.sigma_ledger where policy_id=p.id) then
    raise exception 'This policy has already been credited'; end if;
  insert into public.sigma_ledger(owner_id,policy_id,points,amount_paise,note,credited_by)
    values(p.owner_id,p.id,p_points,p_amount_paise,coalesce(p_note,''),auth.uid()) returning * into entry;
  insert into public.sigma_audit(actor_id,policy_id,action,details)
    values(auth.uid(),p.id,'Credited',jsonb_build_object('points',p_points,'amount_paise',p_amount_paise,'ledger_id',entry.id));
  return entry;
end;
$$;

create function public.sigma_discard_upload(p_policy_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare p public.sigma_policies;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into p from public.sigma_policies where id=p_policy_id for update;
  if p.id is null or p.owner_id<>auth.uid() or p.status<>'Uploading' then raise exception 'Only your unfinished uploads may be discarded'; end if;
  if exists(select 1 from storage.objects where bucket_id='sigma-policies' and name=p.storage_path) then
    raise exception 'Remove the unfinished uploaded file first'; end if;
  delete from public.sigma_policies where id=p.id;
end;
$$;

create function public.sigma_portal_summary() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb; admin_mode boolean;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  admin_mode:=public.sigma_is_admin();
  select jsonb_build_object(
    'total',count(*) filter(where status<>'Uploading'),
    'pending',count(*) filter(where status='Pending'),
    'approved',count(*) filter(where status='Approved'),
    'rejected',count(*) filter(where status='Rejected'),
    'unfinished',count(*) filter(where status='Uploading'),
    'credited',(select count(*) from public.sigma_ledger l where admin_mode or l.owner_id=auth.uid()),
    'points',(select coalesce(sum(l.points),0)::text from public.sigma_ledger l where admin_mode or l.owner_id=auth.uid()),
    'amount_paise',(select coalesce(sum(l.amount_paise),0)::text from public.sigma_ledger l where admin_mode or l.owner_id=auth.uid())
  ) into result from public.sigma_policies where admin_mode or owner_id=auth.uid();
  return result;
end;
$$;

revoke all on function public.sigma_submit_policy(uuid) from public;
revoke all on function public.sigma_review_policy(uuid,text,text) from public;
revoke all on function public.sigma_credit_policy(uuid,bigint,bigint,text) from public;
revoke all on function public.sigma_discard_upload(uuid) from public;
revoke all on function public.sigma_portal_summary() from public;
grant execute on function public.sigma_submit_policy(uuid),public.sigma_review_policy(uuid,text,text),
  public.sigma_credit_policy(uuid,bigint,bigint,text),public.sigma_discard_upload(uuid),public.sigma_portal_summary() to authenticated;

do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    execute 'alter publication supabase_realtime add table public.sigma_policies,public.sigma_ledger';
  end if;
end $$;

commit;
