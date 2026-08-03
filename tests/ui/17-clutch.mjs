// The clutch end of a Sri Tex loom, and the pins it takes.
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
const kinds  = ()=>$$('#segTable select[data-act=kind]').map(s=>s.value);
const counts = ()=>$$('#segTable input[data-act=count]').map(s=>s.value);

click($('#signInLocal')); await wait(300);
click($('#newLoom')); await wait(250);

console.log('\n== only Sri Tex is asked ==');
ok('the field is on the registration screen', !!$('#clutchField'));
ok('but hidden while no company is set', $('#clutchField').hidden === true);
setSel($('#loomCompany'), 'saitex'); await wait(300);
ok('and hidden for Sai Tex', $('#clutchField').hidden === true);
ok('who gets no clutch group', !/the clutch/.test($('#segTable').textContent));

console.log('\n== choosing Sri Tex ==');
setVal($('#loomName'),'Clutch loom'); setVal($('#totalDeclared'),'1824');
setSel($('#loomCompany'), 'sritex'); await wait(350);
ok('the field appears', $('#clutchField').hidden === false);
// Their own 1568-pin loom uses pin 1 for the achu, so nothing is set aside
// until someone says which end the clutch is on.
ok('nothing is assumed', $('#loomClutch').value === 'none');
ok('and no pins are taken', !/the clutch/.test($('#segTable').textContent));
ok('the note says so plainly', /No pins set aside/.test($('#clutchNote').textContent),
   $('#clutchNote').textContent.slice(0,60));

console.log('\n== saying which end ==');
setSel($('#loomClutch'), 'left'); await wait(350);
ok('an empty group arrives', /the clutch/.test($('#segTable').textContent));
ok('at the left of the board', kinds()[0] === 'empty', kinds().join(','));
ok('holding 32 pins', counts()[0] === '32', counts()[0]);
ok('the note says where they are', /32 pins/.test($('#clutchNote').textContent) && /left/.test($('#clutchNote').textContent),
   $('#clutchNote').textContent);

console.log('\n== the clutch end does not move them ==');
// The end the clutch sits on is worth recording, but on a Sri Tex loom the
// pins are the first thirty-two either way.
setSel($('#loomClutch'), 'right'); await wait(350);
ok('a right clutch keeps them at the left', kinds()[0] === 'empty' && counts()[0] === '32',
   kinds().join(',')+' / '+counts()[0]);
ok('nothing is left at the back', counts().slice(-1)[0] !== '32' || kinds().slice(-1)[0] !== 'empty',
   kinds().slice(-1)[0]+'/'+counts().slice(-1)[0]);
ok('only one of them exists', $$('#segTable .content-note').filter(n=>/the clutch/.test(n.textContent)).length === 1);
ok('and the choice is remembered', $('#loomClutch').value === 'right');
ok('the note says the left of the board, whichever end',
   /left of the board/.test($('#clutchNote').textContent), $('#clutchNote').textContent.slice(0,70));

console.log('\n== the pins are yours to change ==');
{
  setVal($$('#segTable input[data-act=count]')[0], '40'); await wait(300);
  ok('the count can be changed', counts()[0] === '40', counts()[0]);
  setSel($('#loomClutch'), 'left'); await wait(350);
  ok('and a changed count is kept, not reset', counts()[0] === '40', counts()[0]);
  setVal($$('#segTable input[data-act=count]')[0], '32'); await wait(300);
}

console.log('\n== it can be taken off ==');
{
  const before = kinds().length;
  click($$('#segTable button[data-act=del]')[0]); await wait(300);
  ok('the group deletes like any other', kinds().length === before - 1, kinds().length+' of '+before);
  ok('and the note says how to get it back', /removed/.test($('#clutchNote').textContent), $('#clutchNote').textContent);
  setSel($('#loomClutch'), 'right'); await wait(350);
  ok('picking an end puts it back at the left', counts()[0] === '32', counts()[0]);
}

console.log('\n== and taking it off again ==');
{
  setSel($('#loomClutch'), 'none'); await wait(350);
  ok('choosing no clutch removes the group', !/the clutch/.test($('#segTable').textContent), kinds().join(','));
  setSel($('#loomClutch'), 'right'); await wait(350);
  ok('and asking again brings it back', /the clutch/.test($('#segTable').textContent));
}

console.log('\n== leaving Sri Tex ==');
setSel($('#loomCompany'), 'saitex'); await wait(350);
ok('the field goes away', $('#clutchField').hidden === true);
ok('and an untouched group goes with it', !/the clutch/.test($('#segTable').textContent), kinds().join(','));
setSel($('#loomCompany'), 'sritex'); await wait(350);
ok('coming back brings it again', /the clutch/.test($('#segTable').textContent));
{
  setVal($$('#segTable input[data-act=count]').slice(-1)[0], '48'); await wait(300);
  setSel($('#loomCompany'), 'saitex'); await wait(350);
  ok('but a count you set yourself is left alone', counts().slice(-1)[0] === '48', counts().slice(-1)[0]);
  setVal($$('#segTable input[data-act=count]').slice(-1)[0], '32'); await wait(250);
  setSel($('#loomCompany'), 'sritex'); await wait(350);
}

console.log('\n== it stays put ==');
// the clutch is row 0, so the eight standard groups start at row 1
ok('the clutch is the first group', kinds()[0] === 'empty' && counts()[0] === '32',
   kinds()[0]+'/'+counts()[0]);
[4,4,500,8,720,500,4,52].forEach((v,i)=>{ const e=$$('#segTable input[data-act=count]')[i+1]; if(e) setVal(e,String(v)); });
setVal($('#totalDeclared'),'1824'); await wait(500);
ok('they add up with the clutch included', /1,824 of 1,824/.test($('#alloc').textContent.replace(/\s+/g,' ')),
   $('#alloc').textContent.replace(/\s+/g,' ').slice(0,90));
ok('the loom is valid and can be saved', $('#saveLoom').disabled === false,
   $('#loomChecks').textContent.replace(/\s+/g,' ').slice(0,120));
click($('#saveLoom')); await wait(400);
click($$('nav.steps button').find(x=>x.dataset.go==='looms')); await wait(250);
ok('the card names the end', /right clutch/i.test($('#loomList').textContent),
   $('#loomList').textContent.replace(/\s+/g,' ').slice(0,140));

w=boot(); await wait(500);
$=s=>w.document.querySelector(s); $$=s=>[...w.document.querySelectorAll(s)];
ok('the end survives a reload', $('#loomClutch') && $('#loomClutch').value === 'right', ($('#loomClutch')||{}).value);
ok('the field is still shown', $('#clutchField') && $('#clutchField').hidden === false);
ok('and the group came back as the clutch', /the clutch/.test($('#segTable').textContent));
ok('still the first group, at the left of the board',
   $$('#segTable input[data-act=count]')[0].value === '32',
   $$('#segTable input[data-act=count]')[0].value);
ok('and still marked as the clutch',
   /the clutch/.test($$('#segTable .seg-row[data-row]')[0].textContent),
   $$('#segTable .seg-row[data-row]')[0].textContent.replace(/\s+/g,' ').slice(0,70));

console.log('\n== result ==');
if (errors.length){ console.log('  '+errors.length+' problem(s)'); errors.forEach(e=>console.log('   - '+e)); }
else console.log('  no errors');
process.exit(errors.length?1:0);
