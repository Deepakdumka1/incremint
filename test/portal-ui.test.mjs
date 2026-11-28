import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const nodes=new Map();
const node=selector=>{if(!nodes.has(selector))nodes.set(selector,{innerHTML:'',textContent:'',classList:{toggle(){},add(){},remove(){}},focus(){},insertAdjacentHTML(){}});return nodes.get(selector)};
const context={console,URL,Blob,TextEncoder,structuredClone,FormData,location:{hash:'#policyportal',origin:'https://example.test'},history:{replaceState(){}},matchMedia:()=>({matches:false}),setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},localStorage:{getItem(){return null},setItem(){},removeItem(){}},document:{querySelector:node,querySelectorAll:()=>[],addEventListener(){},title:''}};
context.window=context;context.addEventListener=()=>{};context.scrollTo=()=>{};vm.createContext(context);
for(const file of ['app.js','workflows.js','parity.js','operations.js','quote-tools.js','excel-export.js','workspace-tools.js','portal-core.js','portal.js','portal-workspace.js','portal-admin.js','portal-forms.js','portal-profile.js'])vm.runInContext(readFileSync('dist/'+file,'utf8'),context);
const run=s=>vm.runInContext(s,context);
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',owner='11111111-1111-4111-8111-111111111111';
function compileHandlers(html){for(const m of html.matchAll(/(?:onclick|onchange|oninput|onsubmit)="([^"]*)"/g)){const text=m[1].replaceAll('&quot;','"').replaceAll('&#39;',"'").replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>');new vm.Script(`(function(event){${text}})`)}}
test('unconfigured portal does not pretend login or shared storage is live',()=>{run('portal.booting=false;portal.configured=false;portalRender()');assert.match(node('#app').innerHTML,/Database connection pending/);assert.doesNotMatch(node('#app').innerHTML,/portalAuthForm/);compileHandlers(node('#app').innerHTML)});
test('own profile editor exposes photo and personal details while email and role stay fixed',()=>{run("portal.user={id:'11111111-1111-4111-8111-111111111111'};portal.profile={full_name:'Admin <script>',email:'admin@example.test',role:'admin',phone:'9876543210',address:'Sample <address>'};portalAccount()");const html=node('#overlay').innerHTML;assert.match(html,/Choose profile photo/);assert.match(html,/name="fullName"/);assert.match(html,/name="phone"/);assert.match(html,/name="address"/);assert.match(html,/readonly/);assert.doesNotMatch(html,/name="role"|<script>/);compileHandlers(html)});
test('public auth screens offer neither account creation nor an admin role selector',()=>{run('portal.configured=true;portal.user=null');for(const mode of ['login','register','forgot','reset']){run(`portal.authMode='${mode}';portalRender()`);let html=node('#app').innerHTML;assert.match(html,/portalAuthForm/);assert.doesNotMatch(html,/<select[^>]*name="role"|Create partner account|Create admin|Sign up|Have an invitation code/);compileHandlers(html)}});
test('partner policy details show credits and cannot expose admin controls',async()=>{run(`portal.user={id:'${owner}'};portal.profile={id:'${owner}',full_name:'Partner <script>',email:'partner@example.test',role:'partner'};portal.policies=[{id:'${id}',owner_id:'${owner}',customer_name:'Customer <img onerror=bad>',customer_mobile:'9000000000',product:'Health',status:'Pending',premium_paise:9999,file_size:100,file_type:'application/pdf',original_file_name:'copy.pdf',owner_profile:{full_name:'Partner A',email:'partner@example.test'}}];portal.summary={total:1,pending:1,points:'125',amount_paise:'9999'};portal.view='home';portalRender()`);let html=node('#app').innerHTML;assert.match(html,/Customer &lt;img/);assert.doesNotMatch(html,/<script>/);assert.match(html,/₹99.99/);compileHandlers(html);await run(`portalPolicyDetails('${id}')`);let modal=node('#overlay').innerHTML;assert.doesNotMatch(modal,/>Approve</);assert.doesNotMatch(modal,/Credit points/);compileHandlers(modal)});
test('admin workflow shows uploader identity, approval, then credit only after approval',async()=>{run("portalEntry.role='admin';portal.profile.role='admin';portalRender()");assert.match(node('#app').innerHTML,/Partner account/);assert.match(node('#app').innerHTML,/partner@example.test/);await run(`portalPolicyDetails('${id}')`);let html=node('#overlay').innerHTML;assert.match(html,/>Approve</);assert.doesNotMatch(html,/Award earnings/);compileHandlers(html);run("portal.policies[0].status='Approved'");await run(`portalPolicyDetails('${id}')`);assert.match(node('#overlay').innerHTML,/Award earnings/);compileHandlers(node('#overlay').innerHTML);run(`portalCreditForm('${id}')`);compileHandlers(node('#overlay').innerHTML);run("portal.policies[0].sigma_ledger={points:125,amount_paise:9999,note:'Confirmed'}");await run(`portalPolicyDetails('${id}')`);assert.match(node('#overlay').innerHTML,/₹99.99/);assert.doesNotMatch(node('#overlay').innerHTML,/Award earnings/)});
test('a retried interrupted upload reuses the same policy record',async()=>{let inserts=0,uploads=0,hasRecord=false,hasFile=false;context.mock={from(){return {select(){return {eq(){return {maybeSingle:async()=>({data:hasRecord?{id}:null,error:null})}}}},insert:async()=>{inserts++;hasRecord=true;return {error:null}}}},rpc:async()=>hasFile?{data:{},error:null}:{error:{message:'Upload the policy document before submitting'}},storage:{from(){return {upload:async()=>{uploads++;hasFile=true;return {error:null}}}}}};run('portal.client=mock');const attempt={record:{id,storage_path:owner+'/'+id+'/policy.pdf'},file:{type:'application/pdf'}};context.attempt=attempt;context.progress={textContent:''};await run('portalCompleteUpload(attempt,progress)');await run('portalCompleteUpload(attempt,progress)');assert.equal(inserts,1);assert.equal(uploads,1)});

test('opening the other workspace does not silently render its dashboard',()=>{run("portalEntry.role='admin';portal.profile.role='partner';portalRender()");let html=node('#app').innerHTML;assert.match(html,/This page requires a admin account/);assert.doesNotMatch(html,/Review policies/);run("portalEntry.role='partner';portal.profile.role='admin';portalRender()");html=node('#app').innerHTML;assert.match(html,/This page requires a partner account/);assert.doesNotMatch(html,/Admin overview/)});

test('full authenticated partner navigation renders every business section',()=>{
 run("portalEntry.role='partner';portal.profile.role='partner';business.ready=true;business.owner=portal.user.id;businessApply({});portalMirrorPolicies()");
 const pages=['home','refer','brochures','assistant','policies','wallet','renewals','rates','prospects','contacts','help','settings','integrations'];
 for(const page of pages){run("portal.view="+JSON.stringify(page)+";portalRender()");const html=node('#app').innerHTML;assert.match(html,/Refer & Earn/);assert.match(html,/My contacts/);assert.match(html,/My renewals/);compileHandlers(html)}
});
test('referral catalogue removes mutual funds and insurer quote cards, retaining safe client destinations',()=>{
 run("portal.view='refer';business.referral={links:{}};portalRender()");let html=node('#app').innerHTML;assert.match(html,/Commercial Vehicle/);assert.match(html,/Group Personal Accident/);assert.doesNotMatch(html,/Mutual Funds|ICICI Lombard|Go Digit|Tata AIG/);assert.match(html,/Link pending/);assert.doesNotMatch(html,/href=\"javascript:/);
 run("business.referral={links:{term:'https://client.example/term',health:'javascript:bad()'}};portal.view='refer';portalRender()");html=node('#app').innerHTML;assert.match(html,/<a class="referral-product" href="https:\/\/client.example\/term"/);assert.doesNotMatch(html,/onclick="portalRoute\('refer-term'\)/);assert.doesNotMatch(html,/aria-label="Close navigation"/);assert.match(html,/disabled aria-label="Health — Link pending"/);
 run("portal.view='refer-term';business.referral={links:{term:'https://client.example/term','term-quote':'javascript:bad()'}};portalRender()");html=node('#app').innerHTML;assert.match(html,/https:\/\/client.example\/term/);assert.match(html,/noopener noreferrer/);assert.doesNotMatch(html,/javascript:bad/);compileHandlers(html);
});

test('client navigation hides removed menus and amount-only forms never expose point inputs',()=>{
 run("portalEntry.role='partner';portal.profile.role='partner';portal.view='home';portalRender()");
 const nav=run('portalNavHTML()');assert.match(nav,/Brochures/);assert.doesNotMatch(nav,/My leads|My network|Health quotes|Niva quotes|Saved quotes|Marketing kit/);
 assert.doesNotMatch(node('#app').innerHTML,/Points earned| pts|My leads/);
 run("portal.profile.role='admin';portalEntry.role='admin';portal.policies[0].status='Approved';portal.policies[0].sigma_ledger=[]");run(`portalCreditForm('${id}')`);
 assert.match(node('#overlay').innerHTML,/Earning amount/);assert.doesNotMatch(node('#overlay').innerHTML,/name="points"|>Points</);compileHandlers(node('#overlay').innerHTML);
 run("portal.authMode='register';portal.user=null");assert.doesNotMatch(run('portalAuth()'),/Create partner account|fullName|Sign up/);
 run(`portal.user={id:'${owner}'};portal.authMode='login'`);
});

test('payment receipt UI exposes UTR/private proof and no admin receipt controls to partners',()=>{
 context.receiptCredit={id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',owner_id:owner,policy_id:id,amount_paise:9999,sigma_payment_receipts:[{id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',utr:'UTR123456',paid_on:'2026-11-27',storage_path:owner+'/proof.png',original_file_name:'proof.png'}]};
 run("portal.profile.role='partner'");const html=run('portalPaymentDetails(receiptCredit)');assert.match(html,/UTR123456/);assert.match(html,/Open payment proof/);assert.doesNotMatch(html,/portalPaymentForm/);compileHandlers(html);
 run("portal.profile.role='admin';portal.ledger=[{...receiptCredit,sigma_payment_receipts:[]}]");run("portalPaymentForm('cccccccc-cccc-4ccc-8ccc-cccccccccccc')");assert.match(node('#overlay').innerHTML,/name="utr"/);assert.match(node('#overlay').innerHTML,/name="proof"/);compileHandlers(node('#overlay').innerHTML);
});
test('admin sees direct credit actions and a dedicated uncredited queue',()=>{
 run("portalEntry.role='admin';portal.profile.role='admin';portal.policies[0].status='Approved';portal.policies[0].sigma_ledger=[];portal.view='policies';portalRender()");let html=node('#app').innerHTML;assert.match(html,/Award earnings/);assert.match(html,/portalCreditForm/);
 run("portal.view='uncredited';portalRender()");html=node('#app').innerHTML;assert.match(html,/partner@example.test/);assert.match(html,/APPROVED · NOT CREDITED/);compileHandlers(html);
 run("portal.view='referral-settings';portalRender()");html=node('#app').innerHTML;assert.match(html,/Save client links/);assert.match(html,/link-term-quote/);compileHandlers(html);
});

test('approval opens the partner credit form without issuing a credit automatically',async()=>{
 const priorFormData=context.FormData;context.FormData=class{get(){return 'Reviewed'}};
 context.reviewCalls=[];context.reviewForm={querySelector(){return {disabled:false,textContent:''}}};
 context.reviewClient={rpc:async(name,args)=>{context.reviewCalls.push({name,args});return {data:{},error:null}}};
 run("portalEntry.role='admin';portal.profile.role='admin';portal.busy=false;portal.client=reviewClient;portal.policies[0].status='Pending';portal.policies[0].sigma_ledger=[];var savedPortalRefresh=portalRefresh;portalRefresh=async()=>{portal.policies[0].status='Approved'}");
 try{await run("portalReviewSubmit('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Approved',reviewForm)");assert.match(node('#overlay').innerHTML,/Award partner earnings/);assert.match(node('#overlay').innerHTML,/partner@example.test/);assert.equal(context.reviewCalls.length,1);assert.equal(context.reviewCalls[0].name,'sigma_review_policy')}finally{context.FormData=priorFormData;run('portalRefresh=savedPortalRefresh')}
});
test('business saves cannot inject browser bookings into the authoritative wallet',async()=>{
 context.savedBusinessPayload=null;context.businessClient={rpc:async(name,args)=>{context.savedBusinessPayload=args;return {data:{version:2},error:null}}};
 run("portal.client=businessClient;business.owner=portal.user.id;business.ready=true;business.dirty=false;business.version=1;business.saving=false;db.leads=[{name:'A customer'}];db.bookings=[{points:999999}];portalSaveBusiness()");
 await run('portalFlushBusiness()');assert.equal(context.savedBusinessPayload.p_version,1);assert.equal(context.savedBusinessPayload.p_data.db.bookings,undefined);assert.equal(context.savedBusinessPayload.p_data.db.leads[0].name,'A customer');assert.equal(run('business.dirty'),false);
});

test('admin policy form clearly selects the partner while preserving document autofill',()=>{
 context.assistedPartner={id:owner,full_name:'Selected Partner',email:'selected@example.test',role:'partner'};
 run("portalEntry.role='admin';portal.profile.role='admin';adminUpload.people=[assistedPartner];portalSelectUploadPartner(assistedPartner.id)");
 const html=node('#overlay').innerHTML;assert.match(html,/Selected Partner/);assert.match(html,/selected@example.test/);assert.match(html,new RegExp('data-owner-id="'+owner+'"'));assert.match(html,/policyAutoFill/);assert.match(html,/Change partner/);compileHandlers(html);
});
test('admin upload submits the selected partner owner and partner storage path, not admin ownership',async()=>{
 const originalFormData=context.FormData;const originalCrypto=context.crypto;
 const values={customerName:'Assisted customer',customerMobile:'9000000000',premium:'2500',product:'Motor',insurer:'Test Insurer',policyNumber:'TEST-123',startDate:'2026-11-27',expiryDate:'2027-11-26'};
 context.FormData=class{get(k){return values[k]||''}};context.crypto={randomUUID:()=>id};context.assistedForm={dataset:{ownerId:owner},elements:{extractionChecked:{required:false},policyFile:{files:[{name:'synthetic.pdf',type:'application/pdf',size:100,slice(){return {arrayBuffer:async()=>new TextEncoder().encode('%PDF-1.7').buffer}}}]}},querySelector(){return {disabled:false,textContent:''}},querySelectorAll(){return []}};
 run("var originalCompleteUpload=portalCompleteUpload,originalUploadRefresh=portalRefresh;portalCompleteUpload=async(attempt)=>{globalThis.assistedAttempt=attempt};portalRefresh=async()=>{};portal.user={id:'33333333-3333-4333-8333-333333333333'};portal.profile.role='admin';portal.busy=false;adminUpload.people=[assistedPartner]");
 try{await run('portalSubmitUpload(assistedForm)');assert.equal(context.assistedAttempt.record.owner_id,owner);assert.equal(context.assistedAttempt.record.storage_path,owner+'/'+id+'/policy.pdf');assert.equal(context.assistedAttempt.record.uploaded_by,undefined)}finally{context.FormData=originalFormData;context.crypto=originalCrypto;run(`portalCompleteUpload=originalCompleteUpload;portalRefresh=originalUploadRefresh;portal.user={id:'${owner}'}`)}
});
test('form enquiries escape answers and expose assignment controls only to admins',()=>{run(`portal.user={id:'${owner}'};portal.profile={role:'partner'};formInbox.owner='${owner}';formInbox.rows=[{id:'${id}',product:'Marine',customer_name:'<img>',customer_mobile:'9000000000',submitted_at:'2026-11-28T12:00:00Z',claimed_partner_email:'partner@example.test',answers:[{question:'<script>',value:'<script>alert(1)</script>'}]}]`);let html=run('portalEnquiriesPage()');assert.match(html,/&lt;img&gt;/);assert.doesNotMatch(html,/Assign partner|Connect Google Forms/);compileHandlers(html);run(`portalEnquiryDetails('${id}')`);assert.match(node('#overlay').innerHTML,/&lt;script&gt;/);run("portal.profile={role:'admin'}");html=run('portalEnquiriesPage()');assert.match(html,/Assign partner/);assert.match(html,/Connect Google Forms/);compileHandlers(html);run("location.hash='#form-enquiries'");assert.equal(run('portalBusinessRoute()'),'form-enquiries');});
test('email code sign-in verifies an existing account and never creates users or enters password-reset mode',async()=>{
 const previousFormData=context.FormData;
 context.FormData=class{get(k){return {email:'existing@example.test',token:'123456'}[k]||''}};
 context.otpForm={elements:{email:{value:'existing@example.test',reportValidity:()=>true}},querySelector:()=>({disabled:false})};
 context.otpCalls=[];
 run("var beforeOtpHandle=portalHandleSession;portalHandleSession=async(session)=>otpCalls.push({session});portal.busy=false;portal.emailOtpEnabled=true;portal.recovery=false;portal.authMode='login';portal.client={auth:{signInWithOtp:async(args)=>{otpCalls.push(args);return {error:null}},verifyOtp:async(args)=>{otpCalls.push(args);return {data:{session:{access_token:'test'}}}}}}");
 try{await run('portalEmailLink(otpForm)');assert.equal(context.otpCalls[0].options.shouldCreateUser,false);assert.equal(run('portal.authMode'),'otp');let html=run('portalAuth()');assert.match(html,/one-time-code/);assert.doesNotMatch(html,/name="password"/);compileHandlers(html);await run('portalSubmitAuth(otpForm)');assert.equal(context.otpCalls[1].type,'email');assert.equal(context.otpCalls[1].token,'123456');assert.equal(run('portal.recovery'),false);assert.equal(run('portal.authMode'),'login')}finally{context.FormData=previousFormData;run('portalHandleSession=beforeOtpHandle;portal.emailOtpEnabled=false')}
});
