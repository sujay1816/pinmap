import fs from 'fs';
import { SATIN_LIBRARY, satinRow, satinStep, stepIsValid, gcd, satinName,

         compose, state, freshWefts, decodeBMP, DEFAULT_LAYOUT } from '../core.mjs';
import { fileURLToPath as __f } from 'url';
import { dirname as __d, join as __j } from 'path';
const U = __j(__d(__f(import.meta.url)), '..', 'fixtures') + '/';

let pass=0, fail=0;
const ok=(n,c,e='')=>{ c?(pass++,console.log('  ok   '+n)):(fail++,console.log('  FAIL '+n+(e?'  -> '+e:''))); };
const head=t=>console.log('\n== '+t+' ==');

head('the weave gallery');
ok('library is not empty', SATIN_LIBRARY.length > 0, String(SATIN_LIBRARY.length));
console.log('   offered: ' + SATIN_LIBRARY.map(w=>satinName(w.repeat,w.step,w.satin)).join(', '));
ok('every entry states a pin count', SATIN_LIBRARY.every(w => Number.isInteger(w.repeat) && w.repeat >= 4));
ok('every step is valid for its repeat', SATIN_LIBRARY.every(w => stepIsValid(w.repeat, w.step)));
ok('true satins never step 1 or N-1',
   SATIN_LIBRARY.filter(w=>w.satin).every(w => w.step !== 1 && w.step !== w.repeat - 1));
ok('4 and 6 are marked as twills, not satins',
   SATIN_LIBRARY.filter(w=>[4,6].includes(w.repeat)).every(w => !w.satin));
ok('5, 7, 8, 10, 12, 16 are offered as satins',
   [5,7,8,10,12,16].every(n => SATIN_LIBRARY.some(w=>w.repeat===n && w.satin)));
ok('no duplicate repeat+step pairs',
   new Set(SATIN_LIBRARY.map(w=>w.repeat+':'+w.step)).size === SATIN_LIBRARY.length);
{
  const eight = SATIN_LIBRARY.filter(w=>w.repeat===8);
  ok('8-end offers both mirror images', eight.length===2 && eight.map(w=>w.step).sort((a,b)=>a-b).join(',')==='3,5',
     eight.map(w=>w.step).join(','));
  const a = Array.from({length:8},(_,r)=>satinRow(8,r,false,3).indexOf(1)).join(',');
  const b = Array.from({length:8},(_,r)=>satinRow(8,r,false,5).indexOf(1)).join(',');
  ok('the two run in opposite directions', a==='0,3,6,1,4,7,2,5' && b==='0,5,2,7,4,1,6,3', a+' | '+b);
}

head('every offered weave really is one interlacing per line');
ok('all tiles lift exactly one pin per line',
   SATIN_LIBRARY.every(w => Array.from({length:w.repeat},(_,r)=>satinRow(w.repeat,r,false,w.step))
     .every(row => row.reduce((x,y)=>x+y,0)===1)));
ok('all tiles use every pin once per repeat',
   SATIN_LIBRARY.every(w => new Set(Array.from({length:w.repeat},(_,r)=>satinRow(w.repeat,r,false,w.step).indexOf(1))).size===w.repeat));
ok('true satins never place interlacings side by side on consecutive lines',
   SATIN_LIBRARY.filter(w=>w.satin).every(w => {
     const c = Array.from({length:w.repeat},(_,r)=>satinRow(w.repeat,r,false,w.step).indexOf(1));
     for (let r=1;r<w.repeat;r++){ const d=Math.abs(c[r]-c[r-1]); if (d===1 || d===w.repeat-1) return false; }
     return true;
   }));

head('choosing a weave drives the build');
const bodyOnly = () => {
  state.totalDeclared = 0;
  state.opts = { achuStartsBlack:true, pinOneLeft:true, topRowFirstPick:true,
                 blackIsIndexZero:true, stackMode:'interleave', achuOnBody:true, achuInBody:true, satinWarpFaced:false };
  state.borderFiles = {};
  state.wefts = freshWefts();
};

const rd=p=>{const b=fs.readFileSync(p);return decodeBMP(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));};
const men=rd(U+'720_butta_menna.bmp');

for (const w of [{repeat:5,step:2},{repeat:8,step:3},{repeat:8,step:5},{repeat:12,step:5},{repeat:16,step:7}]) {
  bodyOnly();
  state.segments = [{ id:'lk', kind:'locking', count:w.repeat, weave:`satin:${w.repeat}:${w.step}` },
                    { id:'bd', kind:'body', count:500 }];
  state.wefts[0].file = men;
  const out = compose();
  const W = w.repeat + 500;
  const cols = [];
  for (let y=0;y<w.repeat;y++){
    let c=-1, n=0;
    for (let x=0;x<w.repeat;x++) if (out.bits[y*W+x]) { c=x; n++; }
    cols.push(n===1 ? c : 'x');
  }
  const expect = Array.from({length:w.repeat},(_,r)=>((r*w.step)%w.repeat)).join(',');
  ok(`${w.repeat}-end step ${w.step} builds as chosen`, cols.join(',')===expect, cols.join(',')+' vs '+expect);
}

head('a hand-typed count that breaks the step');
bodyOnly();
state.segments = [{ id:'lk', kind:'locking', count:9, weave:'satin:9:3' },   // 3 shares a factor with 9
                  { id:'bd', kind:'body', count:500 }];
state.wefts[0].file = men;
{
  const out = compose(), W = 509;
  let perLine = true;
  for (let y=0;y<20;y++){ let n=0; for (let x=0;x<9;x++) if (out.bits[y*W+x]) n++; if (n!==1) perLine=false; }
  ok('an invalid step falls back rather than breaking', perLine);
  ok('the fallback is a real satin for 9 pins', satinStep(9)===4 || gcd(satinStep(9),9)===1, String(satinStep(9)));
}

head('the standard layout ships with a working locking weave');
{
  const lk = DEFAULT_LAYOUT.find(g => g[0]==='locking');
  ok('locking is preset, not blank', lk[1]===8, String(lk[1]));
  ok('8 is in the gallery', SATIN_LIBRARY.some(w=>w.repeat===8));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail?1:0);
