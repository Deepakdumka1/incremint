import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function setup(){
  const fields=Object.fromEntries(['customerName','customerMobile','insurer','policyNumber','product','premium','startDate','expiryDate','extractionChecked'].map(k=>[k,{value:k==='premium'?'0':'',required:false,checked:false}]));
  const nodes=Object.fromEntries(['button[type=submit]','[data-extraction-status]','[data-extraction-stop]','[data-extraction-review]'].map(k=>[k,{hidden:false,disabled:false,textContent:''}]));
  const form={isConnected:true,elements:{namedItem:k=>fields[k]},querySelector:k=>nodes[k]};
  const pending=[];
  const context={AbortController,MutationObserver:class{observe(){}disconnect(){}},setTimeout:()=>1,clearTimeout(){},document:{querySelector:()=>({})},PortalCore:{validateFile:async()=>{}},PolicyFields:{parse:text=>({fields:JSON.parse(text)})},injectedReader:{readPolicy:()=>new Promise(resolve=>pending.push(resolve))}};
  vm.createContext(context);
  vm.runInContext(readFileSync('dist/policy-autofill.js','utf8').replace(/await import\('\/vendor\/policy-reader\.mjs[^']*'\)/,"injectedReader"),context);
  const start=async()=>{const promise=context.policyAutoFill({form,files:[{}]});await new Promise(resolve=>setImmediate(resolve));return {promise,resolve:pending.at(-1)}};
  return {fields,nodes,form,context,start};
}
test('autofill preserves existing and newly edited entries and requires review',async()=>{
  const s=setup();s.fields.customerName.value='Manual name';const run=await s.start();
  assert.equal(s.nodes['button[type=submit]'].disabled,true);
  s.fields.policyNumber.value='TYPED-123';run.resolve({text:JSON.stringify({customerName:'Detected name',customerMobile:'9876543210',policyNumber:'PDF-123',premium:'1250.50'}),ocrPages:0});await run.promise;
  assert.equal(s.fields.customerName.value,'Manual name');assert.equal(s.fields.customerMobile.value,'9876543210');assert.equal(s.fields.policyNumber.value,'TYPED-123');assert.equal(s.fields.premium.value,'1250.50');assert.equal(s.fields.extractionChecked.required,true);assert.equal(s.nodes['button[type=submit]'].disabled,false);

});
test('replacement files and stopping cannot apply stale extraction results',async()=>{
  const s=setup(),old=await s.start(),latest=await s.start();
  latest.resolve({text:JSON.stringify({policyNumber:'LATEST-123'}),ocrPages:0});await latest.promise;
  old.resolve({text:JSON.stringify({policyNumber:'STALE-123'}),ocrPages:0});await old.promise;assert.equal(s.fields.policyNumber.value,'LATEST-123');
  const next=await s.start();s.context.policyStopReading(s.form);next.resolve({text:JSON.stringify({policyNumber:'STOPPED-123'}),ocrPages:0});await next.promise;
  assert.equal(s.fields.policyNumber.value,'');assert.equal(s.nodes['button[type=submit]'].disabled,false);
});
