import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const nodes=new Map();
const node=s=>{if(!nodes.has(s)){const classes=new Set();nodes.set(s,{innerHTML:'',textContent:'',classList:{add(c){classes.add(c)},remove(c){classes.delete(c)},contains(c){return classes.has(c)},toggle(c,force){if(force??!classes.has(c))classes.add(c);else classes.delete(c)}},focus(){},scrollIntoView(){},setAttribute(){},insertAdjacentHTML(where,html){this.innerHTML+=html}})}return nodes.get(s)};
const ctx={console,structuredClone,URL,Blob,FormData,TextEncoder,matchMedia:()=>({matches:false}),setTimeout:()=>0,clearTimeout(){},localStorage:{getItem(){return null},setItem(k,v){JSON.parse(v)},removeItem(){}},location:{hash:'',pathname:'/',origin:'http://localhost'},navigator:{},document:{querySelector:node,querySelectorAll:()=>[],addEventListener(){},title:''}};
ctx.window=ctx;ctx.addEventListener=()=>{};ctx.scrollTo=()=>{};vm.createContext(ctx);vm.runInContext(readFileSync('dist/app.js','utf8'),ctx);
for(const file of ['workflows.js','parity.js','operations.js','quote-tools.js','excel-export.js','workspace-tools.js'])vm.runInContext(readFileSync('dist/'+file,'utf8'),ctx);
function run(s){return vm.runInContext(s,ctx)}
assert.equal(run('db.bookings.length'),0,'new workspaces must not contain fabricated policies');
run('db=structuredClone(seed)');
run('toggleSidebar()');assert.ok(node('#app').classList.contains('sidebar-collapsed'));
run("go('bookings')");assert.ok(node('#app').classList.contains('sidebar-collapsed'));
run('toggleSidebar()');assert.ok(!node('#app').classList.contains('sidebar-collapsed'));
ctx.matchMedia=()=>({matches:true});run('toggleSidebar()');assert.ok(node('.sidebar').classList.contains('open'));run('toggleSidebar()');assert.ok(!node('.sidebar').classList.contains('open'));ctx.matchMedia=()=>({matches:false});
for(const p of ['dashboard','sell','marketing','assistant','bookings','statement','renewals','rates','leads','network','prospects','contacts','help','quotes']){run(`go('${p}')`);const html=node('#app').innerHTML;assert.ok(html.length>1500,p);for(const match of html.matchAll(/(?:onclick|onchange|oninput|onsubmit)="([^"]*)"/g)){const js=match[1].replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');new vm.Script(`(function(event){${js}})`)} }
run("go('dashboard')");assert.ok(node('#app').innerHTML.includes('sigma0nine-logo.png'));assert.ok(!node('#app').innerHTML.includes('14,850'));assert.ok(readFileSync('dist/brand.css','utf8').includes('@media(max-width:600px)'));assert.ok(readFileSync('dist/sigma0nine-logo.png').length>0);
run("moveLead('L1','Booked')");assert.equal(run("db.leads.find(l=>l.id==='L1').status"),'Booked');
run("renewPolicy('INC-2047')");assert.equal(run("db.bookings.find(b=>b.id==='INC-2047').renewed"),true);
run("issue('INC-2046')");assert.equal(run("db.bookings.find(b=>b.id==='INC-2046').status"),'Issued');
run("query='Aarav';productFilter='Health'");assert.equal(run('filteredBookings().length'),1);
run("productFilter='Motor'");assert.equal(run('filteredBookings().length'),0);
for(const prompt of ['Give me a business summary','Which renewals need attention?','Draft a renewal reminder','How can I follow up with new leads?'])run(`ask(${JSON.stringify(prompt)})`);
assert.equal(run('chat.length'),8);
for(const type of ['booking','contact','prospect']){run(`openForm('${type}')`);const html=node('#overlay').innerHTML;assert.ok(html.includes('<form'),type);assert.ok(html.includes('required'),type)}
run('globalSearch()');for(const match of node('#overlay').innerHTML.matchAll(/(?:onclick|oninput)="([^"]*)"/g))new vm.Script(`(function(){${match[1]}})`);
assert.ok(run("csv([{name:'=FORMULA',value:'A,B'}])").includes("' =FORMULA"));
for(const product of ['Health','Motor','Travel','Term','Investment','Group Health','Group PA','Home','Fire & Burglary','Mutual Fund','Jewellery Block']){run(`startLead(${JSON.stringify(product)})`);assert.ok(node('#app').innerHTML.includes('leadWizard'),product)}
for(const p of ['quotes','nivaquote','savedquotes','settings','integrations','marketing','statement','rates','leads','prospects','contacts','bookings','renewals']){run(`go('${p}')`);for(const match of node('#app').innerHTML.matchAll(/(?:onclick|onchange|oninput|onsubmit)="([^"]*)"/g))new vm.Script(`(function(event){${match[1].replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>')}})`)}
assert.equal(run("normalisePhone('+91 9876543210')"),'9876543210');assert.equal(run("validPhone('123')"),false);assert.equal(run('earnings(10000,27)'),2700);
assert.equal(run(`parseCSV(${JSON.stringify('plan,conditions\r\n"Test, plan","line 1\nline 2"')})[0].plan`),'Test, plan');
assert.equal(run('nivaTotals([[100,200,300,400,500],[10,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[20,20,20,20,20],[5,0,0,0,0]])[0]'),85);
run("wizard={product:'Health',step:0,data:{planType:'Port'}}");assert.equal(run('wizardSteps().length'),2);run("wizard.data.planType='Base Plan'");assert.equal(run('wizardSteps().length'),1);
assert.ok(run("quoteValidation({...quoteDraft,customer:'Customer',phone:'invalid'},'health')").includes('mobile'));
assert.equal(run('excelColumn(26)'),'AA');assert.equal(run("crc32(new TextEncoder().encode('123456789'))"),0xcbf43926);
const workbook=Buffer.from(await run("workbookFile([{name:'=formula',value:123,notes:'a&b'}],'Report')").arrayBuffer());assert.equal(workbook.readUInt32LE(0),0x04034b50);assert.ok(workbook.includes(Buffer.from('t="inlineStr"')));assert.ok(workbook.includes(Buffer.from('a&amp;b')));assert.ok(!workbook.includes(Buffer.from('<f>')));
console.log('PASS: routes, product flows, sidebar, pipeline, filters, forms, quote validation, payout arithmetic, CSV parser/export and earnings calculation.');
