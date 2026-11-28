begin;
alter table public.sigma_profiles add column avatar_path text not null default '';
alter table public.sigma_profiles add constraint sigma_avatar_owner check(avatar_path='' or (split_part(avatar_path,'/',1)=id::text and avatar_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$'));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('sigma-profile-photos','sigma-profile-photos',false,1048576,array['image/jpeg']);
create policy sigma_avatar_upload on storage.objects for insert to authenticated with check(bucket_id='sigma-profile-photos' and (storage.foldername(name))[1]=auth.uid()::text and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$');
create policy sigma_avatar_read on storage.objects for select to authenticated using(bucket_id='sigma-profile-photos' and (storage.foldername(name))[1]=auth.uid()::text);
create function public.sigma_save_profile(p_name text,p_phone text,p_address text,p_avatar text) returns public.sigma_profiles language plpgsql security definer set search_path='' as $$
declare saved public.sigma_profiles; number text:=regexp_replace(coalesce(p_phone,''),'[ ()+-]','','g');
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if length(number)=12 and left(number,2)='91' then number:=substring(number from 3); end if;
 if p_name is null or length(trim(p_name)) not between 1 and 100 then raise exception 'Enter your name (up to 100 characters)'; end if;
 if number<>'' and number !~ '^[6-9][0-9]{9}$' then raise exception 'Enter a valid 10-digit mobile number'; end if;
 if p_address is null or length(p_address)>500 then raise exception 'Address must be 500 characters or fewer'; end if;
 if p_avatar is null then raise exception 'Invalid profile photo'; end if;
 if p_avatar<>'' and (split_part(p_avatar,'/',1)<>auth.uid()::text or p_avatar !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$' or not exists(select 1 from storage.objects where bucket_id='sigma-profile-photos' and name=p_avatar and metadata->>'mimetype'='image/jpeg' and (metadata->>'size')::bigint between 1 and 1048576)) then raise exception 'Upload your own profile photo first'; end if;
 update public.sigma_profiles set full_name=trim(p_name),phone=number,address=trim(p_address),avatar_path=p_avatar where id=auth.uid() returning * into saved;
 if saved.id is null then raise exception 'Profile not found'; end if;return saved;
end $$;
revoke all on function public.sigma_save_profile(text,text,text,text) from public;
grant execute on function public.sigma_save_profile(text,text,text,text) to authenticated;
commit;
