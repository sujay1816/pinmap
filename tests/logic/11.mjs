import { BUILTIN_WEAVES, allWeaves, weaveById, weaveRow, satinRow, compose, state, freshWefts,
         decodeBMP, DEFAULT_LAYOUT } from '../core.mjs';
import fs from 'fs';
import { fileURLToPath as __f } from 'url';
import { dirname as __d, join as __j } from 'path';
const U = __j(__d(__f(import.meta.url)), '..', 'fixtures') + '/';


let pass=0, fail=0;
const ok=(n,c,e='')=>{ c?(pass++,console.log('  ok   '+n)):(fail++,console.log('  FAIL '+n+(e?'  -> '+e:''))); };
const head=t=>console.log('\n== '+t+' ==');
const str=a=>Array.from(a).join('');

head('the built-in weaves');
ok('fifteen weaves — fourteen satins and twills, plus the plain', BUILTIN_WEAVES.length === 15, String(BUILTIN_WEAVES.length));
ok('the plain one is first, and is two pins', BUILTIN_WEAVES[0].pins === 2 && BUILTIN_WEAVES[0].repeat === 2);
ok('each states its pin count', BUILTIN_WEAVES.every(w => w.pins === w.repeat && w.pins >= 2));
ok('ids are unique and stable',
   new Set(BUILTIN_WEAVES.map(w=>w.id)).size === BUILTIN_WEAVES.length &&
   BUILTIN_WEAVES.some(w => w.id === 'satin:8:3'));
ok('lookup by id works', weaveById('satin:8:3').repeat === 8 && weaveById('satin:8:3').step === 3);
ok('unknown id returns nothing', weaveById('nope') === null);
ok('a built-in weave renders as its satin',
   str(weaveRow(weaveById('satin:8:3'), 8, 1, false)) === str(satinRow(8, 1, false, 3)));

head('a weave the user uploads');
const custom = { id:'w1', name:'My lock', pins:4, kind:'custom', width:4, height:2,
                 bits: Uint8Array.from([1,1,0,0, 0,0,1,1]) };
state.weaves = [custom];
ok('it joins the list', allWeaves().length === BUILTIN_WEAVES.length + 1);
ok('found by id', weaveById('w1').name === 'My lock');
ok('line 1 comes out as drawn', str(weaveRow(custom, 4, 0, false)) === '1100');
ok('line 2 comes out as drawn', str(weaveRow(custom, 4, 1, false)) === '0011');
ok('it repeats down the file', str(weaveRow(custom, 4, 2, false)) === '1100');
ok('and tiles across more pins', str(weaveRow(custom, 12, 0, false)) === '110011001100');
ok('warp-faced inverts it', str(weaveRow(custom, 4, 0, true)) === '0011');

head('a tall weave');
const tall = { id:'w2', name:'Six line', pins:3, kind:'custom', width:3, height:6,
               bits: Uint8Array.from([1,0,0, 0,1,0, 0,0,1, 1,0,0, 0,1,0, 0,0,1]) };
ok('cycles over its own height',
   str(weaveRow(tall,3,0,false))==='100' && str(weaveRow(tall,3,2,false))==='001' &&
   str(weaveRow(tall,3,6,false))==='100');

head('driving a real build');

const rd=p=>{const b=fs.readFileSync(p);return decodeBMP(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));};
const men=rd(U+'720_butta_menna.bmp');
const build = (weave, count) => {
  state.segments=[{id:'lk',kind:'locking',count,weave},{id:'bd',kind:'body',count:500}];
  state.totalDeclared=count+500; state.boxMotion='4x4';
  state.opts={achuStartsBlack:true,pinOneLeft:true,topRowFirstPick:true,blackIsIndexZero:true,
              stackMode:'interleave',achuOnBody:false, achuInBody:true,satinWarpFaced:false,autoRotate:true,boxWholeBand:true};
  state.borderFiles={}; state.wefts=freshWefts(); state.wefts[0].file=men;
  return compose();
};
let out = build('satin:12:5', 12);
ok('a chosen satin drives the locking pins', (()=>{
  const cols=[]; for(let y=0;y<12;y++){ let c=-1;
    for(let x=0;x<12;x++) if(out.bits[y*out.width+x]) c=x; cols.push(c); }
  return cols.join(',') === Array.from({length:12},(_,r)=>(r*5)%12).join(','); })());

out = build('w1', 4);
ok('an uploaded weave drives them too',
   Array.from(out.bits.slice(0,4)).join('')==='1100' &&
   Array.from(out.bits.slice(out.width, out.width+4)).join('')==='0011');
out = build('w1', 12);
ok('and tiles when the group is wider',
   Array.from(out.bits.slice(0,12)).join('')==='110011001100');

head('falling back');
out = build(undefined, 8);
ok('no weave chosen still gives a satin', (()=>{
  let n=0; for(let y=0;y<out.height;y++) for(let x=0;x<8;x++) if(out.bits[y*out.width+x]) n++;
  return n===out.height; })());

head('the standard layout ships with a weave');
{
  const lk = DEFAULT_LAYOUT.find(g=>g[0]==='locking');
  ok('locking preset to 8 pins', lk[1]===8);
  ok('and to an 8-end satin', lk[2]==='satin:8:3', String(lk[2]));
}
state.weaves = [];
head('a weave given more pins than its repeat');
{
  const w8 = weaveById('satin:8:3');
  const str8 = (n,r) => Array.from(weaveRow(w8, n, r, false)).join('');
  ok('across its own eight pins it lifts once', str8(8,0).split('1').length-1 === 1);
  ok('across sixteen it binds twice, not once', str8(16,0).split('1').length-1 === 2, str8(16,0));
  ok('the second repeat mirrors the first', (()=>{
    for (let r=0;r<8;r++) { const s=str8(16,r); if (s.slice(0,8) !== s.slice(8)) return false; }
    return true; })());
  ok('across twenty-four it binds three times', str8(24,0).split('1').length-1 === 3);
  ok('a real sixteen-end satin still lifts once across sixteen',
     Array.from(weaveRow(weaveById('satin:16:7'), 16, 0, false)).join('').split('1').length-1 === 1);
  ok('fewer pins than the repeat still works', str8(4,0).length === 4);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail?1:0);
