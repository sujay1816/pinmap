// The pin board: handles between groups, and dragging pins across them.
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

click($('#signInLocal')); await wait(300);
click($('#newLoom'));
setVal($('#loomName'),'Board'); setVal($('#totalDeclared'),'1792');
const START=[4,4,500,8,720,500,4,52];
START.forEach((v,i)=>{ const el=$$('#segTable input[type=number]')[i]; if(el) setVal(el,String(v)); });
await wait(600);

const counts = () => $$('#segTable input[type=number]').map(e=>parseInt(e.value,10)||0);
const cv = () => $('#board');
// jsdom gives every element a zero-size rect, so place the canvas by hand
const place = () => { const c=cv(); c.getBoundingClientRect = () => ({ left:0, top:0, width:c.width, height:c.height }); };

console.log('\n== handles ==');
ok('the board is drawn', !!cv());
place();
const geomBounds = () => {
  // recover the joins from the group counts and the drawn width
  const t = counts().reduce((a,b)=>a+b,0);
  const px = parseFloat(cv().style.width) / t;
  const bs=[]; let at=0;
  counts().forEach((c,i)=>{ at+=c; if (i<counts().length-1) bs.push({x:at*px,i}); });
  return bs;
};
const bs = geomBounds();
ok('there is a join between each pair of groups', bs.length===START.length-1, String(bs.length));

console.log('\n== dragging a join moves pins across it ==');
{
  const before = counts();
  const b = bs[4];                       // between body and right border, neither constrained
  const move = (dx) => {
    cv().dispatchEvent(new w.MouseEvent('mousedown',{bubbles:true,clientX:b.x,clientY:60}));
    cv().dispatchEvent(new w.MouseEvent('mousemove',{bubbles:true,clientX:b.x+dx,clientY:60}));
    w.dispatchEvent(new w.MouseEvent('mouseup',{bubbles:true}));
  };
  const px = parseFloat(cv().style.width) / before.reduce((a,c)=>a+c,0);
  move(px*20);                            // twenty pins to the right
  const after = counts();
  ok('the group on the left grew', after[4] > before[4], `${before[4]} -> ${after[4]}`);
  ok('the group on the right shrank', after[5] < before[5], `${before[5]} -> ${after[5]}`);
  ok('the two together are unchanged',
     after[4]+after[5] === before[4]+before[5], `${before[4]+before[5]} vs ${after[4]+after[5]}`);
  ok('the loom total is unchanged',
     after.reduce((a,c)=>a+c,0) === before.reduce((a,c)=>a+c,0));
}

console.log('\n== groups that cannot take any number ==');
{
  place();
  const before = counts();
  const t = before.reduce((a,c)=>a+c,0);
  const px = parseFloat(cv().style.width) / t;
  let at=0; for (let i=0;i<=2;i++) at+=before[i];      // the join before locking
  cv().dispatchEvent(new w.MouseEvent('mousedown',{bubbles:true,clientX:at*px,clientY:60}));
  cv().dispatchEvent(new w.MouseEvent('mousemove',{bubbles:true,clientX:at*px+px*3,clientY:60}));
  w.dispatchEvent(new w.MouseEvent('mouseup',{bubbles:true}));
  const after = counts();
  ok('locking stays a whole number of repeats', after[3] % 8 === 0, `${after[3]} pins`);
  ok('and the pair still adds up', after[2]+after[3] === before[2]+before[3]);
}

console.log('\n== it will not take a group down to nothing ==');
{
  place();
  const before = counts();
  const t = before.reduce((a,c)=>a+c,0);
  const px = parseFloat(cv().style.width) / t;
  let at=0; for (let i=0;i<=2;i++) at+=before[i];
  cv().dispatchEvent(new w.MouseEvent('mousedown',{bubbles:true,clientX:at*px,clientY:60}));
  cv().dispatchEvent(new w.MouseEvent('mousemove',{bubbles:true,clientX:at*px+px*5000,clientY:60}));
  w.dispatchEvent(new w.MouseEvent('mouseup',{bubbles:true}));
  const after = counts();
  ok('the neighbour keeps a usable count', after[3] >= 8 && after[3] % 8 === 0, String(after[3]));
  ok('and the total still holds', after.reduce((a,c)=>a+c,0)===t, String(after.reduce((a,c)=>a+c,0)));
}

console.log('\n== the guidance changes on a join ==');
{
  place();
  const before = counts();
  const px = parseFloat(cv().style.width) / before.reduce((a,c)=>a+c,0);
  let at=0; for (let i=0;i<=0;i++) at+=before[i];
  cv().dispatchEvent(new w.MouseEvent('mousemove',{bubbles:true,clientX:at*px,clientY:60}));
  await wait(80);
  ok('it says what dragging would do', /drag to move pins/i.test($('#boardRead').textContent),
     $('#boardRead').textContent.slice(0,80));
  ok('and the cursor shows it', /col-resize/.test(cv().style.cursor||''), cv().style.cursor);
}

console.log('\n== the mini ruler names its groups ==');
{
  // the banners carry a small ruler; save the loom and open a file screen
  if ($('#saveLoom').disabled) throw new Error('save disabled: ' + $('#loomChecks').textContent.replace(/\s+/g,' ').slice(0,140));
  click($('#saveLoom')); await wait(400);
  const nav = $$('nav.steps button').find(x => x.dataset.go === 'body');
  if (nav) { click(nav); await wait(250); }
  const named = $$('.loombanner .ruler-seg .k').length;
  const total = $$('.loombanner .ruler-seg').length;
  ok('a ruler is drawn in the banner', total>0, String(total)+' segments');
  ok('the wider groups are named', named>0, `${named} of ${total} named`);
  ok('narrow ones are not crowded with text', named < total, `${named} of ${total}`);
}

console.log('\n== result ==');
if (errors.length){ console.log('  '+errors.length+' problem(s)'); errors.forEach(e=>console.log('   - '+e)); }
else console.log('  no errors');
process.exit(errors.length?1:0);
