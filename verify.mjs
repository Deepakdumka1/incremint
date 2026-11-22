import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const nodes=new Map();
const node=s=>{if(!nodes.has(s)){const classes=new Set();nodes.set(s,{innerHTML:'',textContent:'',classList:{add(c){classes.add(c)},remove(c){classes.delete(c)},contains(c){return classes.has(c)},toggle(c,force){if(force??!classes.has(c))classes.add(c);else classes.delete(c)}},focus(){},scrollIntoView(){},setAttribute(){}})}return nodes.get(s)};
const ctx={console,structuredClone,URL,Blob,FormData,matchMedia:()=>({matches:false}),setTimeout:()=>0,clearTimeout(){},localStorage:{getItem(){return null},setItem(k,v){JSON.parse(v)}},location:{hash:'',pathname:'/',origin:'http://localhost'},navigator:{},document:{querySelector:node,querySelectorAll:()=>[],addEventListener(){},title:''}};
ctx.window=ctx;ctx.addEventListener=()=>{};ctx.scrollTo=()=>{};vm.createContext(ctx);vm.runInContext(readFileSync('dist/app.js','utf8'),ctx);
function run(s){return vm.runInContext(s,ctx)}
run('toggleSidebar()');assert.ok(node('#app').classList.contains('sidebar-collapsed'));
run("go('bookings')");assert.ok(node('#app').classList.contains('sidebar-collapsed'));
run('toggleSidebar()');assert.ok(!node('#app').classList.contains('sidebar-collapsed'));
ctx.matchMedia=()=>({matches:true});run('toggleSidebar()');assert.ok(node('.sidebar').classList.contains('open'));run('toggleSidebar()');assert.ok(!node('.sidebar').classList.contains('open'));ctx.matchMedia=()=>({matches:false});
for(const p of ['dashboard','sell','marketing','assistant','bookings','statement','renewals','rates','leads','network','prospects','contacts','help','quotes']){run(`go('${p}')`);const html=node('#app').innerHTML;assert.ok(html.length>1500,p);for(const match of html.matchAll(/(?:onclick|onchange|oninput|onsubmit)="([^"]*)"/g)){const js=match[1].replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');new vm.Script(`(function(event){${js}})`)} }
run("moveLead('L1','Booked')");assert.equal(run("db.leads.find(l=>l.id==='L1').status"),'Booked');
run("renewPolicy('INC-2047')");assert.equal(run("db.bookings.find(b=>b.id==='INC-2047').renewed"),true);
run("issue('INC-2046')");assert.equal(run("db.bookings.find(b=>b.id==='INC-2046').status"),'Issued');
run("query='Aarav';productFilter='Health'");assert.equal(run('filteredBookings().length'),1);
run("productFilter='Motor'");assert.equal(run('filteredBookings().length'),0);
for(const prompt of ['Give me a business summary','Which renewals need attention?','Draft a renewal reminder','How can I follow up with new leads?'])run(`ask(${JSON.stringify(prompt)})`);
assert.equal(run('chat.length'),8);
for(const type of ['booking','lead','contact','prospect']){run(`openForm('${type}')`);const html=node('#overlay').innerHTML;assert.ok(html.includes('<form'),type);assert.ok(html.includes('required'),type)}
run('globalSearch()');for(const match of node('#overlay').innerHTML.matchAll(/(?:onclick|oninput)="([^"]*)"/g))new vm.Script(`(function(){${match[1]}})`);
assert.ok(run("csv([{name:'=FORMULA',value:'A,B'}])").includes("' =FORMULA"));
console.log('PASS: 14 screens render, inline handlers compile, lead stage, renewal, issuance, filters, assistant prompts, form generation, search and CSV safety.');
