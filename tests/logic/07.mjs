import fs from 'fs';
import { decodeBMP, fitToPins, compose, state, freshWefts } from '../core.mjs';
import { fileURLToPath as __f } from 'url';
import { dirname as __d, join as __j } from 'path';
const U = __j(__d(__f(import.meta.url)), '..', 'fixtures') + '/';


let pass=0, fail=0;
const ok=(n,c,e='')=>{ c?(pass++,console.log('  ok   '+n)):(fail++,console.log('  FAIL '+n+(e?'  -> '+e:''))); };
const head=t=>console.log('\n== '+t+' ==');

const rd=p=>{const b=fs.readFileSync(p);return decodeBMP(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));};
const men=rd(U+'720_butta_menna.bmp'), res=rd(U+'720_butta_resham.bmp'), jar=rd(U+'720_butta_jari.bmp');
const tgt=rd(U+'IMG_2413.BMP');

const A5 = [
  { id:'a1', kind:'achu',        count:4   },
  { id:'bx', kind:'box',         count:4   },
  { id:'lb', kind:'leftBorder',  count:500 },
  { id:'lk', kind:'locking',     count:8   },
  { id:'bd', kind:'body',        count:720 },
  { id:'rb', kind:'rightBorder', count:500 },
  { id:'a2', kind:'achu',        count:4   }
];
const load = () => {
  state.segments = A5; state.totalDeclared = 1792; state.borderFiles = {};
  state.wefts = freshWefts();
  state.wefts[0].file = fitToPins(res,720);
  state.wefts[1].file = fitToPins(jar,720);
  state.wefts[2].file = fitToPins(men,720);
  state.opts = { achuStartsBlack:true, pinOneLeft:true, topRowFirstPick:true, blackIsIndexZero:true,
                 stackMode:'interleave', achuOnBody:false, achuInBody:true, satinWarpFaced:false, autoRotate:true };
};
const bodyOf = o => { const b=new Uint8Array(720*1500);
  for(let y=0;y<1500;y++) for(let x=0;x<720;x++) b[y*720+x]=o.bits[y*o.width+516+x];
  return b; };
const diff=(a,b)=>{let d=0;for(let i=0;i<b.length;i++) if(a[i]!==b[i])d++;return d;};

head('the A-5 loom, three wefts, matched against the sample');
load();
let out = compose();
ok('file is 1792 pins x 1500 lines', out.width===1792 && out.height===1500, `${out.width}x${out.height}`);
ok('body matches the sample, pin for pin', diff(bodyOf(out), tgt.bits)===0,
   diff(bodyOf(out), tgt.bits)+' pins differ');
ok('body lifts 192264', bodyOf(out).reduce((a,b)=>a+b,0)===192264);

head('the body carries only its weft files');
ok('line 1 of the body is the ground weft alone, 360 lifts', (()=>{
  const b=bodyOf(out); let n=0; for(let x=0;x<720;x++) if(b[x]) n++; return n===360; })(),
  String((()=>{const b=bodyOf(out);let n=0;for(let x=0;x<720;x++) if(b[x])n++;return n;})()));
ok('lines 2 and 3 are blank where the figures are blank', (()=>{
  const b=bodyOf(out); let n=0;
  for(let x=0;x<720;x++){ if(b[720+x]) n++; if(b[1440+x]) n++; }
  return n===0; })());

head('unloaded borders stay blank without touching the body');
{
  let lb=0, rb=0;
  for (let y=0;y<1500;y++) {
    for (let x=8;x<508;x++)   if (out.bits[y*1792+x]) lb++;
    for (let x=1236;x<1736;x++) if (out.bits[y*1792+x]) rb++;
  }
  ok('left border blank', lb===0, String(lb));
  ok('right border blank', rb===0, String(rb));
}
ok('achu pins still generate', Array.from(out.bits.slice(0,4)).join('')==='1100');
ok('locking satin still one pin per line', (()=>{
  let n=0; for(let y=0;y<1500;y++) for(let x=508;x<516;x++) if(out.bits[y*1792+x]) n++;
  return n===1500; })());

head('the fill is still there if wanted');
state.opts.achuOnBody = true;
out = compose();
ok('turning it on changes the body', diff(bodyOf(out), tgt.bits) > 0);
ok('and adds lifts rather than removing them',
   bodyOf(out).reduce((a,b)=>a+b,0) > 192264);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail?1:0);
