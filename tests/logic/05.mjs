import fs from 'fs';
import { decodeBMP, encodeBMP1, compose, state, freshWefts, achuRow } from '../core.mjs';
import { fileURLToPath as __f } from 'url';
import { dirname as __d, join as __j } from 'path';
const U = __j(__d(__f(import.meta.url)), '..', 'fixtures') + '/';


let pass=0, fail=0;
const ok=(n,c,e='')=>{ c?(pass++,console.log('  ok   '+n)):(fail++,console.log('  FAIL '+n+(e?'  -> '+e:''))); };
const head=t=>console.log('\n== '+t+' ==');

const rd=p=>{const b=fs.readFileSync(p);return decodeBMP(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));};
const men=rd(U+'720_butta_menna.bmp'), res=rd(U+'720_butta_resham.bmp'), jar=rd(U+'720_butta_jari.bmp');
const crop=(f,w)=>{const b=new Uint8Array(w*f.height);
  for(let y=0;y<f.height;y++) for(let x=0;x<w;x++) b[y*w+x]=f.bits[y*f.width+x];
  return {width:w,height:f.height,bits:b,name:'crop'};};

const setup = (segs, total) => {
  state.segments = segs;
  state.totalDeclared = total;
  state.opts = { achuStartsBlack:true, pinOneLeft:true, topRowFirstPick:true,
                 blackIsIndexZero:true, stackMode:'overlay', achuOnBody:true, achuInBody:true, satinWarpFaced:false };
  state.borderFiles = {};
  state.wefts = freshWefts();
};

head('body only: three wefts merged onto one line each');
setup([{ id:'bd', kind:'body', count:500 }], 500);
state.wefts[0].file=men; state.wefts[1].file=res; state.wefts[2].file=jar;
let out = compose('body');
ok('flagged as overlay', out.overlay === true);
ok('height stays at the design height', out.height === 720, out.height);
ok('width 500', out.width === 500);
ok('all three wefts counted', out.weftCount === 3);
{
  let exact = true;
  for (let i=0;i<men.bits.length;i++) {
    const want = (men.bits[i] || res.bits[i] || jar.bits[i]) ? 1 : 0;
    if (out.bits[i] !== want) { exact = false; break; }
  }
  ok('body equals menna OR resham OR jari, pin for pin', exact);
}
{
  let lifted=0; for (const v of out.bits) lifted+=v;
  ok('192264 pins lifted, nothing lost or invented', lifted === 192264, String(lifted));
}
ok('each weft still contributes', (() => {
  let mOnly=0, jOnly=0, rOnly=0;
  for (let i=0;i<men.bits.length;i++) {
    if (men.bits[i]) mOnly++; if (jar.bits[i]) jOnly++; if (res.bits[i]) rOnly++;
  }
  return mOnly===11714 && jOnly===11714 && rOnly===168836;
})());

head('the merge is lossless because the wefts never clash');
{
  let clash=0;
  for (let i=0;i<men.bits.length;i++)
    if (men.bits[i]+res.bits[i]+jar.bits[i] > 1) clash++;
  ok('no pin is claimed by two wefts', clash===0, String(clash));
  // so each weft can still be recovered from the merge
  let recoverable = true;
  for (let i=0;i<men.bits.length && recoverable;i++)
    if (men.bits[i] && !out.bits[i]) recoverable = false;
  ok('every menna lift survives the merge', recoverable);
}

head('one and two wefts');
setup([{ id:'bd', kind:'body', count:500 }], 500);
state.wefts[0].file=men;
out = compose('body');
ok('single weft passes straight through', (() => {
  for (let i=0;i<men.bits.length;i++) if (out.bits[i]!==men.bits[i]) return false;
  return true;
})());
ok('height unchanged at 720', out.height===720);
state.wefts[1].file=res;
out = compose('body');
ok('two wefts still 720 lines', out.height===720);
{
  let exact=true;
  for (let i=0;i<men.bits.length;i++) {
    const want=(men.bits[i]||res.bits[i])?1:0;
    if (out.bits[i]!==want){exact=false;break;}
  }
  ok('two wefts merge correctly', exact);
}

head('with the full pin map around it');
const segs=[
  { id:'a1', kind:'achu',        count:4   },
  { id:'bx', kind:'box',         count:4   },
  { id:'lb', kind:'leftBorder',  count:100 },
  { id:'lk', kind:'locking',     count:8   },
  { id:'bd', kind:'body',        count:500 },
  { id:'rb', kind:'rightBorder', count:100 },
  { id:'a2', kind:'achu',        count:4   }
];
setup(segs, 720);
state.wefts[0].file=men; state.wefts[1].file=res; state.wefts[2].file=jar;
state.borderFiles.lb = crop(men,100); state.borderFiles.rb = crop(res,100);
out = compose('body');
const at={}; { let a=0; segs.forEach(s=>{at[s.id]=a;a+=s.count;}); }
ok('720 pins wide, 720 lines tall', out.width===720 && out.height===720);
{
  let exact=true;
  for (let y=0;y<720 && exact;y++)
    for (let x=0;x<500;x++) {
      const want=(men.bits[y*500+x]||res.bits[y*500+x]||jar.bits[y*500+x])?1:0;
      if (out.bits[y*720+at.bd+x]!==want){exact=false;break;}
    }
  ok('body region is the merged design', exact);
}
{
  const bOut = compose('border');
  const lf=crop(men,100);
  let exact=true;
  for (let y=0;y<bOut.height && exact;y++)
    for (let x=0;x<100;x++)
      if (bOut.bits[y*bOut.width+at.lb+x]!==lf.bits[y*100+x]){exact=false;break;}
  ok('the border file reads line for line', exact);
  ok('and the body file leaves the border pins down', (()=>{
    for (let y=0;y<out.height;y++) for (let x=0;x<100;x++) if (out.bits[y*720+at.lb+x]) return false;
    return true; })());
}
{
  let lk=0;
  for (let y=0;y<720;y++) for (let x=0;x<8;x++) if (out.bits[y*720+at.lk+x]) lk++;
  ok('locking satin still one pin per line', lk===720, String(lk));
}
ok('achu is in the border file, not the body', (()=>{
  const bOut = compose('border');
  const inBorder = Array.from(bOut.bits.slice(at.a1,at.a1+4)).join('')==='1100';
  let inBody=false;
  for (let y=0;y<out.height && !inBody;y++) for (let x=0;x<4;x++) if (out.bits[y*720+at.a1+x]) inBody=true;
  return inBorder && !inBody; })());

head('interleave is still available');
state.opts.stackMode = 'interleave';
out = compose('body');
ok('interleave gives a line per weft again', out.height===2160, out.height);
ok('not flagged as overlay', out.overlay === false);
state.opts.stackMode = 'overlay';

head('achu ground under a merged body');
setup([{ id:'a1', kind:'achu', count:4 },{ id:'bd', kind:'body', count:500 }], 504);
state.wefts[0].file=men;                       // no border, no ground weft
out = compose('body');
{
  const g0=achuRow(4,0,true);
  let good=true;
  for (let x=0;x<500;x++) {
    const want = men.bits[x] || g0[x%4];
    if (out.bits[4+x] !== (want?1:0)) { good=false; break; }
  }
  ok('achu fills the gaps of a merged body too', good);
}

out = compose('body');
fs.writeFileSync('overlay.bmp', Buffer.from(encodeBMP1(out.bits,out.width,out.height,true)));
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail?1:0);
