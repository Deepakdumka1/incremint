-- Admin-assisted uploads retain the partner as owner and the real uploader as actor.
begin;
alter table public.sigma_policies add column uploaded_by uuid references public.sigma_profiles(id);
update public.sigma_policies set uploaded_by=owner_id;
alter table public.sigma_policies alter column uploaded_by set default auth.uid();
alter table public.sigma_policies alter column uploaded_by set not null;
drop policy sigma_policy_create on public.sigma_policies;
create policy sigma_policy_create on public.sigma_policies for insert to authenticated
with check((owner_id=auth.uid() or public.sigma_is_admin()) and uploaded_by=auth.uid()
 and exists(select 1 from public.sigma_profiles recipient where recipient.id=owner_id and recipient.role='partner')
 and status='Uploading' and review_note='' and reviewed_by is null and reviewed_at is null and submitted_at is null);
drop policy sigma_document_upload on storage.objects;
create policy sigma_document_upload on storage.objects for insert to authenticated
with check(bucket_id='sigma-policies' and exists(select 1 from public.sigma_policies p
 where (p.owner_id=auth.uid() or public.sigma_is_admin()) and p.status='Uploading' and p.storage_path=name));
create or replace function public.sigma_submit_policy(p_policy_id uuid) returns public.sigma_policies
language plpgsql security definer set search_path='' as $$
declare p public.sigma_policies;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select * into p from public.sigma_policies where id=p_policy_id for update;
 if p.id is null or (p.owner_id<>auth.uid() and not public.sigma_is_admin()) then raise exception 'Policy not available'; end if;
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
commit;
