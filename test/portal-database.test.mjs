import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
const partnerA='11111111-1111-4111-8111-111111111111',partnerB='22222222-2222-4222-8222-222222222222',admin='33333333-3333-4333-8333-333333333333';
const policyA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',policyB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
async function user(id,callback){await db.exec(`set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`);try{return await callback()}finally{await db.exec('reset role;reset request.jwt.claim.sub;')}}
async function failAs(id,sql,params=[]){await user(id,()=>assert.rejects(db.query(sql,params)))}
before(async()=>{
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,storage,public to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb default '{}');
    alter table storage.objects enable row level security;grant select,insert,delete on storage.objects to authenticated;`);
  await db.exec(readFileSync('supabase/migrations/202611240001_phase1.sql','utf8'));
  await db.query(`insert into auth.users(id,email,raw_user_meta_data) values($1,'partner-a@example.test','{"full_name":"Partner A","role":"admin"}'),($2,'partner-b@example.test','{"full_name":"Partner B"}'),($3,'admin@example.test','{"full_name":"Admin"}')`,[partnerA,partnerB,admin]);
  await db.query('update sigma_profiles set role=\'admin\' where id=$1',[admin]);
});
after(()=>db.close());
test('registration cannot self-assign admin, and profile role is not client-editable',async()=>{
  await user(partnerA,async()=>{assert.equal((await db.query('select role from sigma_profiles')).rows[0].role,'partner');await assert.rejects(db.query("update sigma_profiles set role='admin' where id=$1",[partnerA]));});
});
test('partners create only their own upload record and cannot forge a reviewed record',async()=>{
  const sql=`insert into sigma_policies(id,owner_id,customer_name,customer_mobile,product,original_file_name,file_type,file_size,storage_path) values($1,$2,'Customer','9000000000','Health','policy.pdf','application/pdf',100,$3)`;
  await user(partnerA,()=>db.query(sql,[policyA,partnerA,`${partnerA}/${policyA}/policy.pdf`]));
  await user(partnerB,()=>db.query(sql,[policyB,partnerB,`${partnerB}/${policyB}/policy.pdf`]));
  await failAs(partnerB,sql,['cccccccc-cccc-4ccc-8ccc-cccccccccccc',partnerA,`${partnerA}/cccccccc-cccc-4ccc-8ccc-cccccccccccc/policy.pdf`]);
  await failAs(partnerA,"update sigma_policies set status='Approved' where id=$1",[policyA]);
  await failAs(partnerA,"insert into sigma_policies(owner_id,customer_name,customer_mobile,product,original_file_name,file_type,file_size,storage_path,status) values($1,'X','9000000000','Health','x.pdf','application/pdf',100,'wrong','Approved')",[partnerA]);
});
test('private documents and rows are isolated by owner; admins can review both',async()=>{
  await user(partnerA,()=>db.query("insert into storage.objects(bucket_id,name) values('sigma-policies',$1)",[`${partnerA}/${policyA}/policy.pdf`]));
  await user(partnerB,async()=>{assert.equal((await db.query('select * from sigma_policies')).rows.length,1);assert.equal((await db.query('select * from storage.objects')).rows.length,0);await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('sigma-policies',$1)",[`${partnerA}/${policyA}/policy.pdf`]));});
  await user(admin,async()=>{assert.equal((await db.query('select * from sigma_policies')).rows.length,2);assert.equal((await db.query('select * from storage.objects')).rows.length,1)});
});
test('submission requires the stored file, records an audit entry and is retry-safe',async()=>{
  await failAs(partnerB,'select sigma_submit_policy($1)',[policyB]);
  await failAs(partnerB,'select sigma_submit_policy($1)',[policyA]);
  await user(partnerA,async()=>{await db.query('select sigma_submit_policy($1)',[policyA]);await db.query('select sigma_submit_policy($1)',[policyA]);assert.equal((await db.query('select status from sigma_policies where id=$1',[policyA])).rows[0].status,'Pending');assert.equal((await db.query("select * from sigma_audit where action='Submitted'")).rows.length,1)});
});
test('only admins may review and only pending policies may be reviewed',async()=>{
  await failAs(partnerA,"select sigma_review_policy($1,'Approved','')",[policyA]);
  await failAs(admin,"select sigma_review_policy($1,'Rejected','')",[policyA]);
  await user(admin,()=>db.query("select sigma_review_policy($1,'Approved','Verified document')",[policyA]));
  await failAs(admin,"select sigma_review_policy($1,'Rejected','Changed mind')",[policyA]);
});
test('credit is admin-only, positive, approval-gated and exactly once',async()=>{
  await failAs(partnerA,"select sigma_credit_policy($1,50,10000,'')",[policyA]);
  await failAs(admin,"select sigma_credit_policy($1,50,10000,'')",[policyB]);
  await failAs(admin,"select sigma_credit_policy($1,-1,10000,'')",[policyA]);
  await failAs(admin,"select sigma_credit_policy($1,0,0,'')",[policyA]);
  await user(admin,()=>db.query("select sigma_credit_policy($1,125,9999,'Phase 1 credit')",[policyA]));
  await failAs(admin,"select sigma_credit_policy($1,125,9999,'retry')",[policyA]);
  await failAs(admin,"update sigma_ledger set points=9999 where policy_id=$1",[policyA]);
  await user(partnerA,async()=>{const row=(await db.query('select * from sigma_ledger')).rows[0];assert.equal(Number(row.points),125);assert.equal(Number(row.amount_paise),9999);const summary=(await db.query('select sigma_portal_summary() as result')).rows[0].result;assert.equal(summary.amount_paise,'9999');assert.equal(summary.points,'125');assert.equal(Number(summary.approved),1)});
  await user(partnerB,async()=>{assert.equal((await db.query('select * from sigma_ledger')).rows.length,0);assert.equal((await db.query('select sigma_portal_summary() as result')).rows[0].result.amount_paise,'0')});
});
test('submitted documents cannot be replaced or deleted by partners',async()=>{
  await user(partnerA,async()=>{await assert.rejects(db.query("update storage.objects set name='changed' where name=$1",[`${partnerA}/${policyA}/policy.pdf`]));await db.query("delete from storage.objects where name=$1",[`${partnerA}/${policyA}/policy.pdf`]);assert.equal((await db.query('select * from storage.objects')).rows.length,1);await assert.rejects(db.query('select sigma_discard_upload($1)',[policyA]))});
});
test('rejected policies retain their reason, stay private and cannot receive credits',async()=>{
  await user(partnerB,async()=>{await db.query("insert into storage.objects(bucket_id,name) values('sigma-policies',$1)",[`${partnerB}/${policyB}/policy.pdf`]);await db.query('select sigma_submit_policy($1)',[policyB])});
  await user(admin,()=>db.query("select sigma_review_policy($1,'Rejected','Policy copy is unreadable')",[policyB]));
  await failAs(admin,"select sigma_credit_policy($1,10,100,'')",[policyB]);
  await user(partnerB,async()=>{const rows=(await db.query('select status,review_note from sigma_policies')).rows;assert.equal(rows.length,1);assert.equal(rows[0].status,'Rejected');assert.equal(rows[0].review_note,'Policy copy is unreadable')});
  await user(partnerA,async()=>{assert.equal((await db.query('select * from sigma_policies where id=$1',[policyB])).rows.length,0);await assert.rejects(db.query("insert into sigma_audit(actor_id,policy_id,action) values($1,$2,'Approved')",[partnerA,policyA]))});
});
test('unauthenticated access is denied',async()=>{await db.exec('set role anon');try{await assert.rejects(db.query('select * from sigma_policies'));await assert.rejects(db.query('select sigma_portal_summary()'))}finally{await db.exec('reset role')}});
