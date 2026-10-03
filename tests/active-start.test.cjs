const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8').split('const importedFromLink=')[0];
function setup(extra=[]){
  let now=Date.parse('2026-10-03T08:00:00+03:00'),interval;
  const elements=new Map(),storage=new Map();
  const element=selector=>{
    if(!elements.has(selector))elements.set(selector,{value:'',textContent:'',innerHTML:'',style:{},classList:{add(){},remove(){},toggle(){}},addEventListener(){},showModal(){this.open=true},close(){this.open=false}});
    return elements.get(selector);
  };
  class Clock extends Date {constructor(...args){super(...(args.length?args:[now]))}static now(){return now}}
  const context=vm.createContext({Date:Clock,Intl,Number,Math,JSON,structuredClone,console,
    document:{querySelector:element,querySelectorAll:()=>[],documentElement:{dataset:{}}},
    navigator:{onLine:true},matchMedia:()=>({matches:false}),
    setTimeout:()=>0,setInterval:fn=>{interval=fn;return 1},clearInterval(){},
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)}
  });
  vm.runInContext(source,context);
  const original={id:42,start:'2026-10-03T08:00:00+03:00',end:null,breakMinutes:0,rate:18,holiday:false,active:true,manual:false,notes:'keep'};
  context.fixture=[...extra,original];
  vm.runInContext('state.sessions=structuredClone(fixture);state.settings.rate=99;editActiveStart()',context);
  const read=()=>JSON.parse(vm.runInContext('JSON.stringify(state)',context));
  const submit=value=>{element('#activeStart').value=value;element('#saveActiveStart').onclick()};
  return {context,element,read,submit,original,storage,advance:ms=>{now+=ms;interval?.()}};
}
test('backdating keeps same running session, persists, recalculates using its rate, and continues ticking',()=>{
  const s=setup();s.submit('2026-10-03T07:00');
  const record=s.read().sessions[0];
  assert.equal(record.start,new Date('2026-10-03T07:00').toISOString());
  assert.equal(record.active,true);assert.equal(record.end,null);
  for(const k of ['id','breakMinutes','rate','holiday','manual','notes'])assert.equal(record[k],s.original[k]);
  assert.equal(s.element('#liveDuration').textContent,'1س و0د');
  assert.equal(s.element('#livePay').textContent,'18.00 ₪');
  s.advance(60*60000);
  assert.equal(s.element('#liveDuration').textContent,'2س و0د');
  assert.equal(s.element('#livePay').textContent,'36.00 ₪');
  assert.equal(JSON.parse(s.storage.get('saati-web-v1')).sessions.length,1);
  assert.equal(vm.runInContext('load().sessions[0].start',s.context),record.start);
  vm.runInContext('endWork()',s.context);
  assert.equal(s.read().sessions[0].active,false);
  assert.equal(vm.runInContext('completed()[0].pay',s.context),36);
});
test('rejects future and empty time without changing or saving the session',()=>{
  for(const input of ['2026-10-03T09:00','']){
    const s=setup();s.submit(input);
    assert.deepEqual(s.read().sessions[0],s.original);
    assert.ok(s.element('#startError').textContent);assert.equal(s.storage.size,0);
  }
});
test('rejects overlap but permits starting exactly at previous shift end',()=>{
  const prior={id:1,start:'2026-10-03T06:00:00+03:00',end:'2026-10-03T07:00:00+03:00',active:false};
  const s=setup([prior]);s.submit('2026-10-03T06:30');
  assert.match(s.element('#startError').textContent,/يتداخل/);assert.equal(s.storage.size,0);
  s.submit('2026-10-03T07:00');assert.equal(s.read().sessions[1].active,true);
  assert.equal(s.read().sessions[1].start,new Date('2026-10-03T07:00').toISOString());
});
test('supports moving start into yesterday while keeping the shift running',()=>{
  const s=setup();s.submit('2026-10-02T23:00');
  assert.equal(s.element('#liveDuration').textContent,'9س و0د');
  assert.equal(s.read().sessions[0].active,true);
});
test('closing edit leaves the running session unchanged',()=>{
  const s=setup();s.element('#activeStart').value='2026-10-03T07:00';
  vm.runInContext('closeModal()',s.context);
  assert.deepEqual(s.read().sessions[0],s.original);assert.equal(s.storage.size,0);
});
test('cannot change a shift that ended while the editor was open',()=>{
  const s=setup();vm.runInContext('state.sessions[0].active=false;state.sessions[0].end=new Date().toISOString()',s.context);
  s.submit('2026-10-03T07:00');assert.equal(s.read().sessions[0].start,s.original.start);assert.equal(s.storage.size,0);
});
test('failed storage write restores original start',()=>{
  const s=setup();s.context.localStorage.setItem=()=>{throw Error('full')};
  s.submit('2026-10-03T07:00');assert.deepEqual(s.read().sessions[0],s.original);
  assert.match(s.element('#startError').textContent,/تعذّر/);
});
