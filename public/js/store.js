import { initialState } from "./initial-state.js";
import { SLOW_SYNC_MS, pendingTotal } from "./logic.js";
import { readOnly } from "./readonly.js";

const internal = initialState();

export const state = readOnly(internal);

const listeners = new Set();
let renderScheduled = false;
let slowSyncTimer;

export function subscribe(listener) {
  listeners.add(listener);
}

export function changed() {
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(() => {
    renderScheduled = false;
    listeners.forEach((listener) => listener());
  });
}

export function setUser(user) {
  internal.user = user;
  changed();
}

export function setPendingInvite(invite) {
  internal.pendingInvite = invite;
}

export function takePendingInvite() {
  const invite = internal.pendingInvite;
  internal.pendingInvite = null;
  return invite;
}

export function resetSession() {
  Object.assign(internal, {
    households: [],
    householdsLoaded: false,
    hiddenItemIds: new Set(),
    panel: null,
    editingItemId: null,
  });
  startHousehold(null);
}

export function setHouseholds(households, loaded) {
  internal.households = households;
  internal.householdsLoaded ||= loaded;
  changed();
}

export function startHousehold(householdId) {
  clearTimeout(slowSyncTimer);
  Object.assign(internal, {
    householdId,
    lists: [],
    listsLoaded: false,
    listId: null,
    items: [],
    purchases: [],
    invites: [],
    pending: {},
    pendingSince: null,
  });
  changed();
}

export function setLists(lists, loaded) {
  internal.lists = lists;
  internal.listsLoaded ||= loaded;
  changed();
}

export function setItems(items) {
  internal.items = items;
  changed();
}

export function setPurchases(purchases) {
  internal.purchases = purchases;
  changed();
}

export function setInvites(invites) {
  internal.invites = invites;
  changed();
}

export function setListId(listId) {
  internal.listId = listId;
  changed();
}

export function setPending(key, count) {
  internal.pending = { ...internal.pending, [key]: count };
  if (pendingTotal(internal.pending) === 0) {
    internal.pendingSince = null;
    clearTimeout(slowSyncTimer);
  } else if (internal.pendingSince === null) {
    internal.pendingSince = Date.now();
    slowSyncTimer = setTimeout(changed, SLOW_SYNC_MS);
  }
  changed();
}

export function hideItems(itemIds) {
  internal.hiddenItemIds = new Set([...internal.hiddenItemIds, ...itemIds]);
  changed();
}

export function showItems(itemIds) {
  internal.hiddenItemIds = new Set([...internal.hiddenItemIds].filter((id) => !itemIds.includes(id)));
  changed();
}

export function openPanel(panel) {
  internal.panel = panel;
  changed();
}

export function closePanel() {
  internal.panel = null;
  changed();
}

export function setEditingItem(itemId) {
  internal.editingItemId = itemId;
}

export function setOnline(online) {
  internal.online = online;
  changed();
}

export function currentHousehold() {
  return state.households.find((household) => household.id === state.householdId) ?? null;
}

export function currentList() {
  return state.lists.find((list) => list.id === state.listId) ?? null;
}

export function findItem(itemId) {
  return state.items.find((item) => item.id === itemId) ?? null;
}

export function visibleItems() {
  return state.items.filter((item) => !state.hiddenItemIds.has(item.id));
}

export function listItems(listId = state.listId) {
  return visibleItems().filter((item) => item.listId === listId);
}

export function requireHouseholdId() {
  if (!state.householdId) throw new Error("No household selected");
  return state.householdId;
}

export function requireUser() {
  if (!state.user) throw new Error("Not signed in");
  return state.user;
}

export function userName() {
  return state.user?.displayName?.trim() || state.user?.email?.split("@")[0] || "Someone";
}

export function personName(uid, fallback) {
  return currentHousehold()?.memberInfo?.[uid]?.name ?? fallback;
}
