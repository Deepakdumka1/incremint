// Install in the form owner's Google Apps Script project. Never publish this script as a web app.
const SIGMA_FORMS=['1EoB9OkM8QA9U7ZL3imBWAnYRV-_61iEUSnw5PbM8i4c','1ED9yFYc0w4J4dZ1vz9a5iDi59a0Oa9Dl-DKyp_FL5Zc','16cwDYjprcF5Nmi53q7MKIl_HNzmuiDoJ9YzfqgozaaE','1M4wLivcGVsaUilUOn5rC2Rv0xZnJWdi-4xN-YHn1pqQ'];
function sigmaPost_(payload){
 const settings=PropertiesService.getScriptProperties(),key=settings.getProperty('SIGMA_SYNC_KEY'),anon=settings.getProperty('SUPABASE_ANON_KEY');
 if(!key||!anon)throw new Error('Configure SIGMA_SYNC_KEY and SUPABASE_ANON_KEY in Script Properties first.');
 const response=UrlFetchApp.fetch('https://tdnywfoljybghrnltsoq.supabase.co/functions/v1/forms-sync',{method:'post',contentType:'application/json',headers:{Authorization:'Bearer '+anon,apikey:anon,'x-sigma-sync-key':key},payload:JSON.stringify(payload),muteHttpExceptions:true});
 if(response.getResponseCode()!==200)throw new Error('Sync request failed with HTTP '+response.getResponseCode()+'. No response data was logged.');
 return JSON.parse(response.getContentText());
}
function sigmaSend_(formId,response){return sigmaPost_({formId,responseId:response.getId(),submittedAt:response.getTimestamp().toISOString(),answers:response.getItemResponses().map(item=>({question:item.getItem().getTitle(),value:Array.isArray(item.getResponse())?item.getResponse().join(', '):String(item.getResponse()??'')}))})}
function sigmaOnSubmit(event){const formId=event.source.getId();if(!SIGMA_FORMS.includes(formId))throw new Error('Unknown form');sigmaSend_(formId,event.response)}
function sigmaSweep(){
 const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;try{
 const properties=PropertiesService.getScriptProperties();
 for(const formId of SIGMA_FORMS){const cursor=properties.getProperty('cursor_'+formId);const form=FormApp.openById(formId),responses=(cursor?form.getResponses(new Date(Number(cursor)-1)):form.getResponses()).sort((a,b)=>a.getTimestamp()-b.getTimestamp());let count=0;
 for(const response of responses){if(count++>=200)break;sigmaSend_(formId,response);properties.setProperty('cursor_'+formId,String(response.getTimestamp().getTime()))}}
 }finally{lock.releaseLock()}
}
function sigmaInstall(){
 if(!sigmaPost_({checkOnly:true}).connected)throw new Error('Sync connection failed');
 const existing=ScriptApp.getProjectTriggers();
 for(const id of SIGMA_FORMS){FormApp.openById(id);if(!existing.some(t=>t.getHandlerFunction()==='sigmaOnSubmit'&&t.getTriggerSourceId()===id))ScriptApp.newTrigger('sigmaOnSubmit').forForm(id).onFormSubmit().create()}
 if(!existing.some(t=>t.getHandlerFunction()==='sigmaSweep'))ScriptApp.newTrigger('sigmaSweep').timeBased().everyMinutes(5).create();
 sigmaSweep();
}
