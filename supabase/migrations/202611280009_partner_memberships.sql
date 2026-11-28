-- One authenticated identity may belong to several independent workspaces.
begin;
create table public.sigma_partner_memberships (
 admin_id uuid not null references public.sigma_profiles(id), partner_id uuid not null references public.sigma_profiles(id),
 full_name text not null, phone text not null default '', address text not null default '',
 status text not null default 'active' check(status in ('active','removed')),
 created_at timestamptz not null default now(), removed_at timestamptz,
 primary key(admin_id,partner_id), check(admin_id<>partner_id)
);
alter table public.sigma_partner_memberships enable row level security;
revoke all on public.sigma_partner_memberships from anon,authenticated;
grant select on public.sigma_partner_memberships to authenticated;
grant all on public.sigma_partner_memberships to service_role;
create policy sigma_membership_read on public.sigma_partner_memberships for select to authenticated using(admin_id=auth.uid() or partner_id=auth.uid());
insert into public.sigma_partner_memberships(admin_id,partner_id,full_name,phone,address,created_at)
 select managing_admin,id,full_name,phone,address,created_at from public.sigma_profiles where role='partner' and managing_admin is not null;
alter table public.sigma_policies add column admin_id uuid references public.sigma_profiles(id);
update public.sigma_policies p set admin_id=coalesce((select managing_admin from public.sigma_profiles where id=p.owner_id),public.sigma_root_admin());
alter table public.sigma_policies alter column admin_id set not null;
grant insert(admin_id) on public.sigma_policies to authenticated;
alter table public.sigma_ledger add column admin_id uuid references public.sigma_profiles(id);
update public.sigma_ledger l set admin_id=p.admin_id from public.sigma_policies p where p.id=l.policy_id;
alter table public.sigma_ledger alter column admin_id set not null;
create function public.sigma_ledger_workspace_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 select admin_id into new.admin_id from public.sigma_policies where id=new.policy_id;
 return new;
end $$;
revoke all on function public.sigma_ledger_workspace_guard() from public;
create trigger sigma_ledger_workspace before insert on public.sigma_ledger for each row execute function public.sigma_ledger_workspace_guard();
create index sigma_policy_workspace on public.sigma_policies(admin_id,owner_id,created_at desc);
create or replace function public.sigma_manages_partner(p_owner uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.sigma_is_admin() and exists(select 1 from public.sigma_partner_memberships m join public.sigma_profiles p on p.id=m.partner_id and p.role='partner' where m.admin_id=auth.uid() and m.partner_id=p_owner and m.status='active');
$$;
create function public.sigma_admin_owns_policy(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.sigma_is_admin() and exists(select 1 from public.sigma_policies where id=p_id and admin_id=auth.uid());
$$;
create function public.sigma_policy_visible(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.sigma_policies where id=p_id and (owner_id=auth.uid() or (public.sigma_is_admin() and admin_id=auth.uid())));
$$;
revoke all on function public.sigma_admin_owns_policy(uuid),public.sigma_policy_visible(uuid) from public;
grant execute on function public.sigma_admin_owns_policy(uuid),public.sigma_policy_visible(uuid) to authenticated;
create function public.sigma_policy_workspace_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='UPDATE' then
  if new.admin_id is distinct from old.admin_id or new.owner_id is distinct from old.owner_id then raise exception 'Policy workspace cannot be changed'; end if; return new;
 end if;
 if new.admin_id is null then new.admin_id:=case when public.sigma_is_admin() then auth.uid() else (select managing_admin from public.sigma_profiles where id=new.owner_id) end; end if;
 if not exists(select 1 from public.sigma_profiles where id=new.admin_id and role='admin') then raise exception 'Choose an administrator workspace'; end if;
 if not exists(select 1 from public.sigma_partner_memberships where admin_id=new.admin_id and partner_id=new.owner_id and status='active') then raise exception 'Partner is not active in this workspace'; end if;
 if auth.uid() is not null and auth.uid()<>new.owner_id and auth.uid()<>new.admin_id then raise exception 'Workspace not available'; end if;
 return new;
end $$;
revoke all on function public.sigma_policy_workspace_guard() from public;
create trigger sigma_policy_workspace before insert or update on public.sigma_policies for each row execute function public.sigma_policy_workspace_guard();
drop policy sigma_policy_read on public.sigma_policies;
create policy sigma_policy_read on public.sigma_policies for select to authenticated using(owner_id=auth.uid() or (public.sigma_is_admin() and admin_id=auth.uid()));
drop policy sigma_policy_create on public.sigma_policies;
create policy sigma_policy_create on public.sigma_policies for insert to authenticated with check((owner_id=auth.uid() or (admin_id=auth.uid() and public.sigma_manages_partner(owner_id))) and exists(select 1 from public.sigma_partner_memberships m where m.admin_id=sigma_policies.admin_id and m.partner_id=owner_id and m.status='active') and uploaded_by=auth.uid() and status='Uploading' and review_note='' and reviewed_by is null and reviewed_at is null and submitted_at is null);
drop policy sigma_ledger_read on public.sigma_ledger;
create policy sigma_ledger_read on public.sigma_ledger for select to authenticated using(public.sigma_policy_visible(policy_id));
drop policy sigma_audit_read on public.sigma_audit;
create policy sigma_audit_read on public.sigma_audit for select to authenticated using(public.sigma_policy_visible(policy_id));
drop policy sigma_receipts_read on public.sigma_payment_receipts;
create policy sigma_receipts_read on public.sigma_payment_receipts for select to authenticated using(exists(select 1 from public.sigma_ledger where id=ledger_id and public.sigma_policy_visible(policy_id)));
drop policy sigma_document_read on storage.objects;
create policy sigma_document_read on storage.objects for select to authenticated using(bucket_id='sigma-policies' and exists(select 1 from public.sigma_policies p where p.storage_path=name and public.sigma_policy_visible(p.id)));
drop policy sigma_document_upload on storage.objects;
create policy sigma_document_upload on storage.objects for insert to authenticated with check(bucket_id='sigma-policies' and exists(select 1 from public.sigma_policies p where p.storage_path=name and p.status='Uploading' and public.sigma_policy_visible(p.id) and exists(select 1 from public.sigma_partner_memberships m where m.admin_id=p.admin_id and m.partner_id=p.owner_id and m.status='active')));
drop policy sigma_payment_upload on storage.objects;
create policy sigma_payment_upload on storage.objects for insert to authenticated with check(bucket_id='sigma-payment-proofs' and exists(select 1 from public.sigma_ledger l where public.sigma_admin_owns_policy(l.policy_id) and l.owner_id::text=(storage.foldername(name))[1] and l.id::text=(storage.foldername(name))[2] and l.amount_paise>0 and not exists(select 1 from public.sigma_payment_receipts r where r.ledger_id=l.id)));
drop policy sigma_payment_read on storage.objects;
create policy sigma_payment_read on storage.objects for select to authenticated using(bucket_id='sigma-payment-proofs' and exists(select 1 from public.sigma_payment_receipts r join public.sigma_ledger l on l.id=r.ledger_id where r.storage_path=name and public.sigma_policy_visible(l.policy_id)));
drop policy sigma_profile_read on public.sigma_profiles;
create policy sigma_profile_read on public.sigma_profiles for select to authenticated using(id=auth.uid() or public.sigma_manages_partner(id) or (public.sigma_is_admin() and exists(select 1 from public.sigma_policies p where p.owner_id=sigma_profiles.id and p.admin_id=auth.uid())));
alter table public.sigma_partner_invites drop constraint sigma_partner_invites_email_key;
alter table public.sigma_partner_invites add unique(invited_by,email);
alter table public.sigma_partner_invites drop constraint sigma_partner_invites_status_check;
alter table public.sigma_partner_invites add check(status in ('sending','sent','failed','linked','removed'));
create or replace function public.sigma_reserve_partner_invite(p_email text,p_name text) returns public.sigma_partner_invites language plpgsql security definer set search_path='' as $$
declare saved public.sigma_partner_invites; normalized text:=lower(trim(p_email)); person public.sigma_profiles;
begin
 if not public.sigma_is_admin() then raise exception 'Admin access required'; end if;
 if normalized is null or normalized !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(normalized)>254 or p_name is null or length(trim(p_name)) not between 2 and 100 then raise exception 'Enter a valid name and email'; end if;
 perform 1 from public.sigma_profiles where id=auth.uid() for update;
 select * into person from public.sigma_profiles where lower(email)=normalized;
 if person.role='admin' then raise exception 'Use a partner email address'; end if;
 if exists(select 1 from public.sigma_partner_memberships where admin_id=auth.uid() and partner_id=person.id and status='active') then raise exception 'This partner already exists in your workspace'; end if;
 if (select count(*) from public.sigma_partner_invites where invited_by=auth.uid() and last_attempt_at>now()-interval '1 hour')>=10 then raise exception 'Invitation limit reached. Try later.'; end if;
 select * into saved from public.sigma_partner_invites where email=normalized and invited_by=auth.uid() for update;
 if saved.status<>'removed' and saved.last_attempt_at>now()-interval '60 seconds' then raise exception 'Wait one minute before retrying this invitation'; end if;
 insert into public.sigma_partner_invites(email,full_name,invited_by,user_id) values(normalized,trim(p_name),auth.uid(),person.id)
 on conflict(invited_by,email) do update set full_name=excluded.full_name,user_id=excluded.user_id,status='sending',last_attempt_at=now(),attempts=sigma_partner_invites.attempts+1 returning * into saved;
 return saved;
end $$;
create function public.sigma_complete_partner_invite(p_invite uuid,p_phone text default '',p_address text default '') returns void language plpgsql security definer set search_path='' as $$
declare invitation public.sigma_partner_invites; person public.sigma_profiles;
begin
 if not public.sigma_is_admin() then raise exception 'Admin access required'; end if;
 if length(coalesce(p_address,''))>500 or (coalesce(p_phone,'')<>'' and p_phone !~ '^[6-9][0-9]{9}$') then raise exception 'Invalid contact details'; end if;
 select * into invitation from public.sigma_partner_invites where id=p_invite and invited_by=auth.uid() for update;
 if invitation.id is null or invitation.status not in ('sending','sent','linked') then raise exception 'Invitation not available'; end if;
 select * into person from public.sigma_profiles where lower(email)=invitation.email and role='partner';
 if person.id is null then raise exception 'Partner account is not ready'; end if;
 insert into public.sigma_partner_memberships(admin_id,partner_id,full_name,phone,address) values(auth.uid(),person.id,invitation.full_name,coalesce(p_phone,''),coalesce(p_address,''))
 on conflict(admin_id,partner_id) do update set status='active',removed_at=null,full_name=excluded.full_name,phone=excluded.phone,address=excluded.address;
 update public.sigma_partner_invites set user_id=person.id where id=invitation.id;
end $$;
create function public.sigma_remove_partner(p_partner uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.sigma_is_admin() then raise exception 'Admin access required'; end if;
 update public.sigma_partner_memberships set status='removed',removed_at=now() where admin_id=auth.uid() and partner_id=p_partner and status='active';
 if not found then raise exception 'Partner not available in your workspace'; end if;
 update public.sigma_partner_invites set status='removed' where invited_by=auth.uid() and user_id=p_partner;
end $$;
create function public.sigma_list_partners(p_search text default '',p_limit integer default 100) returns table(id uuid,full_name text,email text,phone text,address text,role text,created_at timestamptz) language plpgsql stable security definer set search_path='' as $$
begin
 if not public.sigma_is_admin() then raise exception 'Admin access required'; end if;
 return query select p.id,m.full_name,p.email,m.phone,m.address,p.role,m.created_at from public.sigma_partner_memberships m join public.sigma_profiles p on p.id=m.partner_id where m.admin_id=auth.uid() and m.status='active' and p.role='partner' and (m.full_name ilike '%'||left(coalesce(p_search,''),100)||'%' or p.email ilike '%'||left(coalesce(p_search,''),100)||'%') order by m.created_at desc,p.id limit greatest(1,least(coalesce(p_limit,100),1000));
end $$;
create function public.sigma_partner_workspaces() returns table(admin_id uuid,full_name text,status text) language sql stable security definer set search_path='' as $$
 select m.admin_id,p.full_name,m.status from public.sigma_partner_memberships m join public.sigma_profiles p on p.id=m.admin_id and p.role='admin' where m.partner_id=auth.uid() order by m.created_at,m.admin_id;
$$;
revoke all on function public.sigma_complete_partner_invite(uuid,text,text),public.sigma_remove_partner(uuid),public.sigma_list_partners(text,integer),public.sigma_partner_workspaces() from public;
grant execute on function public.sigma_complete_partner_invite(uuid,text,text),public.sigma_remove_partner(uuid),public.sigma_list_partners(text,integer),public.sigma_partner_workspaces() to authenticated;
create or replace function public.sigma_new_profile() returns trigger language plpgsql security definer set search_path='' as $$
declare manager uuid;
begin
 select i.invited_by into manager from public.sigma_partner_invites i join public.sigma_profiles a on a.id=i.invited_by and a.role='admin' where i.email=lower(new.email) and i.status='sending' order by i.last_attempt_at desc limit 1;
 manager:=coalesce(manager,public.sigma_root_admin());
 insert into public.sigma_profiles(id,full_name,email,phone,address,managing_admin) values(new.id,coalesce(nullif(left(trim(new.raw_user_meta_data->>'full_name'),100),''),'Partner'),coalesce(new.email,''),left(coalesce(new.raw_user_meta_data->>'phone',''),20),left(trim(coalesce(new.raw_user_meta_data->>'address','')),500),manager);
 if manager is not null then insert into public.sigma_partner_memberships(admin_id,partner_id,full_name,phone,address) select manager,id,full_name,phone,address from public.sigma_profiles where id=new.id; end if;
 return new;
end $$;

create or replace function public.sigma_submit_policy(p_policy_id uuid) returns public.sigma_policies
language plpgsql security definer set search_path='' as $$
declare p public.sigma_policies;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select * into p from public.sigma_policies where id=p_policy_id for update;
 if p.id is null or (p.owner_id<>auth.uid() and not public.sigma_admin_owns_policy(p.id)) then raise exception 'Policy not available'; end if;
 if not exists(select 1 from public.sigma_partner_memberships where admin_id=p.admin_id and partner_id=p.owner_id and status='active') then raise exception 'Partner is not active in this workspace'; end if;
 if p.status<>'Uploading' then
  if p.status='Pending' then return p; end if;
  raise exception 'This policy has already been reviewed';
 end if;
 if not exists(select 1 from storage.objects where bucket_id='sigma-policies' and name=p.storage_path)
 then raise exception 'Upload the policy document before submitting'; end if;
 update public.sigma_policies set status='Pending',submitted_at=now() where id=p.id returning * into p;
 insert into public.sigma_audit(actor_id,policy_id,action,details) values(auth.uid(),p.id,'Submitted',
 jsonb_build_object('owner_id',p.owner_id,'uploaded_by',p.uploaded_by,'submitted_by',auth.uid()));
 return p;
end $$;
create or replace function public.sigma_review_policy(p_policy_id uuid,p_decision text,p_note text default '')
returns public.sigma_policies language plpgsql security definer set search_path = '' as $$
declare p public.sigma_policies;
begin
  if not public.sigma_is_admin() then raise exception 'Admin access required'; end if;
  if p_decision not in ('Approved','Rejected') then raise exception 'Invalid review decision'; end if;
  if length(coalesce(p_note,''))>2000 then raise exception 'Note is too long'; end if;
  if p_decision='Rejected' and length(trim(coalesce(p_note,'')))<5 then
    raise exception 'Give a rejection reason of at least 5 characters'; end if;
  select * into p from public.sigma_policies where id=p_policy_id for update;
  if p.id is null or not public.sigma_admin_owns_policy(p.id) then raise exception 'Policy not available'; end if;
  if p.status<>'Pending' then raise exception 'Only pending policies can be reviewed'; end if;
  update public.sigma_policies set status=p_decision,review_note=coalesce(p_note,''),
    reviewed_by=auth.uid(),reviewed_at=now() where id=p.id returning * into p;
  insert into public.sigma_audit(actor_id,policy_id,action,details)
    values(auth.uid(),p.id,p_decision,jsonb_build_object('note',coalesce(p_note,'')));
  return p;
end;
$$;
create or replace function public.sigma_credit_policy(p_policy_id uuid,p_points bigint,p_amount_paise bigint,p_note text default '')
returns public.sigma_ledger language plpgsql security definer set search_path='' as $$
declare p public.sigma_policies; entry public.sigma_ledger;
begin
 if not public.sigma_is_admin() then raise exception 'Admin access required'; end if;
 if p_points is distinct from 0::bigint or p_amount_paise is null or p_amount_paise<=0 or p_amount_paise>100000000000 then raise exception 'Enter a positive earning amount. Points are no longer issued.'; end if;
 if length(coalesce(p_note,''))>2000 then raise exception 'Note is too long'; end if;
 select * into p from public.sigma_policies where id=p_policy_id for update;
 if p.id is null or not public.sigma_admin_owns_policy(p.id) or p.status<>'Approved' then raise exception 'Approve the policy before crediting'; end if;
 if exists(select 1 from public.sigma_ledger where policy_id=p.id) then raise exception 'This policy has already been credited'; end if;
 insert into public.sigma_ledger(owner_id,policy_id,points,amount_paise,note,credited_by)
 values(p.owner_id,p.id,0,p_amount_paise,coalesce(p_note,''),auth.uid()) returning * into entry;
 insert into public.sigma_audit(actor_id,policy_id,action,details) values(auth.uid(),p.id,'Credited',jsonb_build_object('amount_paise',p_amount_paise,'ledger_id',entry.id));
 return entry;
end $$;
create or replace function public.sigma_record_payment(p_ledger_id uuid,p_utr text,p_paid_on date,p_note text default '',p_storage_path text default null,p_file_name text default null,p_file_type text default null,p_file_size bigint default null)
returns public.sigma_payment_receipts language plpgsql security definer set search_path='' as $$
declare l public.sigma_ledger; saved public.sigma_payment_receipts; reference text:=upper(trim(coalesce(p_utr,''))); object_row storage.objects;
begin
 if not public.sigma_is_admin() then raise exception 'Admin access required'; end if;
 if (reference<>'' and reference !~ '^[A-Z0-9/-]{6,40}$') or (reference='' and p_storage_path is null) then raise exception 'Enter a valid UTR or attach a payment screenshot'; end if;
 if p_paid_on is null or p_paid_on>current_date or length(coalesce(p_note,''))>2000 then raise exception 'Enter a valid payment date and note'; end if;
 select * into l from public.sigma_ledger where id=p_ledger_id for update;
 if l.id is null or not public.sigma_admin_owns_policy(l.policy_id) or l.amount_paise<=0 then raise exception 'Award the earning amount before recording payment'; end if;
 select * into saved from public.sigma_payment_receipts where ledger_id=l.id;
 if saved.id is not null then
  if saved.utr=reference and saved.paid_on=p_paid_on and saved.note=coalesce(p_note,'') and saved.storage_path is not distinct from p_storage_path then return saved; end if;
  raise exception 'Payment is already recorded for this earning';
 end if;
 if p_storage_path is not null then
  if split_part(p_storage_path,'/',1)<>l.owner_id::text or split_part(p_storage_path,'/',2)<>l.id::text or array_length(string_to_array(p_storage_path,'/'),1)<>3 then raise exception 'Receipt must belong to this partner and earning'; end if;
  select * into object_row from storage.objects where bucket_id='sigma-payment-proofs' and name=p_storage_path;
  if object_row.id is null then raise exception 'Upload the private payment proof first'; end if;
  if (object_row.metadata->>'mimetype') is distinct from p_file_type or (object_row.metadata->>'size')::bigint is distinct from p_file_size then raise exception 'Payment proof metadata does not match the uploaded file'; end if;
 elsif p_file_name is not null or p_file_type is not null or p_file_size is not null then raise exception 'Invalid receipt metadata'; end if;
 insert into public.sigma_payment_receipts(ledger_id,owner_id,utr,paid_on,note,storage_path,original_file_name,file_type,file_size,recorded_by)
 values(l.id,l.owner_id,reference,p_paid_on,coalesce(p_note,''),p_storage_path,p_file_name,p_file_type,p_file_size,auth.uid()) returning * into saved;
 return saved;
end $$;

drop function public.sigma_portal_summary();
create function public.sigma_portal_summary(p_admin_id uuid default null) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('total',count(*) filter(where status<>'Uploading'),'pending',count(*) filter(where status='Pending'),'approved',count(*) filter(where status='Approved'),'rejected',count(*) filter(where status='Rejected'),'unfinished',count(*) filter(where status='Uploading'),'credited',count(l.id),'points',coalesce(sum(l.points),0)::text,'amount_paise',coalesce(sum(l.amount_paise),0)::text)
 from public.sigma_policies p left join public.sigma_ledger l on l.policy_id=p.id where auth.uid() is not null and (p.owner_id=auth.uid() or (public.sigma_is_admin() and p.admin_id=auth.uid())) and (p_admin_id is null or p.admin_id=p_admin_id);
$$;
drop function public.sigma_payment_summary();
create function public.sigma_payment_summary(p_admin_id uuid default null) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('paid_paise',coalesce(sum(l.amount_paise) filter(where r.id is not null),0)::text,'unpaid_paise',coalesce(sum(l.amount_paise) filter(where r.id is null),0)::text) from public.sigma_ledger l join public.sigma_policies p on p.id=l.policy_id left join public.sigma_payment_receipts r on r.ledger_id=l.id where auth.uid() is not null and (p.owner_id=auth.uid() or (public.sigma_is_admin() and p.admin_id=auth.uid())) and (p_admin_id is null or p.admin_id=p_admin_id);
$$;
revoke all on function public.sigma_portal_summary(uuid),public.sigma_payment_summary(uuid) from public;
grant execute on function public.sigma_portal_summary(uuid),public.sigma_payment_summary(uuid) to authenticated;
drop policy sigma_referral_read on public.sigma_referral_settings;
create policy sigma_referral_read on public.sigma_referral_settings for select to authenticated using((public.sigma_is_admin() and admin_id=auth.uid()) or (not public.sigma_is_admin() and exists(select 1 from public.sigma_partner_memberships m where m.admin_id=sigma_referral_settings.admin_id and m.partner_id=auth.uid() and m.status='active')));
commit;
