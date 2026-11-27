// Synthetic documents for browser extraction QA; contains no customer data.
import {mkdir,writeFile} from 'node:fs/promises';
import {createCanvas} from '@napi-rs/canvas';
await mkdir('test-results',{recursive:true});
const lines=['Insured Name: Asha Sharma','Customer Mobile: 9876543210','Policy Number: SIG-2026-123456','Insurer: Care Health Insurance','Product Type: Health Insurance','Total Premium Payable: INR 11800.50','Policy Start Date: 27/11/2026','Policy Expiry Date: 26/11/2027'];
const stream='BT /F1 16 Tf 50 780 Td '+lines.map((line,i)=>(i?'0 -34 Td ':'')+'('+line+') Tj').join('\n')+' ET';
const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];let pdf='%PDF-1.4\n',offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`}const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 6\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
await writeFile('test-results/sample-policy.pdf',pdf);
const canvas=createCanvas(1500,1000),ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,1500,1000);ctx.fillStyle='black';ctx.font='32px Arial';lines.forEach((line,i)=>ctx.fillText(line,60,80+i*90));await writeFile('test-results/sample-policy.png',canvas.toBuffer('image/png'));
console.log('Created synthetic PDF and image fixtures under test-results.');
