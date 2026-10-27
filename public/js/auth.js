import {
  GoogleAuthProvider,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
  signOut,
  updateProfile,
} from "./sdk.js";
import { askForText } from "./dialogs.js";
import { EMAIL_SIGN_IN_KEY, readJson, writeStorage } from "./storage.js";
import { state } from "./store.js";

let auth;

export function useAuth(instance) {
  auth = instance;
}

export function readInviteFromUrl() {
  const params = new URLSearchParams(location.search);
  if (params.has("join")) return params.get("join");
  const continueUrl = params.get("continueUrl");
  if (!continueUrl) return null;
  try {
    return new URL(continueUrl).searchParams.get("join");
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

export async function completeEmailSignIn() {
  const link = location.href;
  if (!isSignInWithEmailLink(auth, link)) return;
  history.replaceState(null, "", continueUrl());
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

export async function sendEmailLink(name, email) {
  await sendSignInLinkToEmail(auth, email, { url: continueUrl(), handleCodeInApp: true });
  writeStorage(EMAIL_SIGN_IN_KEY, JSON.stringify({ email, name }));
}

export function signInWithGoogle() {
  return signInWithPopup(auth, new GoogleAuthProvider());
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
