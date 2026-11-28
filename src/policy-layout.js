// Reconstruct reading order without letting diagonal watermarks join schedule rows.
export function policyPageText(items,pageWidth=600){
  const rows=[];
  const words=items.filter(i=>i.str?.trim()&&Math.abs(Math.atan2(i.transform[1],i.transform[0]))<0.12&&!(i.transform[4]<pageWidth*.04&&i.str.trim().length<6)).sort((a,b)=>b.transform[5]-a.transform[5]||a.transform[4]-b.transform[4]);
  for(const item of words){
    const y=item.transform[5],height=Math.hypot(item.transform[2],item.transform[3])||9;
    let row=rows.find(r=>Math.abs(r.y-y)<=Math.min(4,height*.48));
    if(!row){row={y,items:[]};rows.push(row)}row.items.push({x:item.transform[4],width:item.width||0,text:item.str});
  }
  return rows.sort((a,b)=>b.y-a.y).map(r=>{let end=0;return r.items.sort((a,b)=>a.x-b.x).map((i,n)=>{const gap=i.x-end;end=i.x+i.width;return (n?(gap>26?' | ':' '):'')+i.text}).join('')}).join('\n');
}
