import { HOUR_MS } from "./format.js";
import { initialState } from "./initial-state.js";
import { SLOW_SYNC_MS, dueStaples, frequentItems, groupByName, memoizeLast, pendingTotal } from "./logic.js";
import { readOnly } from "./readonly.js";

const internal = initialState();

export const state = readOnly(internal);

const listeners = new Set();
let renderScheduled = false;
let renderHolds = 0;
let renderWanted = false;
let slowSyncTimer;

export function subscribe(listener) {
  listeners.add(listener);
}

export function changed() {
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(() => {
    renderScheduled = false;
    if (renderHolds > 0) {
      renderWanted = true;
      return;
    }
    listeners.forEach((listener) => listener());
  });
}

// Keeps the page as it is (for example while a row is being dragged) even if state changes. State still updates,
// and one render catches up once every hold is released.
export function holdRenders() {
  renderHolds += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    renderHolds -= 1;
    if (renderHolds === 0 && renderWanted) {
      renderWanted = false;
      changed();
    }
  };
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
    hiddenListIds: new Set(),
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

export function hideList(listId) {
  internal.hiddenListIds = new Set([...internal.hiddenListIds, listId]);
  changed();
}

export function showList(listId) {
  internal.hiddenListIds = new Set([...internal.hiddenListIds].filter((id) => id !== listId));
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

export function visibleLists() {
  return state.lists.filter((list) => !state.hiddenListIds.has(list.id));
}

export function currentList() {
  return visibleLists().find((list) => list.id === state.listId) ?? null;
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

// Worked out from purchases, which can hold hundreds of records. Renders happen on every change, so each result is
// kept until a snapshot replaces state.purchases (and, for staples, until the hour changes).
const groupPurchasesByName = memoizeLast((purchases) => readOnly(groupByName(purchases)));
const frequentPurchases = memoizeLast((purchases) => readOnly(frequentItems(purchases)));
const listSuggestions = memoizeLast((purchases, listId, hour) => {
  const onList = purchases.filter((purchase) => purchase.listId === listId);
  return readOnly({ staples: dueStaples(onList, hour * HOUR_MS), frequent: frequentItems(onList) });
});

export function purchasesByName() {
  return groupPurchasesByName(state.purchases);
}

export function frequentlyBought() {
  return frequentPurchases(state.purchases);
}

export function suggestionsForList(listId = state.listId) {
  return listSuggestions(state.purchases, listId, Math.floor(Date.now() / HOUR_MS));
}
