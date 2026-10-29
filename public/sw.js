"use strict";

const CACHE_NAME = "shopping-list-v2";
const SDK_VERSION = "13.1.0";
const SDK_BASE = `https://www.gstatic.com/firebasejs/${SDK_VERSION}/`;
const NETWORK_TIMEOUT_MS = 4000;

const APP_FILES = [
  "./",
  "index.html",
  "styles.css",
  "firebase-config.js",
  "manifest.webmanifest",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon.png",
  "js/auth.js",
  "js/boot.js",
  "js/data/firestore.js",
  "js/data/households.js",
  "js/data/invites.js",
  "js/data/items.js",
  "js/data/lists.js",
  "js/data/removals.js",
  "js/data/watch.js",
  "js/dialogs.js",
  "js/dom.js",
  "js/errors.js",
  "js/format.js",
  "js/initial-state.js",
  "js/logic.js",
  "js/main.js",
  "js/readonly.js",
  "js/records.js",
  "js/sdk.js",
  "js/sections.js",
  "js/sortable.js",
  "js/storage.js",
  "js/store.js",
  "js/toast.js",
  "js/views/add-items.js",
  "js/views/editor.js",
  "js/views/history.js",
  "js/views/households.js",
  "js/views/install.js",
  "js/views/invites.js",
  "js/views/item-rows.js",
  "js/views/list-settings.js",
  "js/views/list.js",
  "js/views/share.js",
  "js/views/signin.js",
  "js/views/suggestions.js",
  "js/views/tabs.js",
];

const SDK_FILES = ["firebase-app.js", "firebase-app-check.js", "firebase-auth.js", "firebase-firestore.js"].map(
  (name) => SDK_BASE + name,
);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // "reload" skips the browser's HTTP cache, which could otherwise hand back files from the previous deploy.
      await cache.addAll(APP_FILES.map((url) => new Request(url, { cache: "reload" })));
      await Promise.allSettled(SDK_FILES.map((url) => cache.add(new Request(url, { mode: "cors" }))));
      await self.skipWaiting();
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Network timed out")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function networkFirst(request, fallbackUrl) {
  const cache = await caches.open(CACHE_NAME);
  const network = fetch(request).then((response) => {
    if (response.ok) cache.put(fallbackUrl ?? request, response.clone());
    return response;
  });
  network.catch(() => {});
  try {
    return await withTimeout(network, NETWORK_TIMEOUT_MS);
  } catch {
    const cached = await cache.match(fallbackUrl ?? request, { ignoreSearch: true });
    return cached ?? network;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  // Firebase's reserved pages (such as the sign-in handler) must never be answered with, or saved as, the app.
  if (url.origin === self.location.origin && url.pathname.includes("/__/")) return;
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "index.html"));
  } else if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request));
  } else if (url.href.startsWith(SDK_BASE)) {
    event.respondWith(cacheFirst(request));
  }
});
