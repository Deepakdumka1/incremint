import {createClient} from 'npm:@supabase/supabase-js@2.119.2';
const products:Record<string,string>={
 '1EoB9OkM8QA9U7ZL3imBWAnYRV-_61iEUSnw5PbM8i4c':'Fire & Burglary',
 '1ED9yFYc0w4J4dZ1vz9a5iDi59a0Oa9Dl-DKyp_FL5Zc':'Marine Insurance',
 '16cwDYjprcF5Nmi53q7MKIl_HNzmuiDoJ9YzfqgozaaE':'Workmen Compensation',
 '1M4wLivcGVsaUilUOn5rC2Rv0xZnJWdi-4xN-YHn1pqQ':'Term Offline'
};
Deno.serve(async(req)=>{
 const reply=(status:number,data:unknown)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
 if(req.method!=='POST')return reply(405,{error:'POST required'});
 const secret=req.headers.get('x-sigma-sync-key')||'';if(!/^[a-f0-9]{64}$/.test(secret))return reply(401,{error:'Sync authentication required'});
 const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret)))).map(x=>x.toString(16).padStart(2,'0')).join('');
 const key=await db.from('sigma_form_sync_keys').select('key_hash').eq('id',true).single();
 if(key.error||!key.data||key.data.key_hash!==hash)return reply(401,{error:'Invalid sync key'});
 const raw=await req.text();if(raw.length>110000)return reply(413,{error:'Response too large'});
 let body;try{body=JSON.parse(raw)}catch{return reply(400,{error:'Invalid JSON'})}
 if(body?.checkOnly===true)return reply(200,{connected:true});
 if(!body||typeof body.formId!=='string'||!Object.hasOwn(products,body.formId)||typeof body.responseId!=='string'||!body.responseId||body.responseId.length>500||!Array.isArray(body.answers)||body.answers.length>100||typeof body.submittedAt!=='string'||!Number.isFinite(Date.parse(body.submittedAt)))return reply(400,{error:'Invalid form response'});
 const answers=[];for(const a of body.answers){if(typeof a?.question!=='string'||a.question.length>500||typeof a.value!=='string'||a.value.length>20000)return reply(400,{error:'Invalid answer'});answers.push({question:a.question,value:a.value})}
 const field=(names:string[])=>answers.find(a=>names.includes(a.question.trim().toLowerCase()))?.value.trim()||'';
 const row={form_id:body.formId,response_id:body.responseId,product:products[body.formId],submitted_at:new Date(body.submittedAt).toISOString(),answers,
 claimed_partner_email:field(['partner email']).toLowerCase().slice(0,254),customer_name:field(['customer name','customer/company name','employer/company name']).slice(0,150),customer_mobile:field(['customer mobile','contact mobile']).slice(0,30)};
 // Partner email is self-reported. Only an administrator can assign access to the response.
 const existing=await db.from('sigma_form_enquiries').select('id').eq('form_id',row.form_id).eq('response_id',row.response_id).maybeSingle();
 if(existing.error)return reply(503,{error:'Database unavailable'});
 if(existing.data)return reply(200,{synced:true,duplicate:true});
 const saved=await db.from('sigma_form_enquiries').insert(row);
 if(saved.error&&saved.error.code!=='23505')return reply(503,{error:'Could not store response'});
 return reply(200,{synced:true});
});
