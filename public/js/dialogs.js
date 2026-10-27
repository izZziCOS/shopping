import { buttonById, byId, dialogById, inputById, onSubmit, textAreaById } from "./dom.js";

function waitForClose(dialog) {
  return new Promise((resolve) => {
    dialog.addEventListener("close", () => resolve(dialog.returnValue), { once: true });
  });
}

function open(dialog) {
  dialog.returnValue = "";
  dialog.showModal();
  return waitForClose(dialog);
}

export async function askForText({ title, value = "", placeholder = "", submitLabel = "Save", maxLength = 60, type = "text" }) {
  const input = inputById("text-input");
  byId("text-title").textContent = title;
  byId("text-submit").textContent = submitLabel;
  Object.assign(input, { type, value, placeholder, maxLength });
  const closed = open(dialogById("text-dialog"));
  input.select();
  return (await closed) || null;
}

export async function askToConfirm({ title, message, confirmLabel = "OK", danger = false }) {
  byId("confirm-title").textContent = title;
  byId("confirm-message").textContent = message;
  const confirm = buttonById("confirm-ok");
  confirm.textContent = confirmLabel;
  confirm.className = danger ? "danger-solid" : "primary";
  return (await open(dialogById("confirm-dialog"))) === "confirm";
}

export async function showCopyableText({ title, message, value }) {
  byId("copy-title").textContent = title;
  byId("copy-message").textContent = message;
  buttonById("copy-button").textContent = "Copy";
  const input = textAreaById("copy-input");
  input.value = value;
  input.rows = Math.min(10, Math.max(2, value.split("\n").length));
  const closed = open(dialogById("copy-dialog"));
  input.select();
  await closed;
}

export function bindDialogs() {
  onSubmit("text-form", () => {
    const value = inputById("text-input").value.trim();
    if (value) dialogById("text-dialog").close(value);
  });
  const closeWith = (dialogId, value) => () => dialogById(dialogId).close(value);
  buttonById("text-cancel").addEventListener("click", closeWith("text-dialog", ""));
  buttonById("confirm-ok").addEventListener("click", closeWith("confirm-dialog", "confirm"));
  buttonById("confirm-cancel").addEventListener("click", closeWith("confirm-dialog", ""));
  buttonById("copy-done").addEventListener("click", closeWith("copy-dialog", ""));
  buttonById("copy-button").addEventListener("click", async () => {
    const input = textAreaById("copy-input");
    input.select();
    try {
      await navigator.clipboard.writeText(input.value);
      buttonById("copy-button").textContent = "Copied";
    } catch {
      buttonById("copy-button").textContent = "Select and copy the text above";
    }
  });
}
