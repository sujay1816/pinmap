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
| The border file is written | straight ahead | straight ahead |
| The body file is written | straight ahead | **back to front** |
| Everything else | the same | the same |

Sri Tex was read off their own border file, in `tests/fixtures`. That file also
confirms three rules the app had only been told about: the achu belongs to the
border file, the body and locking pins stay down in it, and the achu is half up
and half down, flipping every line.

### How Sri Tex work the box

Their box is four pins, so a half is a pair. Which half lifts depends on how
many designs are loaded:

| Designs | 1st | 2nd | 3rd |
| --- | --- | --- | --- |
| one | first half | | |
| two | second half | first half | |
| three | second half | both down | first half |

Four is deliberately left out. Nobody has said what it should be, so it falls
back to the standard table and can be set by hand per weft.

Two things make this different from the standard table. The question is asked
**of each weft separately** — not "is there a figure anywhere on this line" but
"is there anything to weave on this weft". And a weft with nothing to weave
does **not** drop its box pins: it takes the one-design setting — the first
half — and the code reads that from the table rather than naming a half of its
own, so the two cannot drift apart.

The loom the samples came off, read from the right, is:

    achu 10 | box 4 | hit 2 | empty 2 | border 375
            | locking 16 + body 720 + locking 16
            | border 375 | achu 14 | hit 2 | empty 32     = 1568

That order was settled against their own two files: every group in it is either
wholly lifted or wholly down in each file, which no other arrangement managed.
The achu appears only in the border file, the box only in the body file.

### Why the Sri Tex body file is turned round

This was wrong for a long time and is worth writing down, because a mirrored
file still looks like a perfectly good file — nothing complains, the loom just
weaves the design back to front.

Their border sample and their body sample disagree by thirty pins: the border
keeps 752 pins down at 394-1145, and the body works 752 pins at 424-1175. Those
have to be the same pins. The old reading was that the body sample came off a
different loom, thirty pins wider at the front, and that mirroring lined the two
up by coincidence.

It is not coincidence. Mirroring does not shift the block thirty pins along; it
lands every block at once. The 752 goes to 394-1145. The body's blank goes to
1146-1534, exactly the border's right border. And the box — six worked pins
sitting at 1553-1558 in their file, right at the far end — comes back to 11-16,
beside the achu, which is where the loom actually has it. A thirty-pin shift
explains the 752 and leaves the box stranded. Mirrored, the two files overlap
nowhere and are exact complements.

Building their job with the switch on reproduces the block at 424-1175 pin for
pin; with it off we write 394-1145. `tests/logic/24.mjs` holds that against
their real file so it cannot quietly flip back.

**Only the body is turned round.** The border file's achu sits at pins 1-10, at
the near end, so mirroring both would throw the achu to the far end. The border
is written straight ahead.

To add a company, build a job, load one of their files into **Check against a
file you trust**, and change whatever it names until the two agree. Then save
those settings as a new entry in the `COMPANIES` table near the top of the
script.

### Choosing a weave

Two groups are worked from a weave, and they differ only in where the weave
comes from:

- **Locking** — the built-in satins and twills
- **Weave library** — whatever has been uploaded to the library

Pick the group in the Group column and its weaves are in the Content column
beside it. Nothing else changes between them; they are composed identically.

They are separate groups on purpose. An uploaded weave used to be a heading
part way down the Locking row's list of satins, where somebody who had just
uploaded one would never think to look. A Weave library group with nothing
uploaded says so in its own list rather than sitting empty and unexplained.

Choosing a weave sets the group's pin count to the weave's width.

### The clutch end

A Sri Tex loom carries its clutch at one end, and the thirty-two pins sitting
over it cannot take a design. Registering a loom as Sri Tex therefore asks one
more question — **left clutch or right clutch** — and puts an empty group of
thirty-two pins **at the left of the board**, whichever end the clutch is on.
The end is a fact about the loom and worth recording, but it does not decide
where the pins sit: on a Sri Tex loom they are the first thirty-two either way.
Nothing else asks the question, because nothing else needs to; the field is not
shown for any other company.

After that it is an ordinary group. Drag it somewhere else, change its count,
or take it out entirely — nothing reaches back in and corrects it. Changing the
clutch end keeps a count you set yourself rather than resetting it.

Changing the loom to a company with no clutch takes the group away again, but
only while it is still thirty-two pins. A count you set yourself is yours, so
it stays where you put it — still marked as the clutch, so coming back to Sri
Tex finds that group instead of laying a second one on top of it.

The empty pins are counted **inside** the loom's total, and are written down in
every file, like any other empty group. So a 1,792-pin loom registered with a
clutch needs 1,824 pins declared.

Looms registered before this was asked read as a left clutch, which is how they
were already drawn.

## Where the data lives

### Waiting for something that never comes

There are no threads here, so no deadlock in the textbook sense. The shapes
that do occur are a guard taken and never given back, and a spinner that never
stops — which is worse than an error, because it looks like the app is still
working.

Two rules hold everywhere:

- **A save or sync asked for while one is running is remembered, not dropped.**
  It used to be dropped: the edit was never written and the dot sat on *saving*
  for good, while the weaver believed the work was safe.
- **Every call out to the network has a time limit**, and every way out of a
  sync leaves a definite answer on the dot. Firestore will wait a very long
  time rather than admit it cannot reach anything, and a shed connection drops
  often.

`tests/ui/19-locks.mjs` drives a deliberately slow store and checks that an
overlapping edit still lands, that the guard is given back even when a write
throws, and that the indicator always settles.

### When saved data will not read

There is a difference between *nothing has been saved here yet* and *something
is saved here and it will not open*, and the two must never be treated alike.
The first is an empty library. The second, read as an empty library, is how a
weaver's work disappears: the drawer looks bare, the next save writes over the
top, and there is nothing left to recover from.

So unreadable data is copied aside before anything else happens, under the same
key with `:damaged` on the end, and left there untouched — the first copy wins,
so a second failure cannot write over the rescue. The app says so plainly under
the loom list, and offers the bytes as a download. It does not carry on as
though the drawer were empty.

A store that refuses to *write* was already handled: the loom is kept for the
session and the app says it was not saved, rather than claiming it was.

| What | Kept in |
| --- | --- |
| Looms, weaves, box settings, session | Browser storage, scoped per account |

### Credits

A credit is spent when a **finished file is downloaded** — the border file and
the body file are one each. Building, previewing and checking against a file you
trust are all free, on purpose: those are the steps that catch a wrong pin map,
and charging for them would teach people to skip the one thing that saves the
silk. A new account starts with `CREDITS_ON_JOINING`.

Two numbers are kept rather than one, and both only ever climb: `granted` and
`spent`. Merging two machines takes the larger of each, so neither a spend nor a
grant can be lost when the same account is used in two places.

**This is a meter, not a lock.** Everything runs in the weaver's own browser, so
the numbers are theirs to edit, and the page works offline with no network at
all. It counts honest use and shows what is left. Making it binding would mean
the conversion itself happening somewhere the weaver does not control — a
different shape of product, and one that gives up working offline. The code is
arranged so that day replaces one function, `spendCredits`.

#### Recharge codes

A stand-in until payment is wired up, so accounts can be topped up by hand.
A code is `PIN-<credits>-<serial>-<check>`, where the check is made from the
amount, the serial and `CODE_SALT`.

Print a batch with:

    node tools-codes.mjs 50 20      # twenty codes worth 50 credits each

Every code is a different string. That matters: one universal code for "50
credits" is a password for free credits, not a recharge. Give each customer
their own and keep a note of who got which, so a leak can be traced.

**What it can and cannot do.** The check stops a mistyped code and stops the
same code being redeemed twice on one account. It cannot stop a code being used
on a *second* account, and it cannot stop anyone reading this page from writing
their own — there is no server to record what has been spent. Real one-time
codes need the redemption recorded somewhere the weaver does not control.

Change `CODE_SALT` and every code issued before it stops working.

### Staying signed in

Firebase keeps the sign-in in the browser it was made in. The app used not to
ask it for one: nothing listened for the kept session, so every reload woke with
no user and went straight back to Google for a fresh token — on a machine that
had never signed out. If the One Tap prompt was blocked, or had been dismissed
often enough for Google to back off, the account simply stayed disconnected.

Now the session is asked for first. Waking calls `restoreCloud`, which starts
Firebase, waits for `onAuthStateChanged` to say whether a sign-in was kept, and
syncs straight away if one was. Google is only troubled when there is genuinely
no session. A session that later runs out says so on the dot rather than going
quiet, and signing out ends the Firebase session as well — otherwise the next
restore would walk straight back into the account just left.

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
