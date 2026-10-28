import {
  GoogleAuthProvider,
  getRedirectResult,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
} from "./sdk.js";
import { askForText } from "./dialogs.js";
import { UserFacingError, errorCode } from "./errors.js";
import { EMAIL_SIGN_IN_KEY, readJson, writeStorage } from "./storage.js";
import { setPendingInvite, state } from "./store.js";

let auth;

export function useAuth(instance) {
  auth = instance;
}

// The invite in a page address, or in the address a sign-in link continues to.
export function readInviteFromUrl(href = location.href) {
  try {
    const params = new URL(href).searchParams;
    if (params.has("join")) return params.get("join");
    const continueUrl = params.get("continueUrl");
    return continueUrl ? new URL(continueUrl).searchParams.get("join") : null;
  } catch {
    return null;
  }
}

export function clearUrl() {
  history.replaceState(null, "", location.pathname);
}

function continueUrl() {
  const base = `${location.origin}${location.pathname}`;
  return state.pendingInvite ? `${base}?join=${encodeURIComponent(state.pendingInvite)}` : base;
}

export async function completeEmailSignIn(link = location.href) {
  if (!isSignInWithEmailLink(auth, link)) return;
  if (link === location.href) history.replaceState(null, "", continueUrl());
  const saved = readJson(EMAIL_SIGN_IN_KEY);
  const email = saved?.email || (await askForText({
    title: "Confirm your email address",
    placeholder: "you@example.com",
    submitLabel: "Sign in",
    maxLength: 254,
    type: "email",
  }));
  if (!email) return;
  const { user } = await signInWithEmailLink(auth, email, link);
  if (!user.displayName && saved?.name) {
    await updateProfile(user, { displayName: saved.name });
  }
  writeStorage(EMAIL_SIGN_IN_KEY, null);
}

// An app opened from the iPhone home screen can't receive links: tapping one in the email opens Safari, which
// would sign in there instead. So the link can be copied from the email and pasted into the app.
export async function signInWithPastedLink(text) {
  const link = text.trim();
  if (!isSignInWithEmailLink(auth, link)) {
    throw new UserFacingError("That isn't a sign-in link. Copy the whole link from the email and try again.");
  }
  const invite = readInviteFromUrl(link);
  if (invite) setPendingInvite(invite);
  await completeEmailSignIn(link);
}

export function hasSentEmailLink() {
  return readJson(EMAIL_SIGN_IN_KEY) !== null;
}

export async function sendEmailLink(name, email) {
  await sendSignInLinkToEmail(auth, email, { url: continueUrl(), handleCodeInApp: true });
  writeStorage(EMAIL_SIGN_IN_KEY, JSON.stringify({ email, name }));
}

export function isInstalledApp() {
  return matchMedia("(display-mode: standalone)").matches || Reflect.get(navigator, "standalone") === true;
}

// Redirect sign-in only works when the sign-in pages are served from this site's own address. Otherwise browsers
// that block third-party storage (Safari, and so every iPhone) lose the result on the way back.
function canRedirect() {
  return auth.config.authDomain === location.host;
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  // Pop-ups often never come back to an app opened from the iPhone home screen.
  if (isInstalledApp() && canRedirect()) return signInWithRedirect(auth, provider);
  try {
    return await signInWithPopup(auth, provider);
  } catch (error) {
    if (errorCode(error) === "auth/popup-blocked" && canRedirect()) return signInWithRedirect(auth, provider);
    throw error;
  }
}

export async function completeRedirectSignIn() {
  await getRedirectResult(auth);
}

export function signOutUser() {
  return signOut(auth);
}

export function updateDisplayName(name) {
  return updateProfile(auth.currentUser, { displayName: name });
}

export function watchUser(handler) {
  return onAuthStateChanged(auth, handler);
}
