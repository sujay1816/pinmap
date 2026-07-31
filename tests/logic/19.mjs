import fs from 'fs';
import { fileURLToPath as __f } from 'url';
import { dirname as __d, join as __j } from 'path';
import { decodeBMP, fitToPins, compose, state, freshWefts,
         compareToReference, mirrorBits, flipBits, invertBits } from '../core.mjs';
const U = __j(__d(__f(import.meta.url)), '..', 'fixtures') + '/';
let pass=0, fail=0;
const ok=(n,c,e='')=>{ c?(pass++,console.log('  ok   '+n)):(fail++,console.log('  FAIL '+n+(e?'  -> '+e:''))); };
const head=t=>console.log('\n== '+t+' ==');
const rd=p=>{const b=fs.readFileSync(p);return decodeBMP(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));};
const men=rd(U+'720_butta_menna.bmp'), res=rd(U+'720_butta_resham.bmp'), jar=rd(U+'720_butta_jari.bmp');
const sample4x4 = rd(U+'IMG_2413.BMP');
const sample4x1 = rd(U+'IMG_2414__1_.BMP');

const build = (motion) => {
  state.segments=[{ id:'bd', kind:'body', count:720 }];
  state.totalDeclared=720; state.boxMotion=motion;
  state.opts={achuStartsBlack:true,pinOneLeft:true,topRowFirstPick:true,blackIsIndexZero:true,
              stackMode:'interleave',achuOnBody:false,achuInBody:true,satinWarpFaced:false,
              autoRotate:true,boxWholeBand:true,weavePerDesignLine:true};
  state.borderFiles={}; state.wefts=freshWefts();
  state.wefts[0].file=fitToPins(res,720);
  state.wefts[1].file=fitToPins(jar,720);
  state.wefts[2].file=fitToPins(men,720);
  return compose('body');
};

head('a file that matches');
{
  const r = compareToReference(build('4x4'), sample4x4, state.segments);
  ok('it says so', r.identical === true);
  ok('with nothing differing', r.differing === 0);
  ok('and the sizes agree', r.sameSize === true);
}
{
  const r = compareToReference(build('4x1'), sample4x1, state.segments);
  ok('the 4 by 1 sample matches too', r.identical === true, String(r.differing));
}

head('a file of the wrong shape');
{
  const r = compareToReference(build('4x4'), sample4x1.width === 720
    ? { width: 500, height: 1500, bits: new Uint8Array(500*1500) } : sample4x1, state.segments);
  ok('it is caught before anything else', r.sameSize === false);
  ok('and it says which way', /width/i.test(r.note), r.note);
}
{
  const short = { width: 720, height: 900, bits: new Uint8Array(720*900) };
  const r = compareToReference(build('4x4'), short, state.segments);
  ok('a length mismatch points at the wefts and box motion',
     /wefts|box motion/i.test(r.note), r.note);
}

head('the usual mistakes are recognised');
const built = build('4x4');
{
  const mirrored = { width: built.width, height: built.height,
                     bits: mirrorBits(built.bits, built.width, built.height) };
  const r = compareToReference(built, mirrored, state.segments);
  ok('a mirrored reference is spotted', r.nudges.some(n => n.exact && /Pin 1/.test(n.labels.join())),
     JSON.stringify(r.nudges.slice(0,1)));
}
{
  const flipped = { width: built.width, height: built.height,
                    bits: flipBits(built.bits, built.width, built.height) };
  const r = compareToReference(built, flipped, state.segments);
  ok('an upside-down reference is spotted',
     r.nudges.some(n => n.exact && /top line/i.test(n.labels.join())), JSON.stringify(r.nudges.slice(0,1)));
}
{
  const inverted = { width: built.width, height: built.height, bits: invertBits(built.bits) };
  const r = compareToReference(built, inverted, state.segments);
  ok('an inverted reference is spotted',
     r.nudges.some(n => n.exact && /colour index/i.test(n.labels.join())), JSON.stringify(r.nudges.slice(0,1)));
}
{
  const both = { width: built.width, height: built.height,
                 bits: flipBits(mirrorBits(built.bits, built.width, built.height), built.width, built.height) };
  const r = compareToReference(built, both, state.segments);
  ok('two mistakes at once are spotted together',
     r.nudges[0] && r.nudges[0].exact && r.nudges[0].labels.length === 2,
     JSON.stringify((r.nudges[0]||{}).labels));
}

head('pointing at the group at fault');
{
  state.segments=[{id:'a1',kind:'achu',count:4},{id:'bx',kind:'box',count:4},{id:'bd',kind:'body',count:720}];
  state.totalDeclared=728;
  state.wefts=freshWefts();
  state.wefts[0].file=fitToPins(res,720);
  state.wefts[1].file=fitToPins(jar,720);
  const mine = compose('body');
  // a reference identical but for the box pins
  const theirs = { width: mine.width, height: mine.height, bits: Uint8Array.from(mine.bits) };
  for (let y=0;y<mine.height;y++) for (let x=4;x<8;x++) theirs.bits[y*mine.width+x] ^= 1;
  const r = compareToReference(mine, theirs, state.segments);
  ok('only the box is reported', r.byGroup.length === 1 && r.byGroup[0].kind === 'box',
     JSON.stringify(r.byGroup));
  ok('with the number of pins involved', r.byGroup[0].differing === mine.height * 4,
     String(r.byGroup[0].differing));
  ok('and the first difference is located', r.firstDiff && r.firstDiff.pin === 5,
     JSON.stringify(r.firstDiff));
}

head('pointing at the weft at fault');
{
  const mine = compose('body');
  const theirs = { width: mine.width, height: mine.height, bits: Uint8Array.from(mine.bits) };
  for (let y=0;y<mine.height;y++) if (mine.rowWeft[y] === 1) theirs.bits[y*mine.width + 100] ^= 1;
  const r = compareToReference(mine, theirs, state.segments);
  const bad = r.byWeft.filter(x=>x.differing>0);
  ok('one weft is singled out', bad.length === 1, JSON.stringify(r.byWeft));
  ok('and it is the right one', bad[0].weft === 1, String(bad[0].weft));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail?1:0);
