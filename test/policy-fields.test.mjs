import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const scope={};vm.createContext(scope);vm.runInContext(readFileSync('dist/policy-fields.js','utf8'),scope);const {parse,date}=scope.PolicyFields;
test('labelled policy values are extracted with exact premium and dates',()=>{
 const result=parse(`Insured Name: Asha Sharma\nCustomer Mobile: +91 9876543210\nPolicy Number: SIG/2026/123456\nInsurer: Care Health Insurance\nProduct Type: Health insurance\nSum Insured: 10,00,000\nNet Premium: 10,000\nTotal Premium Payable: INR 11,800.50\nPolicy Start Date: 27/11/2026\nPolicy Expiry Date: 26-Nov-2027`);
 assert.equal(result.fields.customerName,'Asha Sharma');assert.equal(result.fields.customerMobile,undefined);assert.equal(result.fields.policyNumber,'SIG/2026/123456');assert.equal(result.fields.premium,'11800.50');assert.equal(result.fields.startDate,'2026-11-27');assert.equal(result.fields.expiryDate,'2027-11-26');assert.equal(result.fields.product,'Health');
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

test('motor schedule fills seven fields from generic Name, Final Premium and From/To tables',()=>{
 const f=parse(`Go Digit General Insurance Ltd.
Schedule/Certificate
Digit Two-Wheeler Insurance
Name TEST CUSTOMER Vehicle Registration No. XX00AA0000
Partner Name: SAMPLE BROKER
Address Example Road
Mobile xxxxxxx1234 Partner Mobile No. --
YOUR POLICY DETAILS
Policy No. SAMPLE123 / 08122025 Policy Issue Date 08-Dec-2025 Invoice No. TEST001
Period of Policy Own Damage Cover Third Party Liability Cover
From 14-Dec-2025 00:00:01 14-Dec-2025 00:00:01 --
To 13-Dec-2026 23:59:59 13-Dec-2026 23:59:59 --
Compulsory Deductible 100
Net Premium (\`) 762.01
Final Premium (\`) 899.17
Previous Insurer ICICI Lombard General Insurance Co. Ltd. Previous Policy No. OLD123
Policy No: SAMPLE123
POSP INFORMATION AKA PARTNER DETAILS
Name AGENT PERSON
Mobile Number 9876543210`).fields;
 assert.deepEqual(JSON.parse(JSON.stringify(f)),{customerName:'TEST CUSTOMER',policyNumber:'SAMPLE123/08122025',premium:'899.17',startDate:'2025-12-14',expiryDate:'2026-12-13',insurer:'Go Digit',product:'Motor'});
});

test('schedule cells with separate label/value columns and month-name dates are supported',()=>{
 const f=parse('Go Digit General Insurance Ltd.\nDigit Two-Wheeler Insurance\nName | TEST CUSTOMER | Vehicle Registration No. | XX00AA0000\nAddress | Example Road\nYOUR POLICY DETAILS\nPolicy No. | TEST12345\nPeriod of Policy\nFrom | 14-Dec-2025 00:00:01 | 14-Dec-2025 00:00:01\nTo | 13-Dec-2026 23:59:59 | 13-Dec-2026 23:59:59\nFinal Premium | 899.17').fields;
 assert.equal(Object.keys(f).length,7);assert.equal(f.customerName,'TEST CUSTOMER');assert.equal(f.startDate,'2025-12-14');assert.equal(f.premium,'899.17');
});

test('conflicting own-damage and liability cover dates are left for manual review',()=>{
 const f=parse('Period of Policy Own Damage Cover Third Party Cover\nFrom 14-Dec-2025 00:00:01 20-Dec-2025 00:00:01\nTo 13-Dec-2026 23:59:59 19-Dec-2026 23:59:59').fields;
 assert.equal(f.startDate,undefined);assert.equal(f.expiryDate,undefined);
 assert.equal(parse('POSP INFORMATION AKA PARTNER DETAILS\nName AGENT PERSON\nAddress Sample Road\nMobile Number 9876543210').fields.customerName,undefined);
});
