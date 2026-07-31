// What a Sri Tex file looks like, read off their own border file.
//
// This is the first real evidence for the border rules: that the achu belongs
// to the border file, that the body and locking pins stay down in it, and that
// the achu is half up and half down, flipping every line.
import fs from 'fs';
import { fileURLToPath as __f } from 'url';
import { dirname as __d, join as __j } from 'path';
import { decodeBMP } from '../core.mjs';
const U = __j(__d(__f(import.meta.url)), '..', 'fixtures') + '/';
let pass=0, fail=0;
const ok=(n,c,e='')=>{ c?(pass++,console.log('  ok   '+n)):(fail++,console.log('  FAIL '+n+(e?'  -> '+e:''))); };
const head=t=>console.log('\n== '+t+' ==');

const path = U + 'sritex_border.bmp';
if (!fs.existsSync(path)) { console.log('  (no Sri Tex border sample — skipping)'); process.exit(0); }
const b = fs.readFileSync(path);
const raw = decodeBMP(b.buffer.slice(b.byteOffset, b.byteOffset+b.byteLength));
const W = raw.width, H = raw.height;

// their way: white is the lifted pin, so invert what we read
const up = new Uint8Array(W*H);
for (let i=0;i<up.length;i++) up[i] = raw.bits[i] ? 0 : 1;
const lit = (from,count)=>{ let n=0; for (let y=0;y<H;y++) for (let x=from;x<from+count;x++) if (up[y*W+x]) n++; return n; };
const row = (y,from,count)=>Array.from({length:count},(_,i)=>up[y*W+from+i]);

head('the file itself');
ok('1568 pins across', W === 1568, String(W));
ok('360 lines down', H === 360, String(H));

head('a border file leaves the body alone');
ok('all 752 pins of locking + body + locking stay down', lit(393, 752) === 0, String(lit(393,752)));

head('the borders carry their designs');
ok('the left border works, pins 19 to 393', lit(18, 375) > 10000, String(lit(18,375)));
ok('the right border too, pins 1146 to 1520', lit(1145, 375) > 10000, String(lit(1145,375)));

head('the achu is here, not in the body file');
{
  const first = row(0, 0, 10), second = row(1, 0, 10);
  ok('ten pins, five up then five down', first.join('') === '1111100000', first.join(''));
  ok('and the other five on the next line', second.join('') === '0000011111', second.join(''));
  ok('exactly half lift on every line', (()=>{
    for (let y=0;y<H;y++) { let n=0; for (let x=0;x<10;x++) if (up[y*W+x]) n++; if (n!==5) return false; }
    return true; })());
  ok('it flips every line without fail', (()=>{
    for (let y=1;y<H;y++) if (up[y*W] === up[(y-1)*W]) return false;
    return true; })());
  ok('the pins between achu and border stay down', lit(10, 8) === 0, String(lit(10,8)));
}

head('read our way round, it makes no sense');
{
  const ours = raw.bits;
  const litOurs = (from,count)=>{ let n=0; for (let y=0;y<H;y++) for (let x=from;x<from+count;x++) if (ours[y*W+x]) n++; return n; };
  ok('the body block would lift on every line', litOurs(393, 752) === 752*H, String(litOurs(393,752)));
  ok('which no border file can do', litOurs(393,752) > 0);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail?1:0);
