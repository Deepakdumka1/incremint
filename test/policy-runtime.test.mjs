import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import vm from 'node:vm';
import {createWorker} from 'tesseract.js';
import {DOMMatrix,ImageData,Path2D} from '@napi-rs/canvas';
await import('./make-policy-fixtures.mjs');
Object.assign(globalThis,{DOMMatrix,ImageData,Path2D});
const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
const scope={};vm.createContext(scope);vm.runInContext(readFileSync('dist/policy-fields.js','utf8'),scope);
test('real PDF.js reads a synthetic text policy and extracts seven fields while leaving mobile manual',async()=>{
 const task=pdfjs.getDocument({data:new Uint8Array(readFileSync('test-results/sample-policy.pdf')),standardFontDataUrl:resolve('node_modules/pdfjs-dist/standard_fonts')+'/'});const pdf=await task.promise;
 try{const page=await pdf.getPage(1),content=await page.getTextContent();let text='';for(const item of content.items)if(item.str)text+=item.str+(item.hasEOL?'\n':'');const fields=scope.PolicyFields.parse(text).fields;assert.equal(fields.policyNumber,'SIG-2026-123456');assert.equal(fields.premium,'11800.50');assert.equal(Object.keys(fields).length,7);assert.equal(fields.customerMobile,undefined)}finally{await task.destroy()}
});
test('free OCR reads a synthetic scanned policy image using local English data',async()=>{
 const worker=await createWorker('eng',1,{langPath:resolve('node_modules/@tesseract.js-data/eng/4.0.0'),cacheMethod:'none'});
 try{const result=await worker.recognize('test-results/sample-policy.png');const fields=scope.PolicyFields.parse(result.data.text).fields;assert.equal(fields.policyNumber,'SIG-2026-123456');assert.equal(fields.customerName,'Asha Sharma');assert.equal(fields.premium,'11800.50')}finally{await worker.terminate()}
});
