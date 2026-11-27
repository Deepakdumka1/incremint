/* Conservative, label-based extraction. No guessing missing customer or premium values. */
(function(root){
  const months={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
  function date(value){let y,m,d,match;const text=value.trim();if(match=text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/)){[,y,m,d]=match}else if(match=text.match(/\b(\d{1,2})[\s/.-]+([A-Za-z]{3,9}|\d{1,2})[\s/.,-]+(20\d{2})\b/)){d=match[1];m=/^\d+$/.test(match[2])?match[2]:months[match[2].slice(0,3).toLowerCase()];y=match[3]}else return '';const test=new Date(Date.UTC(+y,+m-1,+d));return test.getUTCFullYear()===+y&&test.getUTCMonth()===+m-1&&test.getUTCDate()===+d?`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`:''}
  function parse(text){
    const lines=String(text).replace(/\u00a0/g,' ').split(/[\r\n]+/).map(s=>s.replace(/[ \t]+/g,' ').trim()).filter(Boolean);
    const fields={},evidence={};
    const labelPattern=/^(?:policy|insured|customer|proposer|name|mobile|phone|premium|total|net|sum|cover|agent|broker|period|start|expiry|end|insurer|insurance|address|email|date)\b/i;
    function collect(labels,convert){const found=[];for(let i=0;i<lines.length;i++){const match=lines[i].match(new RegExp('^(?:'+labels+')\\s*(?:[:：=]|[–—-](?=\\s))?\\s*(.*)$','i'));if(!match)continue;let raw=match[1].trim();if(!raw&&lines[i+1]&&!labelPattern.test(lines[i+1]))raw=lines[i+1];const value=convert(raw);if(value)found.push({value,evidence:lines[i]+' '+(!match[1]?raw:'')})}const values=[...new Set(found.map(v=>v.value))];return values.length===1?found.find(v=>v.value===values[0]):null}
    function put(key,labels,convert){const result=collect(labels,convert);if(result){fields[key]=result.value;evidence[key]=result.evidence.slice(0,220)}}
    put('customerName',"(?:name of (?:the )?(?:insured|policyholder|proposer)|(?:insured|policyholder|policy holder|proposer|customer)(?:'s)? name)",v=>{v=v.replace(/^(?:Mr\.?|Mrs\.?|Ms\.?|Dr\.?)\s+/i,'').trim();return /^[\p{L}][\p{L} .'-]{1,99}$/u.test(v)&&!labelPattern.test(v)?v:''});
    put('customerMobile','(?:insured|policyholder|customer|proposer) (?:mobile|phone)(?: (?:number|no\.?))?|(?:mobile|mobile no\.?|mobile number)',v=>{const match=v.match(/^(?:\+?91[ -]?)?([6-9][0-9 -]{8,15})$/);if(!match)return '';let n=match[1].replace(/\D/g,'');return /^[6-9]\d{9}$/.test(n)?n:''});
    put('policyNumber','policy (?:number|no\.?|#)',v=>{v=v.trim();return /^(?=.*\d)[A-Za-z0-9][A-Za-z0-9/_.-]{3,119}$/.test(v)?v:''});
    put('premium','(?:total premium(?: (?:payable|paid|amount))?|gross premium(?: amount)?|premium payable|total amount payable)',v=>{const m=v.replace(/^(?:INR|Rs\.?|₹)\s*/i,'').match(/^([\d,]+(?:\.\d{1,2})?)(?:\s*(?:INR|Rs\.?|₹|\/-))?$/i);if(!m)return '';const n=m[1].replace(/,/g,'');return /^\d+(?:\.\d{1,2})?$/.test(n)&&Number(n)>0&&Number(n)<=1e9?n:''});
    put('startDate','(?:policy )?(?:start date|commencement date|inception date)|(?:risk|cover|policy) (?:start date|inception date)|period of insurance from|(?:policy )?valid from',date);
    put('expiryDate','(?:policy )?(?:expiry date|expiration date|end date)|(?:risk|cover) end date|period of insurance to|(?:policy )?valid (?:to|till)',date);
    if(fields.startDate&&fields.expiryDate&&fields.expiryDate<=fields.startDate){delete fields.startDate;delete fields.expiryDate;delete evidence.startDate;delete evidence.expiryDate}
    put('insurer','(?:name of (?:the )?insurer|insurer(?: name)?|insurance company)',v=>v.length>3&&v.length<=150&&!/[:=]/.test(v)?v:'');
    const insurers=[[/\bcare health insurance\b/i,'Care Health Insurance'],[/\bniva bupa\b/i,'Niva Bupa'],[/\btata aig\b/i,'Tata AIG'],[/\bicici lombard\b/i,'ICICI Lombard'],[/\bhdfc ergo\b/i,'HDFC ERGO'],[/\bstar health\b/i,'Star Health'],[/\bgo digit\b/i,'Go Digit'],[/\bhdfc life\b/i,'HDFC Life'],[/\blic of india\b|\blife insurance corporation of india\b/i,'LIC of India']];
    if(!fields.insurer){const hits=insurers.filter(([r])=>r.test(text));if(hits.length===1){fields.insurer=hits[0][1];evidence.insurer=hits[0][1]}}
    put('product','(?:insurance|policy|product) type|product',v=>{const s=v.toLowerCase();return /group.*health/.test(s)?'Group Health':/group.*(?:personal|accident)/.test(s)?'Group PA':/motor|car|two.wheeler|vehicle/.test(s)?'Motor':/health|mediclaim/.test(s)?'Health':/term/.test(s)?'Term':/travel/.test(s)?'Travel':/^life(?: insurance)?$/.test(s)?'Life':/home/.test(s)?'Home':/fire|burglary/.test(s)?'Fire & Burglary':''});
    return {fields,evidence};
  }
  root.PolicyFields={parse,date};
})(globalThis);
