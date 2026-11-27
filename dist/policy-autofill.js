let policyExtractionSerial=0;
function policyStopReading(form,message='Automatic reading stopped. Enter the details manually.'){
  if(!form)return;form.policyExtraction?.abort();form.policyRun=++policyExtractionSerial;form.policyReading=false;
  const submit=form.querySelector('button[type=submit]');if(submit)submit.disabled=false;
  const state=form.querySelector('[data-extraction-status]');if(state)state.textContent=message;
  const stop=form.querySelector('[data-extraction-stop]');if(stop)stop.hidden=true;
}
async function policyAutoFill(input){
  const form=input.form,file=input.files[0];policyStopReading(form,'');
  for(const [key,value] of Object.entries(form.policyAutoValues||{})){const field=form.elements.namedItem(key);if(field?.value===value)field.value=key==='premium'?'0':''}
  form.policyAutoValues={};form.querySelector('[data-extraction-review]').hidden=true;const confirmation=form.elements.namedItem('extractionChecked');confirmation.required=false;confirmation.checked=false;
  if(!file)return;
  const run=++policyExtractionSerial;form.policyRun=run;form.policyReading=true;form.policyExtraction=new AbortController();
  const state=form.querySelector('[data-extraction-status]'),stop=form.querySelector('[data-extraction-stop]'),submit=form.querySelector('button[type=submit]');stop.hidden=false;submit.disabled=true;
  const baseline=Object.fromEntries(['customerName','customerMobile','insurer','policyNumber','product','premium','startDate','expiryDate'].map(k=>[k,form.elements.namedItem(k).value]));
  const active=()=>form.isConnected&&form.policyRun===run&&!form.policyExtraction.signal.aborted;
  const progress=message=>{if(active())state.textContent=message};
  const timeout=setTimeout(()=>{if(active())policyStopReading(form,'Reading took too long. You can enter the information manually or retry the file.')},180000);
  const observer=new MutationObserver(()=>{if(!form.isConnected)form.policyExtraction?.abort()});observer.observe(document.querySelector('#overlay'),{childList:true,subtree:true});
  try{
    await PortalCore.validateFile(file);progress('Preparing private document reader…');
    const reader=await import('/vendor/policy-reader.mjs');if(!active())return;
    const result=await reader.readPolicy(file,{signal:form.policyExtraction.signal,onProgress:progress});if(!active())return;
    const parsed=PolicyFields.parse(result.text);let filled=0;
    for(const [key,value] of Object.entries(parsed.fields)){const field=form.elements.namedItem(key);if(!field||field.value!==baseline[key]||(baseline[key]&&!(key==='premium'&&baseline[key]==='0')))continue;field.value=value;form.policyAutoValues[key]=field.value;filled++}
    const names={customerName:'Customer name',customerMobile:'Mobile',insurer:'Insurer',policyNumber:'Policy number',product:'Product',premium:'Premium',startDate:'Start date',expiryDate:'Expiry date'};
    state.textContent=filled?`${filled} fields suggested${result.ocrPages?' using OCR':''}: ${Object.keys(form.policyAutoValues).map(k=>names[k]).join(', ')}. Check every value against the document.`:'No reliable labelled fields found. Enter the policy details manually.';
    if(result.limited)state.textContent+=' Only the first 8 pages and up to 3 scanned pages were read; check the remaining pages manually.';
    if(filled){form.querySelector('[data-extraction-review]').hidden=false;confirmation.required=true}
  }catch(e){if(active())state.textContent=/password|encrypted/i.test(e.message)?'Password-protected PDF: upload an unlocked copy or enter details manually.':'Could not read this document. You can still enter the details manually and upload it.'}
  finally{clearTimeout(timeout);observer.disconnect();if(form.policyRun===run){form.policyReading=false;submit.disabled=false;stop.hidden=true}}
}
