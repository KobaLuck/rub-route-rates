// Курс · Scriptable. Добавьте средний виджет и выберите этот скрипт.
const BASE = 'https://rub-route-rates.boldmite258.chatgpt.site';
const fm = FileManager.local();
const cache = fm.joinPath(fm.cacheDirectory(), 'rub-route-rates-v1.json');
let data, offline = false;
try {
  const request = new Request(BASE + '/api/rates');
  request.timeoutInterval = 15;
  data = await request.loadJSON();
  if (!data.current || !data.updatedAt) throw new Error('Нет данных');
  fm.writeString(cache, JSON.stringify(data));
} catch (e) {
  offline = true;
  if (fm.fileExists(cache)) data = JSON.parse(fm.readString(cache));
}
const w = new ListWidget();
w.backgroundColor = new Color('#101F2C');
w.setPadding(14, 16, 14, 16);
w.url = BASE;
function label(stack, value, size, color, bold = false) {
  const t = stack.addText(value);
  t.font = bold ? Font.boldSystemFont(size) : Font.systemFont(size);
  t.textColor = new Color(color); t.lineLimit = 1; t.minimumScaleFactor = 0.7;
  return t;
}
const signals = offline || data?.stale ? [] : (data?.opportunities || []).filter(x => new Date(data.updatedAt).toLocaleDateString('en-CA',{timeZone:'Asia/Ho_Chi_Minh'}) === new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Ho_Chi_Minh'}) && Date.now()-new Date(data.updatedAt).getTime()<30*3600000);
if(signals.length){w.backgroundColor=new Color('#17442C');}
const head = w.addStack(); head.centerAlignContent();
label(head, signals.length?'✦ ВЫГОДНО СЕГОДНЯ':'ЦЕНА В РУБЛЯХ', 11, signals.length?'#D9F06B':'#A4B6C4', true);
head.addSpacer();
const button = head.addStack(); button.url = BASE + '/#chart';
button.backgroundColor = new Color('#254637'); button.cornerRadius = 9;
button.setPadding(5, 9, 5, 9);
label(button, 'Графики ↗', 11, '#B8EDBC', true);
w.addSpacer(9);
if (data) {
  const nf = (n, d = 0) => Number(n).toLocaleString('ru-RU', {maximumFractionDigits:d});
  const c = data.current;
  const row = w.addStack();
  const usd = row.addStack(); usd.layoutVertically();
  label(usd, '1 доллар', 10, '#A4B6C4');
  label(usd, Number.isFinite(c.rub) ? nf(c.rub, 2) + ' ₽' : '—', 20, '#FFFFFF', true);
  row.addSpacer();
  const uah = row.addStack(); uah.layoutVertically();
  label(uah, '1 гривна', 10, '#A4B6C4');
  label(uah, Number.isFinite(c.rub / c.uah) ? nf(c.rub / c.uah, 4) + ' ₽' : '—', 20, '#FFFFFF', true);
  row.addSpacer();
  const vnd = row.addStack(); vnd.layoutVertically();
  label(vnd, '1 000 донгов', 10, '#A4B6C4');
  label(vnd, Number.isFinite(c.rub / c.vnd) ? nf(c.rub / c.vnd * 1000, 4) + ' ₽' : '—', 20, '#FFFFFF', true);
  w.addSpacer(7);
  const age = Date.now() - new Date(data.updatedAt).getTime();
  const records = offline || age > 30*3600000 ? [] : ['rub','rubvnd','rubuah'].filter(k => data.summary?.[k]?.d30?.record).map(k => (k==='rub'?'USD':k==='rubuah'?'UAH':'VND') + (data.summary[k].d365?.record?' · мин. год*':' · мин. месяц*'));
  if(signals.length){const band=w.addStack();band.backgroundColor=new Color('#D9F06B');band.cornerRadius=7;band.setPadding(5,7,5,7);label(band,signals.slice(0,1).map(x=>(x.key==='rub'?'USD':x.key==='rubvnd'?'VND':'UAH')+' · мин. '+x.days+' д. · −'+nf(x.improvementPercent,2)+'%').join('')+(signals.length>1?' · ещё '+(signals.length-1):''),10,'#173321',true);}else{label(w, 'Меньше рублей — выгоднее', 11, '#D7E1E8');}
  w.addSpacer(4);
  const df = new DateFormatter(); df.dateFormat = 'dd.MM HH:mm'; df.timeZone = 'Asia/Ho_Chi_Minh';
  label(w, (offline?'Офлайн · ':age>30*3600000?'Старые данные · ':'Проверено ') + df.string(new Date(data.updatedAt)) + ' UTC+7' + (records.length?' *предв.':''), 9, '#A4B6C4');
} else {
  label(w, 'Не удалось получить курсы', 15, '#FFFFFF', true);
  w.addSpacer(7); label(w, 'Нажмите «Графики» для проверки', 11, '#A4B6C4');
}
w.refreshAfterDate = new Date(Date.now() + 60 * 60 * 1000);
Script.setWidget(w);
if (!config.runsInWidget) await w.presentMedium();
Script.complete();
