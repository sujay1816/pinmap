// Which colour a lifted pin gets, and that it does not disturb Sai Tex.
import fs from 'fs';
import { fileURLToPath as __f } from 'url';
import { dirname as __d, join as __j } from 'path';
import { encodeBMP1, decodeBMP, compose, state, freshWefts, fitToPins } from '../core.mjs';
const U = __j(__d(__f(import.meta.url)), '..', 'fixtures') + '/';
let pass=0, fail=0;
const ok=(n,c,e='')=>{ c?(pass++,console.log('  ok   '+n)):(fail++,console.log('  FAIL '+n+(e?'  -> '+e:''))); };
const head=t=>console.log('\n== '+t+' ==');

// what the page actually looks like: black squares, not palette indices
function page(bytes, w, h) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const off = dv.getUint32(10, true);
  const p0 = bytes[off-8], p1 = bytes[off-4];
  const stride = ((Math.ceil(w/8))+3) & ~3;
  const out = new Uint8Array(w*h);
  for (let y=0;y<h;y++) { const rs = off + (h-1-y)*stride;
    for (let x=0;x<w;x++) { const bit = (bytes[rs+(x>>3)] >> (7-(x&7))) & 1;
      out[y*w+x] = ((bit ? p1 : p0) === 0) ? 1 : 0; } }   // 1 = black on the page
  return out;
}

head('the two ways round');
{
  const bits = Uint8Array.from([1,0,1,0, 0,1,0,1]);
  const black = page(encodeBMP1(bits,4,2,true), 4, 2);
  const white = page(encodeBMP1(bits,4,2,false), 4, 2);
  ok('written black, a lifted pin is black on the page', Array.from(black).join('') === '10100101', Array.from(black).join(''));
  ok('written white, it is white', Array.from(white).join('') === '01011010', Array.from(white).join(''));
  ok('so the two are opposites', Array.from(black).every((v,i)=>v !== white[i]));
}

head('a file still reads back as the pins that made it');
{
  const bits = new Uint8Array(64);
  for (let i=0;i<64;i++) bits[i] = (i*7) % 3 === 0 ? 1 : 0;
  for (const asBlack of [true,false]) {
    const enc = encodeBMP1(bits, 8, 8, asBlack);
    const back = decodeBMP(enc.buffer.slice(enc.byteOffset, enc.byteOffset+enc.byteLength));
    const same = Array.from(back.bits).join('') === Array.from(bits).join('');
    ok(`written ${asBlack ? 'black' : 'white'}, the page reads as ${asBlack ? 'the same pins' : 'their opposite'}`,
       asBlack ? same : !same);
  }
}

head('Sai Tex is untouched');
{
  const rd=p=>{const b=fs.readFileSync(U+p);return decodeBMP(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));};
  const men=rd('720_butta_menna.bmp'), res=rd('720_butta_resham.bmp'), jar=rd('720_butta_jari.bmp');
  const sample=rd('IMG_2413.BMP');
  state.segments=[{id:'bd',kind:'body',count:720}];
  state.totalDeclared=720; state.boxMotion='4x4';
  state.opts={achuStartsBlack:true,pinOneLeft:true,topRowFirstPick:true,blackIsIndexZero:true,
              stackMode:'interleave',achuOnBody:false,achuInBody:true,satinWarpFaced:false,
              autoRotate:true,boxWholeBand:true,weavePerDesignLine:true};
  state.borderFiles={}; state.wefts=freshWefts();
  state.wefts[0].file=fitToPins(res,720);
  state.wefts[1].file=fitToPins(jar,720);
  state.wefts[2].file=fitToPins(men,720);
  const out = compose('body');

  let diff=0; for (let i=0;i<sample.bits.length;i++) if (out.bits[i]!==sample.bits[i]) diff++;
  ok('the sample still matches pin for pin', diff===0, String(diff));

  const enc = encodeBMP1(out.bits, out.width, out.height, true);
  const pg = page(enc, out.width, out.height);
  let same=0; for (let i=0;i<pg.length;i++) if (pg[i]===sample.bits[i]) same++;
  ok('and the written file looks exactly like theirs', same === pg.length,
     `${pg.length-same} pixels differ`);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail?1:0);
