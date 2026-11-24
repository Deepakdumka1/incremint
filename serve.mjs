import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import configHandler from './api/config.mjs';
const root=path.resolve('dist');
const mime={'.css':'text/css','.js':'text/javascript','.html':'text/html; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'};
http.createServer(async(req,res)=>{try{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(name==='/api/config'){const response={setHeader:(k,v)=>res.setHeader(k,v),status(code){res.statusCode=code;return this},json(data){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data))}};return configHandler(req,response)}const target=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!target.startsWith(root+path.sep))throw Error();const body=await readFile(target);res.writeHead(200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream'});res.end(body)}catch{res.writeHead(404);res.end('Not found')}}).listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173'));
