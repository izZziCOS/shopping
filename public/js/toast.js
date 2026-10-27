import { byId, buttonById } from "./dom.js";
import { GENERIC_ERROR, errorMessage } from "./errors.js";
import { UNDO_DELAY_MS } from "./logic.js";

const TOAST_DELAY_MS = 3000;

let toastTimer;
const noAction = () => {};

let toastAction = noAction;

export function toast(message, { actionLabel = "", onAction = noAction } = {}) {
  byId("toast-message").textContent = message;
  const action = buttonById("toast-action");
  action.hidden = !actionLabel;
  action.textContent = actionLabel;
  toastAction = onAction;
  byId("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, actionLabel ? UNDO_DELAY_MS : TOAST_DELAY_MS);
}

export function hideToast() {
  byId("toast").hidden = true;
  toastAction = noAction;
}

export function showError(error, fallback = GENERIC_ERROR) {
  console.error(error);
  toast(errorMessage(error, fallback));
}

export function bindToast() {
  buttonById("toast-action").addEventListener("click", () => {
    const action = toastAction;
    hideToast();
    action();
  });
}
