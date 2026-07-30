import fs from 'fs';
import { decodeBMP, rotateCCW, fitToPins, compose, state, freshWefts } from '../core.mjs';
import { fileURLToPath as __f } from 'url';
import { dirname as __d, join as __j } from 'path';
const U = __j(__d(__f(import.meta.url)), '..', 'fixtures') + '/';


let pass=0, fail=0;
const ok=(n,c,e='')=>{ c?(pass++,console.log('  ok   '+n)):(fail++,console.log('  FAIL '+n+(e?'  -> '+e:''))); };
const head=t=>console.log('\n== '+t+' ==');

const rd=p=>{const b=fs.readFileSync(p);return decodeBMP(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));};
const men=rd(U+'720_butta_menna.bmp'), res=rd(U+'720_butta_resham.bmp'), jar=rd(U+'720_butta_jari.bmp');
const target=rd(U+'IMG_2413.BMP');

head('turning a file a quarter turn');
{
  const r = rotateCCW(men);
  ok('500 x 720 becomes 720 x 500', r.width===720 && r.height===500, `${r.width}x${r.height}`);
  ok('no pin is gained or lost',
     r.bits.reduce((a,b)=>a+b,0) === men.bits.reduce((a,b)=>a+b,0));
  ok('marked as turned', r.rotated === true);
  // anticlockwise: out[i][j] = src[j][W-1-i]
  let good = true;
  for (let i=0;i<500 && good;i++)
    for (let j=0;j<720;j++)
      if (r.bits[i*720+j] !== men.bits[j*500 + (499-i)]) { good=false; break; }
  ok('turned anticlockwise, not clockwise', good);
  const back = rotateCCW(rotateCCW(rotateCCW(rotateCCW(men))));
  ok('four turns come back to the start',
     back.width===men.width && back.height===men.height &&
     back.bits.every((v,i)=>v===men.bits[i]));
}

head('only turned when that is what fits');
ok('a 500-wide file into 720 pins gets turned', fitToPins(men,720).width===720);
ok('a 500-wide file into 500 pins is left alone', fitToPins(men,500).rotated===undefined);
ok('a file that fits neither is left alone', fitToPins(men,333).width===500);
ok('turning is skipped when the width already matches',
   fitToPins(rotateCCW(men),720).width===720);

head('reproducing the sample exactly');
state.segments=[{ id:'bd', kind:'body', count:720 }];
state.totalDeclared=720;
state.opts={achuStartsBlack:true,pinOneLeft:true,topRowFirstPick:true,blackIsIndexZero:true,
            stackMode:'interleave',achuOnBody:true,satinWarpFaced:false,autoRotate:true,boxWholeBand:true};
state.borderFiles={};
state.wefts=freshWefts();
state.wefts[0].file=fitToPins(res,720);
state.wefts[1].file=fitToPins(jar,720);
state.wefts[2].file=fitToPins(men,720);
let out=compose();
ok('720 pins x 1500 lines', out.width===720 && out.height===1500, `${out.width}x${out.height}`);
ok('192264 pins lifted', out.bits.reduce((a,b)=>a+b,0)===192264);
{
  let diff=0;
  for (let i=0;i<target.bits.length;i++) if (out.bits[i]!==target.bits[i]) diff++;
  ok('identical to the sample, pin for pin', diff===0, diff+' pins differ');
}
ok('line 1 is the ground weft, 360 lifts', (()=>{
  let n=0; for(let x=0;x<720;x++) if(out.bits[x]) n++; return n===360; })());
ok('lines 2 and 3 are the figure wefts', (()=>{
  let a=0,b=0;
  for(let x=0;x<720;x++){ if(out.bits[720+x]) a++; if(out.bits[1440+x]) b++; }
  return a===0 && b===0; })());

head('slot order sets the shuttle order');
state.wefts[0].file=fitToPins(men,720);
state.wefts[1].file=fitToPins(res,720);
state.wefts[2].file=fitToPins(jar,720);
out=compose();
{
  let diff=0;
  for (let i=0;i<target.bits.length;i++) if (out.bits[i]!==target.bits[i]) diff++;
  ok('a different slot order gives a different file', diff>0, String(diff));
  ok('but the same number of lifted pins', out.bits.reduce((a,b)=>a+b,0)===192264);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail?1:0);
