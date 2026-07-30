import fs from 'fs';
import { satinRow, satinStep, gcd, compose, state, freshWefts, decodeBMP, encodeBMP1 } from '../core.mjs';
import { fileURLToPath as __f } from 'url';
import { dirname as __d, join as __j } from 'path';
const U = __j(__d(__f(import.meta.url)), '..', 'fixtures') + '/';


let pass=0, fail=0;
const ok=(n,c,e='')=>{ c?(pass++,console.log('  ok   '+n)):(fail++,console.log('  FAIL '+n+(e?'  -> '+e:''))); };
const head=t=>console.log('\n== '+t+' ==');

head('satin move numbers');
ok('5-end satin steps 2', satinStep(5)===2, String(satinStep(5)));
ok('7-end satin steps 3', satinStep(7)===3, String(satinStep(7)));
ok('8-end satin steps 3', satinStep(8)===3, String(satinStep(8)));
ok('11-end satin steps 5', satinStep(11)===5, String(satinStep(11)));
ok('16-end satin steps 7', satinStep(16)===7, String(satinStep(16)));
ok('a true satin never steps 1 or N-1',
   [5,7,8,9,10,11,12,13,16,20].every(n => { const st=satinStep(n); return st!==1 && st!==n-1; }));
ok('the move is always coprime with the repeat',
   [5,7,8,9,10,11,12,13,16,20].every(n => gcd(satinStep(n), n) === 1));
ok('repeats under 5 fall back to a plain step',
   satinStep(4)===1 && satinStep(3)===1 && satinStep(2)===1);
ok('6 has no true satin, so it falls back',
   [1,5].includes(satinStep(6)), String(satinStep(6)));

head('the satin cloth itself');
{
  const n = 8;
  const rows = Array.from({length:n}, (_,r)=>satinRow(n,r,false));
  ok('one pin up on every line', rows.every(r => r.reduce((a,b)=>a+b,0)===1));
  const cols = rows.map(r => r.indexOf(1));
  ok('every pin is used exactly once per repeat', new Set(cols).size===n, cols.join(','));
  ok('the interlacings step by 3', cols.join(',')==='0,3,6,1,4,7,2,5', cols.join(','));
  // no two interlacings adjacent on consecutive lines — the point of a satin
  let touching = 0;
  for (let r=1;r<n;r++) if (Math.abs(cols[r]-cols[r-1])===1 || Math.abs(cols[r]-cols[r-1])===n-1) touching++;
  ok('no interlacing touches the one before it', touching===0, String(touching));
}
{
  const n = 5, rows = Array.from({length:n},(_,r)=>satinRow(n,r,false));
  ok('5-end satin runs 0,2,4,1,3', rows.map(r=>r.indexOf(1)).join(',')==='0,2,4,1,3');
}
head('it repeats');
{
  const n=8;
  ok('line 9 matches line 1', satinRow(n,8,false).join('')===satinRow(n,0,false).join(''));
  ok('line 17 matches line 1', satinRow(n,16,false).join('')===satinRow(n,0,false).join(''));
}
head('polarity');
{
  const n=8, up=satinRow(n,3,false), down=satinRow(n,3,true);
  ok('warp-faced is the exact inverse', up.every((v,i)=>down[i]===(v?0:1)));
  ok('warp-faced leaves one pin down', down.reduce((a,b)=>a+b,0)===n-1);
}

head('locking inside a real build');

const rd=p=>{const b=fs.readFileSync(p);return decodeBMP(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));};
const men=rd(U+'720_butta_menna.bmp');
state.segments=[
  { id:'lk', kind:'locking', count:8   },
  { id:'bd', kind:'body',    count:500 }
];
state.totalDeclared=508;
state.opts={achuStartsBlack:true,pinOneLeft:true,topRowFirstPick:true,blackIsIndexZero:true,
            stackMode:'interleave',achuOnBody:true,satinWarpFaced:false,boxWholeBand:true};
state.borderFiles={};
state.wefts=freshWefts(); state.wefts[0].file=men;
let out=compose();
ok('builds 508 x 720', out.width===508 && out.height===720);
{
  let perLine=true, total=0;
  for (let y=0;y<out.height;y++){
    let c=0; for(let x=0;x<8;x++) if(out.bits[y*508+x]) c++;
    if(c!==1) perLine=false; total+=c;
  }
  ok('exactly one locking pin up on each of the 720 lines', perLine && total===720, String(total));
}
{
  const seen = new Array(8).fill(0);
  for (let y=0;y<8;y++) for(let x=0;x<8;x++) if(out.bits[y*508+x]) seen[x]++;
  ok('the first eight lines use all eight pins once', seen.every(v=>v===1), seen.join(','));
}
ok('locking region still coded 5', out.region[0]===5);

head('locking under four pins');
state.segments=[{ id:'lk', kind:'locking', count:4 },{ id:'bd', kind:'body', count:500 }];
state.totalDeclared=504;
out=compose();
{
  let total=0;
  for (let y=0;y<out.height;y++) for(let x=0;x<4;x++) if(out.bits[y*504+x]) total++;
  ok('still one pin per line with the fallback step', total===720, String(total));
}

fs.writeFileSync('satin.bmp', Buffer.from(encodeBMP1(out.bits,out.width,out.height,true)));
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail?1:0);
