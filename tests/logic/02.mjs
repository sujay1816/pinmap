import fs from 'fs';
import { decodeBMP, encodeBMP1, achuRow, compose, state, freshWefts } from '../core.mjs';
import { fileURLToPath as __f } from 'url';
import { dirname as __d, join as __j } from 'path';
const U = __j(__d(__f(import.meta.url)), '..', 'fixtures') + '/';


let pass=0, fail=0;
const ok=(n,c,e='')=>{ c?(pass++,console.log('  ok   '+n)):(fail++,console.log('  FAIL '+n+(e?'  -> '+e:''))); };
const head=t=>console.log('\n== '+t+' ==');

const rd=p=>{const b=fs.readFileSync(p);return decodeBMP(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));};
const men=rd(U+'720_butta_menna.bmp'), res=rd(U+'720_butta_resham.bmp');
const crop=(f,w)=>{const b=new Uint8Array(w*f.height);
  for(let y=0;y<f.height;y++) for(let x=0;x<w;x++) b[y*w+x]=f.bits[y*f.width+x];
  return {width:w,height:f.height,bits:b,name:'crop'};};

const segs = [
  { id:'a1', kind:'achu',        count:4   },
  { id:'bx', kind:'box',         count:4   },
  { id:'lb', kind:'leftBorder',  count:100 },
  { id:'bd', kind:'body',        count:500 },
  { id:'rb', kind:'rightBorder', count:100 },
  { id:'a2', kind:'achu',        count:4   }
];
const at = {}; { let a=0; segs.forEach(s=>{ at[s.id]=a; a+=s.count; }); }
const W = 712;
const base = () => {
  state.segments = segs;
  state.totalDeclared = W;
  state.opts = { achuStartsBlack:true, pinOneLeft:true, topRowFirstPick:true,
                 blackIsIndexZero:true, stackMode:'interleave', achuOnBody:true };
  state.borderFiles = {};
  state.wefts = freshWefts();
};

head('no border loaded: border pins blank, achu moves to the body');
base();
state.wefts[0].file = men;                       // body design only
let out = compose();
ok('still builds without any border file', out.width === W && out.height === 720);
{
  let lb=0, rb=0;
  for (let y=0;y<out.height;y++) {
    for (let x=0;x<100;x++) { if (out.bits[y*W+at.lb+x]) lb++; if (out.bits[y*W+at.rb+x]) rb++; }
  }
  ok('left border pins blank', lb===0, String(lb));
  ok('right border pins blank', rb===0, String(rb));
}
{
  // body must be the design, plus achu wherever the design is down
  const g0 = achuRow(4, 0, true), g1 = achuRow(4, 1, true);
  let good = true, filled = 0;
  for (let x=0; x<500 && good; x++) {
    const want0 = men.bits[x] || g0[x % 4];
    const want1 = men.bits[500 + x] || g1[x % 4];
    if (out.bits[at.bd + x] !== want0) good = false;
    if (out.bits[W + at.bd + x] !== want1) good = false;
    if (want0) filled++;
  }
  ok('body carries design plus achu ground', good);
  ok('the achu ground actually lifts pins', filled > 200, String(filled));
}
ok('achu pins themselves still generate', Array.from(out.bits.slice(at.a1, at.a1+4)).join('')==='1100');

head('achu ground respects the design');
{
  // on a line where menna lifts, those pins must come from the design, not the ground
  const line = 300, g = achuRow(4, line, true);
  let conflict = 0;
  for (let x=0;x<500;x++) {
    const design = men.bits[line*500 + x];
    const got = out.bits[line*W + at.bd + x];
    if (design && !got) conflict++;                       // design must always win through
    if (!design && got !== g[x % 4]) conflict++;          // gaps must be ground
  }
  ok('design lifts survive and gaps take the ground', conflict===0, String(conflict));
}

head('one border loaded: achu stays on its own pins');
base();
state.wefts[0].file = men;
state.borderFiles.lb = crop(res, 100);
out = compose();
{
  let bodyGround = 0;
  const g0 = achuRow(4, 0, true);
  for (let x=0;x<500;x++) if (!men.bits[x] && out.bits[at.bd+x]) bodyGround++;
  ok('no achu on the body once a border is loaded', bodyGround===0, String(bodyGround));
}
{
  let rb=0;
  for (let y=0;y<out.height;y++) for (let x=0;x<100;x++) if (out.bits[y*W+at.rb+x]) rb++;
  ok('the unloaded right border is still blank', rb===0, String(rb));
}
{
  let lOK=true;
  const lf = crop(res,100);
  for (let x=0;x<100;x++) if (out.bits[at.lb+x] !== lf.bits[x]) { lOK=false; break; }
  ok('the loaded left border carries its file', lOK);
}
ok('achu pins unchanged', Array.from(out.bits.slice(at.a1, at.a1+4)).join('')==='1100');

head('option can be switched off');
base();
state.wefts[0].file = men;
state.opts.achuOnBody = false;
out = compose();
{
  let bodyGround = 0;
  for (let x=0;x<500;x++) if (!men.bits[x] && out.bits[at.bd+x]) bodyGround++;
  ok('body left plain when the option is off', bodyGround===0, String(bodyGround));
}

head('border only, no body weft');
base();
state.borderFiles.lb = crop(res, 100);
state.borderFiles.rb = crop(men, 100);
out = compose();
ok('builds with no body weft at all', out.height===720);
{
  let bd=0;
  for (let y=0;y<out.height;y++) for (let x=0;x<500;x++) if (out.bits[y*W+at.bd+x]) bd++;
  ok('body pins stay down', bd===0, String(bd));
}
ok('box all down with no weft', Array.from(out.bits.slice(at.bx, at.bx+4)).join('')==='0000');
{
  let ok1=true, ok2=true;
  const lf=crop(res,100), rf=crop(men,100);
  for (let x=0;x<100;x++) {
    if (out.bits[at.lb+x]!==lf.bits[x]) ok1=false;
    if (out.bits[at.rb+x]!==rf.bits[x]) ok2=false;
  }
  ok('both borders carry their own files', ok1 && ok2);
}

head('no achu group in the pin map');
state.segments = segs.filter(x => x.kind !== 'achu');
state.totalDeclared = 704;
state.borderFiles = {};
state.wefts = freshWefts();
state.wefts[0].file = men;
out = compose();
ok('builds without achu groups', out.width===704);
{
  let extra=0;
  const bdAt = 4 + 100;                                  // box, left border, then body
  for (let x=0;x<500;x++) if (!men.bits[x] && out.bits[bdAt+x]) extra++;
  ok('no ground invented when there is no achu group', extra===0, String(extra));
}

out = compose();
fs.writeFileSync('noborder.bmp', Buffer.from(encodeBMP1(out.bits,out.width,out.height,true)));
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail?1:0);
