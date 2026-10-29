import fs from 'node:fs/promises';
const dir='.cache/currency-history';await fs.mkdir(dir,{recursive:true});
const endpoint=d=>`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${d}/v1/currencies/usd.json`;
async function get(date){const file=`${dir}/${date}.json`;try{return JSON.parse(await fs.readFile(file,'utf8'))}catch{}
 for(const host of [endpoint(date),`https://${date}.currency-api.pages.dev/v1/currencies/usd.json`])try{const r=await fetch(host,{signal:AbortSignal.timeout(15000)});if(!r.ok)continue;const d=await r.json();if(d.date!==date||!['rub','vnd','uah'].every(k=>Number.isFinite(d.usd?.[k])&&d.usd[k]>0))continue;const row={date,rub:d.usd.rub,vnd:d.usd.vnd,uah:d.usd.uah};await fs.writeFile(file,JSON.stringify(row));return row}catch{}return {date,rub:null,vnd:null,uah:null}}
const r=await fetch(endpoint('latest'));if(!r.ok)throw Error('Latest failed');const latest=await r.json();
const dates=[];for(let t=Date.parse('2025-01-01T00:00:00Z');t<Date.parse(latest.date+'T00:00:00Z');t+=86400000)dates.push(new Date(t).toISOString().slice(0,10));
let next=0,rows=[];await Promise.all(Array.from({length:12},async()=>{while(next<dates.length){const i=next++;rows[i]=await get(dates[i]);if((i+1)%100===0)console.log('History',i+1,'/',dates.length)}}));
const old=JSON.parse(await fs.readFile('worker/seed.json','utf8'));if(old.source==='Google Finance')await fs.writeFile('worker/google-archive.json',JSON.stringify(old));
const data={version:2,source:'Currency API',sourceUrl:'https://github.com/fawazahmed0/exchange-api',updatedAt:new Date().toISOString(),sourceDate:latest.date,quoteTime:null,current:{rub:latest.usd.rub,vnd:latest.usd.vnd,uah:latest.usd.uah},history:rows};
await fs.writeFile('worker/seed.json',JSON.stringify(data));console.log(JSON.stringify({source:data.source,date:latest.date,rows:rows.length,missing:rows.filter(x=>x.rub===null).length}));
