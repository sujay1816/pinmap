// The pin map appears on the file screens too, picking out what that screen is about.
import fs from 'fs';
import { JSDOM } from 'jsdom';
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
const keys = (which) => [...w.document.querySelectorAll(`.sideboard[data-board=${which}] .sbkey`)];
const litOn = (which) => keys(which).filter(k=>k.getAttribute('aria-pressed')==='true').map(k=>k.dataset.lit);

click($('#signInLocal')); await wait(300);
click($('#newLoom'));
setVal($('#loomName'),'Shared'); setVal($('#totalDeclared'),'1792');
[4,4,500,8,720,500,4,52].forEach((v,i)=>{ const el=$$('#segTable input[type=number]')[i]; if(el) setVal(el,String(v)); });
await wait(600); click($('#saveLoom')); await wait(350);

console.log('\n== the border screen ==');
goTo('border'); await wait(250);
ok('the map is there', !!$('.sideboard[data-board=border] canvas'));
ok('every group is offered as a key', keys('border').length === 7, String(keys('border').length));
{
  const on = litOn('border').sort().join(',');
  ok('the borders are picked out by default', on === 'achu,leftBorder,rightBorder', on);
}
ok('it says what is showing', /showing/i.test($('.sideboard[data-board=border] .sb-read').textContent),
   $('.sideboard[data-board=border] .sb-read').textContent.slice(0,70));

console.log('\n== the body screen ==');
goTo('body'); await wait(250);
ok('the map is there too', !!$('.sideboard[data-board=body] canvas'));
{
  const on = litOn('body').sort().join(',');
  ok('the body, box and locking are picked out', on === 'body,box,locking', on);
}

console.log('\n== the two keep their own choices ==');
{
  const bodyKeys = keys('body');
  const leftBorderKey = bodyKeys.find(k=>k.dataset.lit==='leftBorder');
  click(leftBorderKey); await wait(150);
  ok('a group can be added on the body screen',
     litOn('body').includes('leftBorder'), litOn('body').join(','));
  const bodyKey = keys('body').find(k=>k.dataset.lit==='body');
  click(bodyKey); await wait(150);
  ok('and one can be taken away', !litOn('body').includes('body'), litOn('body').join(','));

  goTo('border'); await wait(250);
  const on = litOn('border').sort().join(',');
  ok('the border screen is unaffected', on === 'achu,leftBorder,rightBorder', on);
  goTo('body'); await wait(250);
  ok('and the body screen remembers what you chose',
     litOn('body').includes('leftBorder') && !litOn('body').includes('body'), litOn('body').join(','));
}

console.log('\n== turning everything off ==');
{
  // the block redraws after each tap, so take them one at a time
  for (let guard = 0; guard < 10; guard++) {
    const on = keys('body').find(k => k.getAttribute('aria-pressed') === 'true');
    if (!on) break;
    click(on);
    await wait(80);
  }
  ok('nothing is picked out', litOn('body').length === 0, litOn('body').join(','));
  ok('and it says so', /nothing picked out/i.test($('.sideboard[data-board=body] .sb-read').textContent),
     $('.sideboard[data-board=body] .sb-read').textContent.slice(0,60));
  ok('the map is still drawn', !!$('.sideboard[data-board=body] canvas'));
}

console.log('\n== the pin map screen keeps its own board ==');
goTo('loom'); await wait(250);
ok('still there, and still the editable one', !!$('#board') && !!$('#boardSel'));
ok('with its own zoom buttons', $$('[data-bzoom]').length >= 4);

console.log('\n== a loom with no border group ==');
{
  const del = $$('#segTable button[data-act=del]');
  // remove both borders
  const kinds = () => $$('#segTable select[data-act=kind]').map(e=>e.value);
  let at = kinds().indexOf('leftBorder');
  click($$('#segTable button[data-act=del]')[at]); await wait(200);
  at = kinds().indexOf('rightBorder');
  click($$('#segTable button[data-act=del]')[at]); await wait(200);
  goTo('body'); await wait(250);
  ok('the keys only offer groups this loom has',
     keys('body').every(k => kinds().includes(k.dataset.lit)), keys('body').map(k=>k.dataset.lit).join(','));
}

console.log('\n== the strip above the map is gone ==');
{
  ok('no banner on the body screen', !w.document.querySelector('#sc-body .loombanner'));
  goTo('border'); await wait(200);
  ok('nor on the border screen', !w.document.querySelector('#sc-border .loombanner'));
  const cap = $('.sideboard[data-board=border] .sb-loom');
  ok('the loom is still named on the map', !!cap && /Shared/.test(cap.textContent),
     cap ? cap.textContent.replace(/\s+/g,' ') : 'missing');
  ok('with its pin count and box motion', /1,792 pins/.test(cap.textContent) && /box 4x4/.test(cap.textContent),
     cap.textContent.replace(/\s+/g,' '));
}

console.log('\n== result ==');
if (errors.length){ console.log('  '+errors.length+' problem(s)'); errors.forEach(e=>console.log('   - '+e)); }
else console.log('  no errors');
process.exit(errors.length?1:0);
