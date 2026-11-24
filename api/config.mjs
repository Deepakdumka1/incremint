import {publicProject} from '../config/public-project.mjs';
export default function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
  const envOverride=Object.hasOwn(process.env,'SUPABASE_URL')||Object.hasOwn(process.env,'SUPABASE_PUBLISHABLE_KEY')||Object.hasOwn(process.env,'SUPABASE_ANON_KEY');
  const url=(envOverride?(process.env.SUPABASE_URL||''):publicProject.url).trim().replace(/\/$/,'');
  const key=(envOverride?(process.env.SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY||''):publicProject.publishableKey).trim();
  const keyRole=(()=>{try{return JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString()).role}catch{return ''}})();
  const publicKey=key.startsWith('sb_publishable_')||keyRole==='anon';
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)||!publicKey||key.startsWith('sb_secret_')||keyRole==='service_role')return res.status(200).json({configured:false});
  return res.status(200).json({configured:true,url,publishableKey:key});
}
