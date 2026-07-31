// A weft with no design of its own must still be tied down.
//
// Sri Tex lay a plain ground under every weft, so each pick lifts about half.
// Without it a figure weft lifts almost nothing until its figure appears, and
// would float unbound.
import fs from 'fs';
import { fileURLToPath as __f } from 'url';
import { dirname as __d, join as __j } from 'path';
import { decodeBMP, fitToPins, compose, state, freshWefts } from '../core.mjs';
const U = __j(__d(__f(import.meta.url)), '..', 'fixtures') + '/';
let pass=0, fail=0;
const ok=(n,c,e='')=>{ c?(pass++,console.log('  ok   '+n)):(fail++,console.log('  FAIL '+n+(e?'  -> '+e:''))); };
const head=t=>console.log('\n== '+t+' ==');
const rd=p=>{const b=fs.readFileSync(U+p);return decodeBMP(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));};
const men=rd('720_butta_menna.bmp'), res=rd('720_butta_resham.bmp'), jar=rd('720_butta_jari.bmp');

const build = (ground) => {
  state.segments=[{id:'bd',kind:'body',count:720}];
  state.totalDeclared=720; state.boxMotion='4x4';
  state.opts={achuStartsBlack:true,pinOneLeft:true,topRowFirstPick:true,blackIsIndexZero:true,
              stackMode:'interleave',achuOnBody:false,achuInBody:true,satinWarpFaced:false,
              autoRotate:true,boxWholeBand:true,weavePerDesignLine:true,mirrorBodyFile:false,
              bodyGround:ground};
  state.borderFiles={}; state.wefts=freshWefts();
  state.wefts[0].file=fitToPins(res,720);
  state.wefts[1].file=fitToPins(jar,720);
  state.wefts[2].file=fitToPins(men,720);
  return compose('body');
};
const per = (o,y) => { let n=0; for (let x=0;x<720;x++) if (o.bits[y*o.width+x]) n++; return n; };

head('without a ground weave');
{
  const o = build('');
  ok('the ground weft works', per(o,0) > 300, String(per(o,0)));
  ok('but a figure weft lifts almost nothing', per(o,1) < 20, String(per(o,1)));
  ok('and so does the next', per(o,2) < 20, String(per(o,2)));
}

head('with a plain ground underneath');
{
  const o = build('satin:2:1');
  ok('every pick lifts exactly half', per(o,0)===360 && per(o,1)===360 && per(o,2)===360,
     [per(o,0),per(o,1),per(o,2)].join(', '));
  ok('no pick is left floating', (()=>{
    for (let y=0;y<o.height;y++) if (per(o,y) < 300) return false;
    return true; })());
  const row = y => Array.from({length:8},(_,x)=>o.bits[y*o.width+x]).join('');
  ok('and it alternates pick by pick', row(0)==='10101010' && row(1)==='01010101',
     row(0)+' / '+row(1));
  ok('staying in phase with the ground weft, which already weaves that way',
     row(0) === Array.from({length:8},(_,x)=>fitToPins(res,720).bits[x]).join(''),
     row(0));
}

head('the figure still comes through');
{
  const plain = build(''), ground = build('satin:2:1');
  let figureLines = 0;
  for (let d=0; d<plain.designHeight; d++) if (plain.figureOnLine[d]) figureLines++;
  ok('there is butta in this design', figureLines > 0, String(figureLines));
  // wherever the weft lifted before, it still lifts
  let lost = 0;
  for (let i=0;i<plain.bits.length;i++) if (plain.bits[i] && !ground.bits[i]) lost++;
  ok('the ground never takes away what the design lifted', lost===0, String(lost));
}

head('a satin ground works too');
{
  const o = build('satin:8:3');
  ok('every pick is bound', (()=>{
    for (let y=0;y<o.height;y++) if (per(o,y) === 0) return false;
    return true; })());
  ok('lighter than a plain ground, as a satin should be', per(o,1) < 360 && per(o,1) > 50,
     String(per(o,1)));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail?1:0);
