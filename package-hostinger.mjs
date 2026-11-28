import {cp,mkdir,writeFile,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {publicProject} from './config/public-project.mjs';

// Package only build output. Repository files, .env and deployment credentials stay outside public_html.
const root=path.resolve('release/hostinger/public_html');
await mkdir(root,{recursive:true});
async function copyPublic(source,target){for(const entry of await readdir(source,{withFileTypes:true})){if(entry.name.startsWith('.')||entry.name.endsWith('-source.html'))continue;if(path.resolve(source)===path.resolve('dist/vendor')&&!['supabase.js','policy-reader.mjs','pdfjs','ocr'].includes(entry.name))continue;const from=path.join(source,entry.name),to=path.join(target,entry.name);if(entry.isSymbolicLink())throw Error('Symlinks are not allowed in hosting output');if(entry.isDirectory()){await mkdir(to,{recursive:true});await copyPublic(from,to)}else await cp(from,to)}}
// Use a new output directory when preparing another release; never overwrite an uploaded site's files here.
if((await readdir(root)).length)throw Error('release/hostinger/public_html already exists. Archive the previous release before preparing another.');
await copyPublic('dist',root);
await mkdir(path.join(root,'api'),{recursive:true});
await writeFile(path.join(root,'api/config.json'),JSON.stringify({configured:true,url:publicProject.url,publishableKey:publicProject.publishableKey,emailOtpEnabled:process.env.EMAIL_OTP_ENABLED==='true'},null,2));
await writeFile(path.join(root,'.htaccess'),`Options -Indexes
DirectoryIndex index.html
RewriteEngine On
RewriteRule ^api/config/?$ api/config.json [L]
RewriteRule ^(?:admin|partner)/?$ index.html [L]
<IfModule mod_headers.c>
  <FilesMatch "^(index\\.html|config\\.json)$">
    Header set Cache-Control "no-store"
  </FilesMatch>
</IfModule>
<IfModule mod_mime.c>
  AddType text/javascript .mjs
  AddType application/wasm .wasm
</IfModule>
`);
let files=0,bytes=0;async function count(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await count(p);else{files++;bytes+=(await stat(p)).size}}}await count(root);
console.log(JSON.stringify({directory:root,files,megabytes:Math.round(bytes/1048576),emailOtpEnabled:process.env.EMAIL_OTP_ENABLED==='true',dataBackend:'Existing Supabase project; this package does not migrate private data.'}));
