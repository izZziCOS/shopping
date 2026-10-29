import { collection, doc, serverTimestamp, setDoc, updateDoc } from "../sdk.js";
import { UserFacingError } from "../errors.js";
import { MAX_LISTS_PER_HOUSEHOLD } from "../logic.js";
import { listRecord } from "../records.js";
import { hideList, requireHouseholdId, requireUser, showList, state } from "../store.js";
import { commitDeletes, householdRef, itemRef } from "./firestore.js";
import { removeAfterUndoWindow } from "./removals.js";
import { reselectList, selectList } from "./watch.js";

export async function createList(name) {
  if (state.lists.length >= MAX_LISTS_PER_HOUSEHOLD) throw new UserFacingError(`A household can have at most ${MAX_LISTS_PER_HOUSEHOLD} lists.`);
  const ref = doc(collection(householdRef(), "lists"));
  const saved = setDoc(ref, listRecord({ name, createdBy: requireUser().uid, createdAt: serverTimestamp() }));
  selectList(ref.id);
  await saved;
}

export async function renameList(listId, name) {
  await updateDoc(doc(householdRef(), "lists", listId), { name });
}

function itemIdsOn(listId) {
  return state.items.filter((item) => item.listId === listId).map((item) => item.id);
}

// The list disappears straight away and is deleted, with its items, once the undo window has passed. Items someone
// adds to it in the meantime are deleted too, as long as this household is still the one being watched.
export function deleteList(listId) {
  const householdId = requireHouseholdId();
  const itemIds = itemIdsOn(listId);
  return removeAfterUndoWindow({
    hide() {
      hideList(listId);
      if (state.listId === listId) reselectList();
    },
    show() {
      showList(listId);
      if (state.householdId === householdId) selectList(listId);
    },
    remove() {
      const ids = state.householdId === householdId ? [...new Set([...itemIds, ...itemIdsOn(listId)])] : itemIds;
      return commitDeletes([...ids.map((id) => itemRef(id, householdId)), doc(householdRef(householdId), "lists", listId)]);
    },
  });
}
