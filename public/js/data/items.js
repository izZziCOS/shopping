import { Timestamp, collection, doc, serverTimestamp, updateDoc } from "../sdk.js";
import { DAY_MS } from "../format.js";
import { NOT_BOUGHT, UNDO_DELAY_MS, canUndoPurchase, knownSection, limitAdds, planAdd } from "../logic.js";
import { boughtItemChanges, itemRecord, purchaseRecord, readdedItemChanges } from "../records.js";
import { findItem, hideItems, listItems, requireHouseholdId, requireUser, showItems, state, userName } from "../store.js";
import { commitDeletes, householdRef, itemRef, newBatch, reportError } from "./firestore.js";

const PURCHASE_RETENTION_MS = 365 * DAY_MS;

const pendingRemovals = new Set();

function addedBy() {
  return { addedBy: requireUser().uid, addedByName: userName(), createdAt: serverTimestamp() };
}

export async function addItems(names, quantity) {
  const listId = state.listId;
  if (!listId) throw new Error("No list selected");
  const { accepted, dropped, reason } = limitAdds(names, listItems().length);
  const batch = newBatch();
  const results = accepted.map((name) => {
    const plan = planAdd(listItems(), name, quantity);
    if (plan.action === "update-quantity") {
      batch.update(itemRef(plan.item.id), { quantity });
    } else if (plan.action === "readd") {
      batch.update(itemRef(plan.item.id), readdedItemChanges({ quantity: quantity || plan.item.quantity, ...addedBy() }));
    } else if (plan.action === "create") {
      batch.set(
        doc(collection(householdRef(), "items")),
        itemRecord({ listId, name, quantity, section: knownSection(name, state.items, state.purchases), ...addedBy() }),
      );
    }
    return plan;
  });
  const hasWrites = results.some((result) => result.action !== "exists");
  return { results, dropped, reason, saved: hasWrites ? batch.commit() : Promise.resolve() };
}

export async function setBought(itemId, bought) {
  const item = findItem(itemId);
  if (!item || item.bought === bought) return;
  const uid = requireUser().uid;
  const batch = newBatch();
  if (bought) {
    const purchaseRef = doc(collection(householdRef(), "purchases"));
    const buyer = { boughtAt: serverTimestamp(), boughtBy: uid, boughtByName: userName() };
    batch.set(
      purchaseRef,
      purchaseRecord({ item, ...buyer, expireAt: Timestamp.fromMillis(Date.now() + PURCHASE_RETENTION_MS) }),
    );
    batch.update(itemRef(item.id), boughtItemChanges({ ...buyer, purchaseId: purchaseRef.id }));
  } else if (item.purchaseId && canUndoPurchase(item, uid, Date.now())) {
    batch.delete(doc(householdRef(), "purchases", item.purchaseId));
    batch.update(itemRef(item.id), NOT_BOUGHT);
  } else {
    batch.update(itemRef(item.id), readdedItemChanges({ quantity: item.quantity, ...addedBy() }));
  }
  await batch.commit();
}

export async function updateItem(itemId, changes) {
  await updateDoc(itemRef(itemId), changes);
}

export async function removeItems(itemIds) {
  const householdId = requireHouseholdId();
  const removal = {
    commit() {
      clearTimeout(timer);
      pendingRemovals.delete(removal);
      commitDeletes(itemIds.map((id) => itemRef(id, householdId))).catch((error) => {
        showItems(itemIds);
        reportError(error);
      });
    },
    undo() {
      clearTimeout(timer);
      pendingRemovals.delete(removal);
      showItems(itemIds);
    },
  };
  hideItems(itemIds);
  const timer = setTimeout(removal.commit, UNDO_DELAY_MS);
  pendingRemovals.add(removal);
  return removal.undo;
}

export function flushPendingRemovals() {
  const hadRemovals = pendingRemovals.size > 0;
  [...pendingRemovals].forEach((removal) => removal.commit());
  return hadRemovals;
}
