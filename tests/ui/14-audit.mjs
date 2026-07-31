// A sweep across every screen, looking for things that are broken or inconsistent.
import fs from 'fs';
import { JSDOM } from 'jsdom';
import { fileURLToPath as __f } from 'url';
import { dirname as __d, join as __j } from 'path';
const U = __j(__d(__f(import.meta.url)), '..', 'fixtures') + '/';
const found=[];
const note=(n,bad,detail)=>{ if(bad){found.push(n);console.log('  ISSUE  '+n+(detail?'  -> '+detail:''));} else console.log('  ok     '+n); };
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const store=new Map();
function boot(){
  const dom=new JSDOM(fs.readFileSync(process.argv[2],'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',
    beforeParse(w){
      w.HTMLCanvasElement.prototype.getContext=()=>({scale(){},beginPath(){},arc(){},fill(){},stroke(){},
        fillRect(){},strokeRect(){},moveTo(){},lineTo(){},fillText(){},setLineDash(){},putImageData(){},
        createImageData:(a,b)=>({width:a,height:b,data:new Uint8ClampedArray(a*b*4)}),
        measureText:t=>({width:String(t).length*6}),closePath(){},save(){},restore(){},clearRect(){},rect(){},translate(){},rotate(){}});
      w.URL.createObjectURL=()=>'blob:'; w.URL.revokeObjectURL=()=>{}; w.scrollTo=()=>{};
      w.confirm=()=>true; w.alert=m=>found.push('alert: '+m); w.HTMLElement.prototype.scrollIntoView=function(){};
      w.storage={ async get(k){ if(!store.has(k)) throw new Error('x'); return {key:k,value:store.get(k)}; },
                  async set(k,v){ store.set(k,v); return {key:k,value:v}; },
                  async delete(k){ store.delete(k); return {key:k,deleted:true}; } };
    }});
  dom.window.addEventListener('error',e=>found.push('uncaught: '+(e.error&&e.error.message||e.message)));
  return dom.window;
}
const attach=(w,input,path)=>{ const buf=fs.readFileSync(path);
  Object.defineProperty(input,'files',{value:[{name:path.split('/').pop(),
    arrayBuffer:async()=>buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength)}],configurable:true});
  input.dispatchEvent(new w.Event('change',{bubbles:true})); };

const w=boot(); await wait(350);
const $=s=>w.document.querySelector(s), $$=s=>[...w.document.querySelectorAll(s)];
const click=e=>e&&e.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
const setVal=(e,v)=>{e.value=v;e.dispatchEvent(new w.Event('input',{bubbles:true}));};
const goTo=n=>click($$('nav.steps button').find(x=>x.dataset.go===n));

click($('#signInLocal')); await wait(300);
click($('#newLoom'));
setVal($('#loomName'),'Audit'); setVal($('#totalDeclared'),'1792');
[4,4,460,16,720,436,8,144].forEach((v,i)=>{ const el=$$('#segTable input[type=number]')[i]; if(el) setVal(el,String(v)); });
await wait(700);

console.log('\n== the pin map screen ==');
note('board drawn', !$('#board'));
note('allocation adds up', !/fully allocated/i.test($('#alloc').textContent), $('#alloc').textContent.replace(/\s+/g,' ').trim());
note('every group has a grip', $$('#segTable button[data-grip]').length !== 8);
note('no arrows left anywhere', !!$('#segTable button[data-act=up]'));
note('weave dropdown on the locking row', !$('select[data-act=weave]'));
{
  const wv = $('select[data-act=weave]');
  const lockCount = $$('#segTable input[type=number]')[3].value;
  note('a 16-pin locking with an 8-end weave is flagged',
       !/repeats 2 times/i.test($('#loomChecks').textContent),
       `${lockCount} pins, weave "${wv?wv.value:'?'}", checks: ${$('#loomChecks').textContent.replace(/\s+/g,' ').slice(0,110)}`);
}

click($('#saveLoom')); await wait(350);

console.log('\n== the border screen ==');
goTo('border'); await wait(250);
note('shared map present', !$('.sideboard[data-board=border] canvas'));
note('no repeated strip above it', !!$('#borderBanner') || !!$('.loombanner'));
note('the map names the loom', !/Audit/.test(($('.sideboard[data-board=border] .sb-loom')||{}).textContent||''), 'caption missing the loom');
note('two border slots', $$('#borderHost input[type=file]').length !== 2);
note('combine blocked with no files', !$('#combineBorder').disabled);
note('achu note explains itself', !/achu/i.test($('#borderAchuNote').textContent));

console.log('\n== the body screen ==');
goTo('body'); await wait(250);
{
  const cells = $$('#bodySummary .cell');
  note('six figures in the summary', cells.length !== 6, String(cells.length));
  const ks = cells.map(c=>c.querySelector('.k').textContent.trim());
  note('no label is long enough to collide', ks.some(k=>k.length>12), ks.join(' | '));
  const vs = cells.map(c=>c.querySelector('.v').textContent.trim());
  note('every figure has a value', vs.some(v=>!v), vs.join(' | '));
  note('pins reads the loom total', vs[0] !== '1,792', vs[0]);
  note('lines and wefts show a dash with nothing loaded', !(vs[1]==='—' && vs[2]==='—'), vs.slice(1,3).join(','));
  note('box shows the motion', vs[3] !== '4x4', vs[3]);
  note('locking names its weave', !/satin|twill/i.test(vs[5]), vs[5]);
}
note('no repeated strip above the map', !!$('#bodyBanner') || !!$('.loombanner'));
note('the map names the loom', !/Audit/.test(($('.sideboard[data-board=body] .sb-loom')||{}).textContent||''), 'caption missing the loom');
note('achu switch present and on', !($('#achuInBody') && $('#achuInBody').checked));
note('four weft slots', $$('#bodyHost input[type=file]').length !== 4);
note('box editor hidden until wefts are loaded', $$('#boxEditor .boxrow').length !== 0);

console.log('\n== with wefts loaded ==');
[0,1].forEach((k,i)=>attach(w, $$('#bodyHost input[type=file]')[k],
  [U+'720_butta_resham.bmp', U+'720_butta_jari.bmp'][i]));
await wait(600);
{
  const vs = $$('#bodySummary .cell').map(c=>c.querySelector('.v').textContent.trim());
  note('wefts now counts two', vs[2] !== '2', vs[2]);
  note('lines now has a number', !/^\d/.test(vs[1]), vs[1]);
  note('box editor now has a row per weft', $$('#boxEditor .boxrow').length !== 2, String($$('#boxEditor .boxrow').length));
  note('files were turned to fit', !/turned to fit/.test($('#bodyHost').textContent));
  note('combine is available', $('#combineBody').disabled,
       $('#bodyChecks').textContent.replace(/\s+/g,' ').slice(0,120));
}
click($('#combineBody')); await wait(400);
note('a preview appears', $('#pvWrap').hidden);
note('download is live', $('#download').disabled);
{
  const d = $('#pvDims').textContent;
  note('the preview reports the right shape', !/1792 pins/.test(d), d);
}

console.log('\n== going back and forth ==');
goTo('border'); await wait(200);
goTo('body'); await wait(200);
note('the body build survived', $('#download').disabled);
note('the summary is still right', $$('#bodySummary .cell').length !== 6);
goTo('loom'); await wait(250);
note('the pin map still draws', !$('#board'));
goTo('looms'); await wait(200);
note('the loom is listed', !/Audit/.test($('#loomList').textContent));

console.log('\n== the sync state ==');
{
  const src = fs.readFileSync(process.argv[2],'utf8');
  const m = src.match(/function explainSyncError[\s\S]*?\n}/);
  note('there is an explainer for sync failures', !m);
  if (m) {
    const fn = new Function('location', m[0] + '; return explainSyncError;')({hostname:'example.test'});
    const cases = {
      'permission-denied': /rules/i,
      'auth/unauthorized-domain': /authorised domains/i,
      'auth/configuration-not-found': /sign-in is not switched on/i,
      'Failed to fetch': /reach Firebase/i
    };
    const bad = Object.entries(cases).filter(([code, want]) => !want.test(fn({ code })));
    note('each common failure gets a useful message', bad.length > 0, bad.map(b=>b[0]).join(', '));
    note('it never returns nothing', !fn(null));
  }
  note('a reconnect can be triggered without a page reload', !/function forceReconnect/.test(src));
  note('there is somewhere to show the reason', !src.includes('id="syncWhy"'));
}

console.log('\n== type ==');
{
  const css = w.document.querySelector('style').textContent;
  const strays = [...css.matchAll(/font-size:\s*([\d.]+)px/g)].map(m => parseFloat(m[1]));
  const small = strays.filter(v => v < 15.5);
  note('nothing sets a small size outside the scale', small.length > 0, small.join(', '));
  note('the scale is actually used', (css.match(/var\(--t-/g) || []).length < 40);
  const build = w.document.querySelector('#appBuild, #gateBuild');
  note('the build is shown, so a stale page is obvious', !build || !/build /.test(build.textContent),
       build ? build.textContent : 'missing');
}

console.log('\n== stylesheet hygiene ==');
{
  const css = w.document.querySelector('style').textContent;
  // A bare .cell rule once matched both the box previews and the summary
  // figures, forcing the figures to 13x13 with a border.
  // a rule whose whole selector is just ".cell" — it once matched both the box
  // previews and the summary figures, forcing those to 13x13 with a border
  const bare = /(^|\})\s*\.cell\s*\{/.test(css);
  note('no unscoped .cell rule', bare, 'a bare .cell rule is back');

  // A single-class rule that pins width and height will squash anything else
  // that happens to share the name. These few are meant to be that size.
  const MARKERS = ['.swatch', '.spin'];
  const risky = [];
  css.replace(/(^|\})\s*(\.[a-zA-Z][\w-]*)\s*\{([^}]*)\}/g, (m, _b, sel, body) => {
    if (/[^-]width:\s*\d+px/.test(' ' + body) && /[^-]height:\s*\d+px/.test(' ' + body)
        && !MARKERS.includes(sel)) risky.push(sel);
    return m;
  });
  note('no new single-class rule pins both width and height', risky.length > 0, risky.join(', '));
}

console.log('\n== result ==');
if (found.length){ console.log('  '+found.length+' problem(s)'); found.forEach(e=>console.log('   - '+e)); }
else console.log('  no errors');
process.exit(found.length?1:0);
