import fs from 'fs';
import { JSDOM } from 'jsdom';

const file = process.argv[2] || 'pinmapH.html';
const errors = [];

// canvas is not implemented in jsdom; give it just enough to not explode
function stubCanvas(win) {
  win.HTMLCanvasElement.prototype.getContext = function () {
    return {
      scale(){}, beginPath(){}, arc(){}, fill(){}, stroke(){}, fillRect(){}, strokeRect(){},
      moveTo(){}, lineTo(){}, fillText(){}, setLineDash(){}, putImageData(){},
      createImageData: (w,h)=>({ width:w, height:h, data:new Uint8ClampedArray(w*h*4) }),
      set fillStyle(v){}, set strokeStyle(v){}, set lineWidth(v){}, set font(v){},
      set textAlign(v){}, set textBaseline(v){}, set globalAlpha(v){}
    };
  };
  win.URL.createObjectURL = () => 'blob:stub';
  win.URL.revokeObjectURL = () => {};
  win.scrollTo = () => {};
  win.confirm = () => true;
  win.alert = (m) => errors.push('alert: ' + m);
  win.HTMLElement.prototype.scrollIntoView = function(){};
}

const dom = new JSDOM(fs.readFileSync(file, 'utf8'), {
  runScripts: 'dangerously', pretendToBeVisual: true,
  beforeParse: stubCanvas
});
const { window } = dom;
window.addEventListener('error', e => errors.push('uncaught: ' + (e.error && e.error.stack || e.message)));
const origErr = console.error;

await new Promise(r => setTimeout(r, 300));

const $ = s => window.document.querySelector(s);
const $$ = s => [...window.document.querySelectorAll(s)];
const click = el => { if (!el) throw new Error('no element to click'); el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); };
const setVal = (el, v) => { el.value = v; el.dispatchEvent(new window.Event('input', { bubbles: true })); };
const setSel = (el, v) => { el.value = v; el.dispatchEvent(new window.Event('change', { bubbles: true })); };

const step = async (name, fn) => {
  try { await fn(); await new Promise(r=>setTimeout(r,60)); console.log('  ok   ' + name); }
  catch (e) { errors.push(name + ' -> ' + e.message); console.log('  FAIL ' + name + '  -> ' + e.message); }
};

console.log('\n== walking the interface ==');

await step('sign-in screen is the front door', () => {
  if ($('#gate').hidden) throw new Error('gate not shown');
  if ($('#app').hidden !== true) throw new Error('app should be hidden behind it');
  if (!$('#signInGoogle') || !$('#signInLocal')) throw new Error('missing sign-in buttons');
});
await step('use this device only opens the app', async () => {
  click($('#signInLocal'));
  await new Promise(r => setTimeout(r, 300));
  if (!$('#gate').hidden) throw new Error('gate still showing');
  if ($('#app').hidden) throw new Error('app still hidden');
});
await step('the header says who is using it', () => {
  if (!/this device/.test($('#whoami').textContent)) throw new Error($('#whoami').textContent);
});

await step('landing screen shows the loom list', () => {
  if ($('#sc-looms').hidden) throw new Error('looms screen hidden');
  if (!$('#loomList').textContent.trim()) throw new Error('loom list empty of content');
});

await step('register a loom', () => { click($('#newLoom')); if ($('#sc-loom').hidden) throw new Error('did not reach the pin map screen'); });
await step('name it and set total pins', () => {
  setVal($('#loomName'), 'Smoke Test Loom');
  setVal($('#totalDeclared'), '1792');
});
await step('box motion selector works', () => {
  const sel = $('#boxMotion'); if (!sel) throw new Error('no box motion field');
  setSel(sel, '2x1'); setSel(sel, '4x4');
});
await step('default groups are present', () => {
  const rows = $$('#segTable .seg-row').length - 1;
  if (rows !== 8) throw new Error('expected 8 groups, found ' + rows);
});
const fillCounts = (want) => {
  want.forEach((v,i) => {
    const el = $$('#segTable input[type=number]')[i];
    if (el) setVal(el, String(v));
  });
};
await step('fill in the blank counts', () => fillCounts([4,4,150,8,1100,150,4,372]));
await step('pin board draws', () => { if (!$('#board')) throw new Error('no board canvas'); });
await step('board zoom buttons', () => { $$('[data-bzoom]').forEach(b => click(b)); });
await step('weave library panel present', () => {
  if (!$('#weaveList').textContent.trim()) throw new Error('no weave library');
  if (!$('#addWeave')) throw new Error('no add-weave button');
});
await step('locking row offers a weave dropdown', () => {
  const sel = $('select[data-act=weave]'); if (!sel) throw new Error('no weave dropdown');
  if (sel.options.length < 10) throw new Error('only ' + sel.options.length + ' weaves offered');
});
await step('choosing a weave sets the pin count', () => {
  const sel = $('select[data-act=weave]');
  setSel(sel, 'satin:12:5');
  const rows = $$('#segTable .seg-row');
  const lock = rows.find(r => (r.querySelector('select[data-act=kind]')||{}).value === 'locking');
  const n = lock.querySelector('input[type=number]').value;
  if (n !== '12') throw new Error('count is ' + n + ', expected 12');
});
await step('content column names every group source', () => {
  const txt = $('#segTable').textContent;
  ['generated','uploaded file','weft files','stays down'].forEach(w => {
    if (!txt.includes(w)) throw new Error('missing content note: ' + w);
  });
});
await step('add and remove a group', () => {
  click($('[data-add=empty]'));
  const dels = $$('#segTable button[data-act=del]'); click(dels[dels.length-1]);
});
await step('reorder a group', () => { click($$('#segTable button[data-act=down]')[0]); click($$('#segTable button[data-act=up]')[1]); });
await step('re-fill counts after the weave change', () => fillCounts([4,4,150,12,1096,150,4,372]));
await step('validation reports readiness', () => {
  const txt = $('#loomChecks').textContent;
  if (!txt.trim()) throw new Error('no validation output');
});
await step('save the loom', async () => {
  if ($('#saveLoom').disabled) throw new Error('save disabled: ' + $('#loomChecks').textContent.replace(/\s+/g,' ').slice(0,200));
  click($('#saveLoom'));
  await new Promise(r => setTimeout(r, 150));
  if ($('#sc-job').hidden) throw new Error('did not advance to weft files');
});
await step('border and body slots render', () => {
  if (!$('#borderHost').textContent.trim()) throw new Error('no border slots');
  if (!$('#bodyHost').textContent.trim()) throw new Error('no body slots');
  const n = $$('#bodyHost input[type=file]').length;
  if (n !== 4) throw new Error('expected 4 weft slots, found ' + n);
});
await step('weft names are editable', () => {
  const el = $$('#bodyHost input[type=text]')[0]; setVal(el, 'Rani');
});
await step('combine is blocked until files load', () => {
  if (!$('#combine').disabled) throw new Error('combine should be disabled with no files');
});
await step('step nav respects prerequisites', () => {
  const b = $$('nav.steps button').find(x => x.dataset.go === 'build');
  if (!b.disabled) throw new Error('build step should be locked');
});
await step('go back to the loom list', () => {
  click($$('nav.steps button').find(x => x.dataset.go === 'looms'));
  if ($('#sc-looms').hidden) throw new Error('did not return');
});
await step('saved loom appears as a card', () => {
  if (!/Smoke Test Loom/.test($('#loomList').textContent)) throw new Error('loom not listed');
});
await step('use / edit / duplicate buttons exist', () => {
  ['use','edit','dupe','exp'].forEach(a => { if (!$(`button[data-act=${a}]`)) throw new Error('missing ' + a); });
});
await step('duplicate a loom', () => { click($('button[data-act=dupe]')); if ($('#sc-loom').hidden) throw new Error('no edit screen'); });
await step('back and use the loom', async () => {
  click($$('nav.steps button').find(x => x.dataset.go === 'looms'));
  click($('button[data-act=use]'));
  await new Promise(r => setTimeout(r, 150));
  if ($('#sc-job').hidden) throw new Error('did not reach weft files');
});
await step('options render on the build screen', () => {
  click($$('nav.steps button').find(x => x.dataset.go === 'job'));
  const opts = $$('#opts .opt').length;
  if (opts < 5) throw new Error('only ' + opts + ' options');
});

await step('toast element exists', () => { if (!$('#toast')) throw new Error('no toast'); });
await step('backup button is live once a loom exists', () => {
  if ($('#exportAll').disabled) throw new Error('backup disabled');
});
await step('search and sort appear with two or more looms', () => {
  const many = $$('.loomcard').length >= 2;
  if (many && $('#loomTools').hidden) throw new Error('tools hidden with ' + $$('.loomcard').length + ' looms');
});
await step('loom cards show group pills and a used-when line', () => {
  const t = $('#loomList').textContent;
  if (!/pins/.test(t)) throw new Error('no meta');
  if (!$('.loomcard .pill')) throw new Error('no group pills');
  if (!$('.loomcard .when')) throw new Error('no used-when line');
});
await step('searching filters the list', () => {
  const before = $$('.loomcard').length;
  setVal($('#loomSearch'), 'zzzznope');
  if ($$('.loomcard').length !== 0) throw new Error('filter did nothing');
  if (!/No loom matches/.test($('#loomList').textContent)) throw new Error('no empty-result message');
  setVal($('#loomSearch'), '');
  if ($$('.loomcard').length !== before) throw new Error('did not restore');
});
await step('sorting does not throw', () => {
  ['name','pins','recent'].forEach(v => setSel($('#loomSort'), v));
  if (!$$('.loomcard').length) throw new Error('list emptied');
});
await step('weave library accepts a name without a file gracefully', () => {
  setVal($('#loomName'), 'x');
  click($$('nav.steps button').find(x => x.dataset.go === 'looms'));
});

console.log('\n== result ==');
if (errors.length) { console.log('  ' + errors.length + ' problem(s):'); errors.forEach(e=>console.log('   - '+e)); }
else console.log('  no errors');
process.exit(errors.length ? 1 : 0);
