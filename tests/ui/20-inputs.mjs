// What the boxes say and what the loom uses must be the same number.
//
// Typing "-9" into a pin count left the field showing -9 while the pin map used
// 0. Nothing was wrong on screen, and nothing added up.
import fs from 'fs';
import { JSDOM } from 'jsdom';
const errors=[]; const ok=(n,c,e='')=>{ c?console.log('  ok   '+n):(errors.push(n),console.log('  FAIL '+n+(e?'  -> '+e:''))); };
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const store=new Map();

function bmp(w,h){
  const rb=Math.ceil(w/8), row=Math.ceil(rb/4)*4, size=62+row*h;
  const b=Buffer.alloc(size); b.write('BM',0); b.writeUInt32LE(size,2); b.writeUInt32LE(62,10);
  b.writeUInt32LE(40,14); b.writeInt32LE(w,18); b.writeInt32LE(h,22);
  b.writeUInt16LE(1,26); b.writeUInt16LE(1,28); b.writeUInt32LE(2,46);
  b.writeUInt32LE(0x00000000,54); b.writeUInt32LE(0x00FFFFFF,58);
  return b;
}
const dom=new JSDOM(fs.readFileSync(process.argv[2],'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',
  beforeParse(w){
    w.HTMLCanvasElement.prototype.getContext=()=>({scale(){},beginPath(){},arc(){},fill(){},stroke(){},
      fillRect(){},strokeRect(){},moveTo(){},lineTo(){},fillText(){},setLineDash(){},putImageData(){},
      createImageData:(a,b)=>({width:a,height:b,data:new Uint8ClampedArray(a*b*4)}),
      measureText:t=>({width:String(t).length*6}),closePath(){},save(){},restore(){},clearRect(){},rect(){},translate(){},rotate(){}});
    w.URL.createObjectURL=()=>'blob:'; w.URL.revokeObjectURL=()=>{}; w.scrollTo=()=>{};
    w.confirm=()=>true; w.alert=()=>{}; w.HTMLElement.prototype.scrollIntoView=function(){};
    w.storage={ async get(k){ if(!store.has(k)) throw new Error('nothing there'); return {key:k,value:store.get(k)}; },
                async set(k,v){ store.set(k,v); return {key:k,value:v}; },
                async delete(k){ store.delete(k); return {key:k,deleted:true}; } };
  }});
dom.window.addEventListener('error',e=>errors.push('uncaught: '+(e.error&&e.error.stack||e.message)));
const w=dom.window, D=w.document; await wait(400);
const $=s=>D.querySelector(s), $$=s=>[...D.querySelectorAll(s)];
const click=e=>e&&e.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
const setVal=(e,v)=>{e.value=v;e.dispatchEvent(new w.Event('input',{bubbles:true}));};
const leave=e=>e.dispatchEvent(new w.Event('change',{bubbles:true}));

click($('#signInLocal')); await wait(300);
click($('#newLoom')); await wait(350);

console.log('\n== a total the loom could not use ==');
for (const [typed, shown] of [['-500',''],['1.5','1'],['abc',''],['0','']]) {
  const f=$('#totalDeclared'); setVal(f,typed); await wait(140); leave(f); await wait(140);
  ok(`"${typed}" is put back to "${shown}"`, f.value===shown, `reads "${f.value}"`);
}
{
  const f=$('#totalDeclared'); setVal(f,'800'); await wait(140); leave(f); await wait(140);
  ok('a good number is left alone', f.value==='800', f.value);
}

console.log('\n== a pin count the loom could not use ==');
for (const [typed, shown] of [['-9',''],['2.7','2']]) {
  const f=$$('#segTable input[data-act=count]')[0];
  setVal(f,typed); await wait(140); leave(f); await wait(140);
  ok(`"${typed}" is put back to "${shown}"`, f.value===shown, `reads "${f.value}"`);
}
{
  const f=$$('#segTable input[data-act=count]')[0];
  setVal(f,'4'); await wait(140); leave(f); await wait(140);
  ok('and a real count stays', f.value==='4', f.value);
}

console.log('\n== a name has to fit on a card ==');
ok('the loom name is capped', $('#loomName').getAttribute('maxlength')==='60',
   $('#loomName').getAttribute('maxlength'));

console.log('\n== the steps read as steps ==');
{
  const btns=$$('nav.steps button');
  ok('each one says which step it is',
     btns.every(b=>/^Step \d+: /.test(b.getAttribute('aria-label')||'')),
     btns.map(b=>b.getAttribute('aria-label')).join(' | '));
  ok('the numbers are not read out as part of the name',
     btns.every(b=>{ const n=b.querySelector('.no'); return n && n.getAttribute('aria-hidden')==='true'; }));
  const cur=btns.filter(b=>b.getAttribute('aria-current'));
  ok('exactly one is current, and it says how', cur.length===1 && cur[0].getAttribute('aria-current')==='step',
     cur.map(b=>b.getAttribute('aria-current')).join(','));
}

console.log('\n== what a bad file says ==');
{
  [4,4,200,8,300,200,4,80].forEach((v,i)=>setVal($$('#segTable input[data-act=count]')[i],String(v)));
  setVal($('#loomName'),'Files'); await wait(500);
  click($('#saveLoom')); await wait(500);
  click($$('nav.steps button').find(b=>b.dataset.go==='border')); await wait(500);

  const drop=(name,buf)=>{
    const inp=$('#borderHost input[type=file]');
    const f=new w.File([new Uint8Array(buf)], name, {type:'image/bmp'});
    const ab=new Uint8Array(buf).buffer.slice(0);
    f.arrayBuffer=async()=>ab;
    Object.defineProperty(inp,'files',{value:[f],configurable:true});
    inp.dispatchEvent(new w.Event('change',{bubbles:true}));
  };
  const meta=()=>{ const m=$('#borderHost .meta'); return m?m.textContent.replace(/\s+/g,' ').trim():''; };

  drop('notes.txt', Buffer.from('this is not a bitmap at all, not even close')); await wait(600);
  ok('a file that is not a BMP is named as such', /not a BMP/i.test(meta()), meta());

  drop('wrong.bmp', bmp(137,50)); await wait(600);
  ok('a BMP of the wrong width says both numbers', /137/.test(meta()) && /200/.test(meta()), meta());

  drop('good.bmp', bmp(200,50)); await wait(600);
  ok('and the right file is simply accepted', /200 × 50/.test(meta()) && !/could not/i.test(meta()), meta());
}

console.log('\n== the app never shows its own workings ==');
{
  const src=fs.readFileSync(process.argv[2],'utf8');
  // An unexpected fault used to be printed straight onto the screen — a weaver
  // at a loom was once shown "file.arrayBuffer is not a function".
  ok('a fault that is not the decoder speaking gets a plain message',
     /err\.fromDecoder \? err\.message/.test(src) && /uncompressed BMP/.test(src));
  ok('and nothing puts a raw message straight into a file record',
     !/error: err\.message \}/.test(src));
}

console.log('\n== result ==');
if (errors.length){ console.log('  '+errors.length+' problem(s)'); errors.forEach(e=>console.log('   - '+e)); }
else console.log('  no errors');
process.exit(errors.length?1:0);
