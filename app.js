const KEY='saati-web-v1';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const pad=n=>String(n).padStart(2,'0');
const isoDate=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const today=()=>isoDate(new Date());
const localInput=d=>`${isoDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const uid=()=>Date.now()+Math.floor(Math.random()*10000);
const defaults={settings:{workerName:'',employerName:'',rate:20,currency:'₪',breakMinutes:30,overtimeEnabled:false,dailyMinutes:480,overtimeMultiplier:1.5,holidayMultiplier:2,theme:'system',payCycleStart:1,startTime:'07:00',endTime:'16:00',longShiftMinutes:720},sessions:[],transactions:[],version:1};
let state=load(), page='home', tick, reportRange='month';

function load(){try{const x=JSON.parse(localStorage.getItem(KEY));return x?{...structuredClone(defaults),...x,settings:{...defaults.settings,...x.settings}}:structuredClone(defaults)}catch{return structuredClone(defaults)}}
function save(){localStorage.setItem(KEY,JSON.stringify(state));renderBadges()}
function active(){return state.sessions.find(x=>x.active)}
function dt(v){return new Date(v)}
function money(n){return `${Number(n||0).toFixed(2)} ${state.settings.currency}`}
function duration(min){min=Math.max(0,Math.floor(min));return `${Math.floor(min/60)}س و${min%60}د`}
function mins(a,b){return Math.max(0,Math.floor((dt(b)-dt(a))/60000))}
function dayName(v){return new Intl.DateTimeFormat('ar',{weekday:'long'}).format(dt(v))}
function fmtDate(v){return new Intl.DateTimeFormat('ar-PS',{year:'numeric',month:'2-digit',day:'2-digit'}).format(dt(v))}
function fmtTime(v){return new Intl.DateTimeFormat('ar',{hour:'numeric',minute:'2-digit'}).format(dt(v))}
function esc(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function calc(start,end,breakMinutes=0,isHoliday=false,rate=state.settings.rate){
  const gross=mins(start,end), net=Math.max(0,gross-(Number(breakMinutes)||0));
  if(isHoliday)return {gross,net,regular:0,overtime:0,pay:net/60*rate*state.settings.holidayMultiplier};
  const regular=state.settings.overtimeEnabled?Math.min(net,state.settings.dailyMinutes):net;
  const overtime=state.settings.overtimeEnabled?Math.max(0,net-regular):0;
  return {gross,net,regular,overtime,pay:regular/60*rate+overtime/60*rate*state.settings.overtimeMultiplier};
}
function normalized(s,end=s.end||new Date().toISOString()){return {...s,...calc(s.start,end,s.breakMinutes,s.holiday,s.rate)}}
function completed(){return state.sessions.filter(x=>!x.active&&x.end).map(x=>normalized(x)).sort((a,b)=>dt(b.start)-dt(a.start))}
function inRange(list,from,to,key='start'){return list.filter(x=>isoDate(dt(x[key]||x.date))>=from&&isoDate(dt(x[key]||x.date))<=to)}
function sum(list,key){return list.reduce((a,x)=>a+Number(x[key]||0),0)}
function txKind(type){return ({bonus:'مكافأة',deduction:'خصم',advance:'سلفة',payment:'دفعة مقبوضة',adjustment:'تعديل'}[type]||type)}
function netDue(sessions=completed(),txs=state.transactions){return sum(sessions,'pay')+sum(txs.filter(x=>x.type==='bonus'),'amount')-sum(txs.filter(x=>x.type==='deduction'||x.type==='advance'||x.type==='payment'),'amount')+sum(txs.filter(x=>x.type==='adjustment'),'amount')}
function toast(msg){const e=$('#toast');e.textContent=msg;e.classList.add('show');setTimeout(()=>e.classList.remove('show'),2400)}
function modal(title,body){$('#modalTitle').textContent=title;$('#modalBody').innerHTML=body;$('#modal').showModal()}
function closeModal(){try{$('#modal').close()}catch{}}
function setTheme(){const t=state.settings.theme;document.documentElement.dataset.theme=t==='system'?(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'):t}

function render(){clearInterval(tick);setTheme();$$('.tabs button').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  const titles={home:'الرئيسية',history:'السجل',calendar:'التقويم',reports:'التقارير',settings:'الإعدادات'};$('#pageTitle').textContent=titles[page];
  ({home:renderHome,history:renderHistory,calendar:renderCalendar,reports:renderReports,settings:renderSettings}[page])();renderBadges();
}
function renderBadges(){$('#onlineState').style.color=navigator.onLine?'var(--success)':'var(--danger)';$('#onlineState').title=navigator.onLine?'متصل':'يعمل دون إنترنت'}

function renderHome(){
  const now=new Date(), a=active(), done=completed(), td=today();
  const todaySessions=done.filter(x=>isoDate(dt(x.start))===td), weekAgo=new Date(now);weekAgo.setDate(now.getDate()-6);
  const week=inRange(done,isoDate(weekAgo),td), month=inRange(done,`${now.getFullYear()}-${pad(now.getMonth()+1)}-01`,td);
  $('#app').innerHTML=`<section class="hero"><div><h1>ساعاتي</h1><div class="subtitle">${new Intl.DateTimeFormat('ar',{dateStyle:'full'}).format(now)}</div><div class="clock" id="clock"></div></div><div class="badge">دوامي اليوم</div></section>
  ${!matchMedia('(display-mode: standalone)').matches?'<div class="card install-note no-print">لإضافته كتطبيق: اضغط زر المشاركة في Safari ثم «إضافة إلى الشاشة الرئيسية».</div>':''}
  <section class="card live"><div class="status">${a?'الدوام جارٍ الآن':'جاهز لبدء الدوام'}</div><div class="subtitle">${a?`بدأت عند ${fmtTime(a.start)}`:'سجّل بداية دوامك بضغطة واحدة'}</div><div class="duration" id="liveDuration">${a?duration(calc(a.start,new Date(),a.breakMinutes,a.holiday,a.rate).net):'0 ساعة و0 دقيقة'}</div><div class="subtitle">الأجر المحسوب حتى الآن</div><div class="earn" id="livePay">${a?money(calc(a.start,new Date(),a.breakMinutes,a.holiday,a.rate).pay):money(0)}</div></section>
  ${a?'<button class="action secondary" id="editStartBtn">تعديل وقت البداية</button><div class="grid2"><button class="action secondary" id="breakBtn">تعديل الاستراحة</button><button class="action danger" id="endBtn">إنهاء الدوام</button></div>':'<button class="action success" id="startBtn">بدء الدوام</button>'}
  <h2 class="section-title">ملخص سريع</h2><section class="grid2"><div class="metric">ساعات اليوم<strong>${duration(sum(todaySessions,'net'))}</strong></div><div class="metric">أجر اليوم<strong>${money(sum(todaySessions,'pay'))}</strong></div><div class="metric">ساعات الأسبوع<strong>${duration(sum(week,'net'))}</strong></div><div class="metric">مستحقات الشهر<strong>${money(netDue(month,state.transactions.filter(x=>x.date.startsWith(`${now.getFullYear()}-${pad(now.getMonth()+1)}`))))}</strong></div></section>
  <button class="action secondary" id="manualBtn">＋ نسيت التسجيل؟ أضف دواماً يدوياً</button>
  ${done[0]?`<div class="card muted">آخر دوام: ${fmtDate(done[0].start)}، ${duration(done[0].net)} — ${money(done[0].pay)}</div>`:''}`;
  const update=()=>{const n=new Date();$('#clock').textContent=n.toLocaleTimeString('ar',{hour:'2-digit',minute:'2-digit',second:'2-digit'});if(a){const c=calc(a.start,n,a.breakMinutes,a.holiday,a.rate);$('#liveDuration').textContent=duration(c.net);$('#livePay').textContent=money(c.pay)}};update();tick=setInterval(update,1000);
  $('#startBtn')?.addEventListener('click',startWork);$('#endBtn')?.addEventListener('click',endWork);$('#breakBtn')?.addEventListener('click',editBreak);$('#editStartBtn')?.addEventListener('click',editActiveStart);$('#manualBtn').onclick=()=>sessionForm();
}
function startWork(){
  const now=new Date(), [h,m]=state.settings.startTime.split(':').map(Number), expected=new Date(now);expected.setHours(h,m,0,0);const diff=Math.abs(now-expected)/60000;
  const go=()=>{state.sessions.push({id:uid(),start:now.toISOString(),end:null,breakMinutes:state.settings.breakMinutes,holiday:false,notes:'',rate:state.settings.rate,active:true,manual:false});save();render();toast('بدأ الدوام')};
  if(diff>90&&!confirm(`الوقت الحالي بعيد عن موعد الدوام المعتاد (${state.settings.startTime}). هل تريد البدء؟`))return;go();
}
function editActiveStart(){
  const session=active();
  if(!session)return;
  modal('تعديل وقت البداية',`
    <p class="muted">نسيت تشغيل الدوام؟ اختر وقت بدايتك الفعلي. سيُحدّث العداد والأجر ويبقى الدوام شغّالاً.</p>
    <div class="field"><label for="activeStart">تاريخ ووقت البداية الفعلي</label><input id="activeStart" type="datetime-local" value="${localInput(dt(session.start))}" max="${localInput(new Date())}" required></div>
    <p id="startPreview" class="muted"></p>
    <p id="startError" class="danger-text" role="alert"></p>
    <button type="button" class="action" id="saveActiveStart">حفظ ومتابعة الدوام</button>`);
  const input=$('#activeStart'),error=$('#startError');
  const preview=()=>{
    const value=dt(input.value);
    $('#startPreview').textContent=Number.isFinite(value.getTime())?`البداية: ${fmtDate(value)}، ${fmtTime(value)}`:'';
    error.textContent='';
  };
  input.oninput=preview;preview();
  $('#saveActiveStart').onclick=()=>{
    const current=active(),start=dt(input.value),now=new Date();
    if(!current||current.id!==session.id){closeModal();render();return toast('تغيّر الدوام الجاري. افتحه من جديد')}
    if(!Number.isFinite(start.getTime())){error.textContent='اختر تاريخاً ووقتاً صحيحين';return}
    if(start>now){error.textContent='وقت البداية لا يمكن أن يكون في المستقبل';return}
    if(state.sessions.some(x=>x.id!==current.id&&start<dt(x.end||now)&&now>dt(x.start))){
      error.textContent='الوقت المختار يتداخل مع دوام مسجّل. اختر بداية بعد نهايته';return;
    }
    const previous=current.start;
    current.start=start.toISOString();
    try{save()}catch{current.start=previous;error.textContent='تعذّر حفظ التعديل. حاول مجدداً';return}
    closeModal();render();toast('تم تعديل البداية، والدوام مستمر');
  };
}
function endWork(){const a=active();if(!a)return;const c=calc(a.start,new Date(),a.breakMinutes,a.holiday,a.rate);if(c.gross>state.settings.longShiftMinutes&&!confirm(`الدوام طويل: ${duration(c.gross)}. هل تريد إنهاءه الآن؟`))return;a.end=new Date().toISOString();a.active=false;save();render();toast('تم حفظ الدوام')}
function editBreak(){const a=active(),v=prompt('مدة الاستراحة بالدقائق',a.breakMinutes);if(v===null)return;const n=Math.max(0,Number(v)||0);if(n>mins(a.start,new Date()))return toast('الاستراحة أطول من مدة الدوام');a.breakMinutes=n;save();render()}

function sessionForm(existing){const s=existing||{},start=s.start?dt(s.start):new Date(),end=s.end?dt(s.end):new Date(start.getTime()+9*3600000);modal(existing?'تعديل الدوام':'إضافة دوام يدوي',`
  <div class="field"><label>البداية</label><input id="fStart" type="datetime-local" value="${localInput(start)}"></div><div class="field"><label>النهاية</label><input id="fEnd" type="datetime-local" value="${localInput(end)}"></div>
  <div class="grid2"><div class="field"><label>الاستراحة بالدقائق</label><input id="fBreak" type="number" min="0" value="${s.breakMinutes??state.settings.breakMinutes}"></div><div class="field"><label>سعر الساعة</label><input id="fRate" type="number" step="0.01" min="0" value="${s.rate??state.settings.rate}"></div></div>
  <div class="field"><label><input id="fHoliday" type="checkbox" ${s.holiday?'checked':''}> يوم عطلة</label></div><div class="field"><label>ملاحظة</label><textarea id="fNotes">${esc(s.notes)}</textarea></div><button type="button" class="action" id="saveSession">حفظ الدوام</button>`);
  $('#saveSession').onclick=()=>{const st=dt($('#fStart').value),en=dt($('#fEnd').value);if(!(en>st))return toast('وقت النهاية يجب أن يكون بعد البداية');const overlaps=state.sessions.some(x=>x.id!==s.id&&st<dt(x.end||new Date())&&en>dt(x.start));if(overlaps&&!confirm('يوجد دوام آخر متداخل مع هذه الفترة. هل تريد الحفظ؟'))return;const item={id:s.id||uid(),start:st.toISOString(),end:en.toISOString(),breakMinutes:Math.max(0,Number($('#fBreak').value)||0),rate:Math.max(0,Number($('#fRate').value)||0),holiday:$('#fHoliday').checked,notes:$('#fNotes').value.trim(),active:false,manual:true};if(s.id)state.sessions[state.sessions.findIndex(x=>x.id===s.id)]=item;else state.sessions.push(item);save();closeModal();render();toast('تم حفظ الدوام')}
}

function renderHistory(){const done=completed(),from=$('#histFrom')?.value||'',to=$('#histTo')?.value||'',filtered=done.filter(x=>(!from||isoDate(dt(x.start))>=from)&&(!to||isoDate(dt(x.start))<=to));const groups=Object.groupBy?Object.groupBy(filtered,x=>isoDate(dt(x.start))):filtered.reduce((a,x)=>((a[isoDate(dt(x.start))]??=[]).push(x),a),{});
  $('#app').innerHTML=`<div class="hero"><div><h1>سجل الدوام</h1><div class="subtitle">${done.length} فترة محفوظة</div></div></div><button class="action" id="addManual">＋ إضافة دوام يدوي</button><div class="card filters"><div class="field"><label>من تاريخ</label><input id="histFrom" type="date" value="${from}"></div><div class="field"><label>إلى تاريخ</label><input id="histTo" type="date" value="${to}"></div></div><div id="historyList">${Object.keys(groups).length?Object.entries(groups).map(([date,list])=>`<section class="card"><h2>${dayName(date)} ${fmtDate(date)}</h2>${list.map(sessionRow).join('')}<strong class="money">إجمالي اليوم: ${duration(sum(list,'net'))} — ${money(sum(list,'pay'))}</strong><button class="action danger small delete-day" data-date="${date}">حذف اليوم بالكامل</button></section>`).join(''):'<div class="card empty">لا توجد سجلات في هذه الفترة</div>'}</div>`;
  $('#addManual').onclick=()=>sessionForm();$('#histFrom').onchange=renderHistory;$('#histTo').onchange=renderHistory;bindSessionActions();$$('.delete-day').forEach(b=>b.onclick=()=>{if(confirm('حذف جميع فترات هذا اليوم؟')){state.sessions=state.sessions.filter(x=>isoDate(dt(x.start))!==b.dataset.date);save();renderHistory()}})
}
function sessionRow(s){return `<div class="session"><div class="session-title">${fmtTime(s.start)} – ${fmtTime(s.end)} | استراحة ${s.breakMinutes} دقيقة</div><div class="session-detail">${duration(s.net)} — <span class="money">${money(s.pay)}</span>${s.notes?`<br>${esc(s.notes)}`:''}</div><div class="grid2"><button class="action small edit-session" data-id="${s.id}">تعديل</button><button class="action danger small delete-session" data-id="${s.id}">حذف</button></div></div>`}
function bindSessionActions(){$$('.edit-session').forEach(b=>b.onclick=()=>sessionForm(state.sessions.find(x=>x.id==b.dataset.id)));$$('.delete-session').forEach(b=>b.onclick=()=>{if(confirm('حذف فترة الدوام؟')){state.sessions=state.sessions.filter(x=>x.id!=b.dataset.id);save();render()}})}

function renderCalendar(){const now=new Date(),ym=`${now.getFullYear()}-${pad(now.getMonth()+1)}`,days=new Date(now.getFullYear(),now.getMonth()+1,0).getDate(),done=completed();$('#app').innerHTML=`<h1>التقويم</h1><p class="subtitle">${new Intl.DateTimeFormat('ar',{month:'long',year:'numeric'}).format(now)}</p><section class="card"><div class="calendar-grid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:7px;text-align:center">${['ح','ن','ث','ر','خ','ج','س'].map(x=>`<b>${x}</b>`).join('')}${Array(new Date(now.getFullYear(),now.getMonth(),1).getDay()).fill('<i></i>').join('')}${Array.from({length:days},(_,i)=>{const d=`${ym}-${pad(i+1)}`,ss=done.filter(x=>isoDate(dt(x.start))===d);return `<button class="chip ${ss.length?'active':''}" style="padding:9px 2px" data-date="${d}">${i+1}${ss.length?'<small style="display:block">✓</small>':''}</button>`}).join('')}</div></section><div id="calendarDay"></div>`;$$('[data-date]').forEach(b=>b.onclick=()=>{const ss=done.filter(x=>isoDate(dt(x.start))===b.dataset.date);$('#calendarDay').innerHTML=ss.length?`<section class="card"><h2>${fmtDate(b.dataset.date)}</h2>${ss.map(sessionRow).join('')}</section>`:'<div class="card empty">لا يوجد دوام في هذا اليوم</div>';bindSessionActions()})}

function rangeDates(kind=reportRange){const n=new Date(),to=isoDate(n),from=new Date(n);if(kind==='week')from.setDate(n.getDate()-6);else if(kind==='month')from.setDate(1);else if(kind==='cycle'){from.setDate(Math.min(28,state.settings.payCycleStart));if(from>n)from.setMonth(from.getMonth()-1)}else from.setFullYear(n.getFullYear(),0,1);return [isoDate(from),to]}
function reportData(from,to){const ss=inRange(completed(),from,to),tx=inRange(state.transactions,from,to,'date');return {ss,tx,due:netDue(ss,tx)}}
function renderReports(){let [from,to]=rangeDates();const d=reportData(from,to);$('#app').innerHTML=`<h1>التقارير</h1><div class="chips no-print">${[['week','هذا الأسبوع'],['month','هذا الشهر'],['cycle','دورة الراتب'],['year','هذه السنة']].map(([k,v])=>`<button class="chip ${reportRange===k?'active':''}" data-range="${k}">${v}</button>`).join('')}</div><section class="card filters no-print"><div class="field"><label>من</label><input id="repFrom" type="date" value="${from}"></div><div class="field"><label>إلى</label><input id="repTo" type="date" value="${to}"></div></section><div id="reportContent">${reportHtml(from,to,d)}</div>`;$$('[data-range]').forEach(b=>b.onclick=()=>{reportRange=b.dataset.range;renderReports()});const refresh=()=>{$('#reportContent').innerHTML=reportHtml($('#repFrom').value,$('#repTo').value,reportData($('#repFrom').value,$('#repTo').value));bindReportActions()};$('#repFrom').onchange=refresh;$('#repTo').onchange=refresh;bindReportActions()}
function reportHtml(from,to,d){const regular=sum(d.ss,'regular'),overtime=sum(d.ss,'overtime'),adv=sum(d.tx.filter(x=>x.type==='advance'),'amount'),paid=sum(d.tx.filter(x=>x.type==='payment'),'amount');return `<section class="card"><div class="subtitle">من ${fmtDate(from)} إلى ${fmtDate(to)}</div><h2 style="margin-top:10px">صافي المستحق</h2><h1 class="good-text">${money(d.due)}</h1><div class="grid2" style="margin-top:16px"><div class="metric">فترات الدوام<strong>${d.ss.length}</strong></div><div class="metric">إجمالي الساعات<strong>${duration(sum(d.ss,'net'))}</strong></div><div class="metric">الساعات العادية<strong>${duration(regular)}</strong></div><div class="metric">الساعات الإضافية<strong>${duration(overtime)}</strong></div><div class="metric">السلف<strong class="danger-text">${money(adv)}</strong></div><div class="metric">المقبوض<strong>${money(paid)}</strong></div></div></section><h2 class="section-title">الساعات اليومية</h2><section class="card">${d.ss.length?d.ss.map(x=>`<div class="row session"><span>${fmtDate(x.start)}: ${duration(x.net)}</span><b>${money(x.pay)}</b></div>`).join(''):'<div class="empty">لا توجد ساعات</div>'}</section><h2 class="section-title">الحركات المالية</h2><button class="action success no-print" id="addPayment">✓ تسجيل مبلغ مقبوض</button><button class="action danger no-print" id="addAdvance">＋ تسجيل سلفة</button><button class="action secondary no-print" id="addTx">＋ مكافأة أو خصم</button><section>${d.tx.map(transactionRow).join('')||'<div class="card empty">لا توجد حركات</div>'}</section><h2 class="section-title no-print">تصدير التقرير</h2><div class="grid2 no-print"><button class="action secondary" id="printReport">تصدير PDF</button><button class="action secondary" id="csvReport">تصدير CSV</button></div>`}
function transactionRow(x){return `<div class="card transaction ${x.type}"><div class="row"><div><b>${txKind(x.type)}</b><div class="muted">${fmtDate(x.date)} ${esc(x.notes)}</div></div><strong>${money(x.amount)}</strong></div><button class="action danger small no-print delete-tx" data-id="${x.id}">حذف</button></div>`}
function bindReportActions(){$('#addPayment')?.addEventListener('click',()=>transactionForm('payment'));$('#addAdvance')?.addEventListener('click',()=>transactionForm('advance'));$('#addTx')?.addEventListener('click',()=>transactionForm('bonus'));$('#printReport')?.addEventListener('click',()=>window.print());$('#csvReport')?.addEventListener('click',exportCsv);$$('.delete-tx').forEach(b=>b.onclick=()=>{if(confirm('حذف الحركة المالية؟')){state.transactions=state.transactions.filter(x=>x.id!=b.dataset.id);save();renderReports()}})}
function transactionForm(type){modal('إضافة حركة مالية',`<div class="field"><label>النوع</label><select id="txType"><option value="bonus" ${type==='bonus'?'selected':''}>مكافأة</option><option value="deduction">خصم</option><option value="advance" ${type==='advance'?'selected':''}>سلفة</option><option value="payment" ${type==='payment'?'selected':''}>مبلغ مقبوض</option><option value="adjustment">تعديل يدوي</option></select></div><div class="field"><label>المبلغ</label><input id="txAmount" type="number" min="0" step="0.01"></div><div class="field"><label>التاريخ</label><input id="txDate" type="date" value="${today()}"></div><div class="field"><label>ملاحظة</label><input id="txNotes"></div><button type="button" class="action" id="saveTx">حفظ</button>`);$('#saveTx').onclick=()=>{const amount=Number($('#txAmount').value);if(!(amount>0))return toast('أدخل مبلغاً صحيحاً');state.transactions.push({id:uid(),type:$('#txType').value,amount,date:$('#txDate').value,notes:$('#txNotes').value.trim()});save();closeModal();renderReports();toast('تم تسجيل الحركة')};setTimeout(()=>$('#txAmount').focus(),50)}
function exportCsv(){const from=$('#repFrom').value,to=$('#repTo').value,d=reportData(from,to),rows=[['التاريخ','البداية','النهاية','الاستراحة','الدقائق','الأجر'],...d.ss.map(x=>[isoDate(dt(x.start)),fmtTime(x.start),fmtTime(x.end),x.breakMinutes,x.net,x.pay.toFixed(2)]),[],['الحركات المالية'],['التاريخ','النوع','المبلغ','ملاحظة'],...d.tx.map(x=>[x.date,txKind(x.type),x.amount,x.notes])];download(`saati-${from}-${to}.csv`,'\ufeff'+rows.map(r=>r.map(v=>`"${String(v??'').replaceAll('"','""')}"`).join(',')).join('\n'),'text/csv')}

function renderSettings(){const s=state.settings;$('#app').innerHTML=`<h1>الإعدادات</h1><p class="subtitle">اضبط الأجر وبيانات العمل والنسخ الاحتياطي</p><section class="card settings-section"><h2>الملف الشخصي</h2>${field('setWorker','اسم العامل',s.workerName)}${field('setEmployer','اسم صاحب العمل',s.employerName)}${field('setCycle','يوم بداية دورة الراتب',s.payCycleStart,'number')}</section><section class="card settings-section"><h2>الأجر والعمل الإضافي</h2>${field('setRate','أجر الساعة العادية',s.rate,'number')}<div class="field"><label><input id="setOt" type="checkbox" ${s.overtimeEnabled?'checked':''}> يوجد أجر ساعات إضافية</label></div><div class="grid2">${field('setDaily','الساعات العادية يومياً',s.dailyMinutes/60,'number')}${field('setOtMulti','معامل الإضافي',s.overtimeMultiplier,'number')}</div>${field('setHoliday','معامل العطلة',s.holidayMultiplier,'number')}</section><section class="card settings-section"><h2>الوقت والعملة</h2><div class="grid2">${field('setCurrency','رمز العملة',s.currency)}${field('setBreak','الاستراحة الافتراضية',s.breakMinutes,'number')}</div><div class="grid2">${field('setStart','بداية الدوام المعتادة',s.startTime,'time')}${field('setEnd','نهاية الدوام المعتادة',s.endTime,'time')}</div>${field('setLong','تنبيه الدوام الطويل بعد ساعات',s.longShiftMinutes/60,'number')}<div class="field"><label>المظهر</label><select id="setTheme"><option value="system">حسب الجهاز</option><option value="light">فاتح</option><option value="dark">داكن</option></select></div></section><button class="action" id="saveSettings">حفظ جميع الإعدادات</button><section class="card settings-section"><h2>النسخ الاحتياطي</h2><p class="muted">احفظ نسخة من الساعات والدفعات أو استورد نسخة تطبيق الآيفون.</p><button class="action secondary" id="backupBtn">تنزيل نسخة احتياطية</button><label class="action secondary" style="display:block;text-align:center">استعادة نسخة احتياطية<input id="restoreFile" type="file" accept="application/json" hidden></label></section><section class="card settings-section"><h2 class="danger-text">إدارة البيانات</h2><button class="action danger" id="clearData">حذف جميع بيانات هذا الجهاز</button></section>`;$('#setTheme').value=s.theme;
  $('#saveSettings').onclick=saveSettings;$('#backupBtn').onclick=backup;$('#restoreFile').onchange=restore;$('#clearData').onclick=()=>{if(confirm('سيتم حذف جميع الساعات والدفعات نهائياً. هل أنت متأكد؟')&&confirm('تأكيد أخير: حذف جميع البيانات؟')){state=structuredClone(defaults);save();render();toast('تم حذف البيانات')}}
}
function field(id,label,value,type='text'){return `<div class="field"><label for="${id}">${label}</label><input id="${id}" type="${type}" value="${esc(value)}" ${type==='number'?'step="0.01"':''}></div>`}
function saveSettings(){const s=state.settings;s.workerName=$('#setWorker').value.trim();s.employerName=$('#setEmployer').value.trim();s.payCycleStart=Math.min(28,Math.max(1,Number($('#setCycle').value)||1));s.rate=Math.max(0,Number($('#setRate').value)||0);s.overtimeEnabled=$('#setOt').checked;s.dailyMinutes=Math.max(0,(Number($('#setDaily').value)||0)*60);s.overtimeMultiplier=Math.max(0,Number($('#setOtMulti').value)||0);s.holidayMultiplier=Math.max(0,Number($('#setHoliday').value)||0);s.currency=$('#setCurrency').value.trim()||'₪';s.breakMinutes=Math.max(0,Number($('#setBreak').value)||0);s.startTime=$('#setStart').value;s.endTime=$('#setEnd').value;s.longShiftMinutes=Math.max(60,(Number($('#setLong').value)||12)*60);s.theme=$('#setTheme').value;save();render();toast('تم حفظ الإعدادات')}
function backup(){const envelope={App:'SaatiWeb',Version:1,ExportedAt:new Date().toISOString(),Data:state};download(`saati-backup-${today()}.json`,JSON.stringify(envelope,null,2),'application/json')}
async function restore(e){const file=e.target.files[0];if(!file)return;try{const x=JSON.parse(await file.text());let d=x.Data||x.data||x;if(d.Settings||d.settings&&d.Sessions){const S=d.Settings||d.settings, sessions=d.Sessions||d.sessions||[],transactions=d.Transactions||d.transactions||[];state={version:1,settings:{...defaults.settings,workerName:S.WorkerName??S.workerName??'',employerName:S.EmployerName??'',rate:S.NormalHourlyRate??S.rate??20,currency:S.CurrencySymbol??S.currency??'₪',breakMinutes:S.DefaultBreakMinutes??S.breakMinutes??30,overtimeEnabled:S.OvertimeEnabled??false,dailyMinutes:S.DailyRegularMinutes??480,overtimeMultiplier:S.OvertimeMultiplier??1.5,holidayMultiplier:S.HolidayMultiplier??2,theme:'system',payCycleStart:S.PayCycleStartDay??1,startTime:'07:00',endTime:'16:00',longShiftMinutes:S.LongShiftWarningMinutes??720},sessions:sessions.map(x=>({id:x.Id??uid(),start:x.Start,end:x.End,breakMinutes:x.BreakMinutes??0,holiday:x.IsHoliday??false,notes:x.Notes??'',rate:x.NormalHourlyRateSnapshot??20,active:x.IsActive??false,manual:x.IsManual??false})),transactions:transactions.map(x=>({id:x.Id??uid(),date:String(x.Date).slice(0,10),type:['bonus','deduction','payment','advance','adjustment'][x.Type??0],amount:x.Amount,notes:x.Notes??''}))}}else if(d.sessions&&d.settings)state={...structuredClone(defaults),...d,settings:{...defaults.settings,...d.settings}};else throw Error();save();render();toast('تم استيراد النسخة بنجاح')}catch{toast('ملف النسخة الاحتياطية غير صالح')}}
function download(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}

function importFromPrivateLink(){
  if(!location.hash.startsWith('#import='))return false;
  try{
    const encoded=location.hash.slice(8).replace(/-/g,'+').replace(/_/g,'/');
    const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
    const incoming=JSON.parse(new TextDecoder().decode(bytes));
    if(!incoming?.settings||!Array.isArray(incoming.sessions)||!Array.isArray(incoming.transactions))throw Error();
    state={...structuredClone(defaults),...incoming,settings:{...defaults.settings,...incoming.settings}};
    save();history.replaceState(null,'',location.pathname+location.search);return true;
  }catch{history.replaceState(null,'',location.pathname+location.search);return false}
}

const importedFromLink=importFromPrivateLink();
$$('.tabs button').forEach(b=>b.onclick=()=>{page=b.dataset.page;render();scrollTo({top:0,behavior:'smooth'})});addEventListener('online',renderBadges);addEventListener('offline',renderBadges);matchMedia('(prefers-color-scheme:dark)').addEventListener('change',setTheme);if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js');render();if(importedFromLink)setTimeout(()=>toast('تم نقل بيانات تطبيق الآيفون بنجاح'),250);
