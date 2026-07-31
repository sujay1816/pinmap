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

head('achu alternates on every pick, whatever the file count');
{
  const eight = o => [0,1,2,3,4,5,6,7].map(y => achuAt(o,y)).join(' ');
  const want = '1100 0011 1100 0011 1100 0011 1100 0011';
  ok('one weft',    eight(build([res]))===want,          eight(build([res])));
  ok('two wefts',   eight(build([res,jar]))===want,      eight(build([res,jar])));
  ok('three wefts', eight(build([res,jar,men]))===want,  eight(build([res,jar,men])));
  ok('it never holds for two lines running', (()=>{
    const o = build([res,jar,men]);
    for (let y=1;y<40;y++) if (achuAt(o,y)===achuAt(o,y-1)) return false;
    return true; })());
}

head('locking still belongs to the design line');
{
  const o = build([res,jar,men]);
  const lock = y => { for (let x=4;x<12;x++) if (o.bits[y*o.width+x]) return x-4; return -1; };
  ok('all three picks of a line bind the same way',
     lock(0)===lock(1) && lock(1)===lock(2), [lock(0),lock(1),lock(2)].join(','));
  ok('and the next line binds differently', lock(0)!==lock(3), lock(0)+' / '+lock(3));
}

head('with a border loaded');
{
  const border = { lb: { width:100, height:720, bits:(()=>{ const b=new Uint8Array(100*720); b.fill(1); return b; })() } };
  const o = build([res,jar,men], border);
  const eight = [0,1,2,3,4,5,6,7].map(y => achuAt(o,y)).join(' ');
  ok('achu still alternates every pick', eight==='1100 0011 1100 0011 1100 0011 1100 0011', eight);
  const lock = y => { for (let x=4;x<12;x++) if (o.bits[y*o.width+x]) return x-4; return -1; };
  ok('locking still shared across the picks', lock(0)===lock(1) && lock(1)===lock(2));
  ok('the border itself is carried', (()=>{
    for (let x=0;x<100;x++) if (!o.bits[12+x]) return false;   // achu 4 + locking 8 = 12
    return true; })());
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
