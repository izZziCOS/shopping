import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../public/", import.meta.url));
const PORT = Number(process.env.PORT ?? 4173);

const CONTENT_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".webmanifest", "application/manifest+json"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
]);

const TEST_CONFIG = `export const firebaseConfig = {
  apiKey: "demo-api-key",
  authDomain: "demo-shopping.firebaseapp.com",
  projectId: "demo-shopping",
  appId: "demo-app",
};

export const appCheckSiteKey = "";

export const emulators = {
  enabled: true,
  authUrl: "http://127.0.0.1:9099",
  firestoreHost: "127.0.0.1",
  firestorePort: 8085,
};
`;

function send(response, status, body, contentType = "text/plain; charset=utf-8") {
  response.writeHead(status, { "content-type": contentType, "cache-control": "no-store" });
  response.end(body);
}

createServer(async (request, response) => {
  const path = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname);
  if (path === "/firebase-config.js") {
    send(response, 200, TEST_CONFIG, CONTENT_TYPES.get(".js"));
    return;
  }
  const file = normalize(join(ROOT, path === "/" ? "index.html" : path));
  if (!file.startsWith(ROOT)) {
    send(response, 403, "Forbidden");
    return;
  }
  try {
    send(response, 200, await readFile(file), CONTENT_TYPES.get(extname(file)) ?? "application/octet-stream");
  } catch {
    send(response, 404, "Not found");
  }
}).listen(PORT, "127.0.0.1", () => {
  console.log(`Serving ${ROOT} on http://127.0.0.1:${PORT}`);
});
