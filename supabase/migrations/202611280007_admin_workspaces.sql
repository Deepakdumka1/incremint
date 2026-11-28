-- Each administrator manages an independent partner workspace.
begin;
alter table public.sigma_profiles add column managing_admin uuid references public.sigma_profiles(id);
create index sigma_profiles_managing_admin on public.sigma_profiles(managing_admin);
create function public.sigma_root_admin() returns uuid language sql stable security definer set search_path='' as $$
 select id from public.sigma_profiles where role='admin' order by created_at,id limit 1;
$$;
revoke all on function public.sigma_root_admin() from public;
create function public.sigma_manages_partner(p_owner uuid) returns boolean language sql stable security definer set search_path='' as $$
 select public.sigma_is_admin() and exists(select 1 from public.sigma_profiles where id=p_owner and role='partner' and managing_admin=auth.uid());
$$;
revoke all on function public.sigma_manages_partner(uuid) from public;
grant execute on function public.sigma_manages_partner(uuid) to authenticated;
create function public.sigma_workspace_admin() returns uuid language sql stable security definer set search_path='' as $$
 select case when role='admin' then id else managing_admin end from public.sigma_profiles where id=auth.uid();
$$;
revoke all on function public.sigma_workspace_admin() from public;
grant execute on function public.sigma_workspace_admin() to authenticated;
update public.sigma_profiles p set managing_admin=coalesce(
 (select i.invited_by from public.sigma_partner_invites i join public.sigma_profiles a on a.id=i.invited_by and a.role='admin' where i.user_id=p.id or i.email=lower(p.email) order by i.created_at limit 1),public.sigma_root_admin()) where p.role='partner';
create or replace function public.sigma_new_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.sigma_profiles(id,full_name,email,phone,address,managing_admin)
 values(new.id,coalesce(nullif(left(trim(new.raw_user_meta_data->>'full_name'),100),''),'Partner'),coalesce(new.email,''),left(coalesce(new.raw_user_meta_data->>'phone',''),20),left(trim(coalesce(new.raw_user_meta_data->>'address','')),500),
 coalesce((select i.invited_by from public.sigma_partner_invites i join public.sigma_profiles a on a.id=i.invited_by and a.role='admin' where i.email=lower(new.email) and i.status='sending'),public.sigma_root_admin()));
 return new;
end $$;
drop policy sigma_profile_read on public.sigma_profiles;
create policy sigma_profile_read on public.sigma_profiles for select to authenticated using(id=auth.uid() or public.sigma_manages_partner(id));
drop policy sigma_policy_read on public.sigma_policies;
create policy sigma_policy_read on public.sigma_policies for select to authenticated using(owner_id=auth.uid() or public.sigma_manages_partner(owner_id));
drop policy sigma_ledger_read on public.sigma_ledger;
create policy sigma_ledger_read on public.sigma_ledger for select to authenticated using(owner_id=auth.uid() or public.sigma_manages_partner(owner_id));
drop policy sigma_audit_read on public.sigma_audit;
create policy sigma_audit_read on public.sigma_audit for select to authenticated using(exists(select 1 from public.sigma_policies p where p.id=policy_id and (p.owner_id=auth.uid() or public.sigma_manages_partner(p.owner_id))));
drop policy sigma_invites_read on public.sigma_partner_invites;
create policy sigma_invites_read on public.sigma_partner_invites for select to authenticated using(public.sigma_is_admin() and invited_by=auth.uid());
drop policy sigma_receipts_read on public.sigma_payment_receipts;
create policy sigma_receipts_read on public.sigma_payment_receipts for select to authenticated using(owner_id=auth.uid() or public.sigma_manages_partner(owner_id));
drop policy sigma_policy_create on public.sigma_policies;
create policy sigma_policy_create on public.sigma_policies for insert to authenticated with check((owner_id=auth.uid() or public.sigma_manages_partner(owner_id)) and uploaded_by=auth.uid() and exists(select 1 from public.sigma_profiles where id=owner_id and role='partner') and status='Uploading' and review_note='' and reviewed_by is null and reviewed_at is null and submitted_at is null);
drop policy sigma_document_upload on storage.objects;
create policy sigma_document_upload on storage.objects for insert to authenticated with check(bucket_id='sigma-policies' and exists(select 1 from public.sigma_policies p where (p.owner_id=auth.uid() or public.sigma_manages_partner(p.owner_id)) and p.status='Uploading' and p.storage_path=name));
drop policy sigma_document_read on storage.objects;
create policy sigma_document_read on storage.objects for select to authenticated using(bucket_id='sigma-policies' and exists(select 1 from public.sigma_policies p where p.storage_path=name and (p.owner_id=auth.uid() or public.sigma_manages_partner(p.owner_id))));
drop policy sigma_payment_upload on storage.objects;
create policy sigma_payment_upload on storage.objects for insert to authenticated with check(bucket_id='sigma-payment-proofs' and public.sigma_is_admin() and exists(select 1 from public.sigma_ledger l where public.sigma_manages_partner(l.owner_id) and l.owner_id::text=(storage.foldername(name))[1] and l.id::text=(storage.foldername(name))[2] and l.amount_paise>0 and not exists(select 1 from public.sigma_payment_receipts r where r.ledger_id=l.id)));
drop policy sigma_payment_read on storage.objects;
create policy sigma_payment_read on storage.objects for select to authenticated using(bucket_id='sigma-payment-proofs' and exists(select 1 from public.sigma_payment_receipts r where r.storage_path=name and (r.owner_id=auth.uid() or public.sigma_manages_partner(r.owner_id))));
create or replace function public.sigma_reserve_partner_invite(p_email text,p_name text) returns public.sigma_partner_invites
language plpgsql security definer set search_path='' as $$
declare saved public.sigma_partner_invites; normalized text:=lower(trim(p_email));
begin
 if not public.sigma_is_admin() then raise exception 'Admin access required'; end if;
 if normalized is null or normalized !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(normalized)>254
 or p_name is null or length(trim(p_name)) not between 2 and 100 then raise exception 'Enter a valid name and email'; end if;
 perform 1 from public.sigma_profiles where id=auth.uid() for update;
 if exists(select 1 from public.sigma_profiles where lower(email)=normalized) then raise exception 'This email already has an account. Use password recovery to sign in.'; end if;
 if (select count(*) from public.sigma_partner_invites where invited_by=auth.uid() and last_attempt_at>now()-interval '1 hour')>=10 then raise exception 'Invitation limit reached. Try later.'; end if;
 select * into saved from public.sigma_partner_invites where email=normalized for update;
 if saved.id is not null and saved.invited_by<>auth.uid() then raise exception 'Email unavailable for this workspace'; end if;
 if saved.id is not null and saved.last_attempt_at>now()-interval '60 seconds' then raise exception 'Wait one minute before retrying this invitation'; end if;
 insert into public.sigma_partner_invites(email,full_name,invited_by) values(normalized,trim(p_name),auth.uid())
 on conflict(email) do update set full_name=excluded.full_name,invited_by=excluded.invited_by,status='sending',last_attempt_at=now(),attempts=sigma_partner_invites.attempts+1 returning * into saved;
 return saved;
end $$;
create or replace function public.sigma_submit_policy(p_policy_id uuid) returns public.sigma_policies
language plpgsql security definer set search_path='' as $$
declare p public.sigma_policies;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select * into p from public.sigma_policies where id=p_policy_id for update;
 if p.id is null or (p.owner_id<>auth.uid() and not public.sigma_manages_partner(p.owner_id)) then raise exception 'Policy not available'; end if;
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
  if p.id is null or not public.sigma_manages_partner(p.owner_id) then raise exception 'Policy not available'; end if;
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
 if p.id is null or not public.sigma_manages_partner(p.owner_id) or p.status<>'Approved' then raise exception 'Approve the policy before crediting'; end if;
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
 if l.id is null or not public.sigma_manages_partner(l.owner_id) or l.amount_paise<=0 then raise exception 'Award the earning amount before recording payment'; end if;
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
create or replace function public.sigma_portal_summary() returns jsonb
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
    'credited',(select count(*) from public.sigma_ledger l where public.sigma_manages_partner(l.owner_id) or l.owner_id=auth.uid()),
    'points',(select coalesce(sum(l.points),0)::text from public.sigma_ledger l where public.sigma_manages_partner(l.owner_id) or l.owner_id=auth.uid()),
    'amount_paise',(select coalesce(sum(l.amount_paise),0)::text from public.sigma_ledger l where public.sigma_manages_partner(l.owner_id) or l.owner_id=auth.uid())
  ) into result from public.sigma_policies where public.sigma_manages_partner(owner_id) or owner_id=auth.uid();
  return result;
end;
$$;
create or replace function public.sigma_payment_summary() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('paid_paise',coalesce(sum(l.amount_paise) filter(where r.id is not null),0)::text,'unpaid_paise',coalesce(sum(l.amount_paise) filter(where r.id is null),0)::text)
 from public.sigma_ledger l left join public.sigma_payment_receipts r on r.ledger_id=l.id where auth.uid() is not null and (l.owner_id=auth.uid() or public.sigma_manages_partner(l.owner_id));
$$;
-- Referral destinations are shared only inside the administrator's workspace.
alter table public.sigma_referral_settings add column admin_id uuid references public.sigma_profiles(id);
update public.sigma_referral_settings set admin_id=public.sigma_root_admin();
alter table public.sigma_referral_settings alter column admin_id set not null;
alter table public.sigma_referral_settings drop constraint sigma_referral_settings_pkey;
alter table public.sigma_referral_settings add primary key(admin_id);
insert into public.sigma_referral_settings(admin_id) select id from public.sigma_profiles where role='admin' on conflict do nothing;
drop policy sigma_referral_read on public.sigma_referral_settings;
create policy sigma_referral_read on public.sigma_referral_settings for select to authenticated using(admin_id=public.sigma_workspace_admin());
create function public.sigma_admin_settings_init() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if new.role='admin' then insert into public.sigma_referral_settings(admin_id) values(new.id) on conflict do nothing; end if;return new;
end $$;
revoke all on function public.sigma_admin_settings_init() from public;
create trigger sigma_admin_settings after update of role on public.sigma_profiles for each row execute function public.sigma_admin_settings_init();
create or replace function public.sigma_save_referral_settings(p_data jsonb,p_version bigint) returns public.sigma_referral_settings
language plpgsql security definer set search_path='' as $$
declare saved public.sigma_referral_settings; entry record;
begin
  if not public.sigma_is_admin() then raise exception 'Admin access required'; end if;
  if p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>65536 or jsonb_typeof(p_data->'links') is distinct from 'object' then raise exception 'Invalid link settings'; end if;
  for entry in select key,value from jsonb_each_text(p_data->'links') loop
    if entry.value<>'' and (entry.value !~ '^https://[^[:space:]]+$' or length(entry.value)>4000) then raise exception 'Only HTTPS destinations are allowed'; end if;
  end loop;
  if coalesce(p_data->>'supportPhone','') !~ '^[+0-9 ()-]{0,25}$' then raise exception 'Invalid support number'; end if;
  select * into saved from public.sigma_referral_settings where admin_id=auth.uid() for update;
  if saved.version is distinct from p_version then raise exception 'Links changed in another tab. Reload before saving.'; end if;
  update public.sigma_referral_settings set data=p_data,version=version+1,updated_by=auth.uid(),updated_at=now() where admin_id=auth.uid() returning * into saved;
  return saved;
end $$;
-- Existing Google Forms belong to the original administrator. Assignment
-- never crosses workspaces, and new forms default to that existing integration.
alter table public.sigma_form_enquiries add column admin_id uuid references public.sigma_profiles(id);
update public.sigma_form_enquiries e set admin_id=coalesce((select managing_admin from public.sigma_profiles where id=e.owner_id),public.sigma_root_admin());
alter table public.sigma_form_enquiries alter column admin_id set not null;
alter table public.sigma_form_enquiries alter column admin_id set default public.sigma_root_admin();
grant execute on function public.sigma_root_admin() to service_role;
drop policy sigma_enquiry_read on public.sigma_form_enquiries;
create policy sigma_enquiry_read on public.sigma_form_enquiries for select to authenticated using(owner_id=auth.uid() or (public.sigma_is_admin() and admin_id=auth.uid()));
create or replace function public.sigma_assign_form_enquiry(p_id uuid,p_owner uuid) returns void language plpgsql security definer set search_path='' as $$ begin
 if not public.sigma_is_admin() then raise exception 'Admin access required'; end if;
 if not exists(select 1 from public.sigma_profiles where id=p_owner and role='partner' and public.sigma_manages_partner(id)) then raise exception 'Choose an existing partner'; end if;
 update public.sigma_form_enquiries set owner_id=p_owner,assigned_by=auth.uid(),assigned_at=now() where id=p_id and admin_id=auth.uid();
 if not found then raise exception 'Enquiry not found'; end if;
end $$;
create or replace function public.sigma_set_form_sync_key(p_hash text) returns void language plpgsql security definer set search_path='' as $$ begin
 if not public.sigma_is_admin() or auth.uid() is distinct from public.sigma_root_admin() then raise exception 'Admin access required'; end if;
 if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid sync key'; end if;
 insert into public.sigma_form_sync_keys(id,key_hash,updated_by) values(true,p_hash,auth.uid()) on conflict(id) do update set key_hash=excluded.key_hash,updated_by=auth.uid(),updated_at=now();
end $$;
commit;
