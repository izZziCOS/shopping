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

async function sentSignInCode(request, email) {
  const response = await request.get(`${AUTH_EMULATOR}/emulator/v1/projects/${PROJECT_ID}/oobCodes`);
  const { oobCodes } = await response.json();
  const code = oobCodes.filter((entry) => entry.email === email && entry.requestType === "EMAIL_SIGNIN").at(-1);
  if (!code) throw new Error(`No sign-in email was sent to ${email}`);
  return code;
}

// The link exactly as it appears in the email.
export async function emailedLink(request, email) {
  return (await sentSignInCode(request, email)).oobLink;
}

async function emailSignInLink(request, email) {
  const code = await sentSignInCode(request, email);
  const continueUrl = new URL(code.oobLink).searchParams.get("continueUrl");
  const link = new URL(continueUrl ?? "http://127.0.0.1:4173/");
  link.searchParams.set("mode", "signIn");
  link.searchParams.set("oobCode", code.oobCode);
  link.searchParams.set("apiKey", "demo-api-key");
  return link.toString();
}

export async function requestSignInLink(page, { name, email, url = "/" }) {
  await page.goto(url);
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await expect(page.getByText(`We sent a sign-in link to ${email}`)).toBeVisible();
}

export async function signIn(page, options) {
  await requestSignInLink(page, options);
  await page.goto(await emailSignInLink(page.request, options.email));
}

function firestoreValue(value) {
  if (value instanceof Date) return { timestampValue: value.toISOString() };
  return { stringValue: value };
}

// Writes straight to the emulator, past the security rules, to create history that would take weeks to build up.
export async function seedPurchases(request, { name, quantity = "", daysAgo }) {
  const documents = `${FIRESTORE_EMULATOR}/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
  const headers = { Authorization: "Bearer owner" };
  const get = async (path) => (await (await request.get(`${documents}/${path}`, { headers })).json()).documents ?? [];
  const idOf = (document) => document.name.split("/").at(-1);
  // The app shows a new household before the server has it.
  await expect.poll(async () => (await get("households")).length).toBe(1);
  const [household] = await get("households");
  await expect.poll(async () => (await get(`households/${idOf(household)}/lists`)).length).toBe(1);
  const [list] = await get(`households/${idOf(household)}/lists`);
  const buyer = Object.keys(household.fields.memberInfo.mapValue.fields)[0];
  for (const days of daysAgo) {
    const boughtAt = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const fields = {
      itemId: "seededitem01",
      listId: idOf(list),
      name,
      quantity,
      section: "dairy",
      boughtAt,
      boughtBy: buyer,
      boughtByName: "Seeded",
      expireAt: new Date(boughtAt.getTime() + 365 * 24 * 60 * 60 * 1000),
    };
    const body = { fields: Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, firestoreValue(value)])) };
    const response = await request.post(`${documents}/households/${idOf(household)}/purchases`, { headers, data: body });
    if (!response.ok()) throw new Error(`Couldn't seed a purchase: ${await response.text()}`);
  }
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
