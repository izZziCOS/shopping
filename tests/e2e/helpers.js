import { expect } from "@playwright/test";

const PROJECT_ID = "demo-shopping";
const AUTH_EMULATOR = "http://127.0.0.1:9099";
const FIRESTORE_EMULATOR = "http://127.0.0.1:8085";

export async function resetEmulators(request) {
  await request.delete(`${FIRESTORE_EMULATOR}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`);
  await request.delete(`${AUTH_EMULATOR}/emulator/v1/projects/${PROJECT_ID}/accounts`);
}

export async function newUser(browser) {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    const shared = [];
    Object.defineProperty(window, "shared", { value: shared });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data) => {
        shared.push(data);
      },
    });
  });
  return context.newPage();
}

async function emailSignInLink(request, email) {
  const response = await request.get(`${AUTH_EMULATOR}/emulator/v1/projects/${PROJECT_ID}/oobCodes`);
  const { oobCodes } = await response.json();
  const code = oobCodes.filter((entry) => entry.email === email && entry.requestType === "EMAIL_SIGNIN").at(-1);
  if (!code) throw new Error(`No sign-in email was sent to ${email}`);
  const continueUrl = new URL(code.oobLink).searchParams.get("continueUrl");
  const link = new URL(continueUrl ?? "http://127.0.0.1:4173/");
  link.searchParams.set("mode", "signIn");
  link.searchParams.set("oobCode", code.oobCode);
  link.searchParams.set("apiKey", "demo-api-key");
  return link.toString();
}

export async function signIn(page, { name, email, url = "/" }) {
  await page.goto(url);
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByText(`We sent a sign-in link to ${email}`)).toBeVisible();
  await page.goto(await emailSignInLink(page.request, email));
}

async function lastShared(page, field) {
  await expect.poll(() => page.evaluate((key) => window.shared.filter((data) => data[key]).length, field)).toBeGreaterThan(0);
  return page.evaluate((key) => window.shared.filter((data) => data[key]).at(-1)[key], field);
}

export function lastSharedUrl(page) {
  return lastShared(page, "url");
}

export function lastSharedText(page) {
  return page.evaluate(() => window.shared.filter((data) => !data.url).at(-1)?.text ?? "");
}

export async function addItems(page, text) {
  await page.getByLabel("Items to add, separated by commas").fill(text);
  await page.getByRole("button", { name: "Add", exact: true }).click();
}

export function toBuy(page) {
  return page.locator("#to-buy-groups");
}

export function bought(page) {
  return page.locator("#bought-list");
}

export function itemCheckbox(scope, name) {
  return scope.getByRole("checkbox", { name: new RegExp(`^${name}\\b`) });
}
