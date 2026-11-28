import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
test('partner restores a per-tab workspace and refreshes records when switching',async()=>{
 const ids=['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
 const saved=new Map([['sigma-workspace-partner',ids[1]]]),calls=[];
 const portal={user:{id:'partner'},profile:{managing_admin:ids[0]},client:{rpc:async()=>({data:ids.map((id,i)=>({admin_id:id,full_name:i?'Second admin':'First admin',status:'active'}))})},policies:[{}],ledger:[{}],refreshVersion:0};
 const c=vm.createContext({portal,portalModeAdmin:()=>false,pe:s=>String(s),sessionStorage:{getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)},business:{dirty:false},closeModal:()=>{},portalResetBusiness:()=>calls.push('clear'),portalLoadBusiness:async()=>calls.push('load'),portalRefresh:async()=>calls.push('refresh'),portalRender:()=>calls.push('render'),portalError:e=>e.message,toast:()=>{}});
 vm.runInContext(readFileSync('dist/portal-memberships.js','utf8'),c);
 await c.portalLoadMemberships();assert.equal(portal.workspaceAdmin,ids[1]);assert.match(c.portalWorkspaceSelector(),/Administrator workspace/);
 await c.portalChangeWorkspace(ids[0]);assert.equal(portal.workspaceAdmin,ids[0]);assert.equal(saved.get('sigma-workspace-partner'),ids[0]);assert.equal(portal.policies.length,0);assert.deepEqual(calls,['clear','load','refresh','render']);
 calls.length=0;await c.portalChangeWorkspace('foreign-workspace');assert.equal(calls.length,0);
});
