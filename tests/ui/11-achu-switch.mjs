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
      measureText:t=>({width:String(t).length*6}),closePath(){},save(){},restore(){},clearRect(){},rect(){},translate(){}, rotate(){}});
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
setVal($('#loomName'),'Achu'); setVal($('#totalDeclared'),'1792');
[4,4,500,8,720,500,4,52].forEach((v,i)=>{ const el=$$('#segTable input[type=number]')[i]; if(el) setVal(el,String(v)); });
await wait(600); click($('#saveLoom')); await wait(300);
goTo('body'); await wait(250);

console.log('\n== the switch ==');
ok('it is there', !!$('#achuInBody'));
ok('and on to begin with', $('#achuInBody').checked===true);
ok('it says what is happening', /waiting on a rani|generated into this file/i.test($('#bodyAchu').textContent),
   $('#bodyAchu').textContent.replace(/\s+/g,' ').slice(0,90));

[0,1,2].forEach((k,i)=>{
  attach($$('#bodyHost input[type=file]')[k],
    [U+'720_butta_resham.bmp',U+'720_butta_jari.bmp',U+'720_butta_menna.bmp'][i]);
});
await wait(600);
ok('with a rani loaded it says it is on', /on, so the achu is generated/i.test($('#bodyAchu').textContent),
   $('#bodyAchu').textContent.replace(/\s+/g,' ').slice(0,90));

console.log('\n== turning it off ==');
const box=$('#achuInBody');
box.checked=false; box.dispatchEvent(new w.Event('change',{bubbles:true}));
await wait(250);
ok('it stays off', $('#achuInBody').checked===false);
ok('and says so', /off, so the achu pins stay down/i.test($('#bodyAchu').textContent),
   $('#bodyAchu').textContent.replace(/\s+/g,' ').slice(0,80));
ok('the built file is dropped, so nothing stale is downloaded', $('#download').disabled===true);

click($('#combineBody')); await wait(400);
ok('it still builds', !$('#download').disabled);

console.log('\n== back on again ==');
const box2=$('#achuInBody');
box2.checked=true; box2.dispatchEvent(new w.Event('change',{bubbles:true}));
await wait(250);
ok('on again', $('#achuInBody').checked===true);
click($('#combineBody')); await wait(400);
ok('and builds', !$('#download').disabled);

console.log('\n== with a border loaded it explains itself ==');
goTo('border'); await wait(200);
attach($$('#borderHost input[type=file]')[0], U+'720_butta_resham.bmp'); await wait(300);
goTo('body'); await wait(250);
ok('it says the achu is in the border file',
   /border file is loaded/i.test($('#bodyAchu').textContent),
   $('#bodyAchu').textContent.replace(/\s+/g,' ').slice(0,90));

console.log('\n== result ==');
if (errors.length){ console.log('  '+errors.length+' problem(s)'); errors.forEach(e=>console.log('   - '+e)); }
else console.log('  no errors');
process.exit(errors.length?1:0);
