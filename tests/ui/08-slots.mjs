// Slot names, extra slots, and the per-file view and clear buttons.
import fs from 'fs';
import { JSDOM } from 'jsdom';
import { fileURLToPath as __f } from 'url';
import { dirname as __d, join as __j } from 'path';
const U = __j(__d(__f(import.meta.url)), '..', 'fixtures') + '/';
const errors=[]; const ok=(n,c,e='')=>{ c?console.log('  ok   '+n):(errors.push(n),console.log('  FAIL '+n+(e?'  -> '+e:''))); };
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const dom=new JSDOM(fs.readFileSync(process.argv[2],'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',
  beforeParse(w){
    w.HTMLCanvasElement.prototype.getContext=()=>({scale(){},beginPath(){},arc(){},fill(){},stroke(){},
      fillRect(){},strokeRect(){},moveTo(){},lineTo(){},fillText(){},setLineDash(){},putImageData(){},
      createImageData:(a,b)=>({width:a,height:b,data:new Uint8ClampedArray(a*b*4)}),
      measureText:t=>({width:String(t).length*6}),closePath(){},save(){},restore(){},clearRect(){},rect(){},translate(){}, rotate(){},rotate(){}});
    w.URL.createObjectURL=()=>'blob:'; w.URL.revokeObjectURL=()=>{}; w.scrollTo=()=>{};
    w.confirm=()=>true; w.alert=m=>errors.push('alert: '+m); w.HTMLElement.prototype.scrollIntoView=function(){};
  }});
const w=dom.window;
w.addEventListener('error',e=>errors.push('uncaught: '+(e.error&&e.error.stack||e.message)));
await wait(350);
const $=s=>w.document.querySelector(s), $$=s=>[...w.document.querySelectorAll(s)];
const click=e=>e.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
const setVal=(e,v)=>{e.value=v;e.dispatchEvent(new w.Event('input',{bubbles:true}));};
const goTo=n=>click($$('nav.steps button').find(x=>x.dataset.go===n));
const attach=(input,path)=>{ const buf=fs.readFileSync(path);
  Object.defineProperty(input,'files',{value:[{name:path.split('/').pop(),
    arrayBuffer:async()=>buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength)}],configurable:true});
  input.dispatchEvent(new w.Event('change',{bubbles:true})); };

click($('#signInLocal')); await wait(300);
click($('#newLoom'));
setVal($('#loomName'),'Slots'); setVal($('#totalDeclared'),'1792');
[4,4,500,8,720,500,4,52].forEach((v,i)=>{ const el=$$('#segTable input[type=number]')[i]; if(el) setVal(el,String(v)); });
await wait(700);
click($('#saveLoom')); await wait(300);
goTo('body'); await wait(250);

console.log('\n== the slots are named in shuttle order ==');
{
  const names=$$('#bodyHost input[type=text]').map(e=>e.value);
  ok('rani, zari, meena 1, meena 2', names.join(',')==='Rani,Zari,Meena 1,Meena 2', names.join(','));
}

console.log('\n== more slots can be added ==');
ok('four to begin with', $$('#bodyHost input[type=file]').length===4, String($$('#bodyHost input[type=file]').length));
click($('#addWeftSlot')); await wait(200);
ok('a fifth appears', $$('#bodyHost input[type=file]').length===5, String($$('#bodyHost input[type=file]').length));
ok('an empty extra one can be taken away again', !!$('#removeWeftSlot'));
click($('#removeWeftSlot')); await wait(200);
ok('back to four', $$('#bodyHost input[type=file]').length===4);
{
  for (let i=0;i<5;i++) { const b=$('#addWeftSlot'); if (b && !b.disabled) { click(b); await wait(120); } }
  ok('it stops at eight', $$('#bodyHost input[type=file]').length===8, String($$('#bodyHost input[type=file]').length));
  ok('and the button is then disabled', $('#addWeftSlot').disabled===true);
}

console.log('\n== view and clear a loaded file ==');
attach($$('#bodyHost input[type=file]')[0], U+'720_butta_resham.bmp'); await wait(300);
ok('no buttons on an empty slot', $$('#bodyHost button[data-view]').length===1,
   String($$('#bodyHost button[data-view]').length));
ok('the loaded slot offers View and Clear',
   !!$('#bodyHost button[data-view]') && !!$('#bodyHost button[data-clearfile]'));

click($('#bodyHost button[data-view]')); await wait(200);
ok('the viewer opens', $('#viewer').hidden===false);
ok('it names the file and its size', /720|500/.test($('#viewerTitle').textContent), $('#viewerTitle').textContent);
$$('[data-vzoom]').forEach(b=>click(b));
ok('zoom buttons do not throw', true);
click($('#viewerClose')); await wait(150);
ok('and it closes', $('#viewer').hidden===true);

click($('#bodyHost button[data-view]')); await wait(150);
w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
await wait(150);
ok('escape closes it too', $('#viewer').hidden===true);

click($('#bodyHost button[data-clearfile]')); await wait(250);
ok('clear removes that file', $$('#bodyHost button[data-view]').length===0);
ok('and leaves the slot ready again', $$('#bodyHost input[type=file]').length===8);

console.log('\n== the border slots get the same buttons ==');
goTo('border'); await wait(200);
attach($$('#borderHost input[type=file]')[0], U+'720_butta_resham.bmp'); await wait(300);
ok('View and Clear appear there too',
   !!$('#borderHost button[data-view]') && !!$('#borderHost button[data-clearfile]'));
click($('#borderHost button[data-view]')); await wait(200);
ok('the viewer works from the border screen', $('#viewer').hidden===false);
click($('#viewerClose')); await wait(150);
click($('#borderHost button[data-clearfile]')); await wait(250);
ok('and clear works there', $$('#borderHost button[data-view]').length===0);

console.log('\n== result ==');
if (errors.length){ console.log('  '+errors.length+' problem(s)'); errors.forEach(e=>console.log('   - '+e)); }
else console.log('  no errors');
process.exit(errors.length?1:0);
