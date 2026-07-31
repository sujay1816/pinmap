import fs from 'fs';
import {

  decodeBMP, encodeBMP1, achuRow, boxRow, compose, state,
  KINDS, DEFAULT_LAYOUT, labelFor, freshWefts, filledWefts,
  borderSlots, bodySlots, WEFT_SLOTS, WEFT_NAMES, totalPins, allocated
} from '../core.mjs';
import { fileURLToPath as __f } from 'url';
import { dirname as __d, join as __j } from 'path';
const U = __j(__d(__f(import.meta.url)), '..', 'fixtures') + '/';


let pass = 0, fail = 0;
const ok = (n, c, e = '') => { c ? (pass++, console.log('  ok   ' + n))
                                 : (fail++, console.log('  FAIL ' + n + (e ? '  -> ' + e : ''))); };
const head = (t) => console.log('\n== ' + t + ' ==');


const rd = p => { const b = fs.readFileSync(p); return decodeBMP(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
const men = rd(U + '720_butta_menna.bmp'), res = rd(U + '720_butta_resham.bmp'), jar = rd(U + '720_butta_jari.bmp');
const crop = (f, w) => { const b = new Uint8Array(w * f.height);
  for (let y = 0; y < f.height; y++) for (let x = 0; x < w; x++) b[y * w + x] = f.bits[y * f.width + x];
  return { width: w, height: f.height, bits: b, name: 'crop' }; };

/* ---------------------------------------------------------- decoding */
head('the three real weft files');
ok('all decode 500 x 720', [men, res, jar].every(f => f.width === 500 && f.height === 720));
ok('menna lifts 11714 pins', men.bits.reduce((a, b) => a + b, 0) === 11714);
ok('resham lifts 168836', res.bits.reduce((a, b) => a + b, 0) === 168836);
ok('jari lifts 11714', jar.bits.reduce((a, b) => a + b, 0) === 11714);
{
  let same = true;
  for (let y = 0; y < 720 && same; y++) for (let x = 0; x < 500; x++)
    if (jar.bits[y * 500 + x] !== men.bits[y * 500 + ((x - 250 + 500) % 500)]) { same = false; break; }
  ok('jari is menna rolled 250 columns', same);
}
{
  let overlap = 0;
  for (let i = 0; i < men.bits.length; i++) if (men.bits[i] + res.bits[i] + jar.bits[i] > 1) overlap++;
  ok('the three wefts never lift the same pin on a line', overlap === 0, 'overlap=' + overlap);
}

/* ------------------------------------------------------------- achu */
head('achu');
ok('4 pins line 1 = 1100', achuRow(4, 0, true).join('') === '1100');
ok('4 pins line 2 = 0011', achuRow(4, 1, true).join('') === '0011');
ok('6 pins line 1 = 111000', achuRow(6, 0, true).join('') === '111000');
ok('6 pins line 2 = 000111', achuRow(6, 1, true).join('') === '000111');
ok('phase toggle inverts line 1', achuRow(6, 0, false).join('') === '000111');

/* -------------------------------------------------------------- box */
head('box table');
ok('1 weft  -> 0000', boxRow(4, 0, 1).join('') === '0000');
ok('2 wefts -> 1111 / 1111', boxRow(4, 0, 2).join('') === '1111' && boxRow(4, 1, 2).join('') === '1111');
ok('3 wefts -> 1111 / 1100 / 0011  (rani, zari, meena)',
   [0, 1, 2].map(i => boxRow(4, i, 3, true).join('')).join(' ') === '1111 1100 0011',
   [0,1,2].map(i => boxRow(4,i,3,true).join('')).join(' '));
ok('4 wefts -> 1111 / 1100 / 0011 / 0000',
   [0, 1, 2, 3].map(i => boxRow(4, i, 4, true).join('')).join(' ') === '1111 1100 0011 0000',
   [0,1,2,3].map(i => boxRow(4,i,4,true).join('')).join(' '));
ok('halves scale to 6 box pins', boxRow(6, 1, 3, true).join('') === '111000',
   boxRow(6,1,3,true).join(''));

/* --------------------------------------------------------- BMP round trip */
head('BMP writing');
for (const [nm, f] of [['menna', men], ['resham', res]]) {
  for (const zero of [true, false]) {
    const enc = encodeBMP1(f.bits, f.width, f.height, zero);
    const back = decodeBMP(enc.buffer.slice(enc.byteOffset, enc.byteOffset + enc.byteLength));
    let same = back.width === f.width && back.height === f.height;
    if (same) for (let i = 0; i < f.bits.length; i++) if (f.bits[i] !== back.bits[i]) { same = false; break; }
    ok(`${nm} survives a round trip (black=index${zero ? 0 : 1})`, same);
  }
}
{
  const W = 501, H = 7, bits = new Uint8Array(W * H);
  for (let i = 0; i < bits.length; i++) bits[i] = (i * 7919 % 3 === 0) ? 1 : 0;
  const enc = encodeBMP1(bits, W, H, true);
  const back = decodeBMP(enc.buffer.slice(enc.byteOffset, enc.byteOffset + enc.byteLength));
  let same = true;
  for (let i = 0; i < bits.length; i++) if (bits[i] !== back.bits[i]) { same = false; break; }
  ok('odd width 501 round trips (row padding)', same);
}

/* ------------------------------------------------------- groups and names */
head('groups');
ok('seven groups', Object.keys(KINDS).length === 7, String(Object.keys(KINDS).length));
ok('only the borders take a single file',
   Object.entries(KINDS).filter(([, v]) => v.source === 'border').map(([k]) => k).join(',') === 'leftBorder,rightBorder');
ok('only body takes weft files',
   Object.entries(KINDS).filter(([, v]) => v.source === 'weft').map(([k]) => k).join(',') === 'body');
ok('achu and box are generated',
   KINDS.achu.source === 'generated' && KINDS.box.source === 'generated');
ok('locking is generated, empty never lifts',
   KINDS.locking.source === 'generated' && KINDS.empty.source === 'down');
ok('codes and colours are unique',
   new Set(Object.values(KINDS).map(k => k.code)).size === 7 &&
   new Set(Object.values(KINDS).map(k => k.colour)).size === 7);
ok('standard order preloaded',
   DEFAULT_LAYOUT.map(g => g[0]).join(',') === 'achu,box,leftBorder,locking,body,rightBorder,achu,empty',
   DEFAULT_LAYOUT.map(g => g[0]).join(','));
ok('four slots to start with, in shuttle order',
   WEFT_SLOTS === 4 && WEFT_NAMES.join(',') === 'Rani,Zari,Meena 1,Meena 2', WEFT_NAMES.join(','));
{
  const std = DEFAULT_LAYOUT.map(([kind]) => ({ kind }));
  ok('repeated groups are numbered', labelFor(std, 0) === 'Achu 1' && labelFor(std, 6) === 'Achu 2');
  ok('single groups are not', labelFor(std, 1) === 'Box' && labelFor(std, 4) === 'Body');
}

/* ------------------------------------------------- the full standard job */
head('standard layout, three body wefts');
const segs = [
  { id: 'a1', kind: 'achu',        count: 4    },
  { id: 'bx', kind: 'box',         count: 4    },
  { id: 'lb', kind: 'leftBorder',  count: 100  },
  { id: 'lk', kind: 'locking',     count: 8    },
  { id: 'bd', kind: 'body',        count: 500  },
  { id: 'rb', kind: 'rightBorder', count: 100  },
  { id: 'a2', kind: 'achu',        count: 4    },
  { id: 'em', kind: 'empty',       count: 12   }
];
state.segments = segs;
state.totalDeclared = 732;
state.opts = { achuStartsBlack: true, pinOneLeft: true, topRowFirstPick: true, blackIsIndexZero: true, stackMode: 'interleave', achuOnBody: true, achuInBody:true, satinWarpFaced: false, boxWholeBand: true };
const leftF = crop(men, 100), rightF = crop(res, 100);
state.borderFiles = { lb: leftF, rb: rightF };
state.wefts = freshWefts();
state.wefts[0].file = men; state.wefts[1].file = res; state.wefts[2].file = jar;

ok('groups add to 732', allocated() === 732, String(allocated()));
ok('three wefts loaded', filledWefts().length === 3);
ok('two border slots, one body slot', borderSlots().length === 2 && bodySlots().length === 1);

let out = compose();
const at = {}; { let a = 0; segs.forEach(s => { at[s.id] = a; a += s.count; }); }
ok('width 732', out.width === 732, out.width);
ok('height 720 x 3 wefts = 2160', out.height === 2160, out.height);
ok('weft names recorded', out.weftNames.join(',') === 'Rani,Zari,Meena 1', out.weftNames.join(','));

head('box cycles once per weft pick  (design line 1 carries butta here)');
ok('line 1 box = 1111', Array.from(out.bits.slice(at.bx, at.bx + 4)).join('') === '1111');
ok('line 2 box = 1100 (zari)', Array.from(out.bits.slice(732 + at.bx, 732 + at.bx + 4)).join('') === '1100',
   Array.from(out.bits.slice(732+at.bx, 732+at.bx+4)).join(''));
ok('line 3 box = 0011 (meena)', Array.from(out.bits.slice(2 * 732 + at.bx, 2 * 732 + at.bx + 4)).join('') === '0011',
   Array.from(out.bits.slice(2*732+at.bx, 2*732+at.bx+4)).join(''));
ok('line 4 back to 1111', Array.from(out.bits.slice(3 * 732 + at.bx, 3 * 732 + at.bx + 4)).join('') === '1111');

head('body takes a different weft on each pick');
const bodyMatches = (outY, f, designRow) => {
  for (let x = 0; x < 500; x++)
    if (out.bits[outY * 732 + at.bd + x] !== f.bits[designRow * 500 + x]) return false;
  return true;
};
ok('line 1 body is Meena design line 1', bodyMatches(0, men, 0));
ok('line 2 body is Rani design line 1', bodyMatches(1, res, 0));
ok('line 3 body is Zari design line 1', bodyMatches(2, jar, 0));
ok('line 4 body is Meena design line 2', bodyMatches(3, men, 1));
ok('line 543 body is Zari design line 181', bodyMatches(181 * 3 + 2, jar, 181));

head('the border file, built on its own');
const Bfile = compose('border');
const borderMatchesB = (outY, base, f, designRow) => {
  for (let x = 0; x < 100; x++)
    if (Bfile.bits[outY * Bfile.width + base + x] !== f.bits[designRow * 100 + x]) return false;
  return true;
};
const borderMatches = (outY, base, f, designRow) => {
  for (let x = 0; x < 100; x++)
    if (out.bits[outY * 732 + base + x] !== f.bits[designRow * 100 + x]) return false;
  return true;
};
ok('the left border is carried line for line',
   borderMatchesB(0, at.lb, leftF, 0) && borderMatchesB(1, at.lb, leftF, 1));
ok('the right border carries its own file', borderMatchesB(0, at.rb, rightF, 0));
ok('the border file is as tall as the border designs', Bfile.height === leftF.height,
   `${Bfile.height} vs ${leftF.height}`);
ok('and carries no body', (()=>{
   for (let y=0;y<Bfile.height;y++) for (let x=0;x<500;x++)
     if (Bfile.bits[y*Bfile.width + at.bd + x]) return false;
   return true; })());
{
  let differ = false;
  for (let i = 0; i < leftF.bits.length; i++) if (leftF.bits[i] !== rightF.bits[i]) { differ = true; break; }
  ok('the two borders are genuinely different files', differ);
}

head('groups that never lift');
{
  let lk = 0, em = 0;
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < 8; x++) if (out.bits[y * 732 + at.lk + x]) lk++;
    for (let x = 0; x < 12; x++) if (out.bits[y * 732 + at.em + x]) em++;
  }
  ok('locking lifts exactly one pin per line', lk === out.height, `${lk} over ${out.height} lines`);
  ok('empty stays down', em === 0, String(em));
}

head('achu at both edges — in the border file, since a border is loaded');
ok('first achu = 1100', Array.from(Bfile.bits.slice(at.a1, at.a1 + 4)).join('') === '1100',
   Array.from(Bfile.bits.slice(at.a1, at.a1+4)).join(''));
ok('second achu = 1100 too', Array.from(Bfile.bits.slice(at.a2, at.a2 + 4)).join('') === '1100');
ok('both flip on line 2',
   Array.from(Bfile.bits.slice(Bfile.width + at.a1, Bfile.width + at.a1 + 4)).join('') === '0011' &&
   Array.from(Bfile.bits.slice(Bfile.width + at.a2, Bfile.width + at.a2 + 4)).join('') === '0011');
ok('and the body file leaves those pins down', (()=>{
   for (let y=0;y<out.height;y++)
     for (const a of [at.a1, at.a2])
       for (let x=0;x<4;x++) if (out.bits[y*out.width + a + x]) return false;
   return true; })());

head('region map');
ok('box 1, left border 2, right border 3, achu 4, locking 5, body 6, empty 7',
   out.region[at.bx] === 1 && out.region[at.lb] === 2 && out.region[at.rb] === 3 &&
   out.region[at.a1] === 4 && out.region[at.lk] === 5 && out.region[at.bd] === 6 && out.region[at.em] === 7);
ok('row metadata tracks weft and design line',
   out.rowWeft[0] === 0 && out.rowWeft[1] === 1 && out.rowWeft[2] === 2 &&
   out.rowDesign[2] === 0 && out.rowDesign[3] === 1);

/* ------------------------------------------------- unallocated padding */
head('pins left unallocated');
state.totalDeclared = 900;
out = compose();
ok('width follows the declared 900', out.width === 900, out.width);
ok('spare pins marked not allocated', out.region[732] === 8 && out.region[899] === 8);
{
  let any = 0;
  for (let y = 0; y < out.height; y++) for (let x = 732; x < 900; x++) if (out.bits[y * 900 + x]) any++;
  ok('spare pins stay down', any === 0, String(any));
}
state.totalDeclared = 732;

/* ------------------------------------------------------ single weft */
head('a single body weft');
state.wefts[1].file = null; state.wefts[2].file = null;
out = compose();
ok('height equals the design height', out.height === 720, out.height);
ok('box all down with one weft', Array.from(out.bits.slice(at.bx, at.bx + 4)).join('') === '0000');
ok('body is the only weft', bodyMatches(0, men, 0));
state.wefts[1].file = res; state.wefts[2].file = jar;

/* ------------------------------------------------------ block stacking */
head('block stacking');
state.opts.stackMode = 'blocks';
out = compose();
ok('first 720 lines are weft 1', out.rowWeft[0] === 0 && out.rowWeft[719] === 0);
ok('line 721 starts weft 2', out.rowWeft[720] === 1);
ok('box holds 1111 through the first block',
   Array.from(out.bits.slice(at.bx, at.bx + 4)).join('') === '1111' &&
   Array.from(out.bits.slice(719 * 732 + at.bx, 719 * 732 + at.bx + 4)).join('') === '1111');
state.opts.stackMode = 'interleave';

/* --------------------------------------------------- mirror and flip */
head('mirror and flip');
state.opts.pinOneLeft = false;
out = compose();
ok('mirrored: achu 1 now at the far end', out.region[out.width - 1] === 4);
ok('mirrored: box sits next to it', out.region[out.width - 5] === 1);
state.opts.pinOneLeft = true;

state.opts.topRowFirstPick = false;
out = compose();
ok('flipped: last line is design line 1 of weft 1',
   out.rowWeft[out.height - 1] === 0 && out.rowDesign[out.height - 1] === 0);
ok('flipped: bits move with the metadata',
   Array.from(out.bits.slice((out.height - 1) * 732 + at.bx, (out.height - 1) * 732 + at.bx + 4)).join('') === '1111');
state.opts.topRowFirstPick = true;

/* ------------------------------------------------------- write it out */
out = compose();
fs.writeFileSync('combined.bmp', Buffer.from(encodeBMP1(out.bits, out.width, out.height, true)));
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
