import fs from 'fs';
import { JSDOM } from 'jsdom';
const errors=[]; const ok=(n,c,e='')=>{ c?console.log('  ok   '+n):(errors.push(n),console.log('  FAIL '+n+(e?'  -> '+e:''))); };
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const store=new Map();
function boot(){
  const dom=new JSDOM(fs.readFileSync(process.argv[2],'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',
    beforeParse(w){
      w.HTMLCanvasElement.prototype.getContext=()=>({scale(){},beginPath(){},arc(){},fill(){},stroke(){},
        fillRect(){},strokeRect(){},moveTo(){},lineTo(){},fillText(){},setLineDash(){},putImageData(){},
        createImageData:(a,b)=>({width:a,height:b,data:new Uint8ClampedArray(a*b*4)}),
        measureText:t=>({width:String(t).length*6}),closePath(){},save(){},restore(){},clearRect(){},rect(){},translate(){}, rotate(){},rotate(){}});
      w.URL.createObjectURL=()=>'blob:'; w.URL.revokeObjectURL=()=>{}; w.scrollTo=()=>{};
      w.confirm=()=>true; w.alert=()=>{}; w.HTMLElement.prototype.scrollIntoView=function(){};
      w.storage={ async get(k){ if(!store.has(k)) throw new Error('x'); return {key:k,value:store.get(k)}; },
                  async set(k,v){ store.set(k,v); return {key:k,value:v}; },
                  async delete(k){ store.delete(k); return {key:k,deleted:true}; } };
    }});
  return dom.window;
}
const seed = (names) => {
  store.set('pinmap:account', JSON.stringify({ key:'local', account:null, clientId:'' }));
  store.set('pinmap:local:session', JSON.stringify({
    format:'pinmap.session', savedAt:new Date().toISOString(),
    draft:{ name:'Old', totalPins:1792, boxMotion:'4x4', editing:'Old', version:1,
            segments:[{kind:'achu',count:4},{kind:'box',count:4},{kind:'leftBorder',count:500},
                      {kind:'locking',count:8,weave:'satin:8:3'},{kind:'body',count:720},
                      {kind:'rightBorder',count:500},{kind:'achu',count:4},{kind:'empty',count:52}] },
    opts:{}, activeName:'Old', weftNames:names, loomSort:'recent' }));
};

console.log('\n== a session saved under the old names ==');
seed(['Meena','Rani','Zari','Weft 4']);
{
  const w=boot(); await wait(500);
  const $=s=>w.document.querySelector(s), $$=s=>[...w.document.querySelectorAll(s)];
  const click=e=>e.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  click($$('nav.steps button').find(x=>x.dataset.go==='body')); await wait(250);
  const names=$$('#bodyHost input[type=text]').map(e=>e.value);
  ok('they are brought forward', names.join(',')==='Rani,Zari,Meena 1,Meena 2', names.join(','));
}

console.log('\n== names you typed yourself are left alone ==');
seed(['Ground','Gold','Colour','Spare']);
{
  const w=boot(); await wait(500);
  const $=s=>w.document.querySelector(s), $$=s=>[...w.document.querySelectorAll(s)];
  const click=e=>e.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  click($$('nav.steps button').find(x=>x.dataset.go==='body')); await wait(250);
  const names=$$('#bodyHost input[type=text]').map(e=>e.value);
  ok('kept exactly as they were', names.join(',')==='Ground,Gold,Colour,Spare', names.join(','));

  console.log('\n== and the reset button puts them back ==');
  click($('#resetWeftNames')); await wait(250);
  const after=$$('#bodyHost input[type=text]').map(e=>e.value);
  ok('rani, zari, meena 1, meena 2', after.join(',')==='Rani,Zari,Meena 1,Meena 2', after.join(','));
}

console.log('\n== a half-renamed session is not touched ==');
seed(['Meena','Rani','My zari','Weft 4']);
{
  const w=boot(); await wait(500);
  const $=s=>w.document.querySelector(s), $$=s=>[...w.document.querySelectorAll(s)];
  const click=e=>e.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
  click($$('nav.steps button').find(x=>x.dataset.go==='body')); await wait(250);
  const names=$$('#bodyHost input[type=text]').map(e=>e.value);
  ok('left as it was, since one was changed', names.join(',')==='Meena,Rani,My zari,Weft 4', names.join(','));
}

console.log('\n== result ==');
if (errors.length){ console.log('  '+errors.length+' problem(s)'); errors.forEach(e=>console.log('   - '+e)); }
else console.log('  no errors');
process.exit(errors.length?1:0);
