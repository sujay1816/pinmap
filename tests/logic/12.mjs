import fs from 'fs';
import { decodeBMP, fitToPins, compose, state, freshWefts, satinRow, achuRow } from '../core.mjs';
import { fileURLToPath as __f } from 'url';
import { dirname as __d, join as __j } from 'path';
const U = __j(__d(__f(import.meta.url)), '..', 'fixtures') + '/';


let pass=0, fail=0;
const ok=(n,c,e='')=>{ c?(pass++,console.log('  ok   '+n)):(fail++,console.log('  FAIL '+n+(e?'  -> '+e:''))); };
const head=t=>console.log('\n== '+t+' ==');

const rd=p=>{const b=fs.readFileSync(p);return decodeBMP(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));};
const men=rd(U+'720_butta_menna.bmp'), res=rd(U+'720_butta_resham.bmp'), jar=rd(U+'720_butta_jari.bmp');

const build = (motion, K=3, perLine=true) => {
  state.segments=[{id:'a1',kind:'achu',count:4},
                  {id:'lk',kind:'locking',count:8,weave:'satin:8:3'},
                  {id:'bd',kind:'body',count:720}];
  state.totalDeclared=732; state.boxMotion=motion;
  state.opts={achuStartsBlack:true,pinOneLeft:true,topRowFirstPick:true,blackIsIndexZero:true,
              stackMode:'interleave',achuOnBody:false,satinWarpFaced:false,autoRotate:true,
              boxWholeBand:true,weavePerDesignLine:perLine};
  state.borderFiles={}; state.wefts=freshWefts();
  [res,jar,men].slice(0,K).forEach((f,i)=>{ state.wefts[i].file=fitToPins(f,720); });
  return compose();
};
const lockAt=(o,y)=>{ for(let x=4;x<12;x++) if(o.bits[y*o.width+x]) return x-4; return -1; };
const achuAt=(o,y)=>[0,1,2,3].map(x=>o.bits[y*o.width+x]).join('');

head('every weft file carries the whole locking weave');
let o = build('4x4');
for (let k=0;k<3;k++){
  const seq=[]; for(let n=0;n<8;n++) seq.push(lockAt(o, n*3+k));
  ok(`weft ${k+1} runs the 8-end satin 0,3,6,1,4,7,2,5`,
     seq.join(',')==='0,3,6,1,4,7,2,5', seq.join(','));
}
ok('all three wefts of a design line share the same locking line',
   lockAt(o,0)===lockAt(o,1) && lockAt(o,1)===lockAt(o,2) &&
   lockAt(o,3)===lockAt(o,4) && lockAt(o,4)===lockAt(o,5));
ok('and it advances on the next design line', lockAt(o,0)!==lockAt(o,3));

head('achu too');
ok('all three picks of a design line share an achu line',
   achuAt(o,0)===achuAt(o,1) && achuAt(o,1)===achuAt(o,2));
ok('and it flips on the next design line', achuAt(o,0)!==achuAt(o,3));
for (let k=0;k<3;k++){
  const a=achuAt(o,k), b=achuAt(o,3+k);
  ok(`weft ${k+1} sees the achu flip line to line`, a!==b, a+' / '+b);
}

head('with two wefts, where the old way failed outright');
o = build('4x4', 2);
ok('achu still flips for each weft', achuAt(o,0)!==achuAt(o,2), achuAt(o,0)+' / '+achuAt(o,2));
{
  const seq=[]; for(let n=0;n<8;n++) seq.push(lockAt(o, n*2));
  ok('weft 1 still gets a proper satin', seq.join(',')==='0,3,6,1,4,7,2,5', seq.join(','));
}

head('on a 2 by 1 loom');
o = build('2x1');
ok('the locking follows the design line, not the shuttle',
   lockAt(o,0)!==lockAt(o,1) && lockAt(o,0)===lockAt(o,2) && lockAt(o,1)===lockAt(o,3),
   [0,1,2,3].map(y=>lockAt(o,y)).join(','));
{
  const seen=new Map();
  for(let y=0;y<o.height;y++){
    const d=o.rowDesign[y], v=lockAt(o,y);
    if(seen.has(d) && seen.get(d)!==v){ seen.set('bad',1); break; }
    seen.set(d,v);
  }
  ok('a design line always gets the same locking line, whichever shuttle', !seen.has('bad'));
}

head('the old behaviour is still reachable');
o = build('4x4', 3, false);
{
  const seq=[]; for(let n=0;n<8;n++) seq.push(lockAt(o, n*3));
  ok('stepping per pick spreads the weave across the wefts',
     seq.join(',')!=='0,3,6,1,4,7,2,5', seq.join(','));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail?1:0);
