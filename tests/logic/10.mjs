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
const s4=rd(U+'IMG_2413.BMP'), s21=rd(U+'IMG_2414__1_.BMP');

const build = (motion, box=0) => {
  state.segments = box ? [{id:'bx',kind:'box',count:box},{id:'bd',kind:'body',count:720}]
                       : [{id:'bd',kind:'body',count:720}];
  state.totalDeclared = 720 + box;
  state.boxMotion = motion;
  state.opts={achuStartsBlack:true,pinOneLeft:true,topRowFirstPick:true,blackIsIndexZero:true,
              stackMode:'interleave',achuOnBody:false,satinWarpFaced:false,autoRotate:true,boxWholeBand:true};
  state.borderFiles={};
  state.wefts=freshWefts();
  state.wefts[0].name='Rani';  state.wefts[0].file=fitToPins(res,720);
  state.wefts[1].name='Zari';  state.wefts[1].file=fitToPins(jar,720);
  state.wefts[2].name='Meena'; state.wefts[2].file=fitToPins(men,720);
  return compose();
};
const diff=(a,b)=>{let d=0;for(let i=0;i<b.length;i++) if(a[i]!==b[i])d++;return d;};

head('both samples, from the same three files');
let o4 = build('4x4');
ok('4 by 4 matches its sample, pin for pin', diff(o4.bits, s4.bits)===0, diff(o4.bits,s4.bits)+' differ');
ok('one line per shuttle', o4.perShuttle===1);

let o21 = build('4x1');
ok('4 by 1 matches its sample, pin for pin', diff(o21.bits, s21.bits)===0, diff(o21.bits,s21.bits)+' differ');
ok('two lines per shuttle', o21.perShuttle===2);

head('same cloth, different order');
ok('both are 720 x 1500', o4.width===720 && o4.height===1500 && o21.width===720 && o21.height===1500);
ok('both lift 192264 pins',
   o4.bits.reduce((a,b)=>a+b,0)===192264 && o21.bits.reduce((a,b)=>a+b,0)===192264);
ok('but the files are not the same', diff(o4.bits,o21.bits) > 0);

head('the pick order itself');
ok('4 by 4 runs r j m r j m',
   o4.rowWeft[0]===0 && o4.rowWeft[1]===1 && o4.rowWeft[2]===2 && o4.rowWeft[3]===0);
ok('4 by 4 advances the design line every pick',
   o4.rowDesign[0]===0 && o4.rowDesign[3]===1 && o4.rowDesign[6]===2);
ok('4 by 1 runs r r j j m m',
   o21.rowWeft[0]===0 && o21.rowWeft[1]===0 && o21.rowWeft[2]===1 &&
   o21.rowWeft[3]===1 && o21.rowWeft[4]===2 && o21.rowWeft[5]===2,
   Array.from(o21.rowWeft.slice(0,6)).join(','));
ok('4 by 1 pairs the design lines',
   o21.rowDesign[0]===0 && o21.rowDesign[1]===1 && o21.rowDesign[2]===0 &&
   o21.rowDesign[3]===1 && o21.rowDesign[6]===2 && o21.rowDesign[7]===3,
   Array.from(o21.rowDesign.slice(0,8)).join(','));
ok('every design line appears exactly three times in each', (()=>{
  for (const o of [o4,o21]) {
    const seen=new Array(500).fill(0);
    for (let y=0;y<o.height;y++) seen[o.rowDesign[y]]++;
    if (!seen.every(v=>v===3)) return false;
  }
  return true; })());

head('the box on a 4 by 1');
o21 = build('4x1', 4);
const boxAt=(o,y)=>[0,1,2,3].map(x=>o.bits[y*o.width+x]).join('');
ok('holds its value across a shuttle pair',
   boxAt(o21,0)===boxAt(o21,1) && boxAt(o21,2)===boxAt(o21,3) && boxAt(o21,4)===boxAt(o21,5),
   [0,1,2,3,4,5].map(y=>boxAt(o21,y)).join(' '));
{
  let held=true;
  for (let y=0;y<o21.height;y+=2) if (boxAt(o21,y)!==boxAt(o21,y+1)) { held=false; break; }
  ok('never changes part way through a shuttle run', held);
}
{
  let firstLit=0; while(boxAt(o21,firstLit)==='0000') firstLit++;
  ok('over butta the pattern is rani all, zari first, meena second',
     boxAt(o21,firstLit)==='1111' && boxAt(o21,firstLit+2)==='1100' && boxAt(o21,firstLit+4)==='0011',
     [0,2,4].map(k=>boxAt(o21,firstLit+k)).join(' '));
}
o4 = build('4x4', 4);
ok('4 by 4 still changes every pick',
   boxAt(o4,0)!==boxAt(o4,1) || o4.figureOnLine[0]===0);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail?1:0);
