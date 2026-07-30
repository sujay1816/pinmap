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

Then either:

- paste it into the **Google client ID** box on the sign-in screen (it is
  remembered on that device), or
- set it once for everybody by editing `index.html` and putting it in
  `DEFAULT_CLIENT_ID` near the top of the script.

Preview deployments get a new URL each time, and those URLs will not be
authorised. Test sign-in on production or on a fixed alias.

### What sign-in does and does not do

It **does** separate people. Each account gets its own looms, weave library and
box settings, stored under its own keys.

It **does not** keep anyone out. Everything runs in the page, so the identity is
checked by the page itself and anyone can walk past it with a browser console.
Locking people out needs a server that verifies the Google token — the same
server you would need to sync looms between machines.

It also **does not sync**. Looms live in the browser's storage on that machine.
The same account on a different machine opens an empty drawer. Use **Back up
everything** to move them, or add a hosted store when you need real sync.

**Use this device only** skips all of it and works identically offline. Do not
make signing in the only way in.

---

## Where the data lives

| What | Kept in |
| --- | --- |
| Looms, weaves, box settings, session | Browser storage, scoped per account |
| Backups | `pinmap_backup_YYYY-MM-DD.json`, written by *Back up everything* |
| Uploaded design files | Not kept — reselect them after a reload |

Everything saves itself as you work. The **Save version** button is only for
cutting a new version of a pin map; ordinary edits are saved without it.

---

## How a file gets built

1. **Register a loom** — total pins, box motion (4×4 or 2×1), and the pin groups
   in the order they run: achu, box, left border, locking, body, right border,
   achu, empty.
2. **Load the weft files** — one per border, and up to four body wefts in shuttle
   order (rani, zari, meena). Designs drawn sideways are turned a quarter turn to
   fit the pin count.
3. **Combine** — each weft gets its own pick. On a 2×1 loom the shuttle crosses
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
