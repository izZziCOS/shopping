import { doc, writeBatch } from "../sdk.js";
import { requireHouseholdId } from "../store.js";

export const DEFAULT_LIST_NAME = "Groceries";

const BATCH_LIMIT = 400;

let db;
let errorHandler = console.error;

export function useFirestore(instance) {
  db = instance;
}

export function firestore() {
  return db;
}

export function onDataError(handler) {
  errorHandler = handler;
}

export function reportError(error) {
  errorHandler(error);
}

export function newBatch() {
  return writeBatch(db);
}

export function householdRef(householdId = requireHouseholdId()) {
  return doc(db, "households", householdId);
}

export function itemRef(itemId, householdId = requireHouseholdId()) {
  return doc(householdRef(householdId), "items", itemId);
}

export function readSnapshot(snapshot) {
  return {
    id: snapshot.id,
    ...snapshot.data({ serverTimestamps: "estimate" }),
    pending: snapshot.metadata.hasPendingWrites,
  };
}

export async function commitDeletes(refs) {
  for (let start = 0; start < refs.length; start += BATCH_LIMIT) {
    const batch = newBatch();
    refs.slice(start, start + BATCH_LIMIT).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}
