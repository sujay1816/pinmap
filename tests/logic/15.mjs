// Joining two copies of a library that have drifted apart.
import { mergeLibraries, newerOf, normalBoxMotion } from '../core.mjs';
let pass=0, fail=0;
const ok=(n,c,e='')=>{ c?(pass++,console.log('  ok   '+n)):(fail++,console.log('  FAIL '+n+(e?'  -> '+e:''))); };
const head=t=>console.log('\n== '+t+' ==');
const loom=(name,savedAt,extra={})=>({ name, savedAt, version:1, segments:[{kind:'body',count:100}], ...extra });
const names=r=>r.looms.map(l=>l.name).sort().join(',');

head('two machines, different looms');
{
  const r = mergeLibraries(
    { looms:[loom('Shed 1','2026-07-01')], updatedAt:'2026-07-01' },
    { looms:[loom('Shed 2','2026-07-02')], updatedAt:'2026-07-02' });
  ok('both survive', names(r)==='Shed 1,Shed 2', names(r));
}

head('the same loom edited on both');
{
  const r = mergeLibraries(
    { looms:[loom('A','2026-07-05',{version:3})], updatedAt:'2026-07-05' },
    { looms:[loom('A','2026-07-09',{version:7})], updatedAt:'2026-07-09' });
  ok('only one copy is kept', r.looms.length===1);
  ok('the newer save wins', r.looms[0].version===7, String(r.looms[0].version));
}
{
  const r = mergeLibraries(
    { looms:[loom('A','2026-07-20',{version:9})], updatedAt:'2026-07-20' },
    { looms:[loom('A','2026-07-02',{version:1})], updatedAt:'2026-07-02' });
  ok('and it does not matter which side it is on', r.looms[0].version===9, String(r.looms[0].version));
}

head('a loom deleted on one machine');
{
  const r = mergeLibraries(
    { looms:[], graveyard:[{name:'Old',deletedAt:'2026-07-10'}], updatedAt:'2026-07-10' },
    { looms:[loom('Old','2026-07-01')], updatedAt:'2026-07-01' });
  ok('stays deleted rather than coming back', names(r)==='', names(r));
  ok('the deletion is remembered for other machines', r.graveyard.length===1);
}
{
  const r = mergeLibraries(
    { looms:[], graveyard:[{name:'Old',deletedAt:'2026-07-10'}], updatedAt:'2026-07-10' },
    { looms:[loom('Old','2026-07-15')], updatedAt:'2026-07-15' });
  ok('but a loom saved again afterwards is kept', names(r)==='Old', names(r));
}

head('weaves');
{
  const r = mergeLibraries(
    { weaves:[{id:'w1',name:'Mine',width:4,height:2,rows:['1100','0011']}], updatedAt:'2026-07-01' },
    { weaves:[{id:'w2',name:'Yours',width:4,height:2,rows:['1010','0101']}], updatedAt:'2026-07-02' });
  ok('both libraries are kept', r.weaves.length===2);
  ok('matched by id, not name', mergeLibraries(
      { weaves:[{id:'w1',name:'A'}] }, { weaves:[{id:'w1',name:'B'}] }).weaves.length===1);
}

head('box settings');
{
  const r = mergeLibraries(
    { boxPrefs:{'4:w1':'1111'}, updatedAt:'2026-07-01' },
    { boxPrefs:{'4:w2':'1100'}, updatedAt:'2026-07-02' });
  ok('settings from both sides are kept', Object.keys(r.boxPrefs).sort().join(',')==='4:w1,4:w2');
}
{
  const r = mergeLibraries(
    { boxPrefs:{'4:w1':'1111'}, updatedAt:'2026-07-01' },
    { boxPrefs:{'4:w1':'0011'}, updatedAt:'2026-07-09' });
  ok('on a clash the newer side wins', r.boxPrefs['4:w1']==='0011', r.boxPrefs['4:w1']);
}
{
  const r = mergeLibraries(
    { boxPrefs:{'4:w1':'1111'}, updatedAt:'2026-07-20' },
    { boxPrefs:{'4:w1':'0011'}, updatedAt:'2026-07-02' });
  ok('and the local side can win too', r.boxPrefs['4:w1']==='1111', r.boxPrefs['4:w1']);
}

head('nothing on one side');
{
  ok('an empty remote keeps everything local',
     names(mergeLibraries({ looms:[loom('A','2026-07-01')] }, {}))==='A');
  ok('an empty local takes everything remote',
     names(mergeLibraries({}, { looms:[loom('B','2026-07-01')] }))==='B');
  ok('two empties do not throw', mergeLibraries({}, {}).looms.length===0);
  ok('undefined does not throw', mergeLibraries(undefined, undefined).looms.length===0);
}

head('merging twice changes nothing more');
{
  const a = { looms:[loom('A','2026-07-01'),loom('B','2026-07-03')],
              graveyard:[{name:'C',deletedAt:'2026-07-04'}], boxPrefs:{'4:w1':'1111'}, updatedAt:'2026-07-04' };
  const b = { looms:[loom('B','2026-07-09'),loom('C','2026-07-02')], boxPrefs:{'4:w2':'0011'}, updatedAt:'2026-07-09' };
  const once = mergeLibraries(a, b);
  const twice = mergeLibraries(once, b);
  ok('the same looms come out', names(once)===names(twice), names(once)+' vs '+names(twice));
  ok('the deleted one stays gone', !names(once).includes('C'), names(once));
  ok('the newer B is kept', once.looms.find(l=>l.name==='B').savedAt==='2026-07-09');
}

head('picking the newer of two');
ok('by save time', newerOf({savedAt:'2026-01-01'},{savedAt:'2026-06-01'}).savedAt==='2026-06-01');
ok('a missing time loses', newerOf({},{savedAt:'2026-01-01'}).savedAt==='2026-01-01');

head('the box motion that got renamed');
ok('4 by 1 is itself', normalBoxMotion('4x1')==='4x1');
ok('a loom saved as 2x1 still reads as 4 by 1', normalBoxMotion('2x1')==='4x1');
ok('4 by 4 is untouched', normalBoxMotion('4x4')==='4x4');
ok('anything unknown falls back to 4 by 4',
   normalBoxMotion('')==='4x4' && normalBoxMotion(undefined)==='4x4' && normalBoxMotion('nonsense')==='4x4');

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail?1:0);
