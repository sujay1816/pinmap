// autosave: does the work survive a reload?
import fs from 'fs';
import { JSDOM } from 'jsdom';
const errors=[]; const ok=(n,c,e='')=>{ c?console.log('  ok   '+n):(errors.push(n+(e?' -> '+e:'')),console.log('  FAIL '+n+(e?'  -> '+e:''))); };

// one shared fake store, so a second page load sees what the first wrote
const store = new Map();
function makeStorage() {
  return {
    async get(k){ if(!store.has(k)) throw new Error('missing'); return { key:k, value:store.get(k) }; },
    async set(k,v){ store.set(k,v); return { key:k, value:v }; },
    async delete(k){ store.delete(k); return { key:k, deleted:true }; },
    async list(){ return { keys:[...store.keys()] }; }
  };
}
function boot(html) {
  const dom = new JSDOM(html, { runScripts:'dangerously', pretendToBeVisual:true,
    beforeParse(win){
      win.HTMLCanvasElement.prototype.getContext = () => ({
        scale(){},beginPath(){},arc(){},fill(){},stroke(){},fillRect(){},strokeRect(){},
        moveTo(){},lineTo(){},fillText(){},setLineDash(){},putImageData(){},
        createImageData:(w,h)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)}),
      measureText:(t)=>({width:String(t).length*6}),closePath(){},save(){},restore(){},clearRect(){},rect(){},translate(){}, rotate(){},rotate(){},
        set fillStyle(v){},set strokeStyle(v){},set lineWidth(v){},set font(v){},
        set textAlign(v){},set textBaseline(v){},set globalAlpha(v){}});
      win.URL.createObjectURL=()=> 'blob:'; win.URL.revokeObjectURL=()=>{};
      win.scrollTo=()=>{}; win.confirm=()=>true; win.alert=m=>errors.push('alert: '+m);
      win.HTMLElement.prototype.scrollIntoView=function(){};
      win.storage = makeStorage();
    }});
  dom.window.addEventListener('error', e=>errors.push('uncaught: '+(e.error&&e.error.stack||e.message)));
  return dom.window;
}
const html = fs.readFileSync(process.argv[2],'utf8');
const wait = ms => new Promise(r=>setTimeout(r,ms));

console.log('\n== first visit: enter a loom, never press save ==');
let w = boot(html);
await wait(300);
let $=s=>w.document.querySelector(s), $$=s=>[...w.document.querySelectorAll(s)];
const click=e=>e.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
const setVal=(e,v)=>{e.value=v;e.dispatchEvent(new w.Event('input',{bubbles:true}));};
const setSel=(e,v)=>{e.value=v;e.dispatchEvent(new w.Event('change',{bubbles:true}));};

if (!$('#gate').hidden) { click($('#signInLocal')); await wait(300); }
click($('#newLoom'));
setVal($('#loomName'),'Autosaved Loom');
setVal($('#totalDeclared'),'1792');
setSel($('#boxMotion'),'4x1');
[4,4,500,8,720,500,4,52].forEach((v,i)=>{ const el=$$('#segTable input[type=number]')[i]; if(el) setVal(el,String(v)); });
await wait(900);
ok('the indicator reports saved', /saved/i.test($('#saveState').textContent), $('#saveState').textContent);
ok('something was written to storage', store.size > 0, [...store.keys()].join(','));
ok('a session record exists', store.has('pinmap:local:session'), [...store.keys()].join(','));
ok('the account is remembered', store.has('pinmap:account'));
ok('storage is scoped to the account', [...store.keys()].every(k => k === 'pinmap:account' || k.startsWith('pinmap:local:')),
   [...store.keys()].join(','));
ok('the loom reached the library without pressing save', store.has('pinmap:local:looms') &&
   /Autosaved Loom/.test(store.get('pinmap:local:looms')));

console.log('\n== reload the page ==');
w = boot(html);
await wait(400);
$=s=>w.document.querySelector(s); $$=s=>[...w.document.querySelectorAll(s)];
ok('it goes straight in, no sign-in a second time', $('#gate').hidden === true);
ok('it reopens on the pin map, not the loom list', !$('#sc-loom').hidden);
ok('the name came back', $('#loomName').value === 'Autosaved Loom', $('#loomName').value);
ok('the total came back', $('#totalDeclared').value === '1792', $('#totalDeclared').value);
ok('the box motion came back', $('#boxMotion').value === '4x1', $('#boxMotion').value);
ok('all eight groups came back', $$('#segTable .seg-row').length - 1 === 8,
   String($$('#segTable .seg-row').length - 1));
ok('the counts came back', [...$$('#segTable input[type=number]')].map(e=>e.value).join(',') === '4,4,500,8,720,500,4,52',
   [...$$('#segTable input[type=number]')].map(e=>e.value).join(','));
ok('the loom is listed in the library', (()=>{
   const nav=$$('nav.steps button').find(x=>x.dataset.go==='looms'); click(nav);
   return /Autosaved Loom/.test($('#loomList').textContent); })());

console.log('\n== options and box settings survive too ==');
w = boot(html);
await wait(400);
$=s=>w.document.querySelector(s); $$=s=>[...w.document.querySelectorAll(s)];
ok('the loom is still there on a third visit', /Autosaved Loom/.test(store.get('pinmap:local:looms')||''));
ok('version was not bumped by autosaving', (()=>{
   const looms=JSON.parse(store.get('pinmap:local:looms'));
   return looms[0].version === 1; })(), (JSON.parse(store.get('pinmap:local:looms')||'[]')[0]||{}).version+'');

console.log('\n== result ==');
if (errors.length){ console.log('  '+errors.length+' problem(s)'); errors.forEach(e=>console.log('   - '+e)); }
else console.log('  no errors');
process.exit(errors.length?1:0);
