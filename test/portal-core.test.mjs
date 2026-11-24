import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const c={};vm.createContext(c);vm.runInContext(readFileSync('dist/portal-core.js','utf8'),c);const core=c.PortalCore;
test('credits use exact integer paise and integer points',()=>{assert.equal(core.paise('99.99'),9999);assert.equal(core.paise('0.10'),10);assert.equal(core.money('9999'),'₹99.99');assert.throws(()=>core.paise('1.001'));assert.throws(()=>core.paise('-1'));assert.throws(()=>core.points('1.5'));assert.throws(()=>core.validateCredit('0','0'));assert.equal(core.validateCredit('50','0').points,50)});
test('phone and identifier validation',()=>{assert.equal(core.phone('+91 9000000000'),'9000000000');assert.throws(()=>core.phone('1234'));assert.throws(()=>core.uuid("bad' onclick='"))});
test('file content and size restrictions',async()=>{const fake={size:12,type:'application/pdf',slice(){return {arrayBuffer:async()=>new TextEncoder().encode('%PDF-1.7\n').buffer}}};assert.equal(await core.validateFile(fake),'pdf');await assert.rejects(core.validateFile({...fake,size:10485761}));await assert.rejects(core.validateFile({...fake,type:'image/png'}));assert.throws(()=>core.fileExtension('text/html'))});
