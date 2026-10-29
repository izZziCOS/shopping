import { DEFAULT_LIST_NAME } from "../data/firestore.js";
import { createList, deleteList, renameList } from "../data/lists.js";
import { askForText, askToConfirm } from "../dialogs.js";
import { byId, dialogById, inputById, onClick, onSubmit } from "../dom.js";
import { currentList, listItems, visibleLists } from "../store.js";
import { showError, toast } from "../toast.js";

function openListSettings() {
  const list = currentList();
  if (!list) return;
  inputById("list-name").value = list.name;
  byId("delete-list").hidden = visibleLists().length < 2;
  dialogById("list-dialog").showModal();
}

async function confirmDeleteList() {
  const list = currentList();
  if (!list) return;
  const count = listItems(list.id).length;
  const itemNote = count > 0 ? `Its ${count} ${count === 1 ? "item" : "items"} will be deleted too. ` : "";
  const confirmed = await askToConfirm({
    title: `Delete "${list.name}"?`,
    message: `${itemNote}Purchase history is kept.`,
    confirmLabel: "Delete list",
    danger: true,
  });
  if (!confirmed) return;
  dialogById("list-dialog").close();
  toast(`Deleted ${list.name}`, { actionLabel: "Undo", onAction: deleteList(list.id) });
}

async function promptNewList() {
  const name = await askForText({
    title: "New list",
    value: visibleLists().length === 0 ? DEFAULT_LIST_NAME : "",
    placeholder: "e.g. Pharmacy",
    submitLabel: "Create",
    maxLength: 40,
  });
  if (name) createList(name).catch((error) => showError(error));
}

export function bindListSettings() {
  onClick("new-list", promptNewList);
  onClick("create-first-list", promptNewList);
  onClick("list-settings", openListSettings);
  onClick("list-cancel", () => dialogById("list-dialog").close());
  onClick("delete-list", confirmDeleteList);
  onSubmit("list-form", () => {
    const list = currentList();
    const name = inputById("list-name").value.trim();
    if (!name) return;
    dialogById("list-dialog").close();
    if (list && name !== list.name) renameList(list.id, name).catch((error) => showError(error));
  });
}
