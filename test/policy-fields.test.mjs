import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const scope={};vm.createContext(scope);vm.runInContext(readFileSync('dist/policy-fields.js','utf8'),scope);const {parse,date}=scope.PolicyFields;
test('labelled policy values are extracted with exact premium and dates',()=>{
 const result=parse(`Insured Name: Asha Sharma\nCustomer Mobile: +91 9876543210\nPolicy Number: SIG/2026/123456\nInsurer: Care Health Insurance\nProduct Type: Health insurance\nSum Insured: 10,00,000\nNet Premium: 10,000\nTotal Premium Payable: INR 11,800.50\nPolicy Start Date: 27/11/2026\nPolicy Expiry Date: 26-Nov-2027`);
 assert.equal(result.fields.customerName,'Asha Sharma');assert.equal(result.fields.customerMobile,'9876543210');assert.equal(result.fields.policyNumber,'SIG/2026/123456');assert.equal(result.fields.premium,'11800.50');assert.equal(result.fields.startDate,'2026-11-27');assert.equal(result.fields.expiryDate,'2027-11-26');assert.equal(result.fields.product,'Health');
});
test('agent contacts, sums insured and unlabeled values are never guessed',()=>{
 const result=parse('Agent Name: Agent Example\nAgent Mobile: 9876543210\nSum insured: 500000\nNet Premium: 1500\nQuotation Number: 12345');assert.deepEqual(Object.keys(result.fields),[]);
});
test('conflicting values and impossible/reversed dates remain blank',()=>{
 const fields=parse('Insured Name: Asha Sharma\nInsured Name: Ravi Kumar\nTotal Premium: 1000\nTotal Premium: 2000\nStart Date: 27/11/2027\nExpiry Date: 26/11/2026').fields;assert.equal(fields.customerName,undefined);assert.equal(fields.premium,undefined);assert.equal(fields.startDate,undefined);assert.equal(date('31/02/2026'),'');assert.equal(date('2026-11-27'),'2026-11-27');
});
test('split labels work while unrelated next labels are not consumed',()=>{
 assert.equal(parse('Insured Name:\nAsha Sharma\nPolicy No.:\nSIG-2026-9988').fields.policyNumber,'SIG-2026-9988');assert.equal(parse('Insured Name:\nPolicy Number: SIG-9988').fields.customerName,undefined);
});
