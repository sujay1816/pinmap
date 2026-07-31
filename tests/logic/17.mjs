import fs from 'fs';
import { fileURLToPath as __f } from 'url';
import { dirname as __d, join as __j } from 'path';
import { decodeBMP, fitToPins, compose, state, freshWefts, achuRow } from '../core.mjs';
const U = __j(__d(__f(import.meta.url)), '..', 'fixtures') + '/';
let pass=0, fail=0;
const ok=(n,c,e='')=>{ c?(pass++,console.log('  ok   '+n)):(fail++,console.log('  FAIL '+n+(e?'  -> '+e:''))); };
const head=t=>console.log('\n== '+t+' ==');
const rd=p=>{const b=fs.readFileSync(p);return decodeBMP(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));};
const men=rd(U+'720_butta_menna.bmp'), res=rd(U+'720_butta_resham.bmp'), jar=rd(U+'720_butta_jari.bmp');

const build = (slots, borders) => {
  state.segments=[{id:'a1',kind:'achu',count:4},
                  {id:'lk',kind:'locking',count:8,weave:'satin:8:3'},
                  {id:'lb',kind:'leftBorder',count:100},
                  {id:'bd',kind:'body',count:720}];
  state.totalDeclared=832; state.boxMotion='4x4';
  state.opts={achuStartsBlack:true,pinOneLeft:true,topRowFirstPick:true,blackIsIndexZero:true,
              stackMode:'interleave',achuOnBody:false,satinWarpFaced:false,autoRotate:true,
              boxWholeBand:true,weavePerDesignLine:true};
  state.borderFiles = borders || {};
  state.wefts=freshWefts();
  slots.forEach((f,i)=>{ if(f) state.wefts[i].file=fitToPins(f,720); });
  return compose();
};
const achuAt=(o,y)=>[0,1,2,3].map(x=>o.bits[y*o.width+x]).join('');
const lockLit=(o)=>{ let n=0; for(let y=0;y<o.height;y++) for(let x=4;x<12;x++) if(o.bits[y*o.width+x]) n++; return n; };

head('achu waits for the rani');
{
  const o = build([res, jar, men]);
  ok('with rani loaded it lifts', achuAt(o,0)==='1100', achuAt(o,0));
}
{
  const o = build([null, jar, men]);          // the first slot left empty
  let lit=0; for(let y=0;y<o.height;y++) if(achuAt(o,y)!=='0000') lit++;
  ok('with the first slot empty it stays down', lit===0, String(lit)+' lines lift');
}
{
  const o = build([], { lb: { width:100, height:720, bits:new Uint8Array(100*720) } });
  let lit=0; for(let y=0;y<o.height;y++) if(achuAt(o,y)!=='0000') lit++;
  ok('a border-only job leaves it down too', lit===0, String(lit));
}
{
  const o = build([res]);
  ok('rani alone is enough', achuAt(o,0)==='1100', achuAt(o,0));
}

head('achu does not care how many files there are');
{
  const one = build([res]), two = build([res,jar]), three = build([res,jar,men]);
  const first = (o) => achuAt(o,0);
  ok('the same first line with one, two or three',
     first(one)===first(two) && first(two)===first(three),
     [first(one),first(two),first(three)].join(' '));
  ok('and it still flips line to line',
     achuAt(three,0)!==achuAt(three,3), achuAt(three,0)+' / '+achuAt(three,3));
}

head('locking is unaffected by the rani rule');
{
  const withRani = build([res,jar,men]);
  const noRani   = build([null,jar,men]);
  ok('locking lifts with rani', lockLit(withRani) === withRani.height, String(lockLit(withRani)));
  ok('and still lifts without it', lockLit(noRani) === noRani.height, String(lockLit(noRani)));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail?1:0);
