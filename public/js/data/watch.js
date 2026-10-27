import { collection, limit, onSnapshot, orderBy, query, where } from "../sdk.js";
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

export function stopWatching() {
  stopHouseholds();
  stopHousehold();
  stopHouseholds = noop;
  stopHousehold = noop;
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
      const ids = households.map((household) => household.id);
      selectHousehold(firstKnown([readStorage(SELECTED_HOUSEHOLD_KEY), state.householdId], ids) ?? ids[0] ?? null);
    },
    (error) => reportError(error),
  );
}

function watchHousehold(householdId) {
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
        if (state.householdId === householdId) reportError(error);
      },
    );
  const purchasesQuery = query(collection(ref, "purchases"), orderBy("boughtAt", "desc"), limit(HISTORY_LIMIT));
  const stops = [
    watch(collection(ref, "lists"), "lists", (snapshot) => {
      const lists = snapshot.docs.map(readSnapshot).sort((a, b) => millis(a.createdAt) - millis(b.createdAt));
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

export function selectHousehold(householdId) {
  if (householdId === state.householdId) return;
  stopHousehold();
  startHousehold(householdId);
  stopHousehold = householdId ? watchHousehold(householdId) : noop;
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
