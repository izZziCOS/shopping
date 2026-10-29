import { removeItems, updateItem } from "../data/items.js";
import { byId, dialogById, inputById, onClick, onSubmit, option, selectById, textAreaById } from "../dom.js";
import { formatWhen } from "../format.js";
import { normalize, sectionOf } from "../logic.js";
import { orderedSections, sectionLabel } from "../sections.js";
import { currentHousehold, findItem, personName, purchasesByName, setEditingItem, state, visibleLists } from "../store.js";
import { showError, toast } from "../toast.js";

export async function removeWithUndo(itemIds, message) {
  try {
    const undo = await removeItems(itemIds);
    toast(message, { actionLabel: "Undo", onAction: undo });
  } catch (error) {
    showError(error);
  }
}

function describeHistory(purchases) {
  if (purchases.length === 0) return "Not bought before.";
  const [last] = purchases;
  const times = purchases.length === 1 ? "once" : `${purchases.length} times`;
  return `Bought ${times}. Last bought ${formatWhen(last.boughtAt)} by ${personName(last.boughtBy, last.boughtByName)}.`;
}

export function openEditor(itemId) {
  const item = findItem(itemId);
  if (!item) return;
  setEditingItem(itemId);
  inputById("edit-name").value = item.name;
  inputById("edit-quantity").value = item.quantity;
  textAreaById("edit-note").value = item.note ?? "";
  const section = selectById("edit-section");
  section.replaceChildren(
    ...orderedSections(currentHousehold()?.sectionOrder).map((key) => option(key, sectionLabel(key))),
  );
  section.value = sectionOf(item);
  const list = selectById("edit-list");
  const lists = visibleLists();
  list.replaceChildren(...lists.map((entry) => option(entry.id, entry.name)));
  list.value = item.listId;
  byId("edit-list-label").hidden = lists.length < 2;
  byId("edit-stats").textContent = describeHistory(purchasesByName().get(normalize(item.name)) ?? []);
  dialogById("edit-dialog").showModal();
}

function saveEditor() {
  const item = findItem(state.editingItemId);
  const edited = {
    name: inputById("edit-name").value.trim(),
    quantity: inputById("edit-quantity").value.trim(),
    note: textAreaById("edit-note").value.trim(),
    section: selectById("edit-section").value,
    listId: selectById("edit-list").value,
  };
  if (!edited.name) return;
  dialogById("edit-dialog").close();
  if (!item) {
    toast("This item has been removed");
    return;
  }
  const changes = Object.fromEntries(Object.entries(edited).filter(([key, value]) => value !== (item[key] ?? "")));
  if (Object.keys(changes).length > 0) {
    updateItem(item.id, changes).catch((error) => showError(error));
  }
}

export function bindEditor() {
  onSubmit("edit-form", saveEditor);
  onClick("edit-cancel", () => dialogById("edit-dialog").close());
  onClick("edit-remove", () => {
    const item = findItem(state.editingItemId);
    dialogById("edit-dialog").close();
    if (item) return removeWithUndo([item.id], `Removed ${item.name}`);
  });
  dialogById("edit-dialog").addEventListener("close", () => setEditingItem(null));
}
