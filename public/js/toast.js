import { byId, element, textButton } from "./dom.js";
import { GENERIC_ERROR, errorMessage } from "./errors.js";
import { UNDO_DELAY_MS } from "./logic.js";

const TOAST_DELAY_MS = 3000;

// A plain message replaces the one before it. A toast with an action (such as Undo) gets its own place in the stack
// and stays for its whole delay, so a message shown in the meantime can't take the action away.
let messageToast = null;

function removeToast(node) {
  node.remove();
  if (node === messageToast) messageToast = null;
}

function showToast(node, delay) {
  byId("toasts").append(node);
  setTimeout(() => removeToast(node), delay);
}

export function toast(message, { actionLabel = "", onAction = () => {} } = {}) {
  const node = element("div", "toast");
  node.append(element("span", "toast-message", message));
  if (actionLabel) {
    node.append(textButton(actionLabel, "toast-action", () => {
      removeToast(node);
      onAction();
    }));
    showToast(node, UNDO_DELAY_MS);
    return;
  }
  if (messageToast) removeToast(messageToast);
  messageToast = node;
  showToast(node, TOAST_DELAY_MS);
}

export function hideToasts() {
  byId("toasts").replaceChildren();
  messageToast = null;
}

export function showError(error, fallback = GENERIC_ERROR) {
  console.error(error);
  toast(errorMessage(error, fallback));
}
