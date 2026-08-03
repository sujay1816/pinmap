// Losing a weaver's looms is the one thing this must never do.
//
// The dangerous case is not a store that refuses to write — that is noisy and
// gets noticed. It is a store that reads back something unreadable, because an
// empty drawer looks perfectly normal, and the next save writes over the top.
import fs from 'fs';
import { JSDOM } from 'jsdom';
const errors=[]; const ok=(n,c,e='')=>{ c?console.log('  ok   '+n):(errors.push(n),console.log('  FAIL '+n+(e?'  -> '+e:''))); };
const wait=ms=>new Promise(r=>setTimeout(r,ms));

function boot(store, opts={}){
  const dom=new JSDOM(fs.readFileSync(process.argv[2],'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',
    beforeParse(w){
      w.HTMLCanvasElement.prototype.getContext=()=>({scale(){},beginPath(){},arc(){},fill(){},stroke(){},
        fillRect(){},strokeRect(){},moveTo(){},lineTo(){},fillText(){},setLineDash(){},putImageData(){},
        createImageData:(a,b)=>({width:a,height:b,data:new Uint8ClampedArray(a*b*4)}),
        measureText:t=>({width:String(t).length*6}),closePath(){},save(){},restore(){},clearRect(){},rect(){},translate(){},rotate(){}});
      w.URL.createObjectURL=()=>'blob:'; w.URL.revokeObjectURL=()=>{}; w.scrollTo=()=>{};
      w.confirm=()=>true; w.alert=m=>errors.push('alert: '+m); w.HTMLElement.prototype.scrollIntoView=function(){};
      w.storage={
        async get(k){ if(opts.failGet && opts.failGet(k)) throw new Error('read failed');
                      if(!store.has(k)) throw new Error('nothing there'); return {key:k,value:store.get(k)}; },
        async set(k,v){ if(opts.failSet && opts.failSet(k)) throw new Error('QuotaExceededError');
                        store.set(k,v); return {key:k,value:v}; },
        async delete(k){ store.delete(k); return {key:k,deleted:true}; } };
    }});
  dom.window.addEventListener('error',e=>errors.push('uncaught: '+(e.error&&e.error.stack||e.message)));
  return dom.window;
}
const H=w=>({ $:s=>w.document.querySelector(s), $$:s=>[...w.document.querySelectorAll(s)],
  click:e=>e&&e.dispatchEvent(new w.MouseEvent('click',{bubbles:true})),
  setVal:(e,v)=>{if(e){e.value=v;e.dispatchEvent(new w.Event('input',{bubbles:true}));}} });
async function makeLoom(w,name){
  const {$,$$,click,setVal}=H(w);
  click($('#newLoom')); await wait(300);
  setVal($('#loomName'),name); setVal($('#totalDeclared'),'800');
  [4,4,200,8,300,200,4,80].forEach((v,i)=>setVal($$('#segTable input[data-act=count]')[i],String(v)));
  await wait(450); click($('#saveLoom')); await wait(550);
}
const LOOMS='pinmap:local:looms';
const names=s=>{ try{ return JSON.parse(s.get(LOOMS)).map(l=>l.name); }catch{ return ['<unreadable>']; } };

// A weaver's real library, built through the interface.
const SEED=new Map();
{ const w=boot(SEED); await wait(400);
  H(w).click(H(w).$('#signInLocal')); await wait(300);
  await makeLoom(w,'Shed 2 — SEJ 2688');
  await makeLoom(w,'Shed 1 — B-4');
  ok('two looms are saved to begin with', names(SEED).length===2, names(SEED).join(' | ')); }

console.log('\n== nothing wrong ==');
{
  const s=new Map(SEED); const w=boot(s); await wait(600);
  H(w).click(H(w).$$('nav.steps button').find(b=>b.dataset.go==='looms')); await wait(300);
  ok('both looms come back', /SEJ 2688/.test(w.document.querySelector('#loomList').textContent));
  await makeLoom(w,'A THIRD LOOM');
  ok('and a new one joins them', names(s).length===3, names(s).join(' | '));
  ok('no warning is shown', !/could not be read/.test(w.document.querySelector('#storeNote').textContent));
}

console.log('\n== the saved looms will not read ==');
{
  const s=new Map(SEED);
  s.set(LOOMS,'[{"name":"Shed 2 — SEJ 26');        // a write cut short
  const w=boot(s); await wait(700);
  const note=w.document.querySelector('#storeNote').textContent.replace(/\s+/g,' ');
  ok('the weaver is told, rather than shown a bare drawer', /could not be read/i.test(note), note.slice(0,90));
  ok('and told the original was kept', /kept/i.test(note) && /written over/i.test(note), note.slice(0,140));
  ok('there is a way to get the bytes off the machine', !!w.document.querySelector('#recoverDamaged'));

  ok('the unreadable bytes are copied aside', s.has(LOOMS+':damaged'));
  ok('exactly as they were', s.get(LOOMS+':damaged')==='[{"name":"Shed 2 — SEJ 26', s.get(LOOMS+':damaged'));

  // the thing that used to destroy the library: an ordinary save afterwards
  await makeLoom(w,'A NEW LOOM');
  ok('a save afterwards still cannot reach the original', s.get(LOOMS+':damaged')==='[{"name":"Shed 2 — SEJ 26',
     String(s.get(LOOMS+':damaged')));
  ok('so the work is recoverable even after the overwrite',
     String(s.get(LOOMS+':damaged')).includes('SEJ 26'));
}

console.log('\n== the copy aside is written once and never again ==');
{
  const s=new Map(SEED);
  s.set(LOOMS,'{{{ first damage');
  s.set(LOOMS+':damaged','THE ORIGINAL WORK');       // already rescued once
  const w=boot(s); await wait(700);
  ok('a second failure does not write over the first rescue',
     s.get(LOOMS+':damaged')==='THE ORIGINAL WORK', s.get(LOOMS+':damaged'));
}

console.log('\n== one bad weave does not take the library with it ==');
{
  const s=new Map(SEED);
  s.set('pinmap:local:weaves','[{"id":"w1","name":"good","width":2,"height":2,"rows":["10","01"]},{"id":"w2"}]');
  const w=boot(s); await wait(700);
  H(w).click(H(w).$$('nav.steps button').find(b=>b.dataset.go==='looms')); await wait(300);
  ok('the looms are untouched', /SEJ 2688/.test(w.document.querySelector('#loomList').textContent));
}

console.log('\n== a store that will not write says so ==');
{
  const s=new Map(SEED);
  const w=boot(s,{failSet:k=>k.endsWith(':looms')}); await wait(600);
  await makeLoom(w,'WILL NOT SAVE');
  ok('the loom is not silently reported as saved',
     /session only|back it up/i.test(w.document.querySelector('#toast').textContent),
     w.document.querySelector('#toast').textContent);
  ok('and the looms already stored are left alone', names(s).length===2, names(s).join(' | '));
}

console.log('\n== an empty drawer really is empty ==');
{
  const s=new Map(SEED); s.delete(LOOMS);
  const w=boot(s); await wait(600);
  ok('no warning when nothing was ever saved',
     !/could not be read/.test(w.document.querySelector('#storeNote').textContent),
     w.document.querySelector('#storeNote').textContent.slice(0,60));
  ok('and nothing is quarantined', !s.has(LOOMS+':damaged'));
}

console.log('\n== result ==');
if (errors.length){ console.log('  '+errors.length+' problem(s)'); errors.forEach(e=>console.log('   - '+e)); }
else console.log('  no errors');
process.exit(errors.length?1:0);
