/* Workspace choice is per tab; all tenant boundaries are enforced in PostgreSQL. */
async function portalLoadMemberships(){
 portal.memberships=[];portal.workspaceAdmin=portal.user.id;
 if(portalModeAdmin())return;
 const result=await portal.client.rpc('sigma_partner_workspaces');if(result.error)throw result.error;
 portal.memberships=result.data||[];
 const saved=sessionStorage.getItem('sigma-workspace-'+portal.user.id);
 const selected=portal.memberships.find(m=>m.admin_id===saved)||portal.memberships.find(m=>m.status==='active')||portal.memberships[0];
 portal.workspaceAdmin=selected?.admin_id||portal.profile.managing_admin;
}
function portalWorkspaceSelector(){
 if(portalModeAdmin()||!portal.memberships?.length)return '';
 return `<label class="workspace-choice">Workspace<select aria-label="Administrator workspace" onchange="portalChangeWorkspace(this.value)">${portal.memberships.map(m=>`<option value="${pe(m.admin_id)}" ${m.admin_id===portal.workspaceAdmin?'selected':''}>${pe(m.full_name)} · ${pe(m.admin_id.slice(0,6))}${m.status==='active'?'':' (inactive)'}</option>`).join('')}</select></label>`;
}
async function portalChangeWorkspace(id){
 if(portal.busy||!portal.memberships?.some(m=>m.admin_id===id))return;
 if(typeof portalFlushBusiness==='function'&&business.dirty&&!await portalFlushBusiness())return toast('Save your changes before switching workspaces.');
 portal.busy=true;portal.refreshVersion++;portal.workspaceAdmin=id;
 sessionStorage.setItem('sigma-workspace-'+portal.user.id,id);
 closeModal();portal.policies=[];portal.ledger=[];portal.summary={};portal.paymentSummary={};
 if(typeof portalResetBusiness==='function')portalResetBusiness();
 try{await portalLoadBusiness(portal.user.id);await portalRefresh()}catch(e){portal.error=portalError(e)}finally{portal.busy=false;portalRender()}
}
