import { closeBandGaps, boxRow } from '../core.mjs';
let pass=0, fail=0;
const ok=(n,c,e='')=>{ c?(pass++,console.log('  ok   '+n)):(fail++,console.log('  FAIL '+n+(e?'  -> '+e:''))); };
const head=t=>console.log('\n== '+t+' ==');
const mk = s => Uint8Array.from(s.split('').map(Number));
const str = a => Array.from(a).join('');

head('holes inside a butta band');
ok('a short hole inside a long band is closed',
   str(closeBandGaps(mk('0011111011111000000000')))==='0011111111111000000000',
   str(closeBandGaps(mk('0011111011111000000000'))));
ok('a long gap between two short bands is left alone',
   str(closeBandGaps(mk('0110000000000110')))==='0110000000000110',
   str(closeBandGaps(mk('0110000000000110'))));
ok('the real shape: two 100-line bands 150 apart stay apart', (()=>{
   const f=new Uint8Array(500);
   for(let i=77;i<177;i++) f[i]=1;
   for(let i=327;i<427;i++) f[i]=1;
   const g=closeBandGaps(f.slice());
   return g.reduce((a,b)=>a+b,0)===200; })());
ok('several small holes all close',
   str(closeBandGaps(mk('11101110111000')))==='11111111111000',
   str(closeBandGaps(mk('11101110111000'))));
ok('nothing to do on a clean band',
   str(closeBandGaps(mk('0001111000')))==='0001111000');
ok('all plain stays plain', str(closeBandGaps(mk('00000')))==='00000');
ok('all butta stays butta', str(closeBandGaps(mk('11111')))==='11111');

head('even box pins only');
ok('four pins split two and two',
   boxRow(4,1,3,true).join('')==='1100' && boxRow(4,2,3,true).join('')==='0011',
   boxRow(4,1,3,true).join('')+' '+boxRow(4,2,3,true).join(''));
ok('six pins split three and three',
   boxRow(6,1,3,true).join('')==='111000' && boxRow(6,2,3,true).join('')==='000111');
ok('eight pins split four and four',
   boxRow(8,1,3,true).join('')==='11110000' && boxRow(8,2,3,true).join('')==='00001111');
ok('rani takes them all whatever the count',
   boxRow(6,0,3,true).join('')==='111111' && boxRow(8,0,3,true).join('')==='11111111');

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail?1:0);
