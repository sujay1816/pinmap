// Reading the pin board.
//
// The board runs down a column of sixteen and then on to the next, so which end
// of the loom you are looking at is not obvious. It used to be written on the
// ruler line — where the column numbers were then drawn straight over it, one
// label on top of another at both ends.
import fs from 'fs';
import { JSDOM } from 'jsdom';
const errors=[]; const ok=(n,c,e='')=>{ c?console.log('  ok   '+n):(errors.push(n),console.log('  FAIL '+n+(e?'  -> '+e:''))); };
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const store=new Map();
let texts=[];

const dom=new JSDOM(fs.readFileSync(process.argv[2],'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',
  beforeParse(w){
    w.HTMLCanvasElement.prototype.getContext=function(){
      const host=this; let font='10px', align='left';
      return {
        set font(v){font=v;}, get font(){return font;},
        set textAlign(v){align=v;}, get textAlign(){return align;},
        textBaseline:'', fillStyle:'', strokeStyle:'', lineWidth:1, globalAlpha:1,
        scale(){},beginPath(){},arc(){},fill(){},stroke(){},fillRect(){},strokeRect(){},moveTo(){},lineTo(){},
        setLineDash(){},closePath(){},save(){},restore(){},clearRect(){},rect(){},translate(){},rotate(){},putImageData(){},
        createImageData:(a,b)=>({width:a,height:b,data:new Uint8ClampedArray(a*b*4)}),
        measureText:t=>({width:String(t).length*6.3}),
        // only the big interactive board, not the small ones on later screens
        fillText:(t,x,y)=>{ if(host && host.id==='board')
          texts.push({t:String(t), x, y, align, w:String(t).length*6.3}); } };
    };
    w.URL.createObjectURL=()=>'blob:'; w.URL.revokeObjectURL=()=>{}; w.scrollTo=()=>{};
    w.confirm=()=>true; w.alert=m=>errors.push('alert: '+m); w.HTMLElement.prototype.scrollIntoView=function(){};
    w.storage={ async get(k){ if(!store.has(k)) throw new Error('nothing there'); return {key:k,value:store.get(k)}; },
                async set(k,v){ store.set(k,v); return {key:k,value:v}; },
                async delete(k){ store.delete(k); return {key:k,deleted:true}; } };
  }});
dom.window.addEventListener('error',e=>errors.push('uncaught: '+(e.error&&e.error.stack||e.message)));
const w=dom.window, D=w.document; await wait(400);
const $=s=>D.querySelector(s), $$=s=>[...D.querySelectorAll(s)];
const click=e=>e&&e.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
const setVal=(e,v)=>{e.value=v;e.dispatchEvent(new w.Event('input',{bubbles:true}));};

// one label's extent, given how it is anchored
const box=t=>{ const h=t.w/2;
  return t.align==='center' ? [t.x-h,t.x+h] : t.align==='right' ? [t.x-t.w,t.x] : [t.x,t.x+t.w]; };
function overlaps(){
  const seen=new Set();
  const uniq=texts.filter(t=>{ const k=`${t.t}|${Math.round(t.x)}|${Math.round(t.y)}`;
    if(seen.has(k)) return false; seen.add(k); return true; });
  const byY={}; uniq.forEach(t=>{ (byY[Math.round(t.y)]=byY[Math.round(t.y)]||[]).push(t); });
  const out=[];
  for(const list of Object.values(byY))
    for(let i=0;i<list.length;i++) for(let j=i+1;j<list.length;j++){
      const a=box(list[i]), b=box(list[j]);
      if(a[0]<b[1] && b[0]<a[1]) out.push(`"${list[i].t}" over "${list[j].t}"`);
    }
  return { list: out, uniq };
}
const said=()=>[...new Set(texts.map(t=>t.t))].filter(t=>/pin/.test(t));

click($('#signInLocal')); await wait(300);
click($('#newLoom')); await wait(350);
setVal($('#loomName'),'Board'); setVal($('#totalDeclared'),'1568');
// the Sri Tex loom, read from the right
[10,4,2,2,375,16,720,16,375,14,2,32].forEach((v,i)=>{
  const e=$$('#segTable input[data-act=count]')[i]; if(e) setVal(e,String(v)); });
await wait(900);

console.log('\n== nothing is drawn on top of anything else ==');
{
  texts=[]; setVal($('#totalDeclared'),'1568'); await wait(700);
  const { list, uniq } = overlaps();
  ok('no two labels share the same space', list.length===0, list.slice(0,3).join(' , '));
  ok('and the board is labelled at all', uniq.length > 4, String(uniq.length));
}

console.log('\n== both ends are named ==');
{
  const s = said();
  ok('the near end says pin 1', s.some(t=>/pin 1\b/.test(t)), s.join('  '));
  ok('the far end says the last pin', s.some(t=>/1,568/.test(t)), s.join('  '));
  ok('each end names an edge of the loom', s.filter(t=>/edge/.test(t)).length===2, s.join('  '));
  ok('and points which way it runs',
     s.some(t=>t.includes('\u25c0')) && s.some(t=>t.includes('\u25b6')), s.join('  '));
}

console.log('\n== when pin 1 is at the other edge ==');
{
  // a loom whose pins are numbered from the right reads the other way about
  click($$('nav.steps button').find(b=>b.dataset.go==='body'));
  await wait(400);
  const flip = $$('#opts button[data-key=pinOneLeft]').find(b=>/right/i.test(b.textContent));
  if (flip) {
    click(flip); await wait(400);
    click($$('nav.steps button').find(b=>b.dataset.go==='loom')); await wait(500);
    texts=[]; setVal($('#totalDeclared'),'1568'); await wait(700);
    const s = said();
    ok('pin 1 is called the right edge', s.some(t=>/pin 1 .*right edge/.test(t)), s.join('  '));
    ok('and the far end the left', s.some(t=>/left edge/.test(t)), s.join('  '));
    ok('still nothing overlapping', overlaps().list.length===0, overlaps().list.slice(0,2).join(' , '));
  } else {
    ok('the pin 1 edge can be switched', false, 'no control found');
  }
}

console.log('\n== the two ends never meet in the middle ==');
{
  click($$('nav.steps button').find(b=>b.dataset.go==='loom')); await wait(400);
  // walk the board down through every width, clearing groups so the total rules
  let guard=0;
  while ($$('#segTable button[data-act=del]').length && guard++<40) {
    click($$('#segTable button[data-act=del]')[0]); await wait(60);
  }
  await wait(300);
  for (const total of [1568, 900, 600, 400, 260, 160, 96, 48]) {
    texts=[]; setVal($('#totalDeclared'), String(total)); await wait(450);
    const clash = overlaps().list;
    const s = said();
    ok(`${String(total).padStart(4)} pins: the ends do not touch`, clash.length===0, clash.slice(0,1).join(''));
    // on a very narrow board the wording falls back to bare numbers, but there
    // must always be a mark at each end
    ok(`${String(total).padStart(4)} pins: both ends still marked`,
       s.length===2 || (texts.some(t=>t.t.includes('\u25c0')) && texts.some(t=>t.t.includes('\u25b6'))),
       [...new Set(texts.map(t=>t.t))].filter(t=>/[\u25c0\u25b6]/.test(t)).join('  '));
  }
}

console.log('\n== result ==');
if (errors.length){ console.log('  '+errors.length+' problem(s)'); errors.forEach(e=>console.log('   - '+e)); }
else console.log('  no errors');
process.exit(errors.length?1:0);
