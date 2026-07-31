# Pinmap

Register a jacquard loom once, then lay weft designs onto its pins and build the
BMP the machine reads.

The whole app is a single self-contained HTML file. No build step, no framework,
no network calls while it runs — so it works from a pen drive on a shed PC with
the internet down, and it also deploys to a URL as a static site.

---

## Deploying to Vercel

**From the dashboard**

1. Push this repository to GitHub.
2. In Vercel, *Add New → Project*, and import the repository.
3. Framework preset: **Other**. Build command: leave empty. Output directory: leave empty.
4. Deploy.

**From the command line**

```bash
npm i -g vercel
vercel          # preview
vercel --prod   # production
```

`vercel.json` sets `Cross-Origin-Opener-Policy: same-origin-allow-popups`, which
Google's sign-in popup needs. Without it the popup opens and never reports back.

---

## Google sign-in

Signing in keeps one person's looms apart from another's. It is **not** a lock —
see *What sign-in does and does not do* below.

1. Go to the [Google Cloud console](https://console.cloud.google.com/), create a
   project, and open **APIs & Services → Credentials**.
2. Configure the **OAuth consent screen** (External is fine; add yourself as a
   test user while it is unpublished).
3. **Create credentials → OAuth client ID → Web application.**
4. Under **Authorised JavaScript origins**, add every address the app is served
   from — there is no wildcard, so each one must be listed:
   - `https://your-project.vercel.app`
   - your custom domain, if you have one
   - `http://localhost:3000` for local work
5. Copy the client ID.

**Authorised redirect URIs: leave this empty.** This app uses Google's
JavaScript sign-in, which hands the token straight back to the page. Redirect
URIs are for server-side flows and are not used here. Only the origins matter.

Then set the client ID **once**, in the `<meta>` tag at the very top of
`index.html`:

```html
<meta name="pinmap-google-client-id" content="000000-xxxx.apps.googleusercontent.com">
```

That is all anyone using the app ever needs — they open it and press *Sign in
with Google*. The settings box disappears once the tag is filled in, and only
comes back if sign-in fails, so whoever runs the site can see what went wrong.

Leave the tag empty and each person is asked for a client ID themselves, which
is fine for one weaver and hopeless for twenty.

**Is it safe to publish the client ID?** Yes. Client IDs for web apps are public
by design — every site using Google sign-in has one in its page source. What
stops someone else using yours is the authorised origins list: a page served
from anywhere else is refused. There is no secret here to leak.

Preview deployments get a new URL each time, and those URLs will not be
authorised. Test sign-in on production or on a fixed alias.

### What sign-in does and does not do

It **does** separate people. Each account gets its own looms, weave library and
box settings, stored under its own keys.

It **does not** keep anyone out. Everything runs in the page, so the identity is
checked by the page itself and anyone can walk past it with a browser console.
Locking people out needs a server that verifies the Google token — the same
server you would need to sync looms between machines.

By itself it **does not sync** — see *Keeping looms with the account* below to
turn that on.

**Use this device only** skips all of it and works identically offline. Do not
make signing in the only way in.

---

## Keeping looms with the account

Out of the box the library lives on the machine, so the same account on a
different machine opens an empty drawer. Fill in the Firebase details in the
`<meta>` tags at the top of `index.html` and the library follows the account
instead.

### Setting it up

1. [console.firebase.google.com](https://console.firebase.google.com) → **Add
   project**. Pick the **existing Google Cloud project** you made the OAuth
   client in, so the two share an identity.
2. **Build → Firestore Database → Create database.** Production mode is right;
   the rules below replace the defaults.
3. **Authentication → Sign-in method → Google → Enable.**
4. Still in Authentication, open **Settings → Authorised domains** and add
   `pinmap-gilt.vercel.app`.
5. **Project settings → Your apps → Web app.** Register one and copy the
   `apiKey`, `projectId` and `authDomain` into the meta tags:

```html
<meta name="pinmap-firebase-api-key" content="AIza…">
<meta name="pinmap-firebase-project-id" content="pinmap-504017">
<meta name="pinmap-firebase-auth-domain" content="pinmap-504017.firebaseapp.com">
```

6. Paste these Firestore rules under **Firestore → Rules** and publish:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /libraries/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

Those rules are what keep accounts apart. The API key in the page is not a
secret — Firebase keys identify the project, they do not grant access. The rules
do that.

### How syncing behaves

The device is always written to first, so the app keeps working with the
internet down; the shared copy catches up afterwards. When the two meet they are
**merged**, not overwritten:

- looms are matched by name, and the newer save wins
- a loom deleted on one machine stays deleted, rather than returning from the other
- weave libraries are matched by id and combined
- box settings from both sides are kept, and the newer side wins any clash

A dot in the header shows *synced*, *syncing* or *not synced*.

Leave the meta tags empty and none of this loads. The app behaves exactly as it
did before, keeping everything on the machine.

## Jacquard companies

Different companies' software writes files with different conventions. A company
is a named bundle of settings, picked when a loom is registered, and any single
setting can still be overridden for that loom. Box motion belongs to the loom
rather than the software, so it stays a separate choice.

| | Sai Tex | Sri Tex |
| --- | --- | --- |
| A lifted pin is | black | white |
| Pin 1 sits at | the left | the left |
| Everything else | the same | the same |

Sri Tex was read off their own border file, in `tests/fixtures`. That file also
confirms three rules the app had only been told about: the achu belongs to the
border file, the body and locking pins stay down in it, and the achu is half up
and half down, flipping every line.

To add a company, build a job, load one of their files into **Check against a
file you trust**, and change whatever it names until the two agree. Then save
those settings as a new entry in the `COMPANIES` table near the top of the
script.

## Where the data lives

| What | Kept in |
| --- | --- |
| Looms, weaves, box settings, session | Browser storage, scoped per account |
| The same, shared between machines | Firestore, if configured — see above |
| Backups | `pinmap_backup_YYYY-MM-DD.json`, written by *Back up everything* |
| Uploaded design files | Not kept — reselect them after a reload |

Everything saves itself as you work. The **Save version** button is only for
cutting a new version of a pin map; ordinary edits are saved without it.

---

## How the files get built

A loom produces **two files, built apart**: a border file and a body file. They
share the pin map and nothing else — the jacquard company's software puts them
together at the end.

| | Border file | Body file |
| --- | --- | --- |
| Border pins | the uploaded designs | down |
| Body pins | down | the weft files |
| Box pins | down | generated |
| Locking pins | down | generated |
| Achu pins | generated, when a border is loaded | generated, when no border is |
| Height | the border's own | the wefts, times how many |

The achu is the only thing that ties them: it belongs to whichever file exists,
never both, or the two would collide when joined. Make only a border and it goes
there; make only a body and it goes there instead.

## How each one gets built

1. **Register a loom** — total pins, box motion (4×4 or 4×1), and the pin groups
   in the order they run: achu, box, left border, locking, body, right border,
   achu, empty.
2. **Load the weft files** — one per border, and up to four body wefts in shuttle
   order (rani, zari, meena). Designs drawn sideways are turned a quarter turn to
   fit the pin count.
3. **Combine** — each weft gets its own pick. On a 4×1 loom the shuttle crosses
   and comes back, so each weft takes two design lines before the next starts.

Generated groups fill themselves in: achu alternates half up and half down,
locking weaves a satin (or any weave you upload and name), and the box follows
the shuttles — white over plain ground, and over butta the first shuttle lifts
every pin, the second the first half, the third the second half.

---

## Tests

```bash
npm install
npm test            # logic and interface
npm run test:logic
npm run test:ui
```

`tests/extract.mjs` lifts the pure logic out of `index.html` into
`tests/core.mjs`, which the suites import. That file is generated; it is not
committed.

The interface suites drive the real page under jsdom — clicking through
registration, file loading, the box editor, autosave across a reload, and
account separation.

Two suites are the ones that matter most: they rebuild the sample files in
`tests/fixtures` and compare **pin for pin**. If a change breaks how a file is
combined, those fail immediately.

### A note on the fixtures

`tests/fixtures` holds real saree designs. **If you make this repository public,
those designs become public too.** Either keep the repository private, or delete
the folder and the suites that use it.

---

## Editing the app

Everything is in `index.html`, in one script block, in this order: constants and
weaves, BMP reading and writing, the generated patterns, the compositor,
validation, storage, then a screen at a time.

The compositor is the part to understand first. It walks the output line by
line, works out which weft and which design line that line belongs to, and fills
each pin group from its source — an uploaded file, a generated weave, or
nothing.

If you change anything in that path, run the tests. The samples will tell you
straight away whether the file the loom reads is still correct.
