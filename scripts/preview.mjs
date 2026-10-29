import http from 'node:http';
import fs from 'node:fs/promises';
const source=await fs.readFile('dist/server/index.js','utf8');
const {default:worker}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
http.createServer(async(req,res)=>{try{const response=await worker.fetch(new Request('http://127.0.0.1:4317'+req.url),{});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()))}catch{res.writeHead(500);res.end('Preview error')}}).listen(4317,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4317'));
