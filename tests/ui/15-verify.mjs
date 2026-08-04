// Checking a built file against a reference, through the interface.
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
const goTo=n=>click($$('nav.steps button').find(x=>x.dataset.go===n));
const attach=(input,path)=>{ const buf=fs.readFileSync(path);
  Object.defineProperty(input,'files',{value:[{name:path.split('/').pop(),
    arrayBuffer:async()=>buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength)}],configurable:true});
  input.dispatchEvent(new w.Event('change',{bubbles:true})); };

click($('#signInLocal')); await wait(300);
click($('#newLoom'));
setVal($('#loomName'),'Verify'); setVal($('#totalDeclared'),'720');
// one group, the whole loom is body, so it matches the sample exactly
// The app asks in its own dialog now rather than the browser's, so a question
// has to be answered rather than stubbed away.
const answerYes = async () => {
  await wait(60);
  const y = $('#askYes');
  if (y && !$('#ask').hidden) { click(y); await wait(150); }
};
click($('#clearSegs')); await answerYes(); await wait(200);
click($('[data-add=body]')); await wait(200);
setVal($$('#segTable input[type=number]')[0], '720');
await wait(600);
click($('#saveLoom')); await wait(350);
goTo('body'); await wait(250);

console.log('\n== the panel ==');
ok('it is on the body screen', !!$('.verify[data-verify=body] input[type=file]'));
goTo('border'); await wait(200);
ok('and on the border screen', !!$('.verify[data-verify=border] input[type=file]'));
goTo('body'); await wait(250);

console.log('\n== before anything is built ==');
attach($('.verify[data-verify=body] input[type=file]'), U+'IMG_2413.BMP'); await wait(250);
ok('it asks you to combine first', $('.verify[data-verify=body] .vf-out').textContent.trim() === '');

console.log('\n== a file that matches ==');
[U+'720_butta_resham.bmp', U+'720_butta_jari.bmp', U+'720_butta_menna.bmp']
  .forEach((f,i)=>attach($$('#bodyHost input[type=file]')[i], f));
await wait(700);
click($('#combineBody')); await wait(400);
attach($('.verify[data-verify=body] input[type=file]'), U+'IMG_2413.BMP'); await wait(350);
{
  const t = $('.verify[data-verify=body] .vf-out').textContent;
  ok('it reports a match', /the same, pin for pin/i.test(t), t.replace(/\s+/g,' ').slice(0,90));
  ok('with the size', /1,080,000|720/.test(t), t.replace(/\s+/g,' ').slice(0,120));
}

console.log('\n== a file of the wrong shape ==');
attach($('.verify[data-verify=body] input[type=file]'), U+'720_butta_menna.bmp'); await wait(350);
{
  const t = $('.verify[data-verify=body] .vf-out').textContent;
  ok('it says the shape is different', /different shape/i.test(t), t.replace(/\s+/g,' ').slice(0,80));
  ok('and gives both sizes', /500/.test(t) && /720/.test(t), t.replace(/\s+/g,' ').slice(0,110));
}

console.log('\n== a file that differs by a setting ==');
{
  // the 4 by 1 sample against a 4 by 4 build: same pins, different order
  attach($('.verify[data-verify=body] input[type=file]'), U+'IMG_2414__1_.BMP'); await wait(350);
  const t = $('.verify[data-verify=body] .vf-out').textContent;
  ok('it counts the differences', /pins differ/i.test(t), t.replace(/\s+/g,' ').slice(0,70));
  ok('and locates the first one', /first at/i.test(t), t.replace(/\s+/g,' ').slice(0,130));
  ok('and names the group', /body/i.test(t), t.replace(/\s+/g,' ').slice(0,150));
}

console.log('\n== an unreadable file ==');
{
  const bad = $('.verify[data-verify=body] input[type=file]');
  Object.defineProperty(bad,'files',{value:[{name:'x.txt',
    arrayBuffer:async()=>new TextEncoder().encode('not a bitmap').buffer}],configurable:true});
  bad.dispatchEvent(new w.Event('change',{bubbles:true}));
  await wait(250);
  ok('it says so rather than throwing', /could not read/i.test($('.verify[data-verify=body] .vf-out').textContent),
     $('.verify[data-verify=body] .vf-out').textContent.slice(0,60));
}

console.log('\n== result ==');
if (errors.length){ console.log('  '+errors.length+' problem(s)'); errors.forEach(e=>console.log('   - '+e)); }
else console.log('  no errors');
process.exit(errors.length?1:0);
