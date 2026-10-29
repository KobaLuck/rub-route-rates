const BOOTSTRAP = __SEED__;
const PAGE = __PAGE__;
const WIDGET = __WIDGET__;
const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers});
const good=n=>typeof n==='number'&&Number.isFinite(n)&&n>0;
const dayOf=date=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(date));
const lower=k=>['rub','rubvnd','rubuah'].includes(k);
const metric=(r,k)=>k==='rubvnd'?(good(r.rub)&&good(r.vnd)?r.rub/r.vnd*1000:null):k==='rubuah'?(good(r.rub)&&good(r.uah)?r.rub/r.uah:null):k==='vndrub'?(good(r.rub)&&good(r.vnd)?r.vnd/r.rub*1000:null):k==='uahrub'?(good(r.rub)&&good(r.uah)?r.uah/r.rub*1000:null):r[k];
function summarize(raw){
 const comparisonDate=raw.sourceDate||dayOf(raw.updatedAt);
 const end=Date.parse(comparisonDate+'T00:00:00Z'),summary={};
 for(const k of ['rub','vnd','uah','vndrub','uahrub','rubvnd','rubuah']){
  summary[k]={};for(const days of [30,365]){
   const values=raw.history.filter(r=>{const t=Date.parse(r.date+'T00:00:00Z');return t>=end-days*86400000&&t<end&&good(metric(r,k))}).map(r=>({date:r.date,value:metric(r,k)}));
   const best=values.length?(lower(k)?Math.min(...values.map(x=>x.value)):Math.max(...values.map(x=>x.value))):null,current=metric(raw.current,k);
   summary[k]['d'+days]={best,count:values.length,record:good(best)&&good(current)&&(lower(k)?current<best:current>best),preliminary:raw.quoteTime===null||values.length<days,firstDate:values[0]?.date??null,lastDate:values.at(-1)?.date??null,bestDate:values.find(x=>x.value===best)?.date??null,improvementPercent:good(best)&&good(current)?(lower(k)?(best-current)/best:(current-best)/best)*100:null};
  }
 }
 const stale=Date.now()-Date.parse(raw.updatedAt)>30*3600000||(raw.sourceDate&&Date.now()-Date.parse(raw.sourceDate+'T00:00:00Z')>48*3600000);
 const today=dayOf(raw.updatedAt)===dayOf(new Date());
 const opportunities=[];
 if(!stale&&today&&!raw.refreshError)for(const key of ['rub','rubvnd','rubuah']){
  const annual=summary[key].d365,monthly=summary[key].d30;
  const days=annual.record&&annual.count>=240?365:monthly.record&&monthly.count>=20?30:null;
  if(days){const s=summary[key]['d'+days];opportunities.push({key,days,label:key==='rub'?'1 доллар':key==='rubvnd'?'1 000 донгов':'1 гривна',price:metric(raw.current,key),previousBest:s.best,improvementPercent:s.improvementPercent,count:s.count,preliminary:s.preliminary})}
 }
 return {...raw,summary,stale,opportunities};
}
async function read(env){const f=await env.BUCKET?.get('fx/latest.json');return f?await f.json():BOOTSTRAP}
async function provider(date='latest'){
 for(const url of [`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/usd.json`,`https://${date}.currency-api.pages.dev/v1/currencies/usd.json`])try{
  const res=await fetch(url,{signal:AbortSignal.timeout(5000)});if(!res.ok)continue;const d=await res.json();
  if(!/^20\d{2}-\d{2}-\d{2}$/.test(d.date)||!['rub','vnd','uah'].every(k=>good(d.usd?.[k]))||(date!=='latest'&&d.date!==date))continue;
  if(date==='latest'&&(Date.now()-Date.parse(d.date+'T00:00:00Z')>48*3600000||Date.parse(d.date+'T00:00:00Z')>Date.now()+3600000))continue;
  return {date:d.date,rub:d.usd.rub,vnd:d.usd.vnd,uah:d.usd.uah};
 }catch{}throw Error('Источник курсов временно недоступен');
}
let refreshInFlight;
async function automatic(env){
 const previous=await read(env);
 if(env.AUTO_SOURCE_ENABLED!=='true')return previous;
 if(previous.lastCheckedAt&&Date.now()-Date.parse(previous.lastCheckedAt)<3600000)return previous;
 if(refreshInFlight)return refreshInFlight;
 refreshInFlight=(async()=>{try{
  const latest=await provider();if(previous.sourceDate&&latest.date<previous.sourceDate)throw Error('Источник вернул старую дату');
  const map=new Map(previous.history.map(r=>[r.date,r]));
  if(previous.sourceDate&&previous.sourceDate<latest.date)map.set(previous.sourceDate,{date:previous.sourceDate,...previous.current});
  const missing=[];for(let t=Date.parse(latest.date+'T00:00:00Z')-86400000;t>=Date.parse('2025-01-01T00:00:00Z')&&missing.length<5;t-=86400000){const date=new Date(t).toISOString().slice(0,10);if(!map.has(date)||!good(map.get(date).rub))missing.push(date)}
  await Promise.all(missing.map(async date=>{try{map.set(date,await provider(date))}catch{}}));
  const now=new Date().toISOString(),data={version:2,source:'Currency API',sourceUrl:'https://github.com/fawazahmed0/exchange-api',updatedAt:now,lastCheckedAt:now,sourceDate:latest.date,quoteTime:null,current:{rub:latest.rub,vnd:latest.vnd,uah:latest.uah},history:[...map.values()].filter(r=>r.date<latest.date).sort((a,b)=>a.date.localeCompare(b.date))};
  if(!env.BUCKET)throw Error('Storage unavailable');await env.BUCKET.put('fx/latest.json',JSON.stringify(data),{httpMetadata:{contentType:'application/json'}});return data;
 }catch(e){return {...previous,refreshError:'Не удалось получить свежие данные; сохранён предыдущий снимок.'}}finally{refreshInFlight=null}})();return refreshInFlight;
}
function validate(input){
 if(!input||!Array.isArray(input.history)||input.history.length>3000)throw Error('Ожидается до 3000 исторических строк');
 if(!input.current||!['rub','vnd','uah'].every(k=>good(input.current[k])))throw Error('Нужны положительные RUB/USD, VND/USD, UAH/USD');
 if(!Number.isFinite(Date.parse(input.updatedAt))||Math.abs(Date.now()-Date.parse(input.updatedAt))>48*3600000)throw Error('Некорректное время обновления');
 const seen=new Set(),history=input.history.map(r=>{
  if(!/^20\d{2}-\d{2}-\d{2}$/.test(r.date)||!Number.isFinite(Date.parse(r.date+'T00:00:00Z'))||r.date>=dayOf(input.updatedAt)||r.date<'2025-01-01'||seen.has(r.date))throw Error('Некорректная или повторная дата');
  seen.add(r.date);return {date:r.date,...Object.fromEntries(['rub','vnd','uah'].map(k=>{if(r[k]!=null&&!good(r[k]))throw Error('Некорректный курс');return [k,r[k]??null]}))};
 }).sort((a,b)=>a.date.localeCompare(b.date));
 if(input.quoteTime!=null&&!Number.isFinite(Date.parse(input.quoteTime)))throw Error('Некорректное время котировки');
 return {version:1,source:'Google Finance',updatedAt:new Date(input.updatedAt).toISOString(),quoteTime:input.quoteTime??null,current:Object.fromEntries(['rub','vnd','uah'].map(k=>[k,input.current[k]])),history};
}
const schema={
 type:'object',additionalProperties:false,required:['current','history','updatedAt'],
 properties:{
  current:{type:'object',additionalProperties:false,required:['rub','vnd','uah'],properties:{rub:{type:'number'},vnd:{type:'number'},uah:{type:'number'}}},
  updatedAt:{type:'string'},quoteTime:{type:['string','null']},
  history:{type:'array',maxItems:3000,items:{type:'object',additionalProperties:false,required:['date','rub','vnd','uah'],properties:{date:{type:'string'},rub:{type:['number','null']},vnd:{type:['number','null']},uah:{type:['number','null']}}}}
 }
};
async function mcp(request,env){
 let input;try{input=await request.json()}catch{return json({error:'Invalid JSON'},400)}const {id,method,params}=input;
 const result=value=>json({jsonrpc:'2.0',id,result:value});
 if(method==='server/discover')return result({supportedVersions:['2026-07-28'],capabilities:{tools:{}}});
 if(method==='initialize')return result({protocolVersion:'2025-03-26',capabilities:{tools:{}},serverInfo:{name:'rub-route-rates',version:'1.0.0'}});
 if(method==='notifications/initialized')return new Response(null,{status:202});
 if(method==='tools/list')return result({tools:[{name:'sync_rates',description:'Обновить публичные рыночные курсы и историю из Google Таблицы. Только владелец. Без персональных данных.',inputSchema:schema},{name:'read_rates',description:'Прочитать снимок и сравнение за 30/365 дней.',inputSchema:{type:'object',additionalProperties:false,properties:{}}}]});
 if(method==='tools/call')try{
   if(params?.name==='read_rates'){const {history,...rest}=summarize(await automatic(env));return result({content:[{type:'text',text:JSON.stringify({...rest,historyRows:history.length})}]})}
   if(params?.name!=='sync_rates')throw Error('Unknown tool');
   const email=request.headers.get('oai-authenticated-user-email');
   if(!email||!env.OWNER_EMAIL||email.toLowerCase()!==env.OWNER_EMAIL.toLowerCase())throw Error('Обновление доступно только владельцу');
   if(!env.BUCKET)throw Error('Storage unavailable');
   const data=validate(params.arguments),file=await env.BUCKET.get('rates/latest.json'),previous=file?await file.json():{history:[],updatedAt:'2025-01-01'};
   if(Date.parse(data.updatedAt)<Date.parse(previous.updatedAt))throw Error('Снимок старше сохранённого');
   if(data.history.length<previous.history.length)throw Error('Нельзя сокращать архив');
   await env.BUCKET.put('rates/latest.json',JSON.stringify(data),{httpMetadata:{contentType:'application/json'}});
   const saved=data;return result({content:[{type:'text',text:JSON.stringify({success:true,archiveOnly:true,updatedAt:saved.updatedAt,historyRows:saved.history.length,current:saved.current})}]});
  }catch(e){return result({isError:true,content:[{type:'text',text:e.message}]})}
 return json({jsonrpc:'2.0',id,error:{code:-32601,message:'Method not found'}});
}
export default {async fetch(request,env){
 const path=new URL(request.url).pathname;
 if(path==='/mcp'){if(request.method!=='POST')return json({error:'POST required'},405);if(Number(request.headers.get('content-length')||0)>400000)return json({error:'Too large'},413);return mcp(request,env)}
 if(request.method!=='GET'&&request.method!=='HEAD')return json({error:'Method not allowed'},405);
 if(path==='/api/rates')try{return json(summarize(await automatic(env)))}catch{return json({error:'Курсы временно недоступны'},503)}
 if(path==='/widget.js')return new Response(WIDGET,{headers:{'Content-Type':'text/javascript; charset=utf-8','Content-Disposition':'attachment; filename="Kurs.js"','Cache-Control':'public, max-age=300'}});
 if(path==='/'||path==='/index.html')return new Response(PAGE,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
 return new Response('Not found',{status:404});
}};
