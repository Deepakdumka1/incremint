import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {policyPageText} from '../src/policy-layout.js';
const scope={};vm.createContext(scope);vm.runInContext(readFileSync('dist/policy-fields.js','utf8'),scope);
const parse=text=>JSON.parse(JSON.stringify(scope.PolicyFields.parse(text).fields));

// Anonymized schedule structures; never store real customer PDFs in the repo.
test('health certificate reads the addressee, paid premium and period, not member-table headers',()=>{
 const f=parse(`Care Health Insurance\nDear Mr Asha Sharma,\nPolicy No. SAMPLE12345\nMr Asha Sharma | Plan Name CARE ADVANTAGE\nPolicy Period - Start Date 00:00 hrs 15-Nov-2026\nPolicy Period - End Date | Midnight 14-Nov-2027\nPremium Paid | Rs. 65,734.00\nPolicyholder | Gender | Date Of Birth\nMr Asha Sharma | Female | 19-Jan-1970\nInsured with the\nName | Client ID | Date of Birth\nThank You for trusting us as your preferred Health Insurer.\nMobile No: XXXXXX2345`);
 assert.equal(f.customerName,'Asha Sharma');assert.equal(f.premium,'65734.00');assert.equal(f.startDate,'2026-11-15');assert.equal(f.expiryDate,'2027-11-14');assert.equal(f.product,'Health');assert.equal(f.customerMobile,undefined);
});
test('bilingual schedule with a split policy number and final total excludes prior insurer',()=>{
 const f=parse(`पॉलिसी अनुसूची Policy Schedule - PRIVATE CAR LIABILITY ONLY\nपॉलिसी संख्या Policy Number:\nBusiness Source: 910631\n12340031266701234567\nNational Insurance Company Ltd.\nग्राहक Customer Name: Mr. SAMPLE CUSTOMER | Customer ID:\nफोन Phone:78######31\nPolicy Effective from 00:00 hours, on 14-11-2026 00:00 to midnight of 13-11-2027 Midnight\nPremium | ₹ 3691\nPrevious Policy Number and\nकुल राशि Total Amount | ₹ 4,355.00 | Dt. 13/11/2026\nExpiry Date and InsurerName\nMagma HDI General Insurance`);
 assert.equal(f.customerName,'SAMPLE CUSTOMER');assert.equal(f.policyNumber,'12340031266701234567');assert.equal(f.premium,'4355.00');assert.equal(f.startDate,'2026-11-14');assert.equal(f.expiryDate,'2027-11-13');assert.equal(f.insurer,'National Insurance');assert.equal(f.customerMobile,undefined);
});
test('split two-column motor schedule recovers From above period heading and To inside cover row',()=>{
 const f=parse(`Go Digit General Insurance Ltd. | Schedule/Certificate\nDigit Private Car Policy | UIN No.: SAMPLE\nYOUR DETAILS | PARTNER DETAILS\nName: SAMPLE CUSTOMER | POLICYBAZAAR INSURANCE BROKERS\nPartner Name:\nPRIVATE LIMITED\nRegistration Number: XX00AA0000\nPolicy Number: TEST123456 / 11112026\nPartner Mobile Number: 9876543210\nMobile Number: xxxxxxxxx8577\nYOUR POLICY DETAILS\nFrom | 27-Nov-2026 00:00:01 | NCB % | 45%\nPeriod of Policy for\nOwn Damage Cover To | 26-Nov-2027 23:59:59 | Additional Excess | --\nPeriod of Policy for | From | 27-Nov-2026 00:00:01\nThird Party Liability To | 26-Nov-2027 23:59:59\nInvoice No. TEST123\nFinal Premium (\` ) | 10338.21\nPolicy No: TEST123456`);
 assert.equal(f.customerName,'SAMPLE CUSTOMER');assert.equal(f.policyNumber,'TEST123456/11112026');assert.equal(f.premium,'10338.21');assert.equal(f.startDate,'2026-11-27');assert.equal(f.expiryDate,'2027-11-26');assert.equal(f.customerMobile,undefined);
});
test('tax-inclusive rounded motor premium outranks gross and policy-period base premium',()=>{
 const f=parse(`Dear MR SAMPLE CUSTOMER\nGenerali Central Insurance Company Limited\nPolicy No. : 132/02/11/1127/MTP/SAMPLE123\nCIS-MOTOR PROTECT PRIVATE CAR PACKAGE POLICY UIN: SAMPLE\nPeriod of Insurance : From 00:00 hours of 13/11/2026 To HSN : 997134\nMidnight of 12/11/2027\nGross Premium 10,806.08\nTotal Premium for the Policy Period | 10,806.08\nGoods and Service Tax | 1,945.09\nTotal Premium (rounded off) | 12,751.00\nInsurer forthwith.`);
 assert.equal(f.customerName,'SAMPLE CUSTOMER');assert.equal(f.premium,'12751.00');assert.equal(f.insurer,'Generali Central Insurance');assert.equal(f.startDate,'2026-11-13');assert.equal(f.expiryDate,'2027-11-12');assert.equal(f.product,'Motor');
});
test('certificate parses same-line dates and currency-parenthesized premium without nominee contacts',()=>{
 const f=parse(`Zurich Kotak General Insurance Company (India) Limited\nLiability Only (Private Car)\nPolicy / Certificate No: 123456789012\nINSURED DETAILS | POLICY DETAILS\nName: | Mr SAMPLE CUSTOMER | Policy Issuing Office: Mumbai\nAddress: Sample Road\nPeriod of Insurance:\nPhone: | +91 91234 56789 | From: 22/11/2026 00:00 to: 21/11/2027 Midnight\nMobile: | 9123456789 | Type Of Vehicle: Private Car\nTotal Premium (in ₹) | 4,102.00\nNOMINEE DETAILS\nName: OTHER PERSON\nMobile: 9876543210`);
 assert.equal(f.customerName,'SAMPLE CUSTOMER');assert.equal(f.customerMobile,'9123456789');assert.equal(f.premium,'4102.00');assert.equal(f.expiryDate,'2027-11-21');assert.equal(f.insurer,'Zurich Kotak General Insurance');
});
test('PDF row reconstruction separates columns and discards diagonal watermark text',()=>{
 const item=(str,x,y,width=50,angle=0)=>({str,width,transform:[9*Math.cos(angle),9*Math.sin(angle),-9*Math.sin(angle),9*Math.cos(angle),x,y]});
 const text=policyPageText([item('Name:',54,657.6,27),item('SAMPLE CUSTOMER',91,656.4,80),item('BROKER COMPANY',384,659.5,100),item('WATERMARK',100,658,200,.6)]);
 assert.match(text,/Name: SAMPLE CUSTOMER \| BROKER COMPANY/);assert.doesNotMatch(text,/WATERMARK/);
});
