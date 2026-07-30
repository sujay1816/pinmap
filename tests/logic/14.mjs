import { weftBoxPattern, hasCustomBox, boxPrefKey, defaultBoxPattern, state, BOX_TABLE } from '../core.mjs';
let pass=0, fail=0;
const ok=(n,c,e='')=>{ c?(pass++,console.log('  ok   '+n)):(fail++,console.log('  FAIL '+n+(e?'  -> '+e:''))); };
const head=t=>console.log('\n== '+t+' ==');
const str=a=>Array.from(a).join('');

head('the default for three shuttles');
ok('rani lifts every pin',        str(defaultBoxPattern(4,0,3))==='1111');
ok('zari lifts the first half',   str(defaultBoxPattern(4,1,3))==='1100', str(defaultBoxPattern(4,1,3)));
ok('meena lifts the second half', str(defaultBoxPattern(4,2,3))==='0011', str(defaultBoxPattern(4,2,3)));
ok('the table reads all, first, second', BOX_TABLE[3].join(',')==='all,first,second', BOX_TABLE[3].join(','));
ok('a fourth shuttle still lifts nothing', str(defaultBoxPattern(4,3,4))==='0000');
ok('two shuttles still lift everything',
   str(defaultBoxPattern(4,0,2))==='1111' && str(defaultBoxPattern(4,1,2))==='1111');
ok('one shuttle still lifts nothing', str(defaultBoxPattern(4,0,1))==='0000');
ok('six pins: zari 111000, meena 000111',
   str(defaultBoxPattern(6,1,3))==='111000' && str(defaultBoxPattern(6,2,3))==='000111');

head('what the user sets is remembered');
state.boxPrefs = {};
const w2 = { id:'w2', name:'Zari' };
ok('nothing remembered to begin with', !hasCustomBox(w2,4));
state.boxPrefs[boxPrefKey(w2,4)] = '1010';
ok('a remembered pattern is used', str(weftBoxPattern(w2,4,1,3))==='1010');
ok('and counts as a pattern of your own', hasCustomBox(w2,4));
ok('a pattern set this session wins over the remembered one',
   str(weftBoxPattern({ id:'w2', box:'0101' },4,1,3))==='0101');
ok('remembered under a different pin count does not apply',
   str(weftBoxPattern(w2,6,1,3))==='111000', str(weftBoxPattern(w2,6,1,3)));
ok('each shuttle remembers separately', (()=>{
   state.boxPrefs[boxPrefKey({id:'w3'},4)] = '0001';
   return str(weftBoxPattern({id:'w3'},4,2,3))==='0001' && str(weftBoxPattern(w2,4,1,3))==='1010'; })());
ok('clearing it returns to the default', (()=>{
   delete state.boxPrefs[boxPrefKey(w2,4)];
   return str(weftBoxPattern(w2,4,1,3))==='1100' && !hasCustomBox(w2,4); })());
state.boxPrefs = {};

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail?1:0);
