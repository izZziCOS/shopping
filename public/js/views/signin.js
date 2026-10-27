import { sendEmailLink, signInWithGoogle } from "../auth.js";
import { showCopyableText } from "../dialogs.js";
import { byId, inputById, onClick, onSubmit } from "../dom.js";
import { isCancelledSignIn } from "../errors.js";
import { state } from "../store.js";
import { showError, toast } from "../toast.js";

const IN_APP_BROWSER_PATTERN = /FBAN|FBAV|FB_IAB|Instagram|Messenger|Line\/|MicroMessenger|Snapchat|TikTok|musical_ly|LinkedInApp|; wv\)/i;
const isInAppBrowser = IN_APP_BROWSER_PATTERN.test(navigator.userAgent);

export function renderSignIn() {
  byId("invite-notice").hidden = !state.pendingInvite;
  byId("in-app-notice").hidden = !isInAppBrowser;
  byId("google-signin").hidden = isInAppBrowser;
}

export function bindSignIn() {
  onClick("signin-button", () => {
    signInWithGoogle().catch((error) => {
      if (!isCancelledSignIn(error)) showError(error, "Google sign-in failed. Try signing in with your email instead.");
    });
  });

  onClick("copy-page-link", async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      toast("Link copied. Paste it into Safari or Chrome.");
    } catch {
      await showCopyableText({
        title: "Copy this link",
        message: "Open it in Safari or Chrome to sign in.",
        value: location.href,
      });
    }
  });

  onSubmit("email-form", async (form, event) => {
    const name = inputById("email-name").value.trim();
    const email = inputById("email-address").value.trim();
    const button = event.submitter instanceof HTMLButtonElement ? event.submitter : null;
    if (button) button.disabled = true;
    try {
      await sendEmailLink(name, email);
      byId("email-sent").textContent = `We sent a sign-in link to ${email}. Open it to finish signing in.`;
      byId("email-sent").hidden = false;
    } catch (error) {
      showError(error, "Couldn't send the email. Check the address and try again.");
    } finally {
      if (button) button.disabled = false;
    }
  });
}
