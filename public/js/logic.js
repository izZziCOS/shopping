import { DEFAULT_SECTION, guessSection, isKnownSection, orderedSections, sectionLabel } from "./sections.js";
import { millis } from "./format.js";

export const NOT_BOUGHT = { bought: false, boughtAt: null, boughtBy: null, boughtByName: null, purchaseId: null };
export const PURCHASE_UNDO_WINDOW_MS = 10 * 60 * 1000;
export const SLOW_SYNC_MS = 2000;
export const UNDO_DELAY_MS = 5000;
export const MAX_ITEM_NAME_LENGTH = 100;
export const MAX_NOTE_LENGTH = 200;
export const MAX_ITEMS_PER_ADD = 50;
export const MAX_ITEMS_PER_LIST = 300;
export const MAX_LISTS_PER_HOUSEHOLD = 20;
export const MAX_ACTIVE_INVITES = 10;
export const MAX_MEMBERS = 20;

const ID_PATTERN = /^[A-Za-z0-9]{8,40}$/;
const CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const ITEM_SEPARATORS = /[,;\n]/;

export function normalize(name) {
  return name.trim().toLocaleLowerCase();
}

export function uniqueByKey(names) {
  const seen = new Map();
  for (const name of names) {
    const key = normalize(name);
    if (!seen.has(key)) seen.set(key, name);
  }
  return [...seen.values()];
}

export function splitItemNames(input) {
  return uniqueByKey(
    input
      .split(ITEM_SEPARATORS)
      .map((name) => name.trim().replace(/\s+/g, " "))
      .filter((name) => name.length > 0),
  );
}

export function planAdd(listItems, name, quantity) {
  const key = normalize(name);
  const matches = listItems.filter((item) => normalize(item.name) === key);
  const onList = matches.find((item) => !item.bought);
  if (onList) {
    return quantity && quantity !== onList.quantity
      ? { action: "update-quantity", item: onList }
      : { action: "exists", item: onList };
  }
  const previouslyBought = matches.find((item) => item.bought);
  if (previouslyBought) return { action: "readd", item: previouslyBought };
  return { action: "create", item: null };
}

export function canUndoPurchase(item, uid, now) {
  return Boolean(item.purchaseId)
    && item.boughtBy === uid
    && now - millis(item.boughtAt) < PURCHASE_UNDO_WINDOW_MS;
}

export function extractJoinParam(value) {
  try {
    return new URL(value).searchParams.get("join") ?? "";
  } catch {
    return value;
  }
}

export function parseInvite(input) {
  const [householdId, code, ...rest] = extractJoinParam(input.trim()).split("-");
  if (rest.length > 0 || !ID_PATTERN.test(householdId ?? "") || !ID_PATTERN.test(code ?? "")) return null;
  return { householdId, code };
}

export function randomCode(bytes = crypto.getRandomValues(new Uint8Array(20))) {
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}

export function groupByName(purchases) {
  const groups = new Map();
  for (const purchase of purchases) {
    const key = normalize(purchase.name);
    groups.set(key, [...(groups.get(key) ?? []), purchase]);
  }
  return groups;
}

export function frequentItems(purchases) {
  return [...groupByName(purchases)]
    .map(([key, group]) => ({ key, name: group[0].name, quantity: group[0].quantity, count: group.length }))
    .sort((a, b) => b.count - a.count);
}

export function sectionOf(item) {
  return isKnownSection(item.section) ? item.section : DEFAULT_SECTION;
}

export function knownSection(name, items, purchases) {
  const key = normalize(name);
  const match =
    items.find((item) => normalize(item.name) === key) ??
    purchases.find((purchase) => normalize(purchase.name) === key);
  return match ? sectionOf(match) : guessSection(name);
}

export function moveEntry(entries, index, offset) {
  const target = index + offset;
  if (target < 0 || target >= entries.length) return null;
  const moved = [...entries];
  [moved[index], moved[target]] = [moved[target], moved[index]];
  return moved;
}

export function memberEntries(household) {
  return Object.entries(household.memberInfo ?? {})
    .map(([uid, info]) => ({ uid, ...info }))
    .sort((a, b) => millis(a.joinedAt) - millis(b.joinedAt));
}

export function nextOwner(household, leavingUid) {
  if (household.ownerId !== leavingUid) return null;
  return memberEntries(household).find((member) => member.uid !== leavingUid) ?? null;
}

export function activeInvites(invites, now) {
  return invites
    .filter((invite) => millis(invite.expiresAt) > now)
    .sort((a, b) => millis(b.expiresAt) - millis(a.expiresAt));
}

export function reusableInvite(invites, now, minimumRemainingMs) {
  return activeInvites(invites, now).find((invite) => millis(invite.expiresAt) - now > minimumRemainingMs) ?? null;
}

export function pendingTotal(pending) {
  return Object.values(pending).reduce((sum, count) => sum + count, 0);
}

export function syncStatus({ online, pending, pendingSince }, now) {
  const count = pendingTotal(pending);
  const slow = count > 0 && pendingSince !== null && now - pendingSince >= SLOW_SYNC_MS;
  return { count, offline: !online, slow, visible: !online || slow };
}

export function summarizeAdds(results) {
  const created = results.filter((result) => result.action === "create" || result.action === "readd").length;
  const updated = results.filter((result) => result.action === "update-quantity");
  const existing = results.filter((result) => result.action === "exists");
  if (results.length === 1) {
    if (updated.length === 1) return `Updated ${updated[0].item.name}`;
    if (existing.length === 1) return `${existing[0].item.name} is already on the list`;
    return null;
  }
  const parts = [];
  if (created > 0) parts.push(`Added ${created} ${created === 1 ? "item" : "items"}`);
  if (updated.length > 0) parts.push(`updated ${updated.length}`);
  if (existing.length > 0) parts.push(`${existing.length} already on the list`);
  const message = parts.join(", ");
  return message.charAt(0).toLocaleUpperCase() + message.slice(1);
}

export function limitAdds(names, itemsOnList) {
  const room = Math.max(0, MAX_ITEMS_PER_LIST - itemsOnList);
  const allowed = Math.min(MAX_ITEMS_PER_ADD, room);
  const accepted = names.slice(0, allowed);
  const dropped = names.length - accepted.length;
  const reason = dropped === 0 ? null : room < MAX_ITEMS_PER_ADD ? "list-full" : "too-many";
  return { accepted, dropped, reason };
}

export function groupBySection(items, savedOrder) {
  return orderedSections(savedOrder)
    .map((key) => ({ key, items: items.filter((item) => sectionOf(item) === key) }))
    .filter((group) => group.items.length > 0);
}

export function listAsText({ listName, householdName, items, savedOrder }) {
  const heading = householdName ? `${listName} (${householdName})` : listName;
  const groups = groupBySection(items, savedOrder);
  if (groups.length === 0) return `${heading}\n\nNothing left to buy.`;
  const describe = (item) =>
    [item.name, item.quantity && `(${item.quantity})`].filter(Boolean).join(" ") + (item.note ? ` – ${item.note}` : "");
  const sections = groups.map((group) => {
    const lines = group.items.map((item) => `• ${describe(item)}`);
    return groups.length > 1 ? [sectionLabel(group.key), ...lines].join("\n") : lines.join("\n");
  });
  return [heading, ...sections].join("\n\n");
}

export function limitMessage(dropped, reason) {
  if (dropped === 0 || reason === null) return "";
  if (reason === "list-full") {
    return `${dropped} not added because the list is full (${MAX_ITEMS_PER_LIST} items)`;
  }
  return `${dropped} more not added: you can add up to ${MAX_ITEMS_PER_ADD} at a time`;
}
