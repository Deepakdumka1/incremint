-- Contact details supplied by the administrator during partner invitation.
begin;
alter table public.sigma_profiles add column address text not null default ''
  check (length(address)<=500);
create or replace function public.sigma_new_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.sigma_profiles(id,full_name,email,phone,address)
  values(new.id,coalesce(nullif(left(trim(new.raw_user_meta_data->>'full_name'),100),''),'Partner'),
    coalesce(new.email,''),left(coalesce(new.raw_user_meta_data->>'phone',''),20),
    left(trim(coalesce(new.raw_user_meta_data->>'address','')),500));
  return new;
end;
$$;
revoke all on function public.sigma_new_profile() from public;
commit;
