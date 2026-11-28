import {build} from 'esbuild';
import {cp,mkdir} from 'node:fs/promises';
await build({entryPoints:['src/portal-sdk.js'],outfile:'dist/vendor/supabase.js',bundle:true,format:'iife',globalName:'SigmaSupabase',target:['es2022'],minify:true,legalComments:'none'});
console.log('Bundled authenticated policy portal client.');
await build({entryPoints:['src/policy-reader.js'],outfile:'dist/vendor/policy-reader.mjs',bundle:true,format:'esm',platform:'browser',external:['/vendor/pdfjs/pdf.mjs'],target:['es2022'],minify:true,legalComments:'eof'});
await mkdir('dist/vendor/pdfjs',{recursive:true});
for(const name of ['pdf.mjs','pdf.worker.mjs'])await cp('node_modules/pdfjs-dist/build/'+name,'dist/vendor/pdfjs/'+name);
for(const name of ['cmaps','standard_fonts','wasm'])await cp('node_modules/pdfjs-dist/'+name,'dist/vendor/pdfjs/'+name,{recursive:true});
await mkdir('dist/vendor/ocr/lang',{recursive:true});
await cp('node_modules/tesseract.js/dist/worker.min.js','dist/vendor/ocr/worker.min.js');
await cp('node_modules/tesseract.js-core','dist/vendor/ocr/core',{recursive:true});
await cp('node_modules/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz','dist/vendor/ocr/lang/eng.traineddata.gz');
await cp('integrations/google-forms-sync.gs','dist/google-forms-sync.gs');
for(const [source,target] of [['node_modules/pdfjs-dist/LICENSE','dist/vendor/pdfjs/LICENSE'],['node_modules/tesseract.js/LICENSE','dist/vendor/ocr/LICENSE'],['node_modules/@tesseract.js-data/eng/LICENSE','dist/vendor/ocr/lang/LICENSE']]){try{await cp(source,target)}catch(e){if(e.code!=='ENOENT')throw e}}
console.log('Prepared same-origin PDF and OCR runtime assets.');
