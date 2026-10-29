import { Timestamp, collection, doc, serverTimestamp, updateDoc } from "../sdk.js";
import { DAY_MS } from "../format.js";
import { NOT_BOUGHT, canUndoPurchase, knownSection, limitAdds, orderBetween, planAdd } from "../logic.js";
import { boughtItemChanges, itemRecord, purchaseRecord, readdedItemChanges } from "../records.js";
import { findItem, hideItems, listItems, requireHouseholdId, requireUser, showItems, state, userName } from "../store.js";
import { errorCode } from "../errors.js";
import { commitDeletes, householdRef, itemRef, newBatch } from "./firestore.js";
import { removeAfterUndoWindow } from "./removals.js";

const PURCHASE_RETENTION_MS = 365 * DAY_MS;

function addedBy() {
  return { addedBy: requireUser().uid, addedByName: userName(), createdAt: serverTimestamp() };
}

export async function addItems(entries) {
  const listId = state.listId;
  if (!listId) throw new Error("No list selected");
  const { accepted, dropped, reason } = limitAdds(entries, listItems().length);
  const batch = newBatch();
  const results = accepted.map(({ name, quantity }) => {
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

function putBack(item) {
  return updateDoc(itemRef(item.id), readdedItemChanges({ quantity: item.quantity, ...addedBy() }));
}

async function undoPurchase(item) {
  const batch = newBatch();
  batch.delete(doc(householdRef(), "purchases", item.purchaseId));
  batch.update(itemRef(item.id), NOT_BOUGHT);
  try {
    await batch.commit();
  } catch (error) {
    // This phone's clock can disagree with the server about the undo window. The rules have the final say: when
    // they refuse, the purchase stays in history and the item goes back on the list instead.
    if (errorCode(error) !== "permission-denied") throw error;
    await putBack(item);
  }
}

export async function setBought(itemId, bought) {
  const item = findItem(itemId);
  if (!item || item.bought === bought) return;
  const uid = requireUser().uid;
  if (!bought) {
    await (item.purchaseId && canUndoPurchase(item, uid, Date.now()) ? undoPurchase(item) : putBack(item));
    return;
  }
  const batch = newBatch();
  const purchaseRef = doc(collection(householdRef(), "purchases"));
  const buyer = { boughtAt: serverTimestamp(), boughtBy: uid, boughtByName: userName() };
  batch.set(
    purchaseRef,
    purchaseRecord({ item, ...buyer, expireAt: Timestamp.fromMillis(Date.now() + PURCHASE_RETENTION_MS) }),
  );
  batch.update(itemRef(item.id), boughtItemChanges({ ...buyer, purchaseId: purchaseRef.id }));
  await batch.commit();
}

export async function updateItem(itemId, changes) {
  await updateDoc(itemRef(itemId), changes);
}

export async function moveItem(itemId, section, before, after) {
  const order = orderBetween(before, after);
  await updateDoc(itemRef(itemId), order === null ? { section } : { section, order });
}

export async function removeItems(itemIds) {
  const householdId = requireHouseholdId();
  return removeAfterUndoWindow({
    hide: () => hideItems(itemIds),
    show: () => showItems(itemIds),
    remove: () => commitDeletes(itemIds.map((id) => itemRef(id, householdId))),
  });
}
