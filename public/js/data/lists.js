import { collection, doc, serverTimestamp, setDoc, updateDoc } from "../sdk.js";
import { UserFacingError } from "../errors.js";
import { MAX_LISTS_PER_HOUSEHOLD } from "../logic.js";
import { listRecord } from "../records.js";
import { requireUser, state } from "../store.js";
import { commitDeletes, householdRef, itemRef } from "./firestore.js";
import { selectList } from "./watch.js";

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

export async function deleteList(listId) {
  const items = state.items.filter((item) => item.listId === listId);
  await commitDeletes([...items.map((item) => itemRef(item.id)), doc(householdRef(), "lists", listId)]);
}
