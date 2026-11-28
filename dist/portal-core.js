/* Pure business rules shared by the portal and its tests. Money stays in paise. */
(function(root){
  function paise(value){const s=String(value??'').trim();if(!/^\d{1,10}(?:\.\d{1,2})?$/.test(s))throw Error('Enter a nonnegative amount with up to 2 decimal places');const [whole,fraction='']=s.split('.');const n=Number(whole)*100+Number(fraction.padEnd(2,'0'));if(!Number.isSafeInteger(n)||n>100000000000)throw Error('Amount exceeds the allowed limit');return n}
  function points(value){const s=String(value??'').trim();if(!/^\d{1,10}$/.test(s))throw Error('Points must be a whole nonnegative number');const n=Number(s);if(n>1000000000)throw Error('Points exceed the allowed limit');return n}
  function money(value){let n;try{n=BigInt(value||0)}catch{return '₹0.00'}const negative=n<0n;if(negative)n=-n;return (negative?'-':'')+'₹'+(n/100n).toLocaleString('en-IN')+'.'+String(n%100n).padStart(2,'0')}
  function phone(v){let n=String(v||'').replace(/\D/g,'');if(n.length===12&&n.startsWith('91'))n=n.slice(2);if(!/^[6-9]\d{9}$/.test(n))throw Error('Enter a valid 10-digit customer mobile');return n}
  function uuid(value){if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value))throw Error('Invalid record identifier');return value}
  function validateCredit(p,amountValue){const pValue=points(p),amountPaise=paise(amountValue);if(pValue===0&&amountPaise===0)throw Error('Enter points or an earning amount greater than zero');return {points:pValue,amount_paise:amountPaise}}
  function fileExtension(type){const ext={'application/pdf':'pdf','image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[type];if(!ext)throw Error('Upload a PDF, JPG, PNG or WebP file');return ext}
  async function validateFile(file){if(!file||!file.size)throw Error('Choose a policy document');if(file.size>10485760)throw Error('Policy copy must be 10 MB or smaller');const ext=fileExtension(file.type),bytes=new Uint8Array(await file.slice(0,16).arrayBuffer());const text=String.fromCharCode(...bytes);const valid=ext==='pdf'?text.startsWith('%PDF-'):ext==='png'?bytes[0]===137&&text.slice(1,4)==='PNG':ext==='jpg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:text.startsWith('RIFF')&&text.slice(8,12)==='WEBP';if(!valid)throw Error('The file contents do not match its declared format');return ext}
  function workspace(path='/',hash=''){
    const admin=/^\/admin\/?$/.test(path)||!/^\/partner\/?$/.test(path)&&/^#admin(?:-|$)/.test(hash);
    return {role:admin?'admin':'partner',path:admin?'/admin':'/partner',storageKey:admin?'sigma-auth-admin-v1':'sigma-auth-v1'};
  }
  function authOptions(entry,tabStore,legacyStore,makeId){if(entry.role!=='admin')return {storageKey:entry.storageKey};let tab=tabStore.getItem('sigma-admin-tab-id');if(!tab){tab=makeId();tabStore.setItem('sigma-admin-tab-id',tab)}const key='sigma-auth-admin-v2-'+tab;if(!tabStore.getItem(key)){const previous=legacyStore.getItem(entry.storageKey);if(previous){tabStore.setItem(key,previous);legacyStore.removeItem(entry.storageKey)}}return {storage:tabStore,storageKey:key}}
  root.PortalCore={paise,points,money,phone,uuid,validateCredit,fileExtension,validateFile,workspace,authOptions};
})(globalThis);
