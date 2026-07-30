// A second pass: build a whole job end to end with real files, through the UI.
import fs from 'fs';
import { JSDOM } from 'jsdom';
import { fileURLToPath as __f } from 'url';
import { dirname as __d, join as __j } from 'path';
const U = __j(__d(__f(import.meta.url)), '..', 'fixtures') + '/';


const errors = [];
const dom = new JSDOM(fs.readFileSync(process.argv[2], 'utf8'), {
  runScripts:'dangerously', pretendToBeVisual:true,
  beforeParse(win){
    win.HTMLCanvasElement.prototype.getContext = () => ({
      scale(){},beginPath(){},arc(){},fill(){},stroke(){},fillRect(){},strokeRect(){},
      moveTo(){},lineTo(){},fillText(){},setLineDash(){},putImageData(){},
      createImageData:(w,h)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)}),
      set fillStyle(v){},set strokeStyle(v){},set lineWidth(v){},set font(v){},
      set textAlign(v){},set textBaseline(v){},set globalAlpha(v){}});
    win.URL.createObjectURL=()=> 'blob:'; win.URL.revokeObjectURL=()=>{};
    win.scrollTo=()=>{}; win.confirm=()=>true;
    win.alert=m=>errors.push('alert: '+m);
    win.HTMLElement.prototype.scrollIntoView=function(){};
  }
});
const w = dom.window;
w.addEventListener('error', e => errors.push('uncaught: ' + (e.error&&e.error.stack||e.message)));
process.on('unhandledRejection', r => errors.push('rejection: ' + (r&&r.stack)));
await new Promise(r=>setTimeout(r,250));
const $=s=>w.document.querySelector(s), $$=s=>[...w.document.querySelectorAll(s)];
const click=e=>e.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
const setVal=(e,v)=>{e.value=v;e.dispatchEvent(new w.Event('input',{bubbles:true}));};
const setSel=(e,v)=>{e.value=v;e.dispatchEvent(new w.Event('change',{bubbles:true}));};
const step=async(n,f)=>{ try{ await f(); await new Promise(r=>setTimeout(r,80)); console.log('  ok   '+n);}
                         catch(e){ errors.push(n+' -> '+e.message); console.log('  FAIL '+n+'  -> '+e.message);} };

// hand the page a real file, bypassing the file dialog

function attach(input, path) {
  const buf = fs.readFileSync(path);
  const file = { name: path.split('/').pop(),
                 arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset+buf.byteLength) };
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new w.Event('change', { bubbles: true }));
}

if (!$('#gate').hidden) { click($('#signInLocal')); await new Promise(r=>setTimeout(r,300)); }

console.log('\n== a whole job, through the interface ==');
await step('register the A-5 loom', () => {
  click($('#newLoom'));
  setVal($('#loomName'),'A-5');
  setVal($('#totalDeclared'),'1792');
  setSel($('#boxMotion'),'2x1');
});
await step('set the group counts', () => {
  const want=[4,4,500,8,720,500,4,52];
  want.forEach((v,i)=>{ const el=$$('#segTable input[type=number]')[i]; if(el) setVal(el,String(v)); });
});
await step('save it', async () => {
  if ($('#saveLoom').disabled) throw new Error('save disabled: '+$('#loomChecks').textContent.replace(/\s+/g,' ').slice(0,180));
  click($('#saveLoom')); await new Promise(r=>setTimeout(r,200));
  if ($('#sc-job').hidden) throw new Error('did not reach weft files');
});
await step('load three body wefts', async () => {
  const slots = $$('#bodyHost input[type=file]');
  if (slots.length !== 4) throw new Error('expected 4 slots');
  attach(slots[0], U+'720_butta_resham.bmp'); await new Promise(r=>setTimeout(r,120));
  attach($$('#bodyHost input[type=file]')[1], U+'720_butta_jari.bmp'); await new Promise(r=>setTimeout(r,120));
  attach($$('#bodyHost input[type=file]')[2], U+'720_butta_menna.bmp'); await new Promise(r=>setTimeout(r,120));
});
await step('files were turned to fit', () => {
  if (!/turned to fit/.test($('#bodyHost').textContent)) throw new Error('no rotation note: '+$('#bodyHost').textContent.replace(/\s+/g,' ').slice(0,200));
});
await step('box editor appears with a row per weft', () => {
  const rows = $$('#boxEditor .boxrow').length;
  if (rows !== 3) throw new Error('expected 3 rows, found ' + rows);
  const pins = $$('#boxEditor .boxrow')[0].querySelectorAll('button[data-boxpin]').length;
  if (pins !== 4) throw new Error('expected 4 pins, found ' + pins);
});
await step('a pin toggles on click', () => {
  const b = $$('#boxEditor button[data-boxpin]')[0];
  const before = b.getAttribute('aria-pressed');
  click(b);
  const after = $$('#boxEditor button[data-boxpin]')[0].getAttribute('aria-pressed');
  if (before === after) throw new Error('pin did not change: ' + before);
});
await step('clicking again turns it back', () => {
  const before = $$('#boxEditor button[data-boxpin]')[0].getAttribute('aria-pressed');
  click($$('#boxEditor button[data-boxpin]')[0]);
  const after = $$('#boxEditor button[data-boxpin]')[0].getAttribute('aria-pressed');
  if (before === after) throw new Error('did not toggle back');
});
await step('the row is marked as yours once touched', () => {
  if (!/yours/.test($('#boxEditor').textContent)) throw new Error('no marker');
});
await step('presets set a whole side', () => {
  click($$('#boxEditor button[data-boxset]').find(b => b.dataset.p === 'second'));
  const row = $$('#boxEditor .boxrow')[0];
  const on = [...row.querySelectorAll('button[data-boxpin]')].map(b => b.getAttribute('aria-pressed'));
  if (on.join(',') !== 'false,false,true,true') throw new Error(on.join(','));
});
await step('the default is rani all, zari first, meena second', () => {
  click($('#boxReset'));
  const pat = i => [...$$('#boxEditor .boxrow')[i].querySelectorAll('button[data-boxpin]')]
      .map(b => b.getAttribute('aria-pressed') === 'true' ? '1' : '0').join('');
  const got = [pat(0), pat(1), pat(2)].join(' ');
  if (got !== '1111 1100 0011') throw new Error(got);
});
await step('reset restores the standard pattern', () => {
  if (/yours/.test($('#boxEditor').textContent)) throw new Error('still marked as custom');
});
await step('combine becomes available', () => {
  if ($('#combine').disabled) throw new Error('still disabled: '+$('#jobChecks').textContent.replace(/\s+/g,' ').slice(0,200));
});
await step('combine the files', async () => {
  click($('#combine')); await new Promise(r=>setTimeout(r,400));
  if ($('#sc-build').hidden) throw new Error('did not reach build');
});
await step('summary reports the job', () => {
  const t=$('#buildSummary').textContent;
  ['1,792','2x1','2 lines'].forEach(x=>{ if(!t.includes(x)) throw new Error('summary missing '+x+': '+t.replace(/\s+/g,' ')); });
});
await step('summary labels stay on one line', () => {
  const ks=[...$$('#buildSummary .k')].map(e=>e.textContent);
  const long = ks.filter(k => k.length > 12);
  if (long.length) throw new Error('labels too long to fit: ' + long.join(', '));
  if (ks.length !== 6) throw new Error('expected 6 figures, found ' + ks.length);
});
await step('the locking weave is shortened with the full name on hover', () => {
  const cells=[...$$('#buildSummary .cell')];
  const lock=cells.find(c=>c.querySelector('.k').textContent==='Locking');
  if (!lock) throw new Error('no locking figure');
  const v=lock.querySelector('.v');
  if (/,/.test(v.textContent)) throw new Error('still showing the long form: '+v.textContent);
  if (v.title && !v.title.includes(v.textContent.trim()))
    throw new Error('hover text does not match: '+v.title);
});
await step('preview appears', () => {
  if ($('#pvWrap').hidden) throw new Error('no preview');
  if (!/1792 pins/.test($('#pvDims').textContent)) throw new Error('dims: '+$('#pvDims').textContent);
});
await step('download button is live', () => { if ($('#download').disabled) throw new Error('download disabled'); });
await step('zoom and colour toggles work', () => { $$('[data-zoom]').forEach(click); click($('#pvMode')); });
await step('switching an option invalidates and rebuilds', async () => {
  const t = $$('#opts button[data-key=stackMode]')[1]; click(t);
  await new Promise(r=>setTimeout(r,120));
  click($('#build')); await new Promise(r=>setTimeout(r,300));
  if ($('#download').disabled) throw new Error('rebuild failed');
});
console.log('\n== result ==');
if (errors.length){ console.log('  '+errors.length+' problem(s):'); errors.forEach(e=>console.log('   - '+e)); }
else console.log('  no errors');
process.exit(errors.length?1:0);
