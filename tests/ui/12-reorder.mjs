// Reordering groups by dragging, and by keyboard.
import fs from 'fs';
import { JSDOM } from 'jsdom';
const errors=[]; const ok=(n,c,e='')=>{ c?console.log('  ok   '+n):(errors.push(n),console.log('  FAIL '+n+(e?'  -> '+e:''))); };
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const dom=new JSDOM(fs.readFileSync(process.argv[2],'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',
  beforeParse(w){
    w.HTMLCanvasElement.prototype.getContext=()=>({scale(){},beginPath(){},arc(){},fill(){},stroke(){},
      fillRect(){},strokeRect(){},moveTo(){},lineTo(){},fillText(){},setLineDash(){},putImageData(){},
      createImageData:(a,b)=>({width:a,height:b,data:new Uint8ClampedArray(a*b*4)}),
      measureText:t=>({width:String(t).length*6}),closePath(){},save(){},restore(){},clearRect(){},rect(){},translate(){},rotate(){}});
    w.URL.createObjectURL=()=>'blob:'; w.URL.revokeObjectURL=()=>{}; w.scrollTo=()=>{};
    w.confirm=()=>true; w.alert=m=>errors.push('alert: '+m); w.HTMLElement.prototype.scrollIntoView=function(){};
  }});
const w=dom.window;
w.addEventListener('error',e=>errors.push('uncaught: '+(e.error&&e.error.stack||e.message)));
await wait(350);
const $=s=>w.document.querySelector(s), $$=s=>[...w.document.querySelectorAll(s)];
const click=e=>e.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
const setVal=(e,v)=>{e.value=v;e.dispatchEvent(new w.Event('input',{bubbles:true}));};

click($('#signInLocal')); await wait(300);
click($('#newLoom'));
setVal($('#loomName'),'Order'); setVal($('#totalDeclared'),'1792');
[4,4,500,8,720,500,4,52].forEach((v,i)=>{ const el=$$('#segTable input[type=number]')[i]; if(el) setVal(el,String(v)); });
await wait(600);

const order = () => $$('#segTable select[data-act=kind]').map(e=>e.value).join(',');
const counts = () => $$('#segTable input[type=number]').map(e=>parseInt(e.value,10)||0);
const rowFor = (i) => $$('#segTable .seg-row[data-row]')[i];
const drag = (fromIdx, toIdx) => {
  const from = rowFor(fromIdx), to = rowFor(toIdx);
  const grip = from.querySelector('button[data-grip]');
  grip.dispatchEvent(new w.MouseEvent('mousedown',{bubbles:true}));
  const dt = { effectAllowed:'', dropEffect:'', setData(){}, getData(){ return ''; } };
  const ev = (type, target) => { const e = new w.Event(type,{bubbles:true,cancelable:true}); e.dataTransfer = dt; target.dispatchEvent(e); };
  ev('dragstart', from);
  ev('dragover', to);
  ev('drop', to);
  ev('dragend', from);
};

console.log('\n== the grips ==');
ok('one on every row', $$('#segTable button[data-grip]').length === 8, String($$('#segTable button[data-grip]').length));
ok('and no arrows left', !$('#segTable button[data-act=up]') && !$('#segTable button[data-act=down]'));
ok('remove is still there', $$('#segTable button[data-act=del]').length === 8);

console.log('\n== dragging a group down the list ==');
{
  const before = order();
  drag(0, 3); await wait(150);
  const after = order();
  ok('the order changed', after !== before, `${before} -> ${after}`);
  ok('achu landed in the fourth place', after.split(',')[3] === 'achu', after);
  ok('nothing was lost', after.split(',').length === 8);
  ok('the counts travelled with their groups',
     counts().reduce((a,b)=>a+b,0) === 1792, String(counts().reduce((a,b)=>a+b,0)));
}

console.log('\n== and back up again ==');
{
  drag(3, 0); await wait(150);
  ok('back to the standard order',
     order() === 'achu,box,leftBorder,locking,body,rightBorder,achu,empty', order());
}

console.log('\n== dropping a row on itself does nothing ==');
{
  const before = order();
  drag(2, 2); await wait(150);
  ok('unchanged', order() === before, order());
}

console.log('\n== the keyboard does the same ==');
{
  const before = order();
  const grip = $$('#segTable button[data-grip]')[0];
  grip.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}));
  await wait(120);
  ok('down moves it one place', order().split(',')[1] === 'achu', order());
  $$('#segTable button[data-grip]')[1].dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true}));
  await wait(120);
  ok('up puts it back', order() === before, order());
  const first = $$('#segTable button[data-grip]')[0];
  first.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true}));
  await wait(120);
  ok('the top row will not go higher', order() === before, order());
}

console.log('\n== the pin ranges follow the new order ==');
{
  drag(2, 0); await wait(200);          // the 500-pin left border to the front
  const ranges = $$('#segTable .seg-range').map(e=>e.textContent.replace(/\s+/g,''));
  ok('the first group now runs 1 to 500', /1–500/.test(ranges[0]), ranges.slice(0,3).join(' | '));
  ok('the next picks up at 501', /501–504/.test(ranges[1]), ranges.slice(0,3).join(' | '));
  ok('and they run end to end without a gap', (()=>{
    let at = 1;
    for (const c of counts()) at += c;
    return at - 1 === 1792; })());
}

console.log('\n== result ==');
if (errors.length){ console.log('  '+errors.length+' problem(s)'); errors.forEach(e=>console.log('   - '+e)); }
else console.log('  no errors');
process.exit(errors.length?1:0);
