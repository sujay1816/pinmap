import fs from 'fs';
import { decodeBMP, fitToPins, boxRow, boxPlan, compose, state, freshWefts } from '../core.mjs';
import { fileURLToPath as __f } from 'url';
import { dirname as __d, join as __j } from 'path';
const U = __j(__d(__f(import.meta.url)), '..', 'fixtures') + '/';


let pass=0, fail=0;
const ok=(n,c,e='')=>{ c?(pass++,console.log('  ok   '+n)):(fail++,console.log('  FAIL '+n+(e?'  -> '+e:''))); };
const head=t=>console.log('\n== '+t+' ==');

const rd=p=>{const b=fs.readFileSync(p);return decodeBMP(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));};
const men=rd(U+'720_butta_menna.bmp'), res=rd(U+'720_butta_resham.bmp'), jar=rd(U+'720_butta_jari.bmp');

head('the pattern for each weft, on a line that carries butta');
ok('rani  = all four black',      boxRow(4,0,3,true).join('')==='1111', boxRow(4,0,3,true).join(''));
ok('zari  = first side black',    boxRow(4,1,3,true).join('')==='1100', boxRow(4,1,3,true).join(''));
ok('meena = second side black',   boxRow(4,2,3,true).join('')==='0011', boxRow(4,2,3,true).join(''));
ok('meena 2 = all white',         boxRow(4,3,4,true).join('')==='0000', boxRow(4,3,4,true).join(''));
ok('six pins split three and three',
   boxRow(6,1,3,true).join('')==='111000' && boxRow(6,2,3,true).join('')==='000111');

head('how many files there are');
ok('one weft: white, butta or not',
   boxRow(4,0,1,true).join('')==='0000' && boxRow(4,0,1,false).join('')==='0000');
ok('two wefts: every pin over butta',
   boxRow(4,0,2,true).join('')==='1111' && boxRow(4,1,2,true).join('')==='1111');
ok('two wefts: white where the figure weft has nothing',
   boxRow(4,0,2,false).join('')==='0000' && boxRow(4,1,2,false).join('')==='0000',
   boxRow(4,0,2,false).join('')+' '+boxRow(4,1,2,false).join(''));
ok('three wefts: white where there is no butta',
   boxRow(4,0,3,false).join('')==='0000' && boxRow(4,1,3,false).join('')==='0000' &&
   boxRow(4,2,3,false).join('')==='0000');
ok('four wefts: same, white where there is no butta',
   [0,1,2,3].every(i => boxRow(4,i,4,false).join('')==='0000'));

head('in a real build');
const build = (wefts) => {
  state.segments=[{ id:'bx', kind:'box', count:4 },{ id:'bd', kind:'body', count:720 }];
  state.totalDeclared=724;
  state.opts={achuStartsBlack:true,pinOneLeft:true,topRowFirstPick:true,blackIsIndexZero:true,
              stackMode:'interleave',achuOnBody:false,satinWarpFaced:false,autoRotate:true,boxWholeBand:true};
  state.borderFiles={};
  state.wefts=freshWefts();
  wefts.forEach((f,i)=>{ state.wefts[i].file=fitToPins(f,720); });
  return compose();
};
const boxAt = (o,y) => [0,1,2,3].map(x=>o.bits[y*o.width+x]).join('');

let out = build([res,jar,men]);          // rani, zari, meena
ok('720 x 1500', out.width===724 && out.height===1500);
ok('200 of 500 design lines carry butta',
   out.figureOnLine.reduce((a,b)=>a+b,0)===200, String(out.figureOnLine.reduce((a,b)=>a+b,0)));

let firstButta=0; while(!out.figureOnLine[firstButta]) firstButta++;
ok('plain ground before the butta is white',
   boxAt(out,0)==='0000' && boxAt(out,1)==='0000' && boxAt(out,2)==='0000');
ok('the line before the butta is still white',
   boxAt(out,(firstButta-1)*3)==='0000');
ok('the butta line switches the box on',
   boxAt(out,firstButta*3)==='1111' &&
   boxAt(out,firstButta*3+1)==='1100' &&
   boxAt(out,firstButta*3+2)==='0011',
   [0,1,2].map(k=>boxAt(out,firstButta*3+k)).join(' '));

let lastButta=out.figureOnLine.length-1; while(!out.figureOnLine[lastButta]) lastButta--;
ok('the box goes white again once the butta ends',
   boxAt(out,(lastButta+1)*3)==='0000' && boxAt(out,(lastButta+1)*3+1)==='0000');
{
  let wrong=0;
  for (let d=0; d<500; d++) {
    const want = out.figureOnLine[d];
    for (let k=0;k<3;k++) {
      const lit = boxAt(out,d*3+k) !== '0000';
      if (lit !== !!want) wrong++;
    }
  }
  ok('every line agrees: box speaks only over butta', wrong===0, String(wrong));
}

head('two wefts follow the figure weft');
out = build([res,jar]);          // rani is the ground, jari carries the butta
{
  let lit=0, plain=0, wrong=0;
  for (let y=0;y<out.height;y++) {
    const on = boxAt(out,y)!=='0000';
    const want = !!out.figureOnLine[Math.floor(y/2)];
    if (on) lit++; else plain++;
    if (on !== want) wrong++;
    if (on && boxAt(out,y)!=='1111') wrong++;
  }
  ok('the box lifts on some lines and not others', lit>0 && plain>0, `${lit} lit, ${plain} plain`);
  ok('every line agrees with where the figure weft has design', wrong===0, String(wrong));
  ok('and where it lifts, all four pins lift', (()=>{
    for (let y=0;y<out.height;y++) { const b=boxAt(out,y); if (b!=='0000' && b!=='1111') return false; }
    return true; })());
}
head('one weft stays white throughout');
out = build([res]);
{
  let notWhite=0;
  for (let y=0;y<out.height;y++) if (boxAt(out,y)!=='0000') notWhite++;
  ok('all 500 lines are 0000', notWhite===0, String(notWhite));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail?1:0);
