// Nothing may be left waiting on something that never comes.
//
// There are no threads here, so no deadlock in the textbook sense. What there
// is instead: a guard taken and never given back, a save asked for while one is
// running and quietly dropped, and a dot that sits on "saving" for the rest of
// the afternoon while the weaver believes the work is safe. That last one is
// the dangerous shape, because it looks like the app is still working.
import fs from 'fs';
import { JSDOM } from 'jsdom';
const errors=[]; const ok=(n,c,e='')=>{ c?console.log('  ok   '+n):(errors.push(n),console.log('  FAIL '+n+(e?'  -> '+e:''))); };
const wait=ms=>new Promise(r=>setTimeout(r,ms));

const store=new Map();
let delay=0;                      // how slow the store is, in ms
const dom=new JSDOM(fs.readFileSync(process.argv[2],'utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',
  beforeParse(w){
    w.HTMLCanvasElement.prototype.getContext=()=>({scale(){},beginPath(){},arc(){},fill(){},stroke(){},
      fillRect(){},strokeRect(){},moveTo(){},lineTo(){},fillText(){},setLineDash(){},putImageData(){},
      createImageData:(a,b)=>({width:a,height:b,data:new Uint8ClampedArray(a*b*4)}),
      measureText:t=>({width:String(t).length*6}),closePath(){},save(){},restore(){},clearRect(){},rect(){},translate(){},rotate(){}});
    w.URL.createObjectURL=()=>'blob:'; w.URL.revokeObjectURL=()=>{}; w.scrollTo=()=>{};
    w.confirm=()=>true; w.alert=m=>errors.push('alert: '+m); w.HTMLElement.prototype.scrollIntoView=function(){};
    w.storage={ async get(k){ if(!store.has(k)) throw new Error('nothing there'); return {key:k,value:store.get(k)}; },
                async set(k,v){ if(delay) await new Promise(r=>setTimeout(r,delay)); store.set(k,v); return {key:k,value:v}; },
                async delete(k){ store.delete(k); return {key:k,deleted:true}; } };
  }});
dom.window.addEventListener('error',e=>errors.push('uncaught: '+(e.error&&e.error.stack||e.message)));
const w=dom.window; await wait(400);
const $=s=>w.document.querySelector(s), $$=s=>[...w.document.querySelectorAll(s)];
const click=e=>e&&e.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
const setVal=(e,v)=>{if(e){e.value=v;e.dispatchEvent(new w.Event('input',{bubbles:true}));}};
const savedName=()=>{ try{ return (JSON.parse(store.get('pinmap:local:session')).draft||{}).name; }catch{ return '<none>'; } };
const indicator=()=>$('#saveState').textContent.trim();

click($('#signInLocal')); await wait(300);
click($('#newLoom')); await wait(300);
setVal($('#loomName'),'Lock test'); setVal($('#totalDeclared'),'800');
[4,4,200,8,300,200,4,80].forEach((v,i)=>setVal($$('#segTable input[data-act=count]')[i],String(v)));
await wait(700);

console.log('\n== an edit arriving while a save is still running ==');
{
  delay = 300;                                   // a slow disk, as a shed PC has
  setVal($('#loomName'),'FIRST EDIT');  await wait(520);   // this save starts
  setVal($('#loomName'),'SECOND EDIT');                    // and this arrives mid-flight
  await wait(4000);
  delay = 0;
  ok('the later edit is written, not dropped', savedName()==='SECOND EDIT', savedName());
  ok('and the dot is not left saying "saving"', !/saving/.test(indicator()), indicator());
  ok('it says everything is saved', /all changes saved/.test(indicator()), indicator());
}

console.log('\n== a burst of edits, all while the store is slow ==');
{
  delay = 200;
  for (const n of ['one','two','three','four','five']) { setVal($('#loomName'),n); await wait(120); }
  await wait(4000);
  delay = 0;
  ok('the last one wins and is on disk', savedName()==='five', savedName());
  ok('the dot settles', /all changes saved/.test(indicator()), indicator());
}

console.log('\n== the guard is given back even when a save goes wrong ==');
{
  // make the very next write throw, then carry on as normal
  const real = w.storage.set;
  let blown = false;
  w.storage.set = async (k,v) => { if(!blown){ blown=true; throw new Error('disk went away'); } return real(k,v); };
  setVal($('#loomName'),'AFTER A FAILURE'); await wait(1200);
  w.storage.set = real;
  setVal($('#loomName'),'RECOVERED'); await wait(1500);
  ok('saving still works afterwards', savedName()==='RECOVERED', savedName());
  ok('the dot recovers too', !/saving/.test(indicator()), indicator());
}

console.log('\n== the source keeps its promises ==');
{
  const src = fs.readFileSync(process.argv[2],'utf8');
  // Firestore waits a very long time before admitting it cannot reach anything.
  note('every call out to Firebase is given a time limit',
       !/withTimeout\(cloudLoad\(\)/.test(src) || !/withTimeout\(cloudSave\(/.test(src));
  note('so is trading the Google token for a Firebase session',
       !/withTimeout\(cloud\.mod\.signInWithCredential/.test(src));
  note('two syncs cannot run at once', !/if \(syncBusy\)/.test(src));
  note('and a sync asked for meanwhile is remembered, not dropped', !/syncAgain = true/.test(src));
  note('a save asked for meanwhile is remembered too', !/saveAgain = true/.test(src));
  note('the sync guard is always given back', !/finally \{ syncBusy = false; \}/.test(src));
  note('leaving the app without a connection still answers the dot',
       !/Not connected to your account yet/.test(src));
  note('loading Google is given a time limit', !/Google did not answer/.test(src));
  note('two cloud starts cannot race', !/if \(cloud\.starting\) return cloud\.starting/.test(src));
}

console.log('\n== the account is not asked to sign in again every time ==');
{
  const src = fs.readFileSync(process.argv[2],'utf8');
  // Firebase keeps the sign-in in the browser. Nothing used to ask it for one,
  // so every reload woke with no user and sent the weaver back to Google.
  note('the kept sign-in is listened for', !/onAuthStateChanged\(cloud\.auth/.test(src));
  note('and it is kept in this browser on purpose',
       !/setPersistence\(cloud\.auth, authMod\.browserLocalPersistence\)/.test(src));
  note('waking looks for that sign-in first', !/restoreCloud\(\)/.test(src));
  note('and boot no longer goes straight to Google',
       /state\.account && !cloud\.user\) reconnectCloud\(\)/.test(src));
  note('Google is only troubled when there is no session',
       !/if \(ready && cloud\.user\) \{ await syncNow\(\); return true; \}/.test(src));
  // and the other way about: signing out has to end the Firebase session too
  note('signing out ends the Firebase session as well',
       !/cloud\.mod\.signOut\(cloud\.auth\)/.test(src));
  note('a session that runs out says so rather than going quiet',
       !/The sign-in has run out/.test(src));
}
function note(n,bad,detail){ bad?(errors.push(n),console.log('  FAIL '+n+(detail?'  -> '+detail:''))):console.log('  ok   '+n); }

console.log('\n== result ==');
if (errors.length){ console.log('  '+errors.length+' problem(s)'); errors.forEach(e=>console.log('   - '+e)); }
else console.log('  no errors');
process.exit(errors.length?1:0);
