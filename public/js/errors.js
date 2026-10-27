export const GENERIC_ERROR = "Something went wrong. Please try again.";

const OFFLINE = "Couldn't reach the server. Check your connection and try again.";
const EXPIRED_LINK = "That sign-in link has expired or was already used. Request a new one.";

const MESSAGES = new Map([
  ["permission-denied", "You don't have access to that any more. You may have been removed from the household."],
  ["unauthenticated", "Your session has expired. Please sign in again."],
  ["not-found", "That no longer exists. Someone may have just removed it."],
  ["unavailable", OFFLINE],
  ["deadline-exceeded", "The server took too long to respond. Please try again."],
  ["resource-exhausted", "Too many changes at once. Wait a moment and try again."],
  ["auth/network-request-failed", OFFLINE],
  ["auth/too-many-requests", "Too many attempts. Wait a few minutes and try again."],
  ["auth/invalid-email", "That email address doesn't look right."],
  ["auth/missing-email", "Enter your email address."],
  ["auth/invalid-action-code", EXPIRED_LINK],
  ["auth/expired-action-code", EXPIRED_LINK],
  ["auth/popup-blocked", "Your browser blocked the sign-in window. Allow pop-ups for this site, or sign in with your email."],
  ["auth/unauthorized-domain", "Sign-in isn't set up for this website address yet."],
  ["auth/unauthorized-continue-uri", "Sign-in isn't set up for this website address yet."],
  ["auth/operation-not-allowed", "This sign-in method isn't turned on for this app."],
  ["auth/user-disabled", "This account has been disabled."],
]);

const CANCELLED_SIGN_IN = new Set(["auth/popup-closed-by-user", "auth/cancelled-popup-request"]);

export class UserFacingError extends Error {
  constructor(message) {
    super(message);
    this.name = "UserFacingError";
  }
}

export function errorCode(error) {
  return typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
}

export function errorMessage(error, fallback = GENERIC_ERROR) {
  if (error instanceof UserFacingError) return error.message;
  return MESSAGES.get(errorCode(error)) ?? fallback;
}

export function isCancelledSignIn(error) {
  return CANCELLED_SIGN_IN.has(errorCode(error));
}
