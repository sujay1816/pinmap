// How Sri Tex work the box.
//
// Their box is four pins, so a half is a pair. Which half lifts depends on how
// many designs are loaded, and it is asked of each weft separately: a weft with
// nothing to weave on a line does not drop its box pins, it takes the
// one-design setting.
import fs from 'fs';
import { fileURLToPath as __f } from 'url';
import { dirname as __d, join as __j } from 'path';
import { decodeBMP, compose, state, freshWefts, COMPANIES, boxPlan, boxRow, SRITEX_BOX } from '../core.mjs';
let pass=0, fail=0;
const ok=(n,c,e='')=>{ c?(pass++,console.log('  ok   '+n)):(fail++,console.log('  FAIL '+n+(e?'  -> '+e:''))); };
const head=t=>console.log('\n== '+t+' ==');
const sritex = COMPANIES.find(c => c.id === 'sritex');
const saitex = COMPANIES.find(c => c.id === 'saitex');

head('the company carries its own way of working the box');
ok('Sri Tex has one', sritex.opts.boxScheme === 'sritex');
ok('Sai Tex keeps the standard table', saitex.opts.boxScheme === 'default');

head('which half lifts, by how many designs are loaded');
const plan = (n) => Array.from({length:n}, (_,i) => boxPlan(n, i, true, 'sritex'));
ok('one design: the first half',              plan(1).join()==='first', plan(1).join());
ok('two: second, then first',                 plan(2).join()==='second,first', plan(2).join());
ok('three: second, both down, then first',    plan(3).join()==='second,none,first', plan(3).join());
// Four was never specified, so it must not be invented here.
ok('four falls back to the standard table, to be set by hand',
   plan(4).join() === ['all','first','second','none'].join(), plan(4).join());

head('a weft with nothing to weave takes the one-design setting');
for (const n of [1,2,3]) {
  const got = Array.from({length:n}, (_,i) => boxPlan(n, i, false, 'sritex'));
  ok(`${n} design${n>1?'s':''}: every idle weft lifts the one-design half`,
     got.every(p => p === SRITEX_BOX[1][0]), got.join());
}
// The fallback must follow the table, not name a half of its own, or the two
// drift apart the next time the rule changes.
ok('the fallback is the one-design setting itself, not a copy of it',
   boxPlan(3, 1, false, 'sritex') === SRITEX_BOX[1][0]);

head('four pins, so a half is a pair');
{
  // Pick the wefts by the plan they produce, not by their position, so this
  // still says what it means if the table is reordered again.
  const rowFor = (want, n) => {
    for (let i = 0; i < n; i++) if (boxPlan(n, i, true, 'sritex') === want)
      return Array.from(boxRow(4, i, n, true, 'sritex')).join('');
    return '(no weft takes that plan)';
  };
  ok('the first half is the first two pins', rowFor('first', 2) === '1100', rowFor('first', 2));
  ok('the second half is the last two',      rowFor('second', 2) === '0011', rowFor('second', 2));
  ok('and both down means both down',        rowFor('none', 3) === '0000', rowFor('none', 3));
}

head('Sai Tex is untouched');
{
  const before = [[2,0],[2,1],[3,0],[3,1],[3,2],[4,0],[4,3]]
    .map(([n,i]) => boxPlan(n, i, true, 'default')).join(',');
  ok('the standard table still reads as it did',
     before === 'all,all,all,first,second,all,none', before);
  ok('and a plain line still leaves the box down', boxPlan(3, 0, false, 'default') === 'none');
}

// ---- the whole thing, built on the loom the samples came off ----
const U = __j(__d(__f(import.meta.url)), '..', 'fixtures') + '/';
head('built end to end');
{
  const bits = (w,h,every) => { const b=new Uint8Array(w*h);
    for (let y=0;y<h;y++) if (every(y)) for (let x=0;x<8;x++) b[y*w+x]=1; return {width:w,height:h,bits:b}; };
  // three designs: the first always has figure, the second only on even rows,
  // the third always. That makes the fallback visible on the second.
  state.segments=[{id:'a1',kind:'achu',count:10},{id:'bx',kind:'box',count:4},
    {id:'h1',kind:'empty',count:2},{id:'e1',kind:'empty',count:2},
    {id:'lb',kind:'leftBorder',count:375},{id:'l1',kind:'locking',count:16,weave:'satin:16:7'},
    {id:'bd',kind:'body',count:720},{id:'l2',kind:'locking',count:16,weave:'satin:16:7'},
    {id:'rb',kind:'rightBorder',count:375},{id:'a2',kind:'achu',count:14},
    {id:'h2',kind:'empty',count:2},{id:'e2',kind:'empty',count:32}];
  state.totalDeclared=1568; state.boxMotion='4x4'; state.weaves=[]; state.boxPrefs={};
  state.borderFiles={ lb:{width:375,height:40,bits:new Uint8Array(375*40)} };
  state.opts={...sritex.opts, achuOnBody:false, achuInBody:true, boxWholeBand:false};
  state.wefts=freshWefts();
  state.wefts[0].file = bits(720,20,()=>true);
  state.wefts[1].file = bits(720,20,y=>y%2===0);
  state.wefts[2].file = bits(720,20,()=>true);

  const b = compose('body');
  // the file is written mirrored, so box pin p sits at column width-p+1
  const up=(y,p)=>b.bits[y*b.width+(b.width-p)];
  const box=y=>{ let t=''; for(let p=11;p<=14;p++) t+=up(y,p)?'1':'0'; return t; };

  // design row 0: all three have figure
  ok('row 0, weft 1 lifts the second half', box(0)==='0011', box(0));
  ok('row 0, weft 2 keeps both down',       box(1)==='0000', box(1));
  ok('row 0, weft 3 lifts the first half',  box(2)==='1100', box(2));
  // design row 1: weft 2 has nothing to weave
  ok('row 1, weft 1 still lifts the second half',  box(3)==='0011', box(3));
  ok('row 1, weft 2 falls back to the first half', box(4)==='1100', box(4));
  ok('row 1, weft 3 is unchanged',                 box(5)==='1100', box(5));
}

head('one design on its own');
{
  state.wefts=freshWefts();
  const b1=new Uint8Array(720*20); for(let y=0;y<20;y+=2) for(let x=0;x<8;x++) b1[y*720+x]=1;
  state.wefts[0].file={width:720,height:20,bits:b1};
  const b=compose('body');
  const up=(y,p)=>b.bits[y*b.width+(b.width-p)];
  const box=y=>{ let t=''; for(let p=11;p<=14;p++) t+=up(y,p)?'1':'0'; return t; };
  ok('with figure, the first half lifts',      box(0)==='1100', box(0));
  ok('and with nothing to weave, still the first half', box(1)==='1100', box(1));
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail?1:0);
