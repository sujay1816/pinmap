// Reading the border file the way the loom will.
//
// The preview drew the groups in colour and said nothing about it, so what was
// on screen looked nothing like the file that came out. There is now a switch,
// the same one the body screen has, and a line saying what gets written.
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
  b.writeUInt32LE(0,54); b.writeUInt32LE(0x00FFFFFF,58);
  for(let y=0;y<h;y++) for(let i=0;i<rb;i++) b[62+y*row+i]=(y%3)?0xF0:0x0F;
  return b;
}
let painted=null, written=null;
const dom=new JSDOM(fs.readFileSync(process.argv[2],'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',
  beforeParse(w){
    w.HTMLCanvasElement.prototype.getContext=function(){ const host=this; return {
      scale(){},beginPath(){},arc(){},fill(){},stroke(){},fillRect(){},strokeRect(){},moveTo(){},lineTo(){},
      fillText(){},setLineDash(){},closePath(){},save(){},restore(){},clearRect(){},rect(){},translate(){},rotate(){},
      putImageData:(img)=>{ if(host && host.id==='borderPv') painted=img; },
      createImageData:(a,b)=>({width:a,height:b,data:new Uint8ClampedArray(a*b*4)}),
      measureText:t=>({width:String(t).length*6}) }; };
    w.URL.createObjectURL=()=>'blob:'; w.URL.revokeObjectURL=()=>{}; w.scrollTo=()=>{};
    w.confirm=()=>true; w.alert=m=>errors.push('alert: '+m); w.HTMLElement.prototype.scrollIntoView=function(){};
    // a download link would try to navigate, which jsdom cannot do; the bytes
    // are captured from the Blob before the click, so this loses nothing
    w.HTMLAnchorElement.prototype.click=function(){};
    w.storage={ async get(k){ if(!store.has(k)) throw new Error('nothing there'); return {key:k,value:store.get(k)}; },
                async set(k,v){ store.set(k,v); return {key:k,value:v}; },
                async delete(k){ store.delete(k); return {key:k,deleted:true}; } };
  }});
dom.window.addEventListener('error',e=>errors.push('uncaught: '+(e.error&&e.error.stack||e.message)));
const w=dom.window, D=w.document; await wait(400);
const $=s=>D.querySelector(s), $$=s=>[...D.querySelectorAll(s)];
const click=e=>e&&e.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
const setVal=(e,v)=>{e.value=v;e.dispatchEvent(new w.Event('input',{bubbles:true}));};
const shades=()=>{ if(!painted) return []; const s=new Set();
  for(let i=0;i<painted.data.length;i+=4) s.add(`${painted.data[i]},${painted.data[i+1]},${painted.data[i+2]}`);
  return [...s]; };

click($('#signInLocal')); await wait(300);
click($('#newLoom')); await wait(350);
setVal($('#loomName'),'Border mono'); setVal($('#totalDeclared'),'800');
[4,4,200,8,300,200,4,80].forEach((v,i)=>setVal($$('#segTable input[data-act=count]')[i],String(v)));
await wait(600); click($('#saveLoom')); await wait(500);
click($$('nav.steps button').find(b=>b.dataset.go==='border')); await wait(500);

{
  const inp=$('#borderHost input[type=file]');
  const buf=bmp(200,60);
  const f=new w.File([new Uint8Array(buf)],'b.bmp',{type:'image/bmp'});
  const ab=new Uint8Array(buf).buffer.slice(0); f.arrayBuffer=async()=>ab;
  Object.defineProperty(inp,'files',{value:[f],configurable:true});
  inp.dispatchEvent(new w.Event('change',{bubbles:true}));
  await wait(700);
}
click($('#combineBorder')); await wait(800);

console.log('\n== after combining ==');
ok('the preview appears', $('#borderPvWrap').hidden === false);
ok('and the file can be downloaded', $('#downloadBorder').disabled === false);
ok('there is a switch for how to read it', !!$('#borderPvMode'));

console.log('\n== colour, to find the groups by ==');
{
  const c = shades();
  ok('more than two shades are drawn', c.length > 2, c.join(' '));
  ok('the switch offers the other view', /black & white/i.test($('#borderPvMode').textContent),
     $('#borderPvMode').textContent);
  ok('the legend names the groups', /Achu/.test($('#borderPvLegend').textContent),
     $('#borderPvLegend').textContent.slice(0,50));
  ok('and it says the download is not coloured',
     /black and white only/i.test($('#borderPvNote').textContent), $('#borderPvNote').textContent);
}

console.log('\n== black and white, as the loom reads it ==');
{
  click($('#borderPvMode')); await wait(500);
  const c = shades().sort();
  ok('only black and white are drawn', c.length===2 && c.includes('0,0,0') && c.includes('255,255,255'), c.join(' '));
  ok('the legend goes, having nothing to say', $('#borderPvLegend').textContent.trim()==='');
  ok('and it says this is the file itself',
     /as it downloads/i.test($('#borderPvNote').textContent), $('#borderPvNote').textContent);
  ok('the switch offers colour again', /colour/i.test($('#borderPvMode').textContent),
     $('#borderPvMode').textContent);
}

console.log('\n== the file on disk is one bit a pin either way ==');
{
  const Real = w.Blob;
  w.Blob = class extends Real { constructor(parts,opts){ super(parts,opts); written=parts[0]; } };
  for (const mode of ['black and white','colour']) {
    written=null;
    click($('#downloadBorder')); await wait(400);
    const b = Buffer.from(written);
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    ok(`written in ${mode}: one bit a pin`, dv.getUint16(28,true)===1, String(dv.getUint16(28,true)));
    ok(`written in ${mode}: uncompressed`, dv.getUint32(30,true)===0);
    ok(`written in ${mode}: two colours, black and white`,
       dv.getUint32(46,true)===2 && b[54]===0 && b[55]===0 && b[56]===0 && b[58]===255 && b[59]===255 && b[60]===255);
    click($('#borderPvMode')); await wait(400);      // and again from the other view
  }
  w.Blob = Real;
}

console.log('\n== result ==');
if (errors.length){ console.log('  '+errors.length+' problem(s)'); errors.forEach(e=>console.log('   - '+e)); }
else console.log('  no errors');
process.exit(errors.length?1:0);
