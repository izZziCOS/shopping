import { byId, onClick } from "../dom.js";
import { toast } from "../toast.js";

const deferred = new Map();

function isStandalone() {
  return matchMedia("(display-mode: standalone)").matches || Reflect.get(navigator, "standalone") === true;
}

function isAppleMobile() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

export function renderInstall() {
  const prompt = deferred.get("install");
  const showIosHint = !prompt && isAppleMobile();
  byId("install-card").hidden = isStandalone() || (!prompt && !showIosHint);
  byId("install-app").hidden = !prompt;
  byId("install-ios-hint").hidden = !showIosHint;
}

export function bindInstall() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred.set("install", event);
    renderInstall();
  });
  window.addEventListener("appinstalled", () => {
    deferred.delete("install");
    renderInstall();
    toast("Shopping List was added to your home screen");
  });
  onClick("install-app", async () => {
    const prompt = deferred.get("install");
    if (!prompt) return;
    deferred.delete("install");
    await prompt.prompt();
    await prompt.userChoice;
    renderInstall();
  });
}
