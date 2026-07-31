// Choosing whose software wrote the file.
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
        measureText:t=>({width:String(t).length*6}),closePath(){},save(){},restore(){},clearRect(){},rect(){},translate(){},rotate(){}});
      w.URL.createObjectURL=()=>'blob:'; w.URL.revokeObjectURL=()=>{}; w.scrollTo=()=>{};
      w.confirm=()=>true; w.alert=m=>errors.push('alert: '+m); w.HTMLElement.prototype.scrollIntoView=function(){};
      w.storage={ async get(k){ if(!store.has(k)) throw new Error('x'); return {key:k,value:store.get(k)}; },
                  async set(k,v){ store.set(k,v); return {key:k,value:v}; },
                  async delete(k){ store.delete(k); return {key:k,deleted:true}; } };
    }});
  dom.window.addEventListener('error',e=>errors.push('uncaught: '+(e.error&&e.error.stack||e.message)));
  return dom.window;
}
let w=boot(); await wait(350);
let $=s=>w.document.querySelector(s), $$=s=>[...w.document.querySelectorAll(s)];
const click=e=>e.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
const setVal=(e,v)=>{e.value=v;e.dispatchEvent(new w.Event('input',{bubbles:true}));};
const setSel=(e,v)=>{e.value=v;e.dispatchEvent(new w.Event('change',{bubbles:true}));};

click($('#signInLocal')); await wait(300);
click($('#newLoom')); await wait(250);

console.log('\n== the dropdown ==');
ok('it is on the registration screen', !!$('#loomCompany'));
{
  const names = [...$('#loomCompany').options].map(o=>o.textContent);
  ok('it offers both companies', names.includes('Sai Tex') && names.includes('Sri Tex'), names.join(', '));
  ok('and a way to leave it unset', names[0] === 'Not set', names[0]);
  ok('nothing is chosen to begin with', $('#loomCompany').value === '', $('#loomCompany').value);
}
ok('box motion is still its own choice', !!$('#boxMotion'));
{
  const motions = [...$('#boxMotion').options].map(o=>o.textContent);
  ok('with both motions, whatever the company', motions.join(',') === '4 by 4,4 by 1', motions.join(','));
}

console.log('\n== choosing one ==');
setVal($('#loomName'),'Company'); setVal($('#totalDeclared'),'1792');
[4,4,500,8,720,500,4,52].forEach((v,i)=>{ const el=$$('#segTable input[type=number]')[i]; if(el) setVal(el,String(v)); });
await wait(600);
setSel($('#loomCompany'), 'sritex'); await wait(300);
ok('it holds the choice', $('#loomCompany').value === 'sritex');
setSel($('#boxMotion'), '4x1'); await wait(250);
ok('box motion still changes freely', $('#boxMotion').value === '4x1');
ok('and the company is untouched by it', $('#loomCompany').value === 'sritex');

console.log('\n== it travels with the loom ==');
click($('#saveLoom')); await wait(400);
click($$('nav.steps button').find(x=>x.dataset.go==='looms')); await wait(250);
ok('the card names the company', /Sri Tex/.test($('#loomList').textContent),
   $('#loomList').textContent.replace(/\s+/g,' ').slice(0,120));
ok('alongside the box motion', /4x1/.test($('#loomList').textContent));

w=boot(); await wait(500);
$=s=>w.document.querySelector(s); $$=s=>[...w.document.querySelectorAll(s)];
ok('it survives a reload', $('#loomCompany') && $('#loomCompany').value === 'sritex', ($('#loomCompany')||{}).value);

console.log('\n== the body file names it too ==');
click($$('nav.steps button').find(x=>x.dataset.go==='body')); await wait(300);
ok('in the figures', /Sri Tex/.test($('#bodySummary').textContent),
   $('#bodySummary').textContent.replace(/\s+/g,' ').slice(0,140));
ok('and on the map caption', /Sri Tex/.test($('.sideboard[data-board=body] .sb-loom').textContent),
   $('.sideboard[data-board=body] .sb-loom').textContent);

console.log('\n== switching companies ==');
click($$('nav.steps button').find(x=>x.dataset.go==='loom')); await wait(250);
setSel($('#loomCompany'), 'saitex'); await wait(300);
ok('the loom follows', $('#loomCompany').value === 'saitex');
setSel($('#loomCompany'), ''); await wait(250);
ok('and can be cleared again', $('#loomCompany').value === '');

console.log('\n== the company sets how the file is written ==');
{
  click($$('nav.steps button').find(x=>x.dataset.go==='loom')); await wait(250);
  setSel($('#loomCompany'), 'sritex'); await wait(350);
  click($$('nav.steps button').find(x=>x.dataset.go==='body')); await wait(300);
  const on = $$('#opts button[data-key=blackIsIndexZero]')
    .find(b => b.getAttribute('aria-pressed') === 'true');
  ok('Sri Tex writes a lifted pin white', on && on.textContent.trim() === 'White',
     on ? on.textContent.trim() : 'none pressed');
  ok('and the figures say so', /Lifted pin/.test($('#bodySummary').textContent) &&
     /White/.test($('#bodySummary').textContent),
     $('#bodySummary').textContent.replace(/\s+/g,' ').slice(-60));

  click($$('nav.steps button').find(x=>x.dataset.go==='loom')); await wait(250);
  setSel($('#loomCompany'), 'saitex'); await wait(350);
  click($$('nav.steps button').find(x=>x.dataset.go==='body')); await wait(300);
  const on2 = $$('#opts button[data-key=blackIsIndexZero]')
    .find(b => b.getAttribute('aria-pressed') === 'true');
  ok('Sai Tex writes it black', on2 && on2.textContent.trim() === 'Black',
     on2 ? on2.textContent.trim() : 'none pressed');
}

console.log('\n== a loom that drifts from its company says so ==');
{
  const other = $$('#opts button[data-key=blackIsIndexZero]').find(b => b.textContent.trim() === 'White');
  click(other); await wait(300);
  const t = $('#bodyChecks').textContent;
  ok('it names the setting and both sides', /lifted pin is written/i.test(t) && /Sai Tex expects/i.test(t),
     t.replace(/\s+/g,' ').slice(0,140));
}

console.log('\n== result ==');
if (errors.length){ console.log('  '+errors.length+' problem(s)'); errors.forEach(e=>console.log('   - '+e)); }
else console.log('  no errors');
process.exit(errors.length?1:0);
