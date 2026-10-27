import { collection, limit, onSnapshot, orderBy, query, where } from "../sdk.js";
import { errorCode } from "../errors.js";
import { millis } from "../format.js";
import { SELECTED_HOUSEHOLD_KEY, readStorage, selectedListKey, writeStorage } from "../storage.js";
import {
  resetSession,
  setHouseholds,
  setInvites,
  setItems,
  setListId,
  setLists,
  setPending,
  setPurchases,
  startHousehold,
  state,
} from "../store.js";
import { firestore, householdRef, readSnapshot, reportError } from "./firestore.js";

export const HISTORY_LIMIT = 300;

function firstKnown(candidates, ids) {
  return candidates.find((id) => id !== null && ids.includes(id)) ?? null;
}

const noop = () => {};

let stopHouseholds = noop;
let stopHousehold = noop;

// A household that was just created (or joined) shows up from the local cache before the server has it. Listeners
// started then can be rejected by the security rules, which check membership on the server, and a rejected
// listener never recovers. So they are started again once the server confirms the household.
let unconfirmedHouseholds = new Set();
let restartWhenConfirmed = false;

export function stopWatching() {
  stopHouseholds();
  stopHousehold();
  stopHouseholds = noop;
  stopHousehold = noop;
  unconfirmedHouseholds = new Set();
  restartWhenConfirmed = false;
  resetSession();
}

export function watchHouseholds(uid) {
  stopHouseholds();
  const householdsQuery = query(collection(firestore(), "households"), where("members", "array-contains", uid));
  stopHouseholds = onSnapshot(
    householdsQuery,
    { includeMetadataChanges: true },
    (snapshot) => {
      const households = snapshot.docs.map(readSnapshot).sort((a, b) => a.name.localeCompare(b.name));
      setHouseholds(households, !snapshot.metadata.fromCache || !snapshot.empty);
      unconfirmedHouseholds = new Set(snapshot.docs.filter((snap) => snap.metadata.hasPendingWrites).map((snap) => snap.id));
      const ids = households.map((household) => household.id);
      selectHousehold(firstKnown([readStorage(SELECTED_HOUSEHOLD_KEY), state.householdId], ids) ?? ids[0] ?? null);
      if (restartWhenConfirmed && state.householdId && !unconfirmedHouseholds.has(state.householdId)) {
        restartWhenConfirmed = false;
        stopHousehold();
        stopHousehold = watchHousehold(state.householdId, false);
      }
    },
    (error) => reportError(error),
  );
}

function watchHousehold(householdId, restartsLater) {
  const ref = householdRef(householdId);
  const watch = (target, key, apply) =>
    onSnapshot(
      query(target),
      { includeMetadataChanges: true },
      (snapshot) => {
        if (state.householdId !== householdId) return;
        setPending(key, snapshot.docs.filter((snap) => snap.metadata.hasPendingWrites).length);
        apply(snapshot);
      },
      (error) => {
        if (state.householdId !== householdId || restartsLater) return;
        reportError(error);
        if (errorCode(error) === "permission-denied") forgetHousehold(householdId);
      },
    );
  const purchasesQuery = query(collection(ref, "purchases"), orderBy("boughtAt", "desc"), limit(HISTORY_LIMIT));
  const stops = [
    watch(collection(ref, "lists"), "lists", (snapshot) => {
      // A list the server hasn't confirmed yet is the newest one. Its estimated createdAt can sort it before
      // a list created moments earlier, so it goes last until the server time arrives.
      const createdAt = (snap) => millis(snap.get("createdAt", { serverTimestamps: "none" })) || Infinity;
      const lists = [...snapshot.docs].sort((a, b) => createdAt(a) - createdAt(b) || 0).map(readSnapshot);
      setLists(lists, !snapshot.metadata.fromCache || !snapshot.empty);
      selectList(preferredListId());
    }),
    watch(collection(ref, "items"), "items", (snapshot) => {
      setItems(snapshot.docs.map(readSnapshot));
    }),
    watch(purchasesQuery, "purchases", (snapshot) => {
      setPurchases(snapshot.docs.map(readSnapshot).sort((a, b) => millis(b.boughtAt) - millis(a.boughtAt)));
    }),
    watch(collection(ref, "invites"), "invites", (snapshot) => {
      setInvites(snapshot.docs.map(readSnapshot));
    }),
  ];
  return () => stops.forEach((stop) => stop());
}

// Once you're removed from a household the rules deny its lists and items. The households listener isn't always
// told that the household no longer matches (the emulator never is), so drop it here too.
function forgetHousehold(householdId) {
  const households = state.households.filter((household) => household.id !== householdId);
  setHouseholds(households, true);
  selectHousehold(households[0]?.id ?? null);
}

export function selectHousehold(householdId) {
  if (householdId === state.householdId) return;
  stopHousehold();
  startHousehold(householdId);
  restartWhenConfirmed = householdId !== null && unconfirmedHouseholds.has(householdId);
  stopHousehold = householdId ? watchHousehold(householdId, restartWhenConfirmed) : noop;
  writeStorage(SELECTED_HOUSEHOLD_KEY, householdId);
}

export function chooseHousehold(householdId) {
  writeStorage(SELECTED_HOUSEHOLD_KEY, householdId);
  if (state.households.some((household) => household.id === householdId)) {
    selectHousehold(householdId);
  }
}

export function selectList(listId) {
  setListId(listId);
  if (listId && state.householdId) writeStorage(selectedListKey(state.householdId), listId);
}

function preferredListId() {
  const ids = state.lists.map((list) => list.id);
  const stored = state.householdId ? readStorage(selectedListKey(state.householdId)) : null;
  return firstKnown([stored, state.listId], ids) ?? ids[0] ?? null;
}
