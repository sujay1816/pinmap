import fs from 'fs';
import { decodeBMP, fitToPins, compose, state, freshWefts, weftBoxPattern, defaultBoxPattern } from '../core.mjs';
import { fileURLToPath as __f } from 'url';
import { dirname as __d, join as __j } from 'path';
const U = __j(__d(__f(import.meta.url)), '..', 'fixtures') + '/';


let pass=0, fail=0;
const ok=(n,c,e='')=>{ c?(pass++,console.log('  ok   '+n)):(fail++,console.log('  FAIL '+n+(e?'  -> '+e:''))); };
const head=t=>console.log('\n== '+t+' ==');
const str=a=>Array.from(a).join('');

const rd=p=>{const b=fs.readFileSync(p);return decodeBMP(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));};
const men=rd(U+'720_butta_menna.bmp'), res=rd(U+'720_butta_resham.bmp'), jar=rd(U+'720_butta_jari.bmp');

head('untouched wefts follow the standard table');
ok('rani all, zari first, meena second',
   str(weftBoxPattern({},4,0,3))==='1111' &&
   str(weftBoxPattern({},4,1,3))==='1100' &&
   str(weftBoxPattern({},4,2,3))==='0011');
ok('a weft with no pattern of its own falls back', str(weftBoxPattern({box:null},4,1,3))==='1100');
ok('a pattern of the wrong width is ignored', str(weftBoxPattern({box:'11'},4,1,3))==='1100');

head('a pattern the user sets');
ok('used exactly as given', str(weftBoxPattern({box:'1010'},4,1,3))==='1010');
ok('any combination is allowed, not just halves',
   str(weftBoxPattern({box:'0110'},4,0,3))==='0110' &&
   str(weftBoxPattern({box:'1001'},4,2,3))==='1001');
ok('all-white is allowed', str(weftBoxPattern({box:'0000'},4,0,3))==='0000');
ok('six pins take a six-long pattern', str(weftBoxPattern({box:'101010'},6,1,3))==='101010');

head('it reaches the built file');
const build = (patterns) => {
  state.segments=[{id:'bx',kind:'box',count:4},{id:'bd',kind:'body',count:720}];
  state.totalDeclared=724; state.boxMotion='4x4';
  state.opts={achuStartsBlack:true,pinOneLeft:true,topRowFirstPick:true,blackIsIndexZero:true,
              stackMode:'interleave',achuOnBody:false,satinWarpFaced:false,autoRotate:true,
              boxWholeBand:true,weavePerDesignLine:true};
  state.borderFiles={}; state.wefts=freshWefts();
  [res,jar,men].forEach((f,i)=>{ state.wefts[i].file=fitToPins(f,720); });
  (patterns||[]).forEach((p,i)=>{ if(p) state.wefts[i].box=p; });
  return compose();
};
const boxAt=(o,y)=>[0,1,2,3].map(x=>o.bits[y*o.width+x]).join('');
let o = build();
let firstButta=0; while(boxAt(o,firstButta)==='0000') firstButta++;
ok('standard patterns appear over butta',
   boxAt(o,firstButta)==='1111' && boxAt(o,firstButta+1)==='1100' && boxAt(o,firstButta+2)==='0011');

o = build(['0110','1001','0011']);
ok('custom patterns appear instead',
   boxAt(o,firstButta)==='0110' && boxAt(o,firstButta+1)==='1001' && boxAt(o,firstButta+2)==='0011',
   [0,1,2].map(k=>boxAt(o,firstButta+k)).join(' '));
ok('plain ground still holds the box white',
   boxAt(o,0)==='0000' && boxAt(o,1)==='0000' && boxAt(o,2)==='0000');
{
  let wrong=0;
  for (let d=0; d<500; d++) {
    const lit = out => out !== '0000';
    for (let k=0;k<3;k++) if (lit(boxAt(o,d*3+k)) !== !!o.figureOnLine[d]) wrong++;
  }
  ok('every line still agrees with the butta test', wrong===0, String(wrong));
}

head('turning a weft fully white');
o = build([null,'0000',null]);
ok('that weft goes white while the others keep their pattern',
   boxAt(o,firstButta)==='1111' && boxAt(o,firstButta+1)==='0000' && boxAt(o,firstButta+2)==='0011',
   [0,1,2].map(k=>boxAt(o,firstButta+k)).join(' '));

head('two wefts, where the box is normally black throughout');
{
  state.segments=[{id:'bx',kind:'box',count:4},{id:'bd',kind:'body',count:720}];
  state.totalDeclared=724; state.boxMotion='4x4';
  state.opts={achuStartsBlack:true,pinOneLeft:true,topRowFirstPick:true,blackIsIndexZero:true,
              stackMode:'interleave',achuOnBody:false,satinWarpFaced:false,autoRotate:true,
              boxWholeBand:true,weavePerDesignLine:true};
  state.borderFiles={}; state.wefts=freshWefts();
  state.wefts[0].file=fitToPins(res,720); state.wefts[1].file=fitToPins(jar,720);
  let two = compose();
  ok('default is black on every line', boxAt(two,0)==='1111' && boxAt(two,7)==='1111');
  state.wefts[1].box='1100';
  two = compose();
  ok('a custom pattern applies on every line too',
     boxAt(two,0)==='1111' && boxAt(two,1)==='1100' && boxAt(two,2)==='1111' && boxAt(two,3)==='1100',
     [0,1,2,3].map(y=>boxAt(two,y)).join(' '));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail?1:0);
