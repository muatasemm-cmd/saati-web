const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8').split('const importedFromLink=')[0];
function setup(now='2026-10-31T12:00:00+02:00'){
  const elements=new Map();let buttons=[];
  const get=selector=>{
    if(!elements.has(selector)){
      const e={textContent:'',style:{},classList:{toggle(){}},setAttribute(){}};
      Object.defineProperty(e,'innerHTML',{get(){return this.html||''},set(value){
        this.html=value;
        if(selector==='#app'){
          buttons=[...value.matchAll(/data-calendar-date="([^"]+)"/g)].map(m=>({dataset:{calendarDate:m[1]},classList:{toggle(){}},setAttribute(){}}));
          get('#calendarDay').innerHTML='';
        }
      }});
      elements.set(selector,e);
    }
    return elements.get(selector);
  };
  class Clock extends Date {constructor(...a){super(...(a.length?a:[now]))}}
  const context=vm.createContext({Date:Clock,Intl,structuredClone,
    localStorage:{getItem:()=>null},clearInterval(){},matchMedia:()=>({matches:false}),navigator:{onLine:true},
    document:{querySelector:get,querySelectorAll:s=>s==='.calendar-grid [data-calendar-date]'?buttons:[],documentElement:{dataset:{}}}});
  vm.runInContext(source,context);
  const run=code=>vm.runInContext(code,context);
  run(`page='calendar';state.sessions=[{id:1,start:'2026-09-15T07:00:00+03:00',end:'2026-09-15T16:00:00+03:00',breakMinutes:0,rate:20,active:false,notes:'دوام سابق'}];renderCalendar()`);
  return {run,get,dates:()=>buttons.map(b=>b.dataset.calendarDate),clickDay:day=>buttons.find(b=>b.dataset.calendarDate===day).onclick()};
}
test('previous month from October 31 shows September without skipping; next returns October',()=>{
  const s=setup();s.get('#calendarPrev').onclick();
  assert.equal(s.dates()[0],'2026-09-01');assert.equal(s.dates().length,30);
  s.get('#calendarNext').onclick();assert.equal(s.dates().length,31);assert.equal(s.dates()[0],'2026-10-01');
});
test('navigation crosses years and handles leap February',()=>{
  const s=setup('2024-01-31T12:00:00+02:00');s.get('#calendarPrev').onclick();
  assert.equal(s.dates()[0],'2023-12-01');s.get('#calendarNext').onclick();s.get('#calendarNext').onclick();
  assert.equal(s.dates()[0],'2024-02-01');assert.equal(s.dates().length,29);
});
test('past day displays its sessions and keeps month and selection after rerender',()=>{
  const s=setup();s.get('#calendarPrev').onclick();s.clickDay('2026-09-15');
  assert.match(s.get('#calendarDay').innerHTML,/دوام سابق/);assert.match(s.get('#calendarDay').innerHTML,/180.00/);
  s.run('render()');assert.equal(s.dates()[0],'2026-09-01');assert.match(s.get('#calendarDay').innerHTML,/دوام سابق/);
  s.run('state.sessions=[];render()');assert.equal(s.dates()[0],'2026-09-01');assert.match(s.get('#calendarDay').innerHTML,/لا يوجد دوام/);
});
test('changing months clears the old day and current-month button resets the view',()=>{
  const s=setup();s.get('#calendarPrev').onclick();s.clickDay('2026-09-15');
  s.get('#calendarPrev').onclick();assert.equal(s.get('#calendarDay').innerHTML,'');
  s.get('#calendarToday').onclick();assert.equal(s.dates()[0],'2026-10-01');assert.equal(s.get('#calendarDay').innerHTML,'');
});
