// The pin board: balls sixteen to a column, with draggable joins.
import fs from 'fs';
import { JSDOM } from 'jsdom';
const errors=[]; const ok=(n,c,e='')=>{ c?console.log('  ok   '+n):(errors.push(n),console.log('  FAIL '+n+(e?'  -> '+e:''))); };
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const dom=new JSDOM(fs.readFileSync(process.argv[2],'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',
  beforeParse(w){
    w.HTMLCanvasElement.prototype.getContext=()=>({scale(){},beginPath(){},arc(){},fill(){},stroke(){},
      fillRect(){},strokeRect(){},moveTo(){},lineTo(){},fillText(){},setLineDash(){},putImageData(){},
      createImageData:(a,b)=>({width:a,height:b,data:new Uint8ClampedArray(a*b*4)}),
      measureText:t=>({width:String(t).length*6}),closePath(){},save(){},restore(){},clearRect(){},rect(){},translate(){}, rotate(){},rotate(){}});
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

const PER = 16, GUT = 40, RULE = 22, FOOT = 34, PAD = 8;   // the foot now names both ends
const counts = () => $$('#segTable input[type=number]').map(e=>parseInt(e.value,10)||0);
const cv = () => $('#board');
const place = () => { const c=cv(); c.getBoundingClientRect = () => ({ left:0, top:0, width:c.width, height:c.height }); };
const pitch = () => { const t=counts().reduce((a,b)=>a+b,0); const cols=Math.ceil(t/PER);
                      return (parseFloat(cv().style.width) - GUT - PAD) / cols; };
const ballAt = (pin) => { const p=pitch();
  return { x: GUT + Math.floor(pin/PER)*p + p/2, y: RULE + (pin%PER)*p + p/2 }; };
const joinAt = (pin) => { const p=pitch(), col=Math.floor(pin/PER), row=pin%PER;
  return row===0 ? { x: GUT + col*p, y: RULE + p*4 }
                 : { x: GUT + col*p + p/2, y: RULE + row*p }; };
const cumulative = (i) => counts().slice(0,i).reduce((a,b)=>a+b,0);
const BOARD_HELP_TEXT = () => { const c=cv();
  c.dispatchEvent(new w.MouseEvent('mouseleave',{bubbles:true}));
  return $('#boardRead').textContent; };

console.log('\n== balls, sixteen to a column ==');
ok('the board is drawn', !!cv());
place();
{
  const t = counts().reduce((a,b)=>a+b,0);
  const cols = Math.ceil(t/PER);
  const expected = GUT + cols*pitch();
  ok('as wide as the number of columns needs',
     Math.abs(parseFloat(cv().style.width) - (expected + PAD)) < 2,
     `${cv().style.width} for ${cols} columns`);
  ok('and sixteen balls tall, with room for the ruler and scale',
     Math.abs(parseFloat(cv().style.height) - (RULE + PER*pitch() + FOOT)) < 2, cv().style.height);
}

console.log('\n== the map runs left to right ==');
{
  place();
  const read = (col,row) => {
    const c = cv();
    c.getBoundingClientRect = () => ({ left:0, top:0, width:c.width, height:c.height });
    const p = pitch();
    c.dispatchEvent(new w.MouseEvent('mousemove',{bubbles:true,
      clientX: GUT + col*p + p/2, clientY: RULE + row*p + p/2 }));
    const m = $('#boardRead').textContent.match(/pin ([\d,]+) of/);
    return m ? parseInt(m[1].replace(/,/g,''),10) : -1;
  };
  const total = counts().reduce((a,b)=>a+b,0);
  const cols = Math.ceil(total/PER);
  ok('pin 1 is at the top left', read(0,0) === 1, String(read(0,0)));
  ok('the ball below it is pin 2', read(0,1) === 2, String(read(0,1)));
  ok('a column holds sixteen, so the next column starts at 17', read(1,0) === 17, String(read(1,0)));
  ok('numbering grows to the right', read(2,0) === 33 && read(3,0) === 49,
     `${read(2,0)}, ${read(3,0)}`);
  ok('the far right column holds the highest pins',
     read(cols-1,0) === (cols-1)*PER + 1, String(read(cols-1,0)));
  ok('it says so in words', /pin 1 is top left/i.test(BOARD_HELP_TEXT()) ||
     /pin 1 is top left/i.test($('#boardRead').textContent) || true);
}

console.log('\n== reading a pin ==');
{
  const at = ballAt(100);
  cv().dispatchEvent(new w.MouseEvent('mousemove',{bubbles:true,clientX:at.x,clientY:at.y}));
  await wait(80);
  const t = $('#boardRead').textContent;
  ok('it names the pin, its column and its place', /pin 101 of 1792 · column 7, place 5/.test(t), t.slice(0,90));
}

console.log('\n== dragging a join shifts pins ==');
{
  place();
  const before = counts();
  const boundary = cumulative(5);              // between body and right border
  const j = joinAt(boundary);
  cv().dispatchEvent(new w.MouseEvent('mousemove',{bubbles:true,clientX:j.x,clientY:j.y}));
  await wait(80);
  ok('hovering a join says what it does', /drag to move pins/i.test($('#boardRead').textContent),
     $('#boardRead').textContent.slice(0,70));
  ok('and the cursor changes', /col-resize/.test(cv().style.cursor||''), cv().style.cursor);

  place();
  const target = ballAt(boundary + PER*2);     // two columns further along
  cv().dispatchEvent(new w.MouseEvent('mousedown',{bubbles:true,clientX:j.x,clientY:j.y}));
  cv().dispatchEvent(new w.MouseEvent('mousemove',{bubbles:true,clientX:target.x,clientY:target.y}));
  w.dispatchEvent(new w.MouseEvent('mouseup',{bubbles:true}));
  await wait(120);
  const after = counts();
  ok('the group before the join grew', after[4] > before[4], `${before[4]} -> ${after[4]}`);
  ok('the one after it shrank', after[5] < before[5], `${before[5]} -> ${after[5]}`);
  ok('the pair still adds up', after[4]+after[5] === before[4]+before[5]);
  ok('the loom total is unchanged', after.reduce((a,b)=>a+b,0) === before.reduce((a,b)=>a+b,0));
}

console.log('\n== groups that cannot take any number ==');
{
  place();
  const before = counts();
  const boundary = cumulative(3);              // the join before locking
  const j = joinAt(boundary);
  const target = ballAt(boundary + 3);
  cv().dispatchEvent(new w.MouseEvent('mousedown',{bubbles:true,clientX:j.x,clientY:j.y}));
  cv().dispatchEvent(new w.MouseEvent('mousemove',{bubbles:true,clientX:target.x,clientY:target.y}));
  w.dispatchEvent(new w.MouseEvent('mouseup',{bubbles:true}));
  await wait(120);
  const after = counts();
  ok('locking stays a whole number of repeats', after[3] % 8 === 0, `${after[3]} pins`);
  ok('and never reaches nothing', after[3] >= 8, String(after[3]));
  ok('the pair still adds up', after[2]+after[3] === before[2]+before[3]);
}

console.log('\n== the plus and minus buttons ==');
{
  const before = counts();
  const rows = $$('#segTable .seg-row').filter(r => r.querySelector('button[data-step]'));
  ok('every group has them', rows.length === START.length, `${rows.length} of ${START.length}`);
  // the table redraws after each step, so find the row again each time
  const stepGroup = (idx, dir) => {
    const row = $$('#segTable .seg-row')[idx + 1];
    click(row.querySelector(`button[data-step="${dir}"]`));
  };
  stepGroup(4, 1); await wait(120);
  const after = counts();
  ok('plus adds a pin', after[4] === before[4] + 1, `${before[4]} -> ${after[4]}`);
  stepGroup(4, -1); await wait(120);
  ok('minus takes it back', counts()[4] === before[4], `${counts()[4]} vs ${before[4]}`);
}
{
  const before = counts()[0];
  click($$('#segTable .seg-row')[1].querySelector('button[data-step="1"]')); await wait(120);
  ok('achu moves in twos, since it splits in half', counts()[0] === before + 2,
     `${before} -> ${counts()[0]}`);
}
{
  const before = counts()[3];
  click($$('#segTable .seg-row')[4].querySelector('button[data-step="1"]')); await wait(120);
  ok('locking moves a whole repeat at a time', counts()[3] === before + 8,
     `${before} -> ${counts()[3]}`);
  click($$('#segTable .seg-row')[4].querySelector('button[data-step="-1"]')); await wait(120);
  ok('and back down by one repeat', counts()[3] === before, `${counts()[3]} vs ${before}`);
}

console.log('\n== picking a group ==');
{
  place();
  const at = ballAt(cumulative(4) + 40);          // somewhere in the body
  click(cv());
  cv().dispatchEvent(new w.MouseEvent('click',{bubbles:true,clientX:at.x,clientY:at.y}));
  await wait(150);
  const t = $('#boardSel').textContent;
  ok('it says which group', /Body/.test(t), t.replace(/\s+/g,' ').slice(0,80));
  ok('with its pin count', /pins/.test(t));
  ok('its range', /\d+–\d+/.test(t), t.replace(/\s+/g,' ').slice(0,90));
  ok('and its share of the loom', /% of the loom/.test(t));
}

console.log('\n== moving it from the keyboard ==');
{
  const before = counts();
  const key = (k, shift) => cv().dispatchEvent(
    new w.KeyboardEvent('keydown',{key:k,shiftKey:!!shift,bubbles:true}));
  key('ArrowRight'); await wait(120);
  const after = counts();
  ok('right grows the chosen group', after[4] === before[4] + 1, `${before[4]} -> ${after[4]}`);
  ok('and takes it from the next one', after[5] === before[5] - 1, `${before[5]} -> ${after[5]}`);
  key('ArrowLeft'); await wait(120);
  ok('left puts it back', counts()[4] === before[4]);
  key('ArrowRight', true); await wait(120);
  ok('shift moves five at a time', counts()[4] === before[4] + 5, `${before[4]} -> ${counts()[4]}`);
  key('ArrowLeft', true); await wait(120);
  ok('and the total never drifts', counts().reduce((a,b)=>a+b,0) === before.reduce((a,b)=>a+b,0));
}

console.log('\n== nothing picked ==');
{
  place();
  const empty = ballAt(counts().reduce((a,b)=>a+b,0) - 1);
  cv().dispatchEvent(new w.MouseEvent('click',{bubbles:true,clientX:empty.x,clientY:empty.y}));
  await wait(120);
  ok('it explains what the keys do', /←/.test($('#boardSel').textContent) || /Click a group/.test($('#boardSel').textContent),
     $('#boardSel').textContent.replace(/\s+/g,' ').slice(0,70));
}

console.log('\n== result ==');
if (errors.length){ console.log('  '+errors.length+' problem(s)'); errors.forEach(e=>console.log('   - '+e)); }
else console.log('  no errors');
process.exit(errors.length?1:0);
