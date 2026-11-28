import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,existsSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
test('Hostinger package exposes public configuration and excludes local setup/QA files',()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'sigma-hostinger-'));
 mkdirSync(path.join(dir,'dist/vendor/ocr'),{recursive:true});
 for(const [name,data] of [['index.html','<html>App</html>'],['vendor/supabase.js','sdk'],['vendor/policy-reader.mjs','reader'],['vendor/ocr/worker.js','worker'],['vendor/admin-setup.html','PRIVATE SQL'],['vendor/sample-policy.pdf','PRIVATE POLICY'],['.env','SMTP_PASSWORD=private']])writeFileSync(path.join(dir,'dist',name),data);
 const result=spawnSync(process.execPath,[path.resolve('package-hostinger.mjs')],{cwd:dir,encoding:'utf8',env:{...process.env,EMAIL_OTP_ENABLED:''}});
 assert.equal(result.status,0,result.stderr);
 const root=path.join(dir,'release/hostinger/public_html');
 for(const name of ['index.html','vendor/supabase.js','vendor/ocr/worker.js','.htaccess','api/config.json'])assert.ok(existsSync(path.join(root,name)),name);
 for(const name of ['vendor/admin-setup.html','vendor/sample-policy.pdf','.env'])assert.equal(existsSync(path.join(root,name)),false,name);
 const config=JSON.parse(readFileSync(path.join(root,'api/config.json')));assert.equal(config.emailOtpEnabled,false);assert.match(config.publishableKey,/^sb_publishable_/);
 assert.match(readFileSync(path.join(root,'.htaccess'),'utf8'),/api\/config/);
 assert.notEqual(spawnSync(process.execPath,[path.resolve('package-hostinger.mjs')],{cwd:dir,encoding:'utf8'}).status,0,'An existing release must not be overwritten silently');
});
