// Credits.
//
// A credit is spent when a finished file is downloaded. Building, previewing
// and checking against a file you trust stay free — those are the steps that
// catch a wrong pin map, and charging for them would teach people to skip the
// one thing that saves the silk.
import fs from 'fs';
import { JSDOM } from 'jsdom';
const errors=[]; const ok=(n,c,e='')=>{ c?console.log('  ok   '+n):(errors.push(n),console.log('  FAIL '+n+(e?'  -> '+e:''))); };
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const store=new Map();
let answer=null, alerts=[];

function boot(){
  const dom=new JSDOM(fs.readFileSync(process.argv[2],'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',
    beforeParse(w){
      w.HTMLCanvasElement.prototype.getContext=()=>({scale(){},beginPath(){},arc(){},fill(){},stroke(){},
        fillRect(){},strokeRect(){},moveTo(){},lineTo(){},fillText(){},setLineDash(){},putImageData(){},
        createImageData:(a,b)=>({width:a,height:b,data:new Uint8ClampedArray(a*b*4)}),
        measureText:t=>({width:String(t).length*6}),closePath(){},save(){},restore(){},clearRect(){},rect(){},translate(){},rotate(){}});
      w.URL.createObjectURL=()=>'blob:'; w.URL.revokeObjectURL=()=>{}; w.scrollTo=()=>{};
      w.confirm=()=>true; w.alert=m=>alerts.push(String(m));
      w.prompt=()=>answer;
      w.HTMLElement.prototype.scrollIntoView=function(){};
      w.HTMLAnchorElement.prototype.click=function(){};
      w.storage={ async get(k){ if(!store.has(k)) throw new Error('nothing there'); return {key:k,value:store.get(k)}; },
                  async set(k,v){ store.set(k,v); return {key:k,value:v}; },
                  async delete(k){ store.delete(k); return {key:k,deleted:true}; } };
    }});
  dom.window.addEventListener('error',e=>errors.push('uncaught: '+(e.error&&e.error.stack||e.message)));
  return dom.window;
}
function bmp(w,h){
  const rb=Math.ceil(w/8), row=Math.ceil(rb/4)*4, size=62+row*h;
  const b=Buffer.alloc(size); b.write('BM',0); b.writeUInt32LE(size,2); b.writeUInt32LE(62,10);
  b.writeUInt32LE(40,14); b.writeInt32LE(w,18); b.writeInt32LE(h,22);
  b.writeUInt16LE(1,26); b.writeUInt16LE(1,28); b.writeUInt32LE(2,46);
  b.writeUInt32LE(0,54); b.writeUInt32LE(0x00FFFFFF,58);
  for(let y=0;y<h;y++) for(let i=0;i<rb;i++) b[62+y*row+i]=(y%3)?0xF0:0x0F;
  return b;
}

let w=boot(); await wait(400);
let $=s=>w.document.querySelector(s), $$=s=>[...w.document.querySelectorAll(s)];
const click=e=>e&&e.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
const setVal=(e,v)=>{e.value=v;e.dispatchEvent(new w.Event('input',{bubbles:true}));};
const left=()=>{ const m=/(\d+)\s+credit/.exec($('#credits').textContent); return m?+m[1]:0; };

click($('#signInLocal')); await wait(300);

console.log('\n== a new account starts with some ==');
ok('the balance is shown in the header', !!$('#credits'), '');
ok('and it is not zero', left() > 0, $('#credits').textContent.trim());
ok('there is a way to add more', !!$('#recharge'));
const started = left();

click($('#newLoom')); await wait(350);
setVal($('#loomName'),'Credit test'); setVal($('#totalDeclared'),'800');
[4,4,200,8,300,200,4,80].forEach((v,i)=>setVal($$('#segTable input[data-act=count]')[i],String(v)));
await wait(600); click($('#saveLoom')); await wait(500);

console.log('\n== building and checking cost nothing ==');
{
  click($$('nav.steps button').find(b=>b.dataset.go==='border')); await wait(500);
  const inp=$('#borderHost input[type=file]');
  const buf=bmp(200,60), f=new w.File([new Uint8Array(buf)],'b.bmp',{type:'image/bmp'});
  const ab=new Uint8Array(buf).buffer.slice(0); f.arrayBuffer=async()=>ab;
  Object.defineProperty(inp,'files',{value:[f],configurable:true});
  inp.dispatchEvent(new w.Event('change',{bubbles:true})); await wait(700);
  click($('#combineBorder')); await wait(800);
  ok('combining a border is free', left() === started, `${left()} of ${started}`);
  click($('#borderPvMode')); await wait(300);
  ok('and so is looking at it', left() === started, String(left()));
}

console.log('\n== a finished file costs one ==');
{
  click($('#downloadBorder')); await wait(400);
  ok('downloading takes a credit', left() === started - 1, `${left()} of ${started}`);
  click($('#downloadBorder')); await wait(400);
  ok('and again for the next one', left() === started - 2, String(left()));
}

console.log('\n== it survives a reload ==');
{
  const before = left();
  w=boot(); await wait(600);
  $=s=>w.document.querySelector(s); $$=s=>[...w.document.querySelectorAll(s)];
  ok('the balance comes back as it was', left() === before, `${left()} was ${before}`);
}

console.log('\n== running out ==');
{
  // spend the rest through the store, then reload to see the header
  const key='pinmap:local:credits';
  const c=JSON.parse(store.get(key));
  c.spent = c.granted;
  store.set(key, JSON.stringify(c));
  w=boot(); await wait(600);
  $=s=>w.document.querySelector(s); $$=s=>[...w.document.querySelectorAll(s)];
  ok('the header says there are none left', /no credits left/i.test($('#credits').textContent),
     $('#credits').textContent.trim());
  ok('and still offers a recharge', !!$('#recharge'));
}

console.log('\n== a download with nothing to pay with ==');
{
  click($$('nav.steps button').find(b=>b.dataset.go==='border')); await wait(500);
  const inp=$('#borderHost input[type=file]');
  const buf=bmp(200,60), f=new w.File([new Uint8Array(buf)],'b.bmp',{type:'image/bmp'});
  const ab=new Uint8Array(buf).buffer.slice(0); f.arrayBuffer=async()=>ab;
  Object.defineProperty(inp,'files',{value:[f],configurable:true});
  inp.dispatchEvent(new w.Event('change',{bubbles:true})); await wait(700);
  click($('#combineBorder')); await wait(800);
  ok('the file can still be built', !!$('#borderPvWrap') && $('#borderPvWrap').hidden === false);
  ok('but the download is not offered', $('#downloadBorder').disabled === true);
  alerts=[];
  click($('#downloadBorder')); await wait(300);
  ok('nothing is taken that is not there',
     !/-\d/.test(store.get('pinmap:local:credits') || ''), store.get('pinmap:local:credits'));
}

console.log('\n== recharging ==');
{
  answer='PIN-50-6DV7';                      // 50 credits
  click($('#recharge')); await wait(500);
  ok('a good code adds its credits', left() === 50, $('#credits').textContent.trim());
  ok('and the download comes back', $('#downloadBorder').disabled === false);

  alerts=[];
  click($('#recharge')); await wait(400);
  ok('the same code cannot be used twice', left() === 50 && alerts.some(a=>/already been used/i.test(a)),
     alerts.join(' | '));

  alerts=[]; answer='PIN-50-XXXX';
  click($('#recharge')); await wait(400);
  ok('a mistyped code is refused', left() === 50 && alerts.some(a=>/did not check out/i.test(a)),
     alerts.join(' | '));

  alerts=[]; answer='hello';
  click($('#recharge')); await wait(400);
  ok('and so is nonsense', left() === 50 && alerts.some(a=>/not a recharge code/i.test(a)),
     alerts.join(' | '));

  answer=null;                                // pressing cancel
  click($('#recharge')); await wait(400);
  ok('cancelling changes nothing', left() === 50, String(left()));
}

console.log('\n== result ==');
if (errors.length){ console.log('  '+errors.length+' problem(s)'); errors.forEach(e=>console.log('   - '+e)); }
else console.log('  no errors');
process.exit(errors.length?1:0);
