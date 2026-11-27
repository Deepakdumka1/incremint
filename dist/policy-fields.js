/* Label and schedule-table extraction. Keep uncertain values empty for review. */
(function(root){
  const months={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
  const datePattern=/\b(?:20\d{2}-\d{1,2}-\d{1,2}|\d{1,2}[\s/.-]+(?:[A-Za-z]{3,9}|\d{1,2})[\s/.,-]+20\d{2})\b/g;
  function date(value){let y,m,d,match;const text=value.trim();if(match=text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/)){[,y,m,d]=match}else if(match=text.match(/\b(\d{1,2})[\s/.-]+([A-Za-z]{3,9}|\d{1,2})[\s/.,-]+(20\d{2})\b/)){d=match[1];m=/^\d+$/.test(match[2])?match[2]:months[match[2].slice(0,3).toLowerCase()];y=match[3]}else return '';const test=new Date(Date.UTC(+y,+m-1,+d));return test.getUTCFullYear()===+y&&test.getUTCMonth()===+m-1&&test.getUTCDate()===+d?`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`:''}
  const boundary='(?:vehicle registration|registration no|partner name|partner code|partner mobile|partner email|policy issue date|invoice (?:no|number|date)|address|e-?mail|mobile|phone|date of birth|gender|sum insured|net premium|previous insurer|previous policy|policy (?:number|no\\.?|#)|(?:insured|customer|proposer) name)';
  function parse(text){
    const source=String(text).replace(/\u00a0/g,' '),lines=source.split(/[\r\n]+|\t+|\s+\|\s+/).map(s=>s.replace(/[ \t]+/g,' ').trim()).filter(Boolean);
    const fields={},evidence={};
    const labelPattern=/^(?:policy|insured|customer|proposer|name|mobile|phone|premium|total|final|net|sum|cover|agent|broker|partner|period|from|to|start|expiry|end|insurer|insurance|address|email|date|vehicle|invoice|uin)\b/i;
    function collect(labels,convert,eligible=()=>true){const found=[];for(let i=0;i<lines.length;i++){if(!eligible(i))continue;const match=lines[i].match(new RegExp('^(?:'+labels+')(?=\\s|[:：=]|$)\\s*(?:[:：=]|[–—-](?=\\s))?\\s*(.*)$','i'));if(!match)continue;let raw=match[1].trim();if(!raw&&lines[i+1]&&!labelPattern.test(lines[i+1]))raw=lines[i+1];raw=raw.split(new RegExp('\\s+(?='+boundary+'(?:\\s|[:=]|$))','i'))[0].trim();const value=convert(raw);if(value)found.push({value,evidence:lines[i]})}return found}
    function put(key,labels,convert,eligible){const found=collect(labels,convert,eligible),values=[...new Set(found.map(v=>v.value))];if(values.length===1){fields[key]=values[0];evidence[key]=found[0].evidence.slice(0,220)}return found}
    const name=v=>{v=v.replace(/^(?:Mr\.?|Mrs\.?|Ms\.?|Dr\.?)\s+/i,'').trim();return /^[\p{L}][\p{L} .'-]{1,99}$/u.test(v)&&!labelPattern.test(v)?v:''};
    put('customerName',"(?:name of (?:the )?(?:insured|policyholder|policy holder|proposer)|(?:insured|policyholder|policy holder|proposer|customer)(?:'s)? name|insured(?: person)?)",name);
    if(!fields.customerName){let excluded=false;const allowed=lines.map((line,i)=>{if(/(?:posp|agent|broker|partner) (?:information|details)|nominee details|insured members|your policy details|policy details/i.test(line))excluded=true;return !excluded&&/\b(?:address|mobile|vehicle registration)\b/i.test(lines.slice(i,i+9).join(' '))});put('customerName','name',name,i=>allowed[i])}
    // The submitting agent supplies the contact number; never extract it from the policy.
    const number=v=>{v=v.replace(/\s*\/\s*/g,'/').trim();return /^(?=.*\d)[A-Za-z0-9][A-Za-z0-9/_.-]{3,119}$/.test(v)?v:''};
    const numbers=put('policyNumber','policy (?:number|no\.?|#)',number);
    if(!fields.policyNumber&&numbers.length){const values=[...new Set(numbers.map(v=>v.value))],longest=values.slice().sort((a,b)=>b.length-a.length)[0];if(values.every(v=>v===longest||longest.startsWith(v+'/'))){fields.policyNumber=longest;evidence.policyNumber=numbers.find(v=>v.value===longest).evidence}}
    const amount=v=>{v=v.replace(/\((?:INR|Rs\.?|₹|`|premium in[^)]*)\)/ig,'').replace(/^(?:INR|Rs\.?|₹|`)\s*/i,'').trim();const m=v.match(/^([\d,]+(?:\.\d{1,2})?)(?:\s*(?:INR|Rs\.?|₹|\/-))?$/i);if(!m)return '';const n=m[1].replace(/,/g,'');return /^\d+(?:\.\d{1,2})?$/.test(n)&&Number(n)>0&&Number(n)<=1e9?n:''};
    put('premium','(?:total premium(?: (?:payable|paid|amount|including tax))?|gross premium(?: amount)?|final premium(?: amount)?|premium payable|total amount payable)',amount);
    put('startDate','(?:policy )?(?:start date|commencement date|inception date)|(?:risk|cover|policy) (?:start date|inception date)|period of insurance from|(?:policy )?valid from',date);
    put('expiryDate','(?:policy )?(?:expiry date|expiration date|end date)|(?:risk|cover) end date|period of insurance to|(?:policy )?valid (?:to|till)',date);
    // From/To are valid only inside the policy-period block, not receipt/previous-policy sections.
    let period=false,periodRows=0;const periodLines=[];for(let i=0;i<lines.length;i++){if(/^(?:period of (?:policy|insurance|cover)|policy period|period of risk)/i.test(lines[i])){period=true;periodRows=0}else if(period&&(/^(?:your |compulsory|voluntary|coverages|previous |premium|nominee|posp|receipt)/i.test(lines[i])||++periodRows>16))period=false;if(period)periodLines.push(i)}
    const periodSet=new Set(periodLines);
    for(const [key,label] of [['startDate','from'],['expiryDate','to']])if(!fields[key]){
      const candidates=[];for(const i of periodLines){if(!new RegExp('^'+label+'(?:\\s|[:：]|$)','i').test(lines[i]))continue;let raw=lines[i];for(let j=i+1;j<Math.min(i+5,lines.length)&&periodSet.has(j)&&!labelPattern.test(lines[j]);j++)raw+=' '+lines[j];const dates=[...new Set((raw.match(datePattern)||[]).map(date).filter(Boolean))];if(dates.length===1)candidates.push(dates[0])}
      const unique=[...new Set(candidates)];if(unique.length===1){fields[key]=unique[0];evidence[key]='Policy period '+label}
    }
    if(fields.startDate&&fields.expiryDate&&fields.expiryDate<=fields.startDate){delete fields.startDate;delete fields.expiryDate;delete evidence.startDate;delete evidence.expiryDate}
    put('insurer','(?:name of (?:the )?insurer|insurer(?: name)?|insurance company)',v=>v.length>3&&v.length<=150&&!/[:=]/.test(v)?v:'');
    const insurers=[[/\bcare health insurance\b/i,'Care Health Insurance'],[/\bniva bupa\b/i,'Niva Bupa'],[/\btata aig\b/i,'Tata AIG'],[/\bicici lombard\b/i,'ICICI Lombard'],[/\bhdfc ergo\b/i,'HDFC ERGO'],[/\bstar health\b/i,'Star Health'],[/\b(?:go )?digit general insurance\b|\bgo digit\b/i,'Go Digit'],[/\bhdfc life\b/i,'HDFC Life'],[/\blic of india\b|\blife insurance corporation of india\b/i,'LIC of India'],[/\bbajaj (?:allianz|general)\b/i,'Bajaj Allianz'],[/\breliance general\b/i,'Reliance General'],[/\bnew india assurance\b/i,'New India Assurance'],[/\bunited india insurance\b/i,'United India Insurance'],[/\broyal sundaram\b/i,'Royal Sundaram'],[/\b(?:sbi general)\b/i,'SBI General']];
    const header=lines.slice(0,18).filter(l=>!/^previous\b/i.test(l)).join('\n');
    if(!fields.insurer){let hits=insurers.filter(([r])=>r.test(header));if(!hits.length)hits=insurers.filter(([r])=>r.test(lines.filter(l=>!/^previous\b/i.test(l)).join('\n')));if(hits.length===1){fields.insurer=hits[0][1];evidence.insurer=hits[0][1]}}
    const product=v=>{const s=v.toLowerCase();return /group.*health/.test(s)?'Group Health':/group.*(?:personal|accident)/.test(s)?'Group PA':/motor|\bcar\b|two[ -]?wheeler|vehicle|\bbike\b/.test(s)?'Motor':/health|mediclaim/.test(s)?'Health':/\bterm\b/.test(s)?'Term':/travel/.test(s)?'Travel':/^life(?: insurance)?$/.test(s)?'Life':/home/.test(s)?'Home':/fire|burglary/.test(s)?'Fire & Burglary':''};
    put('product','(?:insurance|policy|product) type|product(?: name)?|coverages opted',product);
    if(!fields.product){const titles=lines.slice(0,20).filter(l=>/insurance|policy|mediclaim/i.test(l)&&!insurers.some(([r])=>r.test(l))&&!/uin|reg(?:istration)? no|website|previous|general insurance|life insurance corporation/i.test(l));const kinds=[...new Set(titles.map(product).filter(Boolean))];if(kinds.length===1){fields.product=kinds[0];evidence.product=titles.find(l=>product(l)===kinds[0])}}
    return {fields,evidence};
  }
  root.PolicyFields={parse,date};
})(globalThis);
