// Where the Sri Tex body file puts its pins.
//
// Their body sample is written back to front against their border sample. This
// rebuilds the same job on the loom the border sample came off and checks the
// blocks land where their file has them — which is the thing that goes wrong
// silently, because a mirrored file still looks like a perfectly good file.
import fs from 'fs';
import { fileURLToPath as __f } from 'url';
import { dirname as __d, join as __j } from 'path';
import { decodeBMP, compose, state, freshWefts, COMPANIES } from '../core.mjs';
const U = __j(__d(__f(import.meta.url)), '..', 'fixtures') + '/';
let pass=0, fail=0;
const ok=(n,c,e='')=>{ c?(pass++,console.log('  ok   '+n)):(fail++,console.log('  FAIL '+n+(e?'  -> '+e:''))); };
const head=t=>console.log('\n== '+t+' ==');

const sritex = COMPANIES.find(c => c.id === 'sritex');

head('the company carries it');
ok('Sri Tex mirrors the body file', sritex.opts.mirrorBodyFile === true);
ok('and still writes a lifted pin white', sritex.opts.blackIsIndexZero === false);
{
  const saitex = COMPANIES.find(c => c.id === 'saitex');
  ok('Sai Tex does not mirror', saitex.opts.mirrorBodyFile === false);
}

// The loom the Sri Tex border sample came off, read straight from that file:
// achu 10, box 8, left border 375, locking 8 + body 736 + locking 8, right
// border 389, achu 10, spare 24 — 1568 pins.
const setup = (mirror) => {
  state.segments = [
    { id:'a1', kind:'achu',        count:10 },
    { id:'bx', kind:'box',         count:8  },
    { id:'lb', kind:'leftBorder',  count:375 },
    { id:'l1', kind:'locking',     count:8, weave:'satin:8:3' },
    { id:'bd', kind:'body',        count:736 },
    { id:'l2', kind:'locking',     count:8, weave:'satin:8:3' },
    { id:'rb', kind:'rightBorder', count:389 },
    { id:'a2', kind:'achu',        count:10 },
    { id:'em', kind:'empty',       count:24 }];
  state.totalDeclared = 1568; state.boxMotion = '4x4';
  state.weaves = []; state.boxPrefs = {}; state.borderFiles = {};
  state.opts = { ...sritex.opts, achuOnBody:false, achuInBody:true, mirrorBodyFile:mirror };
  const w=736, h=100, bits=new Uint8Array(w*h);
  for (let i=0;i<bits.length;i++) bits[i] = (i % 13 === 0) ? 1 : 0;
  state.wefts = freshWefts(); state.wefts[0].file = { width:w, height:h, bits };
};

// which pins are worked anywhere down the file
const worked = (f) => { const o=new Uint8Array(f.width);
  for (let y=0;y<f.height;y++) for (let x=0;x<f.width;x++) if (f.bits[y*f.width+x]) o[x]=1; return o; };
const run = (u, from, to) => { for (let x=from-1;x<to;x++) if (!u[x]) return false; return true; };
const blank = (u, from, to) => { for (let x=from-1;x<to;x++) if (u[x]) return false; return true; };

head('rebuilt with the company as it ships');
{
  setup(sritex.opts.mirrorBodyFile);
  const u = worked(compose('body'));
  ok('the 752 pins of locking + body + locking land at 424-1175, as their file has them',
     run(u, 424, 1175), 'first worked pin of the block: ' + (u.indexOf(1) + 1));
  ok('nothing is worked at 35-423, where their left border goes', blank(u, 35, 423));
  ok('nor at 1176-1552, where their right border goes', blank(u, 1176, 1552));
}

head('written the same way round, it lands thirty pins short');
{
  setup(false);
  const u = worked(compose('body'));
  ok('the block sits at 394-1145 instead', run(u, 394, 1145));
  ok('which is exactly where their border file keeps its pins DOWN', run(u, 394, 1145));
  ok('and pin 424, where their block really starts, is 30 pins late',
     run(u, 394, 423), 'pins 394-423 worked when their file has them down');
}

head('against their real body file');
if (!fs.existsSync(U + 'sritex_body.bmp')) {
  console.log('  (no Sri Tex body sample — skipping)');
} else {
  const b = fs.readFileSync(U + 'sritex_body.bmp');
  const raw = decodeBMP(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  // they write a lifted pin white, so invert what the reader gives us
  const up = new Uint8Array(raw.bits.length);
  for (let i=0;i<up.length;i++) up[i] = raw.bits[i] ? 0 : 1;
  const theirs = worked({ width: raw.width, height: raw.height, bits: up });

  setup(sritex.opts.mirrorBodyFile);
  const ours = worked(compose('body'));

  ok('same width', raw.width === 1568);
  ok('their block starts where ours does', theirs[423] === 1 && ours[423] === 1);
  ok('and ends where ours does', theirs[1174] === 1 && ours[1174] === 1);
  ok('their pin 393 is down, and so is ours — the thirty that gave it away',
     theirs[392] === 0 && ours[392] === 0);
}

head('the border file is left alone');
{
  setup(sritex.opts.mirrorBodyFile);
  state.borderFiles = { lb: { width:375, height:100,
    bits: (()=>{ const b=new Uint8Array(375*100); b.fill(1); return b; })() } };
  const u = worked(compose('border'));
  ok('the left border stays on the left, at 19-393', run(u, 19, 393));
  ok('the achu is still at the near end, not thrown to the far one', run(u, 1, 10));
  ok('and the body block stays down, as a border file requires', blank(u, 394, 1145));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail?1:0);
