import fs from 'fs';
import { fileURLToPath as __f } from 'url';
import { dirname as __d, join as __j } from 'path';
import { decodeBMP, fitToPins, compose, state, freshWefts, borderFilesLoaded } from '../core.mjs';
const U = __j(__d(__f(import.meta.url)), '..', 'fixtures') + '/';
let pass=0, fail=0;
const ok=(n,c,e='')=>{ c?(pass++,console.log('  ok   '+n)):(fail++,console.log('  FAIL '+n+(e?'  -> '+e:''))); };
const head=t=>console.log('\n== '+t+' ==');
const rd=p=>{const b=fs.readFileSync(p);return decodeBMP(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));};
const men=rd(U+'720_butta_menna.bmp'), res=rd(U+'720_butta_resham.bmp'), jar=rd(U+'720_butta_jari.bmp');

// a border of a given height, guaranteed to carry something
const borderOf = (src, w, h) => {
  const f = fitToPins(src, 720);
  const b = new Uint8Array(w*h);
  for (let y=0;y<h;y++) for (let x=0;x<w;x++) b[y*w+x] = f.bits[((y+200)%f.height)*f.width + ((x+300)%f.width)];
  return { width:w, height:h, bits:b, name:'border' };
};

const SEGS = () => [
  { id:'a1', kind:'achu',        count:4   },
  { id:'bx', kind:'box',         count:4   },
  { id:'lb', kind:'leftBorder',  count:100 },
  { id:'lk', kind:'locking',     count:8, weave:'satin:8:3' },
  { id:'bd', kind:'body',        count:720 },
  { id:'rb', kind:'rightBorder', count:100 }
];
const AT = { a1:0, bx:4, lb:8, lk:108, bd:116, rb:836 };

const setup = ({ border=false, body=false, borderHeight=240 } = {}) => {
  state.segments = SEGS();
  state.totalDeclared = 936; state.boxMotion='4x4';
  state.opts={achuStartsBlack:true,pinOneLeft:true,topRowFirstPick:true,blackIsIndexZero:true,
              stackMode:'interleave',achuOnBody:false, achuInBody:true,satinWarpFaced:false,autoRotate:true,
              boxWholeBand:true,weavePerDesignLine:true};
  state.borderFiles = border
    ? { lb: borderOf(res,100,borderHeight), rb: borderOf(men,100,borderHeight) } : {};
  state.wefts = freshWefts();
  if (body) [res,jar,men].forEach((f,i)=>{ state.wefts[i].file = fitToPins(f,720); });
};
const lit=(o,from,n)=>{let c=0;for(let y=0;y<o.height;y++)for(let x=from;x<from+n;x++) if(o.bits[y*o.width+x])c++;return c;};

head('the two files are built apart');
setup({ border:true, body:true });
const B = compose('border'), D = compose('body');
ok('both are the full loom width', B.width===936 && D.width===936, `${B.width} / ${D.width}`);
ok('the border takes its own height', B.height===240, String(B.height));
ok('the body takes its wefts, three of them', D.height===500*3, String(D.height));
ok('border height owes nothing to the body', B.height !== D.height);

head('each file carries only what belongs to it');
ok('borders are in the border file',  lit(B,AT.lb,100)>0 && lit(B,AT.rb,100)>0);
ok('and not in the body file',        lit(D,AT.lb,100)===0 && lit(D,AT.rb,100)===0);
ok('the body is in the body file',    lit(D,AT.bd,720)>0);
ok('and not in the border file',      lit(B,AT.bd,720)===0);
ok('the box is body only',            lit(D,AT.bx,4)>0 && lit(B,AT.bx,4)===0);
ok('locking is body only',            lit(D,AT.lk,8)===D.height && lit(B,AT.lk,8)===0);

head('the achu goes to whichever file exists');
ok('with a border, it is in the border file', lit(B,AT.a1,4)>0, String(lit(B,AT.a1,4)));
ok('and stays out of the body file',          lit(D,AT.a1,4)===0, String(lit(D,AT.a1,4)));
{
  setup({ border:false, body:true });
  const only = compose('body');
  ok('with no border, it moves to the body', lit(only,AT.a1,4)>0, String(lit(only,AT.a1,4)));
}
{
  setup({ border:true, body:false });
  const only = compose('border');
  ok('a border on its own still gets it', lit(only,AT.a1,4)>0, String(lit(only,AT.a1,4)));
  ok('and still no box or locking', lit(only,AT.bx,4)===0 && lit(only,AT.lk,8)===0);
}

head('either file can be built alone');
{
  setup({ border:true, body:false });
  ok('border alone builds', compose('border').height===240);
  let threw=false; try { compose('body'); } catch { threw=true; }
  ok('asking for a body with no wefts says so', threw);
}
{
  setup({ border:false, body:true });
  ok('body alone builds', compose('body').height===1500);
  let threw=false; try { compose('border'); } catch { threw=true; }
  ok('asking for a border with no files says so', threw);
}

head('border heights of their own');
for (const h of [120, 240, 907]) {
  setup({ border:true, body:true, borderHeight:h });
  ok(`a ${h}-line border makes a ${h}-line file`, compose('border').height===h);
}
setup({ border:true, body:true, borderHeight:907 });
ok('and the body is unchanged by it', compose('body').height===1500);

head('knowing whether a border is loaded');
setup({ border:true, body:true });
ok('reports true with files',  borderFilesLoaded()===true);
setup({ border:false, body:true });
ok('reports false without',    borderFilesLoaded()===false);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail?1:0);
