// two accounts must not see each other's looms
import fs from 'fs';
import { JSDOM } from 'jsdom';
const errors=[]; const ok=(n,c,e='')=>{ c?console.log('  ok   '+n):(errors.push(n),console.log('  FAIL '+n+(e?'  -> '+e:''))); };
const store = new Map();
const mkStore = () => ({
  async get(k){ if(!store.has(k)) throw new Error('missing'); return {key:k,value:store.get(k)}; },
  async set(k,v){ store.set(k,v); return {key:k,value:v}; },
  async delete(k){ store.delete(k); return {key:k,deleted:true}; },
  async list(){ return {keys:[...store.keys()]}; }
});
function boot(html){
  const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,beforeParse(win){
    win.HTMLCanvasElement.prototype.getContext=()=>({scale(){},beginPath(){},arc(){},fill(){},stroke(){},
      fillRect(){},strokeRect(){},moveTo(){},lineTo(){},fillText(){},setLineDash(){},putImageData(){},
      createImageData:(w,h)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)}),
      measureText:(t)=>({width:String(t).length*6}),closePath(){},save(){},restore(){},clearRect(){},rect(){},translate(){}, rotate(){},rotate(){},
      set fillStyle(v){},set strokeStyle(v){},set lineWidth(v){},set font(v){},set textAlign(v){},
      set textBaseline(v){},set globalAlpha(v){}});
    win.URL.createObjectURL=()=> 'blob:'; win.URL.revokeObjectURL=()=>{};
    win.scrollTo=()=>{}; win.confirm=()=>true; win.alert=m=>errors.push('alert: '+m);
    win.HTMLElement.prototype.scrollIntoView=function(){};
    win.storage=mkStore();
  }});
  dom.window.addEventListener('error',e=>errors.push('uncaught: '+(e.error&&e.error.stack||e.message)));
  return dom.window;
}
const rawHtml=fs.readFileSync(process.argv[2],'utf8');
const html = rawHtml.replace(/(<meta name="pinmap-google-client-id" content=")[^"]*(">)/, '$1$2');
const wait=ms=>new Promise(r=>setTimeout(r,ms));

async function makeLoom(w, name) {
  const $=s=>w.document.querySelector(s), $$=s=>[...w.document.querySelectorAll(s)];
  const click=e=>e.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  const setVal=(e,v)=>{e.value=v;e.dispatchEvent(new w.Event('input',{bubbles:true}));};
  click($('#newLoom'));
  setVal($('#loomName'),name);
  setVal($('#totalDeclared'),'1792');
  [4,4,500,8,720,500,4,52].forEach((v,i)=>{ const el=$$('#segTable input[type=number]')[i]; if(el) setVal(el,String(v)); });
  await wait(900);
}

console.log('\n== device account ==');
let w=boot(html); await wait(300);
let $=s=>w.document.querySelector(s);
const click=e=>e.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
click($('#signInLocal')); await wait(300);
await makeLoom(w,'Shed loom');
ok('saved under the device account', store.has('pinmap:local:looms') && /Shed loom/.test(store.get('pinmap:local:looms')));

console.log('\n== a signed-in account, faked ==');
// stand in for Google having answered, to check the data really is kept apart
store.set('pinmap:account', JSON.stringify({ key:'g12345', account:{ name:'Weaver', email:'w@example.com', sub:'12345' }, clientId:'' }));
w=boot(html); await wait(400);
$=s=>w.document.querySelector(s);
ok('goes straight in as that account', $('#gate').hidden === true);
ok('header shows the email', /w@example\.com/.test($('#whoami').textContent), $('#whoami').textContent);
ok('starts with an empty loom list', !/Shed loom/.test($('#loomList').textContent));
await makeLoom(w,'Factory loom');
ok('its loom is stored separately', store.has('pinmap:g12345:looms') && /Factory loom/.test(store.get('pinmap:g12345:looms')));
ok('the device account is untouched', /Shed loom/.test(store.get('pinmap:local:looms')) &&
   !/Factory loom/.test(store.get('pinmap:local:looms')));

console.log('\n== back to the device account ==');
store.set('pinmap:account', JSON.stringify({ key:'local', account:null, clientId:'' }));
w=boot(html); await wait(400);
$=s=>w.document.querySelector(s);
const $$b=s=>[...w.document.querySelectorAll(s)];
click($$b('nav.steps button').find(x=>x.dataset.go==='looms'));
await wait(150);
ok('sees only its own loom', /Shed loom/.test($('#loomList').textContent) &&
   !/Factory loom/.test($('#loomList').textContent),
   $('#loomList').textContent.replace(/\s+/g,' ').slice(0,120));

console.log('\n== no client id configured ==');
store.clear();
w=boot(html); await wait(300);
$=s=>w.document.querySelector(s);
await wait(300);
ok('with no client ID it says so straight away',
   /client ID/i.test($('#gateMsg').textContent), $('#gateMsg').textContent);
ok('and it opens the settings for you', $('#gateAdv').open === true);
ok('the device option still works', (()=>{ click($('#signInLocal')); return true; })());

console.log('\n== result ==');
if (errors.length){ console.log('  '+errors.length+' problem(s)'); errors.forEach(e=>console.log('   - '+e)); }
else console.log('  no errors');
process.exit(errors.length?1:0);
