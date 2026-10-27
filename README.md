# Shopping List

A shared household shopping list that updates in real time, built with Firebase Auth and Cloud Firestore. The app itself is plain HTML, CSS and JS in [public/](public/) with no build step. npm is only used to run the security-rule tests.

- Sign in with Google, or with a link sent to your email. The email option works inside in-app browsers (Instagram, Messenger…), where Google blocks sign-in
- Create a household and invite people with links that expire after 7 days. Links can be cancelled at any time
- The household owner can remove members. Removing someone also cancels all invite links, so an old link can't be used to rejoin
- Anyone can change their own name and rename the household
- **Several lists per household** (e.g. Groceries, Pharmacy, Hardware), shown as tabs
- **Items are grouped by shop section** (fruit & veg, dairy, frozen…) in the order you walk through the shop. You can change that order under Households → Shop route. The section is guessed from the item's name, and once you correct it, items with that name keep the corrected section
- Everyone sees items being added, checked and removed as it happens
- Checking an item saves **when** it was bought and **who** bought it. The time comes from the server and the security rules enforce it
- Every purchase is kept for a year, which powers "last bought 6 days ago", the purchase history page, "Buy again" suggestions and autocomplete
- **Add several items at once** by separating them with commas, e.g. `milk, eggs, bread`
- Adding an item that's already in "Bought" moves it back instead of creating a duplicate
- Removing or clearing items can be undone for 5 seconds
- Items can be edited (✎): name, quantity, a **note** (e.g. "the green brand, only if on sale"), section and which list they're on
- If you tick something by mistake, unticking it within 10 minutes removes it from history again. Only the person who ticked it can do this. If someone else unticks it, or it's later than that, the purchase stays in history and the item goes back on the list
- Works offline. A banner shows when you're offline or when changes are taking a while to sync, and items that haven't synced yet are marked
- **Opens without signal and can be installed.** A service worker keeps the app and the Firebase SDK on the device, so it starts offline. It can be added to the home screen: Android and desktop Chrome show an **Install** button under Households, and on iPhone the same place explains Share → Add to Home Screen
- **Share a list as text**, grouped by shop section with quantities and notes. It uses the phone's share sheet, or copies the text to the clipboard
- **Sensible limits:** up to 50 items per paste, 300 items per list, 20 lists per household, 10 active invite links and 20 members. The member cap is also enforced by the security rules
- The last member to leave a household deletes it, along with all its lists and history
- If the app can't start (for example, the Firebase CDN is blocked) it says so and offers **Try again** instead of loading forever

## Setup

1. **Create a Firebase project** at <https://console.firebase.google.com>.
2. **Add a web app**: Project settings → General → Your apps → Web (`</>`). Copy the `firebaseConfig` values into [public/firebase-config.js](public/firebase-config.js).
3. **Enable sign-in methods**: Build → Authentication → Sign-in method:
   - **Google** → Enable
   - **Email/Password** → Enable, and also turn on **Email link (passwordless sign-in)**
4. **Create the database**: Build → Firestore Database → Create database (production mode).
5. **Deploy the security rules**:
   ```sh
   npm install -g firebase-tools
   firebase login
   firebase use --add        # pick your project
   firebase deploy --only firestore
   ```
6. **Optional but recommended: turn on App Check.** See [App Check](#app-check) below.

## Automatic clean-up

Automatic deletion (TTL policies) is turned off, because Firestore only allows it on projects with billing enabled (the Blaze plan). Without it, expired invite links stay in the database, but the app hides them and refuses to join with them, and purchase records are kept indefinitely.

Every document still carries the dates needed to turn it on later: `expiresAt` on invites, and `expireAt` on purchases (one year after the purchase; the rules require it). After upgrading to Blaze, put this in [firestore.indexes.json](firestore.indexes.json) and run `firebase deploy --only firestore`:

```json
"fieldOverrides": [
  { "collectionGroup": "invites", "fieldPath": "expiresAt", "ttl": true, "indexes": [] },
  { "collectionGroup": "purchases", "fieldPath": "expireAt", "ttl": true, "indexes": [] }
]
```

Firestore usually deletes expired documents within a day or so of the date passing. The policies show under **Firestore → Time-to-live** in the Firebase console.

## Run locally

ES modules have to be served over HTTP, so opening the file directly won't work:

```sh
npm start
```

Then open <http://localhost:3000>. `localhost` is already an authorized sign-in domain.

## Code layout

The app has no build step: the browser loads the ES modules in [public/js/](public/js/) directly.

| File | What it does |
| --- | --- |
| [main.js](public/js/main.js) | Starts Firebase, registers the service worker, picks which screen to show |
| [boot.js](public/js/boot.js) | A tiny classic script that shows "Couldn't load the app" if the modules or the Firebase CDN fail to load, or startup takes over 20 seconds |
| [sdk.js](public/js/sdk.js) | The single place that loads the Firebase SDK from the CDN (and sets its version) |
| [store.js](public/js/store.js) | App state and the **only** functions allowed to change it (`openPanel`, `setItems`, `hideItems`…). Redraws are batched into one per animation frame |
| [readonly.js](public/js/readonly.js) | Wraps the exported `state` so that any change from outside `store.js` throws a `ReadOnlyStateError`, even when it goes through another name for the same thing |
| [data/](public/js/data/) | Firestore, split by concern: `firestore.js` (connection and shared helpers), `watch.js` (live listeners and which household/list is selected), `households.js`, `lists.js`, `items.js`, `invites.js`. Every action is `async`, so all failures arrive as rejected promises. They never change which screen is shown |
| [records.js](public/js/records.js) | Builds every document the app writes. A unit test checks these fields against `firestore.rules` and `types.d.ts` |
| [auth.js](public/js/auth.js) | Google and email-link sign-in |
| [logic.js](public/js/logic.js), [format.js](public/js/format.js), [sections.js](public/js/sections.js), [errors.js](public/js/errors.js) | Pure functions with no page or Firebase code, all unit-tested |
| [dom.js](public/js/dom.js) | Page helpers: `syncChildren` only rebuilds rows whose content changed, and `onClick`/`onSubmit` disable their buttons until async work finishes, so double taps don't send two requests |
| [dialogs.js](public/js/dialogs.js), [toast.js](public/js/toast.js) | The app's own pop-up windows and messages |
| [views/](public/js/views/) | One module per screen or part of a screen: sign-in, households, install, history, editor, invites, share, plus the list screen split into `list.js`, `tabs.js`, `item-rows.js`, `suggestions.js`, `list-settings.js` and `add-items.js` |
| [types.d.ts](public/js/types.d.ts), [initial-state.js](public/js/initial-state.js) + [.d.ts](public/js/initial-state.d.ts) | Type declarations for households, lists, items, purchases, invites and the app state. They're only read by the type checker and are left out of every deploy |
| [sw.js](public/sw.js), [manifest.webmanifest](public/manifest.webmanifest), [icons/](public/icons/) | The offline app shell and what makes the app installable |

**Rule of thumb:** views read `state` but never change it. They call actions in `store.js` (UI state) or `data/` (anything saved to Firestore). This is enforced twice: ESLint flags direct changes, and at runtime the exported `state` is read-only.

### Offline app shell

[sw.js](public/sw.js) caches the files in `APP_FILES` and the four Firebase SDK files when it installs:

- **The app's own files:** fetched from the network first, with a 4-second timeout, falling back to the cache. When you're online you always get the latest deploy. Offline or on poor signal, the app still opens.
- **Firebase SDK files:** each version has its own address and never changes, so these are served from the cache first.
- **Firestore and sign-in traffic:** never touched by the service worker. Firestore's own offline storage handles your data.

A unit test fails if a file in `public/` is missing from `APP_FILES`, or if the SDK version in `sw.js` doesn't match `sdk.js`. If you change the caching strategy itself, bump `CACHE_NAME`, which clears old caches on the next visit. The service worker is not registered when the app points at the emulators, so it can't affect the browser tests.

## Checks and tests

```sh
npm install
npm run check        # lint + type check + unit tests (no Java needed)
npm run test:rules   # security rules in the Firestore emulator
npm run test:e2e     # the real app in a browser against the Auth and Firestore emulators
npm test             # unit + rules + browser tests
```

`test:rules` and `test:e2e` start the Firebase emulators, which need **Java 21 or newer** (for example `brew install openjdk@21`). Locally the browser tests use your installed Google Chrome. CI installs Playwright's Chromium instead.

- **Lint:** ESLint ([eslint.config.js](eslint.config.js)), including the rule above that keeps state changes in `store.js`.
- **Type check:** TypeScript checks the plain JS against the Firebase SDK's types and [types.d.ts](public/js/types.d.ts) ([jsconfig.json](jsconfig.json)). It runs in strict mode, including null checks, with one exception: `noImplicitAny` is off, because satisfying it would mean adding type comments to the code. In practice it catches misspelt fields (`item.quanity`), code that forgets a user might be signed out or a household might not be selected, unhandled `catch` values, and wrong Firebase or DOM calls.
- **Unit tests:** [tests/unit/](tests/unit/) covers:
  - adding several items, duplicate handling and the add limits
  - the undo window and invite parsing
  - history grouping, section grouping and the shop-section guesser
  - sharing as text, date formatting, sync status and error messages
  - `syncChildren` and the busy buttons, using [happy-dom](https://github.com/capricorn86/happy-dom)
  - that `state` refuses outside changes
  - that every written record matches `firestore.rules` and `types.d.ts`
  - that the Firebase version is the same everywhere and the offline cache lists every app file
- **Rules tests:** [tests/rules/](tests/rules/) runs [firestore.rules](firestore.rules) in the emulator. It covers both what's allowed and what's refused for households, joining, leaving, removing members, names, lists, items, notes, the bought time, purchases and invites.
- **Browser tests:** [tests/e2e/](tests/e2e/) uses Playwright with two people in separate browsers. It covers:
  - signing in by email link
  - creating a household and inviting the second person
  - adding several items, with section grouping and duplicate detection
  - seeing each other's ticks live
  - the undo-history rules
  - notes, and undoing a removal
  - keyboard navigation of the list tabs
  - sharing the list as text
  - the 50-item paste cap
  - the owner removing a member

  It also checks that a bad invite link and joining while offline both give the right message. [tests/e2e/serve.js](tests/e2e/serve.js) serves `public/` with a Firebase config that points at the emulators.

GitHub Actions runs all of these on every push and pull request. The site is only published if they pass. If the browser tests fail, the Playwright report and traces are uploaded as a build artifact.

The Firebase version in [sdk.js](public/js/sdk.js), the `paths` in [jsconfig.json](jsconfig.json) and `firebase` in [package.json](package.json) should all stay the same (currently 13.1.0).

## App Check

App Check makes Firebase reject requests that don't come from your real web app, such as scripts that copied your config.

1. In the Firebase console, open **App Check → Apps**, pick your web app, choose **reCAPTCHA Enterprise**, and let it create a site key. Then press **Save**.
2. Put that site key in `appCheckSiteKey` in [public/firebase-config.js](public/firebase-config.js), or use the `APP_CHECK_SITE_KEY` repository variable for GitHub Pages.
3. **Local development:** on `localhost` the app uses a debug token instead of reCAPTCHA. The first time you load it, the browser console prints a debug token. Add it under **App Check → Apps → ⋮ → Manage debug tokens**.
4. Watch the metrics under **App Check → APIs** for a few days. Once almost all requests are verified, press **Enforce** for **Cloud Firestore** and **Authentication**.

Leave `appCheckSiteKey` empty to run without App Check.

## Deploy

### Firebase Hosting

```sh
firebase deploy --only hosting
```

The app will be live at `https://<project-id>.web.app`.

### GitHub Pages

[.github/workflows/pages.yml](.github/workflows/pages.yml) runs the tests and then publishes [public/](public/) every time you push to `main`. On pull requests it only runs the tests.

1. Push this folder to a GitHub repository with `main` as the default branch.
2. In the repository, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Give it your Firebase settings, in one of two ways:
   - Commit your filled-in [public/firebase-config.js](public/firebase-config.js), **or**
   - Keep the placeholder file in the repo and add repository variables instead. Go to **Settings → Secrets and variables → Actions → Variables** and create:
     - `FIREBASE_CONFIG`: the config object as JSON, for example `{"apiKey":"…","authDomain":"…","projectId":"…","storageBucket":"…","messagingSenderId":"…","appId":"…"}`
     - `APP_CHECK_SITE_KEY` (optional): your reCAPTCHA Enterprise site key

     The workflow writes them into `firebase-config.js` when it publishes.
4. In Firebase, add `<your-username>.github.io` under **Authentication → Settings → Authorized domains**. If you use a custom domain, add that instead. Also add it to the reCAPTCHA key's allowed domains if you use App Check.
5. Push to `main`, or run the workflow by hand from the **Actions** tab. The site will be at `https://<your-username>.github.io/<repository>/`.

The Firebase web config isn't a secret: it ends up in the browser either way. Access is protected by the security rules and App Check, not by hiding the config. Using the variables just keeps your project details out of the repository's history.

### Docker

The image serves [public/](public/) with nginx, running as a non-root user on port 8080:

```sh
docker compose up -d --build
```

Then open <http://localhost:8080>. Or, without Compose:

```sh
docker build -t shopping-list .
docker run -d -p 8080:8080 --name shopping-list shopping-list
```

[public/firebase-config.js](public/firebase-config.js) is copied into the image when it's built, so fill it in first, and rebuild after changing it. The security rules still have to be deployed with `firebase deploy --only firestore`, because they run in Firebase, not in the container.

Firebase only allows sign-in from domains you've authorized. If you host the app anywhere other than `localhost` or Firebase Hosting, add that domain under Authentication → Settings → Authorized domains. Both Google and email-link sign-in need it. Outside `localhost`, serve it over HTTPS, for example behind a reverse proxy.

## Data model

```
households/{householdId}
  name, ownerId, createdAt
  sectionOrder: [sectionKey, ...]           ← optional, the shop route
  members: [uid, ...]                       ← used for queries and security rules
  memberInfo: { uid: { name, joinedAt, invite } }

households/{householdId}/lists/{listId}
  name, createdBy, createdAt

households/{householdId}/items/{itemId}
  listId, name, quantity, note, section
  bought: boolean
  boughtAt, boughtBy, boughtByName          ← null while not bought
  purchaseId                                ← the purchase record for the current "bought"
  addedBy, addedByName, createdAt

households/{householdId}/purchases/{purchaseId}
  itemId, listId, name, quantity, section, boughtAt, boughtBy, boughtByName
  expireAt                                  ← a year after purchase; TTL field if enabled

households/{householdId}/invites/{code}
  createdBy, createdByName, createdAt
  expiresAt                                 ← link stops working after this; TTL field if enabled
```

Section keys are defined in [public/js/sections.js](public/js/sections.js). An invite link looks like `?join=<householdId>-<code>`.

## How the security rules work

[firestore.rules](firestore.rules):

- **Household data** (lists, items, history and invite links) can only be read and changed by its members.
- **Joining** means adding *yourself* to `members` and naming an invite code that exists and hasn't expired.
- **Leaving:** any member can leave. If the owner leaves, ownership has to pass to someone who is still a member. The last member can delete the household.
- **Removing:** only the owner can remove another member.
- **Names:** members can rename the household, change the shop route, and change their *own* name. Nobody can change anyone else's name.
- **Bought time and buyer:** `boughtAt` must be the server's time and `boughtBy` must be the person making the change. A purchase record has to be created in the same write.
- **Fixed fields:** who added an item and when can't be changed. The exception is putting a bought item back on the list, which records the new person and time.
- **Lists:** an item can only be added to, or moved to, a list that exists.
- **History:** purchase records can't be edited. Only the person who made a purchase can delete it, which is how the 10-minute undo works. The exception is the last member deleting the whole household.
