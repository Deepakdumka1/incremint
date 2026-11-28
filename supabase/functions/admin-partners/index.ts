import {createClient} from 'npm:@supabase/supabase-js@2.119.2';
const canonicalOrigin='https://sigma0nine.in';
const trustedOrigins=new Set([canonicalOrigin,'https://www.sigma0nine.in','https://first-mediumpurple-kangaroo-62.hostingersite.com','https://incremint-sigma.vercel.app']);
Deno.serve(async(req)=>{
 const requestedOrigin=req.headers.get('origin')||'',origin=trustedOrigins.has(requestedOrigin)?requestedOrigin:canonicalOrigin;
 const headers={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
 const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
 if(requestedOrigin&&!trustedOrigins.has(requestedOrigin))return reply(403,{error:'Origin not allowed'});
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method!=='POST')return reply(405,{error:'Method not allowed'});
 const token=req.headers.get('authorization')||'';
 if(!/^Bearer \S+$/.test(token))return reply(401,{error:'Sign in required'});
 const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
 const caller=createClient(url,anon,{global:{headers:{Authorization:token}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data:identity,error:authError}=await caller.auth.getUser(token.slice(7));
 if(authError||!identity.user)return reply(401,{error:'Sign in again'});
 const admin=await caller.rpc('sigma_is_admin');
 if(admin.error||admin.data!==true)return reply(403,{error:'Admin access required'});
 let body;try{if(Number(req.headers.get('content-length'))>4096)return reply(413,{error:'Request too large'});body=await req.json()}catch{return reply(400,{error:'Invalid request'})}
 if(!body||typeof body!=='object'||Array.isArray(body))return reply(400,{error:'Invalid request'});
 if(body.checkOnly===true)return reply(200,{authorized:true,message:'Admin invitation service connected. Email delivery still depends on your sender configuration.'});
 const email=String(body.email||'').trim().toLowerCase(),name=String(body.fullName||'').trim();
 if(email.length>254||!/^\S+@\S+\.\S+$/.test(email)||name.length<2||name.length>100)return reply(400,{error:'Enter a valid name and email'});
 const address=String(body.address||'').trim(),rawPhone=String(body.phone||'').trim();
 let phone=rawPhone.replace(/[\s()+-]/g,'');if(phone.length===12&&phone.startsWith('91'))phone=phone.slice(2);
 if(address.length>500)return reply(400,{error:'Address must be 500 characters or fewer'});
 if(rawPhone&&!/^[6-9]\d{9}$/.test(phone))return reply(400,{error:'Enter a valid 10-digit partner phone number'});
 const reserved=await caller.rpc('sigma_reserve_partner_invite',{p_email:email,p_name:name});
 if(reserved.error)return reply(400,{error:reserved.error.message});
 const service=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 if(reserved.data.user_id){
  const linked=await caller.rpc('sigma_complete_partner_invite',{p_invite:reserved.data.id,p_phone:phone,p_address:address});
  if(linked.error)return reply(400,{error:linked.error.message});
  await service.from('sigma_partner_invites').update({status:'linked'}).eq('id',reserved.data.id);
  return reply(200,{sent:false,linked:true,message:'Partner added to your workspace. They use their existing email and password and select your workspace. Other administrators’ records remain private.'});
 }
 const invitation=await service.auth.admin.inviteUserByEmail(email,{data:{full_name:name,phone,address},redirectTo:origin+'/partner?invite=1'});
 const updated=await service.from('sigma_partner_invites').update({status:invitation.error?'failed':'sent',user_id:invitation.data?.user?.id||null}).eq('id',reserved.data.id);
 if(invitation.error)return reply(400,{error:invitation.error.message});
 const membership=await caller.rpc('sigma_complete_partner_invite',{p_invite:reserved.data.id,p_phone:phone,p_address:address});
 if(membership.error)return reply(400,{error:'Account invited, but workspace linking needs a retry: '+membership.error.message});
 if(updated.error)return reply(200,{sent:true,message:'Invitation sent. Refresh the list to check its status.'});
 return reply(200,{sent:true,message:'Invitation emailed. The partner must verify their email and choose a password.'});
});
