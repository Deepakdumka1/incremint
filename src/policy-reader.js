import * as pdfjs from '/vendor/pdfjs/pdf.mjs';
import {createWorker} from 'tesseract.js';
import {policyPageText} from './policy-layout.js';
pdfjs.GlobalWorkerOptions.workerSrc='/vendor/pdfjs/pdf.worker.mjs';
export async function readPolicy(file,{signal,onProgress=()=>{},needsOCR=()=>true}={}){
  let worker,task,pdf;const chunks=[],scanned=[];let textPages=0,ocrPages=0,totalPages=1,readPages=0;const maxPages=24,maxScannedPages=4;
  const check=()=>{if(signal?.aborted)throw new DOMException('Extraction stopped','AbortError')};
  const stop=()=>{worker?.terminate().catch(()=>{});task?.destroy().catch(()=>{})};signal?.addEventListener('abort',stop,{once:true});
  async function ocr(image,page){check();onProgress(`Reading scanned page ${page}…`);worker ||=await createWorker('eng',1,{workerPath:'/vendor/ocr/worker.min.js',corePath:'/vendor/ocr/core',langPath:'/vendor/ocr/lang',workerBlobURL:false,logger:m=>{if(m.status==='recognizing text')onProgress(`Reading scanned page ${page} · ${Math.round(m.progress*100)}%`)}});check();const result=await worker.recognize(image);check();return result.data.text}
  try{
    check();
    if(file.type==='application/pdf'){
      onProgress('Reading PDF text…');task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,cMapUrl:'/vendor/pdfjs/cmaps/',cMapPacked:true,standardFontDataUrl:'/vendor/pdfjs/standard_fonts/',wasmUrl:'/vendor/pdfjs/wasm/'});
      task.onPassword=()=>{task.destroy().catch(()=>{});};pdf=await task.promise;totalPages=pdf.numPages;
      // Read inexpensive native text first. A scanned cover must not delay all
      // the searchable policy schedules behind OCR initialization.
      for(let n=1;n<=Math.min(totalPages,maxPages);n++){
        check();const page=await pdf.getPage(n),content=await page.getTextContent();
        const text=policyPageText(content.items,page.getViewport({scale:1}).width);
        chunks[n-1]=text.slice(0,30000);readPages=n;
        if(text.replace(/\s/g,'').length>=60)textPages++;
        if(text.replace(/[^\p{L}]/gu,'').length<120)scanned.push(n);
        page.cleanup();onProgress(`Read PDF text · ${n} of ${Math.min(totalPages,maxPages)} pages`);
      }
      if(needsOCR(chunks.join('\n'))){for(const n of scanned.slice(0,maxScannedPages)){
        check();const page=await pdf.getPage(n),original=page.getViewport({scale:1}),scale=Math.min(2.4,2200/Math.max(original.width,original.height)),viewport=page.getViewport({scale});const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
        try{await page.render({canvasContext:canvas.getContext('2d'),viewport,background:'white'}).promise;chunks[n-1]+='\n'+await ocr(canvas,n);ocrPages++}finally{canvas.width=canvas.height=0;page.cleanup()}
      }
      }
    }else{
      const bitmap=await createImageBitmap(file);const scale=Math.min(1,2200/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.ceil(bitmap.width*scale);canvas.height=Math.ceil(bitmap.height*scale);const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();chunks.push(await ocr(canvas,1));canvas.width=canvas.height=0;ocrPages=1;
    }
    check();return {text:chunks.join('\n').slice(0,720000),textPages,ocrPages,totalPages,readPages:file.type==='application/pdf'?readPages:1,limited:totalPages>maxPages||scanned.length>maxScannedPages&&ocrPages===maxScannedPages};
  }finally{signal?.removeEventListener('abort',stop);await worker?.terminate().catch(()=>{});await task?.destroy().catch(()=>{})}
}
