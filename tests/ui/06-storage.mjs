// The app must keep things on a plain web page, not only inside a host that
// hands it a store.
import fs from 'fs';
import { JSDOM } from 'jsdom';
const errors=[]; const ok=(n,c,e='')=>{ c?console.log('  ok   '+n):(errors.push(n),console.log('  FAIL '+n+(e?'  -> '+e:''))); };
const wait=ms=>new Promise(r=>setTimeout(r,ms));

const rawHtml = fs.readFileSync(process.argv[2],'utf8');
const html = rawHtml.replace(/(<meta name="pinmap-(?:google-client-id|firebase-api-key|firebase-project-id)" content=")[^"]*(">)/g, '$1$2');

function boot({ hostStore = null, localStorageWorks = true, jar = {} } = {}) {
  const dom = new JSDOM(html, { runScripts:'dangerously', pretendToBeVisual:true, url:'https://pinmap-gilt.vercel.app/',
    beforeParse(win){
      win.HTMLCanvasElement.prototype.getContext=()=>({scale(){},beginPath(){},arc(){},fill(){},stroke(){},
        fillRect(){},strokeRect(){},moveTo(){},lineTo(){},fillText(){},setLineDash(){},putImageData(){},
        createImageData:(w,h)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)}),
      measureText:(t)=>({width:String(t).length*6}),closePath(){},save(){},restore(){},clearRect(){},rect(){},translate(){}, rotate(){},rotate(){},
        set fillStyle(v){},set strokeStyle(v){},set lineWidth(v){},set font(v){},set textAlign(v){},
        set textBaseline(v){},set globalAlpha(v){}});
      win.URL.createObjectURL=()=> 'blob:'; win.URL.revokeObjectURL=()=>{};
      win.scrollTo=()=>{}; win.confirm=()=>true; win.alert=m=>errors.push('alert: '+m);
      win.HTMLElement.prototype.scrollIntoView=function(){};
      if (hostStore) win.storage = hostStore;
      // a localStorage that persists across page loads through `jar`
      const fake = {
        getItem: k => (k in jar ? jar[k] : null),
        setItem: (k,v) => { if (!localStorageWorks) throw new Error('blocked'); jar[k] = String(v); },
        removeItem: k => { delete jar[k]; },
        clear: () => { for (const k of Object.keys(jar)) delete jar[k]; },
        key: i => Object.keys(jar)[i], get length(){ return Object.keys(jar).length; }
      };
      Object.defineProperty(win, 'localStorage', { get: () => fake, configurable: true });
    }});
  dom.window.addEventListener('error',e=>errors.push('uncaught: '+(e.error&&e.error.stack||e.message)));
  return dom.window;
}
const q=w=>s=>w.document.querySelector(s), qq=w=>s=>[...w.document.querySelectorAll(s)];
const click=w=>e=>e.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
const setVal=w=>(e,v)=>{e.value=v;e.dispatchEvent(new w.Event('input',{bubbles:true}));};

async function makeLoom(w, name) {
  const $=q(w), $$=qq(w);
  click(w)($('#newLoom'));
  setVal(w)($('#loomName'), name);
  setVal(w)($('#totalDeclared'),'1792');
  [4,4,500,8,720,500,4,52].forEach((v,i)=>{ const el=$$('#segTable input[type=number]')[i]; if(el) setVal(w)(el,String(v)); });
  await wait(900);
}

console.log('\n== a plain web page, no host store ==');
{
  const jar = {};
  let w = boot({ jar }); await wait(300);
  let $=q(w);
  click(w)($('#signInLocal')); await wait(300);
  ok('it reports things are really being saved',
     /all changes saved/i.test($('#saveState').textContent), $('#saveState').textContent);
  await makeLoom(w, 'Browser loom');
  ok('the loom went into browser storage',
     Object.keys(jar).some(k => k.endsWith(':looms') && jar[k].includes('Browser loom')),
     Object.keys(jar).join(','));

  // close the tab and come back
  w = boot({ jar }); await wait(400);
  $=q(w);
  ok('it does not ask to sign in again', $('#gate').hidden === true);
  ok('the loom is still there after a reload',
     $('#loomName').value === 'Browser loom' || /Browser loom/.test($('#loomList').textContent),
     $('#loomName').value);
}

console.log('\n== storage blocked, as in some private windows ==');
{
  let w = boot({ localStorageWorks: false }); await wait(300);
  const $=q(w);
  click(w)($('#signInLocal')); await wait(300);
  ok('it says so plainly', /this session only/i.test($('#saveState').textContent), $('#saveState').textContent);
  ok('and explains on hover', /blocked/i.test($('#saveState').title), $('#saveState').title);
  await makeLoom(w, 'Ghost loom');
  ok('the app still works', /Ghost loom/.test($('#loomName').value), $('#loomName').value);
}

console.log('\n== a host that provides its own store still wins ==');
{
  const shelf = new Map();
  const hostStore = {
    async get(k){ if(!shelf.has(k)) throw new Error('missing'); return {key:k,value:shelf.get(k)}; },
    async set(k,v){ shelf.set(k,v); return {key:k,value:v}; },
    async delete(k){ shelf.delete(k); return {key:k,deleted:true}; }
  };
  const jar = {};
  let w = boot({ hostStore, jar }); await wait(300);
  const $=q(w);
  click(w)($('#signInLocal')); await wait(300);
  await makeLoom(w, 'Host loom');
  ok('it used the host store', [...shelf.keys()].some(k=>k.endsWith(':looms')), [...shelf.keys()].join(','));
  ok('and left browser storage alone', !Object.keys(jar).some(k=>k.endsWith(':looms')), Object.keys(jar).join(','));
}

console.log('\n== result ==');
if (errors.length){ console.log('  '+errors.length+' problem(s)'); errors.forEach(e=>console.log('   - '+e)); }
else console.log('  no errors');
process.exit(errors.length?1:0);
