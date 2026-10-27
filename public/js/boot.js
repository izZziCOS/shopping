"use strict";

const STARTUP_TIMEOUT_MS = 20000;
const STARTUP_FAILED_MESSAGE = "Couldn't load the app. Check your internet connection and try again.";

function showStartupError() {
  if (document.documentElement.dataset.started === "true") return;
  const message = document.getElementById("loading-message");
  const retry = document.getElementById("retry-start");
  const loading = document.getElementById("loading-view");
  if (loading) loading.hidden = false;
  if (message) message.textContent = STARTUP_FAILED_MESSAGE;
  if (retry) {
    retry.hidden = false;
    retry.onclick = () => location.reload();
  }
}

document.querySelector('script[type="module"]')?.addEventListener("error", showStartupError);
document.addEventListener("app-startup-failed", showStartupError);
setTimeout(showStartupError, STARTUP_TIMEOUT_MS);
