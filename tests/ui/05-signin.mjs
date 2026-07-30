// The sign-in screen has to behave whether or not Google can be reached.
import fs from 'fs';
import { JSDOM } from 'jsdom';
const errors=[]; const ok=(n,c,e='')=>{ c?console.log('  ok   '+n):(errors.push(n),console.log('  FAIL '+n+(e?'  -> '+e:''))); };
const wait=ms=>new Promise(r=>setTimeout(r,ms));

function boot(html, { store = new Map(), online = true, googleWorks = false, origin = 'https://pinmap-gilt.vercel.app' } = {}) {
  const dom = new JSDOM(html, { runScripts:'dangerously', pretendToBeVisual:true, url: origin + '/',
    beforeParse(win){
      win.HTMLCanvasElement.prototype.getContext=()=>({scale(){},beginPath(){},arc(){},fill(){},stroke(){},
        fillRect(){},strokeRect(){},moveTo(){},lineTo(){},fillText(){},setLineDash(){},putImageData(){},
        createImageData:(w,h)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)}),
        set fillStyle(v){},set strokeStyle(v){},set lineWidth(v){},set font(v){},set textAlign(v){},
        set textBaseline(v){},set globalAlpha(v){}});
      win.URL.createObjectURL=()=> 'blob:'; win.URL.revokeObjectURL=()=>{};
      win.scrollTo=()=>{}; win.confirm=()=>true; win.alert=m=>errors.push('alert: '+m);
      win.HTMLElement.prototype.scrollIntoView=function(){};
      win.storage={ async get(k){ if(!store.has(k)) throw new Error('missing'); return {key:k,value:store.get(k)}; },
                    async set(k,v){ store.set(k,v); return {key:k,value:v}; },
                    async delete(k){ store.delete(k); return {key:k,deleted:true}; },
                    async list(){ return {keys:[...store.keys()]}; } };
      Object.defineProperty(win.navigator, 'onLine', { get: () => online, configurable: true });

      // stand in for Google's script, which jsdom will not fetch
      const realCreate = win.document.createElement.bind(win.document);
      win.document.createElement = (tag) => {
        const node = realCreate(tag);
        if (tag === 'script') {
          setTimeout(() => {
            if (googleWorks) {
              win.google = { accounts: { id: {
                initialize(cfg){ win.__gsiCfg = cfg; },
                renderButton(host){ host.innerHTML = '<div id="fakeGoogleBtn">Sign in with Google</div>'; },
                disableAutoSelect(){}
              } } };
              node.onload && node.onload();
            } else {
              node.onerror && node.onerror();
            }
          }, 20);
        }
        return node;
      };
    }});
  dom.window.addEventListener('error',e=>errors.push('uncaught: '+(e.error&&e.error.stack||e.message)));
  return dom.window;
}

const rawHtml = fs.readFileSync(process.argv[2],'utf8');
// the shipped file carries a real client ID; each case sets its own
const withClientId = (id) => rawHtml.replace(
  /(<meta name="pinmap-google-client-id" content=")[^"]*(">)/, `$1${id}$2`);
const html = withClientId('');
const q = w => s => w.document.querySelector(s);
const clickOn = w => e => e.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));
const typeIn = w => (e,v) => { e.value=v; e.dispatchEvent(new w.Event('input',{bubbles:true})); };

console.log('\n== no client ID configured ==');
{
  let w = boot(html); await wait(350);
  const $ = q(w);
  ok('the sign-in screen is showing', !$('#gate').hidden);
  ok('the app is hidden behind it', $('#app').hidden);
  ok('it asks for a client ID', /client ID/i.test($('#gateMsg').textContent), $('#gateMsg').textContent);
  ok('settings are opened ready to paste into', $('#gateAdv').open === true);
  ok('the address to authorise is shown', $('#originHere').textContent === 'https://pinmap-gilt.vercel.app',
     $('#originHere').textContent);
  ok('the device option is always there', !!$('#signInLocal'));
}

console.log('\n== a client ID is set and Google answers ==');
{
  const store = new Map([['pinmap:account', JSON.stringify({ clientId:'123-abc.apps.googleusercontent.com' })]]);
  let w = boot(html, { store, googleWorks: true }); await wait(400);
  const $ = q(w);
  ok('Google\u2019s own button is rendered', !!$('#fakeGoogleBtn'));
  ok('the waiting line has gone', $('#gateWait').hidden);
  ok('no error is shown', $('#gateMsg').textContent.trim() === '', $('#gateMsg').textContent);
  ok('the client ID was handed to Google', w.__gsiCfg && w.__gsiCfg.client_id === '123-abc.apps.googleusercontent.com');
  ok('a callback was registered', typeof (w.__gsiCfg||{}).callback === 'function');

  // Google replies with a signed-in user
  const payload = { name:'Weaver', email:'weaver@example.com', sub:'99887', picture:'' };
  const jwt = 'x.' + Buffer.from(JSON.stringify(payload)).toString('base64').replace(/\+/g,'-').replace(/\//g,'_') + '.y';
  await w.__gsiCfg.callback({ credential: jwt });
  await wait(300);
  ok('signing in opens the app', $('#gate').hidden && !$('#app').hidden);
  ok('the header shows the account', /weaver@example\.com/.test($('#whoami').textContent), $('#whoami').textContent);
  ok('storage is scoped to that account', [...store.keys()].some(k => k.startsWith('pinmap:g99887:')) ||
     store.get('pinmap:account').includes('g99887'), [...store.keys()].join(','));
}

console.log('\n== Google cannot be reached ==');
{
  const store = new Map([['pinmap:account', JSON.stringify({ clientId:'123-abc.apps.googleusercontent.com' })]]);
  let w = boot(html, { store, googleWorks: false }); await wait(400);
  const $ = q(w);
  ok('it explains rather than hanging', /could not start/i.test($('#gateMsg').textContent), $('#gateMsg').textContent);
  ok('it points at the origin and client ID', /authorised origin/i.test($('#gateMsg').textContent));
  ok('the waiting line is cleared', $('#gateWait').hidden);
  clickOn(w)($('#signInLocal')); await wait(300);
  ok('the device option still gets you in', $('#gate').hidden && !$('#app').hidden);
}

console.log('\n== offline ==');
{
  const store = new Map([['pinmap:account', JSON.stringify({ clientId:'123-abc.apps.googleusercontent.com' })]]);
  let w = boot(html, { store, online: false }); await wait(350);
  const $ = q(w);
  ok('it says the internet is missing', /no internet/i.test($('#gateMsg').textContent), $('#gateMsg').textContent);
  ok('it does not try to load anything', $('#gateWait').hidden);
}

console.log('\n== pasting a client ID and retrying ==');
{
  let w = boot(html, { googleWorks: true }); await wait(350);
  const $ = q(w);
  ok('starts with no Google button', !$('#fakeGoogleBtn'));
  typeIn(w)($('#clientId'), '555-zzz.apps.googleusercontent.com');
  clickOn(w)($('#applyClientId'));
  await wait(400);
  ok('the button appears after saving', !!$('#fakeGoogleBtn'));
  ok('the new ID was used', w.__gsiCfg.client_id === '555-zzz.apps.googleusercontent.com', (w.__gsiCfg||{}).client_id);
}

console.log('\n== a client ID baked into the file ==');
{
  const baked = withClientId('777-baked.apps.googleusercontent.com');
  const store = new Map();
  let w = boot(baked, { store, googleWorks: true }); await wait(400);
  const $ = q(w);
  ok('Google\u2019s button appears with nothing to configure', !!$('#fakeGoogleBtn'));
  ok('the built-in ID is the one used', w.__gsiCfg.client_id === '777-baked.apps.googleusercontent.com',
     (w.__gsiCfg||{}).client_id);
  ok('the settings box is out of the way', $('#gateAdv').hidden === true);
  ok('no message needed', $('#gateMsg').textContent.trim() === '', $('#gateMsg').textContent);
}
{
  const baked = withClientId('777-baked.apps.googleusercontent.com');
  let w = boot(baked, { googleWorks: false }); await wait(400);
  const $ = q(w);
  ok('if Google fails it points at the device option, not at setup',
     /this device only/i.test($('#gateMsg').textContent), $('#gateMsg').textContent);
  ok('and the settings come back for whoever runs the site', $('#gateAdv').hidden === false);
}

console.log('\n== the client ID the app actually ships with ==');
{
  const m = rawHtml.match(/<meta name="pinmap-google-client-id" content="([^"]*)">/);
  ok('the meta tag is present', !!m);
  const id = m ? m[1] : '';
  ok('it is filled in, so nobody has to set one up', id.length > 0, '(empty)');
  ok('it is a Google web client ID', /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(id), id);
  ok('no client secret has crept into the file', !/GOCSPX-/.test(rawHtml));
}

console.log('\n== result ==');
if (errors.length){ console.log('  '+errors.length+' problem(s)'); errors.forEach(e=>console.log('   - '+e)); }
else console.log('  no errors');
process.exit(errors.length?1:0);
