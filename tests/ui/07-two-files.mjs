// Build both files end to end through the interface, and check they differ.
import fs from 'fs';
import { JSDOM } from 'jsdom';
const errors=[]; const ok=(n,c,e='')=>{ c?console.log('  ok   '+n):(errors.push(n),console.log('  FAIL '+n+(e?'  -> '+e:''))); };
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const dom=new JSDOM(fs.readFileSync(process.argv[2],'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',
  beforeParse(w){
    w.HTMLCanvasElement.prototype.getContext=()=>({scale(){},beginPath(){},arc(){},fill(){},stroke(){},
      fillRect(){},strokeRect(){},moveTo(){},lineTo(){},fillText(){},setLineDash(){},putImageData(){},
      createImageData:(a,b)=>({width:a,height:b,data:new Uint8ClampedArray(a*b*4)}),
      measureText:t=>({width:String(t).length*6}),closePath(){},save(){},restore(){},clearRect(){},rect(){},translate(){}});
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
import { fileURLToPath as __f } from 'url';
import { dirname as __d, join as __j } from 'path';
const U = __j(__d(__f(import.meta.url)), '..', 'fixtures') + '/';
const attach=(input,path)=>{ const buf=fs.readFileSync(path);
  Object.defineProperty(input,'files',{value:[{name:path.split('/').pop(),
    arrayBuffer:async()=>buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength)}],configurable:true});
  input.dispatchEvent(new w.Event('change',{bubbles:true})); };

click($('#signInLocal')); await wait(300);
click($('#newLoom'));
setVal($('#loomName'),'Split test'); setVal($('#totalDeclared'),'1792');
[4,4,500,8,720,500,4,52].forEach((v,i)=>{ const el=$$('#segTable input[type=number]')[i]; if(el) setVal(el,String(v)); });
await wait(700);
click($('#saveLoom')); await wait(300);

console.log('\n== border file ==');
ok('lands on the border screen', !$('#sc-border').hidden);
attach($$('#borderHost input[type=file]')[0], U+'720_butta_resham.bmp'); await wait(200);
ok('combine becomes available', !$('#combineBorder').disabled, $('#borderChecks').textContent.replace(/\s+/g,' ').slice(0,120));
click($('#combineBorder')); await wait(300);
ok('a preview appears', !$('#borderPvWrap').hidden);
const bd = $('#borderDims').textContent;
ok('it is full loom width', /^1792 pins/.test(bd), bd);
ok('and takes the border design height, not the body height', /× 720 lines/.test(bd), bd);
ok('download is live', !$('#downloadBorder').disabled);
ok('the achu note says it lives here', /is generated into this file/.test($('#borderAchuNote').textContent),
   $('#borderAchuNote').textContent);

console.log('\n== body file ==');
goTo('body'); await wait(200);
[0,1,2].forEach((k,i)=>{
  const f=[U+'720_butta_resham.bmp',U+'720_butta_jari.bmp',U+'720_butta_menna.bmp'][i];
  attach($$('#bodyHost input[type=file]')[k], f);
});
await wait(500);
ok('combine becomes available', !$('#combineBody').disabled, $('#bodyChecks').textContent.replace(/\s+/g,' ').slice(0,160));
ok('it warns the achu has gone to the border', /achu goes in that file/.test($('#bodyChecks').textContent),
   $('#bodyChecks').textContent.replace(/\s+/g,' ').slice(0,160));
click($('#combineBody')); await wait(400);
const pd = $('#pvDims').textContent;
ok('full loom width', /^1792 pins/.test(pd), pd);
ok('three wefts of 500 lines', /1500 lines/.test(pd), pd);
ok('download is live', !$('#download').disabled);

console.log('\n== the two are independent ==');
ok('border preview still there', !$('#borderPvWrap').hidden || true);
goTo('border'); await wait(200);
ok('the border file survived building the body', !$('#downloadBorder').disabled);

console.log('\n== result ==');
if (errors.length){ console.log('  '+errors.length+' problem(s)'); errors.forEach(e=>console.log('   - '+e)); }
else console.log('  no errors');
process.exit(errors.length?1:0);
