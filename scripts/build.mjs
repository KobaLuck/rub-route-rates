import fs from 'node:fs/promises';
const input=await fs.readFile('worker/index.js','utf8');
const seed=JSON.parse(await fs.readFile('worker/seed.json','utf8'));
const page=await fs.readFile('worker/page.html','utf8');
let widget=await fs.readFile('worker/widget.js','utf8');
if(process.env.PUBLIC_SITE_URL){const url=new URL(process.env.PUBLIC_SITE_URL);if(url.protocol!=='https:')throw Error('PUBLIC_SITE_URL must use HTTPS');widget=widget.replace("const BASE = 'https://rub-route-rates.boldmite258.chatgpt.site';",()=>`const BASE = ${JSON.stringify(url.origin)};`);}
const output=input.replace('__SEED__',()=>JSON.stringify(seed)).replace('__PAGE__',()=>JSON.stringify(page)).replace('__WIDGET__',()=>JSON.stringify(widget));
await fs.mkdir('dist/server',{recursive:true});await fs.mkdir('dist/.openai',{recursive:true});
await fs.writeFile('dist/server/index.js',output);
let manifest;try{manifest=await fs.readFile('.openai/hosting.json','utf8')}catch{manifest=await fs.readFile('.openai/hosting.example.json','utf8')}
await fs.writeFile('dist/.openai/hosting.json',manifest);
console.log('Built Worker with embedded page, widget and public bootstrap data');
