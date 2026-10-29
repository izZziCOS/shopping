import * as config from "../firebase-config.js";
import {
  ReCaptchaEnterpriseProvider,
  connectAuthEmulator,
  connectFirestoreEmulator,
  getAuth,
  initializeApp,
  initializeAppCheck,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "./sdk.js";
import { clearUrl, completeEmailSignIn, completeRedirectSignIn, readInviteFromUrl, useAuth, watchUser } from "./auth.js";
import { onDataError, useFirestore } from "./data/firestore.js";
import { flushPendingRemovals } from "./data/removals.js";
import { stopWatching, watchHouseholds } from "./data/watch.js";
import { bindDialogs } from "./dialogs.js";
import { byId } from "./dom.js";
import { currentHousehold, setOnline, setPendingInvite, setUser, state, subscribe, takePendingInvite } from "./store.js";
import { hideToasts, showError } from "./toast.js";
import { bindEditor } from "./views/editor.js";
import { bindHistory, renderHistory } from "./views/history.js";
import { bindHouseholds, renderHouseholds } from "./views/households.js";
import { bindInstall } from "./views/install.js";
import { runJoin } from "./views/invites.js";
import { bindList, renderList } from "./views/list.js";
import { bindSignIn, renderSignIn } from "./views/signin.js";

const LOCAL_HOSTS = ["localhost", "127.0.0.1"];

const views = {
  loading: byId("loading-view"),
  signin: byId("signin-view"),
  households: byId("households-view"),
  list: byId("list-view"),
  history: byId("history-view"),
};

function showView(name) {
  for (const [key, view] of Object.entries(views)) {
    view.hidden = key !== name;
  }
}

function markStarted() {
  document.documentElement.dataset.started = "true";
}

function startupFailed(error) {
  console.error(error);
  document.dispatchEvent(new Event("app-startup-failed"));
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || config.emulators?.enabled) return;
  navigator.serviceWorker.register("sw.js").catch((error) => console.error(error));
}

function render() {
  markStarted();
  if (!state.user) {
    renderSignIn();
    showView("signin");
    return;
  }
  if (!state.householdsLoaded) {
    showView("loading");
    return;
  }
  const household = currentHousehold();
  if (!household || state.panel === "households") {
    renderHouseholds(household);
    showView("households");
    return;
  }
  if (state.panel === "history") {
    renderHistory();
    showView("history");
    return;
  }
  renderList(household);
  showView("list");
}

async function handleUserChanged(user) {
  flushPendingRemovals();
  stopWatching();
  setUser(user);
  if (!user) return;
  const invite = takePendingInvite();
  if (invite) {
    clearUrl();
    await runJoin(invite);
  }
  watchHouseholds(user.uid);
}

async function start() {
  const app = initializeApp(config.firebaseConfig);
  if (config.appCheckSiteKey) {
    if (LOCAL_HOSTS.includes(location.hostname)) {
      Reflect.set(globalThis, "FIREBASE_APPCHECK_DEBUG_TOKEN", true);
    }
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(config.appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  }
  const auth = getAuth(app);
  const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  if (config.emulators?.enabled) {
    connectAuthEmulator(auth, config.emulators.authUrl, { disableWarnings: true });
    connectFirestoreEmulator(db, config.emulators.firestoreHost, config.emulators.firestorePort);
  }
  useAuth(auth);
  useFirestore(db);
  onDataError((error) => showError(error));
  await completeEmailSignIn().catch((error) => showError(error));
  completeRedirectSignIn().catch((error) => showError(error));
  watchUser(handleUserChanged);
}

bindDialogs();
bindSignIn();
bindHouseholds();
bindList();
bindEditor();
bindHistory();
bindInstall();
subscribe(render);

for (const eventName of ["online", "offline"]) {
  window.addEventListener(eventName, () => setOnline(navigator.onLine));
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && flushPendingRemovals()) hideToasts();
});

setPendingInvite(readInviteFromUrl());

if (config.firebaseConfig.apiKey.startsWith("YOUR_")) {
  markStarted();
  byId("loading-message").textContent = "Add your Firebase project settings to firebase-config.js to get started.";
} else {
  registerServiceWorker();
  start().catch(startupFailed);
}
