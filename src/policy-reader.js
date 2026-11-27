import * as pdfjs from '/vendor/pdfjs/pdf.mjs';
import {createWorker} from 'tesseract.js';
pdfjs.GlobalWorkerOptions.workerSrc='/vendor/pdfjs/pdf.worker.mjs';
export async function readPolicy(file,{signal,onProgress=()=>{}}={}){
  let worker,task,pdf;const chunks=[];let textPages=0,ocrPages=0,totalPages=1;
  const check=()=>{if(signal?.aborted)throw new DOMException('Extraction stopped','AbortError')};
  const stop=()=>{worker?.terminate().catch(()=>{});task?.destroy().catch(()=>{})};signal?.addEventListener('abort',stop,{once:true});
  async function ocr(image,page){check();onProgress(`Reading scanned page ${page}…`);worker ||=await createWorker('eng',1,{workerPath:'/vendor/ocr/worker.min.js',corePath:'/vendor/ocr/core',langPath:'/vendor/ocr/lang',workerBlobURL:false,logger:m=>{if(m.status==='recognizing text')onProgress(`Reading scanned page ${page} · ${Math.round(m.progress*100)}%`)}});check();const result=await worker.recognize(image);check();return result.data.text}
  try{
    check();
    if(file.type==='application/pdf'){
      onProgress('Reading PDF text…');task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,cMapUrl:'/vendor/pdfjs/cmaps/',cMapPacked:true,standardFontDataUrl:'/vendor/pdfjs/standard_fonts/',wasmUrl:'/vendor/pdfjs/wasm/'});
      task.onPassword=()=>{task.destroy().catch(()=>{});};pdf=await task.promise;totalPages=pdf.numPages;
      for(let n=1;n<=Math.min(totalPages,8);n++){
        check();const page=await pdf.getPage(n);const content=await page.getTextContent();let rows=[];
        for(const item of content.items){if(!item.str?.trim())continue;let row=rows.find(r=>Math.abs(r.y-item.transform[5])<3);if(!row){row={y:item.transform[5],items:[]};rows.push(row)}row.items.push({x:item.transform[4],text:item.str})}
        const text=rows.sort((a,b)=>b.y-a.y).map(r=>r.items.sort((a,b)=>a.x-b.x).map(i=>i.text).join(' ')).join('\n');
        if(text.replace(/\s/g,'').length>=60){chunks.push(text.slice(0,30000));textPages++}
        else if(ocrPages<3){const original=page.getViewport({scale:1}),scale=Math.min(2,2000/Math.max(original.width,original.height)),viewport=page.getViewport({scale});const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);await page.render({canvasContext:canvas.getContext('2d'),viewport,background:'white'}).promise;chunks.push(await ocr(canvas,n));canvas.width=canvas.height=0;ocrPages++}
        page.cleanup();onProgress(`Read ${n} of ${Math.min(totalPages,8)} pages`);
      }
    }else{
      const bitmap=await createImageBitmap(file);const scale=Math.min(1,2200/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.ceil(bitmap.width*scale);canvas.height=Math.ceil(bitmap.height*scale);const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();chunks.push(await ocr(canvas,1));canvas.width=canvas.height=0;ocrPages=1;
    }
    check();return {text:chunks.join('\n').slice(0,240000),textPages,ocrPages,totalPages,limited:totalPages>8||ocrPages>=3&&textPages+ocrPages<Math.min(totalPages,8)};
  }finally{signal?.removeEventListener('abort',stop);await worker?.terminate().catch(()=>{});await task?.destroy().catch(()=>{})}
}
