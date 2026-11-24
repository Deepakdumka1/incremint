import {build} from 'esbuild';
await build({entryPoints:['src/portal-sdk.js'],outfile:'dist/vendor/supabase.js',bundle:true,format:'iife',globalName:'SigmaSupabase',target:['es2022'],minify:true,legalComments:'none'});
console.log('Bundled authenticated policy portal client.');
