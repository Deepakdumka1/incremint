-- Invitation-only partner onboarding and private, immutable payment receipts.
begin;
create table public.sigma_partner_invites (
  id uuid primary key default gen_random_uuid(),
  email text unique not null check(email=lower(trim(email)) and length(email)<=254),
  full_name text not null check(length(trim(full_name)) between 2 and 100),
  invited_by uuid not null references public.sigma_profiles(id),
  status text not null default 'sending' check(status in ('sending','sent','failed')),
  user_id uuid references public.sigma_profiles(id),
  attempts integer not null default 1,
  last_attempt_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.sigma_partner_invites enable row level security;
revoke all on public.sigma_partner_invites from anon,authenticated;
grant select on public.sigma_partner_invites to authenticated;
grant all on public.sigma_partner_invites to service_role;
create policy sigma_invites_read on public.sigma_partner_invites for select to authenticated using(public.sigma_is_admin());
create function public.sigma_reserve_partner_invite(p_email text,p_name text) returns public.sigma_partner_invites
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
 if saved.id is not null and saved.last_attempt_at>now()-interval '60 seconds' then raise exception 'Wait one minute before retrying this invitation'; end if;
 insert into public.sigma_partner_invites(email,full_name,invited_by) values(normalized,trim(p_name),auth.uid())
 on conflict(email) do update set full_name=excluded.full_name,invited_by=excluded.invited_by,status='sending',last_attempt_at=now(),attempts=sigma_partner_invites.attempts+1 returning * into saved;
 return saved;
end $$;
revoke all on function public.sigma_reserve_partner_invite(text,text) from public;
grant execute on function public.sigma_reserve_partner_invite(text,text) to authenticated;

-- Keep historic point entries intact; new awards are money-only.
create or replace function public.sigma_credit_policy(p_policy_id uuid,p_points bigint,p_amount_paise bigint,p_note text default '')
returns public.sigma_ledger language plpgsql security definer set search_path='' as $$
declare p public.sigma_policies; entry public.sigma_ledger;
begin
 if not public.sigma_is_admin() then raise exception 'Admin access required'; end if;
 if p_points is distinct from 0::bigint or p_amount_paise is null or p_amount_paise<=0 or p_amount_paise>100000000000 then raise exception 'Enter a positive earning amount. Points are no longer issued.'; end if;
 if length(coalesce(p_note,''))>2000 then raise exception 'Note is too long'; end if;
 select * into p from public.sigma_policies where id=p_policy_id for update;
 if p.id is null or p.status<>'Approved' then raise exception 'Approve the policy before crediting'; end if;
 if exists(select 1 from public.sigma_ledger where policy_id=p.id) then raise exception 'This policy has already been credited'; end if;
 insert into public.sigma_ledger(owner_id,policy_id,points,amount_paise,note,credited_by)
 values(p.owner_id,p.id,0,p_amount_paise,coalesce(p_note,''),auth.uid()) returning * into entry;
 insert into public.sigma_audit(actor_id,policy_id,action,details) values(auth.uid(),p.id,'Credited',jsonb_build_object('amount_paise',p_amount_paise,'ledger_id',entry.id));
 return entry;
end $$;

create table public.sigma_payment_receipts (
 id uuid primary key default gen_random_uuid(),
 ledger_id uuid unique not null references public.sigma_ledger(id),
 owner_id uuid not null references public.sigma_profiles(id),
 utr text not null default '' check(utr='' or utr ~ '^[A-Z0-9/-]{6,40}$'),
 paid_on date not null check(paid_on<=current_date),
 note text not null default '' check(length(note)<=2000),
 storage_path text unique,
 original_file_name text,
 file_type text,
 file_size bigint,
 recorded_by uuid not null references public.sigma_profiles(id),
 created_at timestamptz not null default now(),
 check(utr<>'' or storage_path is not null),
 check((storage_path is null and original_file_name is null and file_type is null and file_size is null) or
 (storage_path is not null and length(original_file_name) between 1 and 200 and file_type in ('application/pdf','image/png','image/jpeg','image/webp') and file_size between 1 and 10485760))
);
alter table public.sigma_payment_receipts enable row level security;
revoke all on public.sigma_payment_receipts from anon,authenticated;
grant select on public.sigma_payment_receipts to authenticated;
create policy sigma_receipts_read on public.sigma_payment_receipts for select to authenticated using(owner_id=auth.uid() or public.sigma_is_admin());
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('sigma-payment-proofs','sigma-payment-proofs',false,10485760,array['application/pdf','image/png','image/jpeg','image/webp']);
create policy sigma_payment_upload on storage.objects for insert to authenticated with check(bucket_id='sigma-payment-proofs' and public.sigma_is_admin() and exists(select 1 from public.sigma_ledger l where l.owner_id::text=(storage.foldername(name))[1] and l.id::text=(storage.foldername(name))[2] and l.amount_paise>0 and not exists(select 1 from public.sigma_payment_receipts r where r.ledger_id=l.id)));
create policy sigma_payment_read on storage.objects for select to authenticated using(bucket_id='sigma-payment-proofs' and (public.sigma_is_admin() or exists(select 1 from public.sigma_payment_receipts r where r.storage_path=name and r.owner_id=auth.uid())));
create function public.sigma_record_payment(p_ledger_id uuid,p_utr text,p_paid_on date,p_note text default '',p_storage_path text default null,p_file_name text default null,p_file_type text default null,p_file_size bigint default null)
returns public.sigma_payment_receipts language plpgsql security definer set search_path='' as $$
declare l public.sigma_ledger; saved public.sigma_payment_receipts; reference text:=upper(trim(coalesce(p_utr,''))); object_row storage.objects;
begin
 if not public.sigma_is_admin() then raise exception 'Admin access required'; end if;
 if (reference<>'' and reference !~ '^[A-Z0-9/-]{6,40}$') or (reference='' and p_storage_path is null) then raise exception 'Enter a valid UTR or attach a payment screenshot'; end if;
 if p_paid_on is null or p_paid_on>current_date or length(coalesce(p_note,''))>2000 then raise exception 'Enter a valid payment date and note'; end if;
 select * into l from public.sigma_ledger where id=p_ledger_id for update;
 if l.id is null or l.amount_paise<=0 then raise exception 'Award the earning amount before recording payment'; end if;
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
revoke all on function public.sigma_record_payment(uuid,text,date,text,text,text,text,bigint) from public;
grant execute on function public.sigma_record_payment(uuid,text,date,text,text,text,text,bigint) to authenticated;
create function public.sigma_payment_summary() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('paid_paise',coalesce(sum(l.amount_paise) filter(where r.id is not null),0)::text,'unpaid_paise',coalesce(sum(l.amount_paise) filter(where r.id is null),0)::text)
 from public.sigma_ledger l left join public.sigma_payment_receipts r on r.ledger_id=l.id where auth.uid() is not null and (l.owner_id=auth.uid() or public.sigma_is_admin());
$$;
revoke all on function public.sigma_payment_summary() from public;
grant execute on function public.sigma_payment_summary() to authenticated;
do $$ begin if exists(select 1 from pg_publication where pubname='supabase_realtime') then execute 'alter publication supabase_realtime add table public.sigma_payment_receipts'; end if; end $$;
commit;
