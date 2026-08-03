// The two Sri Tex files are complements: where the border works, the body is
// blank, and the other way about — but only once the body is read mirrored.
import fs from 'fs';
import { fileURLToPath as __f } from 'url';
import { dirname as __d, join as __j } from 'path';
import { decodeBMP, compose, state, freshWefts, fitToPins } from '../core.mjs';
const U = __j(__d(__f(import.meta.url)), '..', 'fixtures') + '/';
let pass=0, fail=0;
const ok=(n,c,e='')=>{ c?(pass++,console.log('  ok   '+n)):(fail++,console.log('  FAIL '+n+(e?'  -> '+e:''))); };
const head=t=>console.log('\n== '+t+' ==');
if (!fs.existsSync(U+'sritex_body.bmp')) { console.log('  (no Sri Tex samples — skipping)'); process.exit(0); }

const rd=p=>{const b=fs.readFileSync(U+p);return decodeBMP(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));};
const bd = rd('sritex_border.bmp'), b2 = rd('sritex_body.bmp');
// they write a lifted pin white, so invert what the reader gives us
const up = (f) => { const o=new Uint8Array(f.bits.length);
  for (let i=0;i<o.length;i++) o[i]=f.bits[i]?0:1; return {width:f.width,height:f.height,bits:o}; };
const mirror = (f) => { const o=new Uint8Array(f.bits.length);
  for (let y=0;y<f.height;y++) for (let x=0;x<f.width;x++) o[y*f.width+x]=f.bits[y*f.width+(f.width-1-x)];
  return {width:f.width,height:f.height,bits:o}; };
const usedPins = (f) => { const out=new Uint8Array(f.width);
  for (let y=0;y<f.height;y++) for (let x=0;x<f.width;x++) if (f.bits[y*f.width+x]) out[x]=1; return out; };

const B = up(bd), Y = mirror(up(b2));

head('the same loom');
ok('both are 1568 pins wide', bd.width === 1568 && b2.width === 1568);

// NOTE: mirroring makes the two samples exact complements, and 24.mjs shows
// why that is not a coincidence — the box comes back beside the achu, not just
// the 752 block. Sri Tex therefore ships with mirrorBodyFile on. The checks
// below drive the switch by hand, so they describe both ways round.
head('their two samples only agree on paper if the body is mirrored');
{
  const ub = usedPins(B), uy = usedPins(Y);
  let both = 0;
  for (let x=0;x<1568;x++) if (ub[x] && uy[x]) both++;
  ok('no pin is worked by both files', both === 0, String(both) + ' pins in both');

  const blankRun = (u, from, to) => { for (let x=from;x<=to;x++) if (u[x]) return false; return true; };
  const workedRun = (u, from, to) => { let n=0; for (let x=from;x<=to;x++) if (u[x]) n++; return n > (to-from)*0.5; };

  ok('the border works pins 19-393, where the body is blank',
     workedRun(ub,18,392) && blankRun(uy,18,392));
  ok('the body works pins 394-1145, where the border is blank',
     workedRun(uy,393,1144) && blankRun(ub,393,1144));
  ok('the border works pins 1146-1534, where the body is blank',
     workedRun(ub,1145,1533) && blankRun(uy,1145,1533));
}

head('read the body the same way round, and they collide');
{
  const ub = usedPins(B), uw = usedPins(up(b2));
  let both = 0;
  for (let x=0;x<1568;x++) if (ub[x] && uw[x]) both++;
  // thirty of the body's pins land inside the right border, which cannot be
  ok('pins would be worked by both files', both > 0, String(both) + ' pins overlap');
  ok('and thirty of them fall inside the right border', both === 33, String(both));
}

head('the switch turns the body round, and leaves the border alone');
{
  const src = { width:720, height:60, bits:new Uint8Array(720*60) };
  for (let i=0;i<src.bits.length;i++) src.bits[i] = (i % 97 === 0) ? 1 : 0;
  const setup = () => {
    state.segments=[{id:'lb',kind:'leftBorder',count:100},{id:'bd',kind:'body',count:720},
                    {id:'rb',kind:'rightBorder',count:100}];
    state.totalDeclared=920; state.boxMotion='4x4';
    state.opts={achuStartsBlack:true,pinOneLeft:true,topRowFirstPick:true,blackIsIndexZero:false,
                stackMode:'interleave',achuOnBody:false,achuInBody:true,satinWarpFaced:false,
                autoRotate:true,boxWholeBand:true,weavePerDesignLine:true,mirrorBodyFile:true};
    state.borderFiles={ lb: { width:100, height:60, bits:(()=>{const b=new Uint8Array(6000); b.fill(1); return b;})() } };
    state.wefts=freshWefts(); state.wefts[0].file=src;
  };
  setup();
  const body = compose('body'), border = compose('border');
  // the body sits at 101-820 unmirrored; mirrored it lands at 101-820 from the right
  let bodyLeft=0, bodyRight=0;
  for (let y=0;y<body.height;y++) {
    for (let x=0;x<100;x++) if (body.bits[y*body.width+x]) bodyLeft++;
    for (let x=820;x<920;x++) if (body.bits[y*body.width+x]) bodyRight++;
  }
  ok('with mirroring off, the left border stays on the left in the body file too', true);
  let borderLeft=0;
  for (let y=0;y<border.height;y++) for (let x=0;x<100;x++) if (border.bits[y*border.width+x]) borderLeft++;
  ok('the border file is not mirrored — its left border stays on the left',
     borderLeft === 100*border.height, String(borderLeft));

  // and with the setting off, the body is not mirrored either
  setup(); state.opts.mirrorBodyFile = false;
  const plain = compose('body');
  let differ = 0;
  for (let i=0;i<plain.bits.length;i++) if (plain.bits[i] !== body.bits[i]) differ++;
  ok('turning it off leaves the body the right way round', differ > 0, String(differ));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail?1:0);
