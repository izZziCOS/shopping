import { byId, inputById, onClick, onSubmit } from "../dom.js";
import { formatList } from "../format.js";
import { memberEntries, splitItemNames, syncStatus } from "../logic.js";
import { currentList, listItems, openPanel, state } from "../store.js";
import { submitItems } from "./add-items.js";
import { removeWithUndo } from "./editor.js";
import { shareInvite } from "./invites.js";
import { renderItems } from "./item-rows.js";
import { bindListSettings } from "./list-settings.js";
import { shareCurrentList } from "./share.js";
import { addDueStaples, renderSuggestions } from "./suggestions.js";
import { bindTabs, renderTabs } from "./tabs.js";

function renderSyncStatus(status) {
  const node = byId("sync-status");
  const changes = `${status.count} ${status.count === 1 ? "change" : "changes"}`;
  node.classList.toggle("offline", status.offline);
  if (status.offline) {
    node.textContent = status.count > 0
      ? `You're offline. ${changes} saved on this device will sync when you're back online.`
      : "You're offline. Changes you make will sync when you're back online.";
  } else if (status.slow) {
    node.textContent = `Syncing ${changes}…`;
  }
  node.hidden = !status.visible;
}

export function renderList(household) {
  byId("household-name").textContent = household.name;
  byId("household-meta").textContent = formatList(memberEntries(household).map((member) => member.name));
  renderTabs();
  const status = syncStatus(state, Date.now());
  renderSyncStatus(status);
  const hasList = Boolean(currentList());
  byId("list-content").hidden = !hasList;
  byId("list-settings").hidden = !hasList;
  byId("no-lists").hidden = hasList || !state.listsLoaded;
  if (!hasList) return;
  renderItems(household, status.visible);
  renderSuggestions();
}

function clearBought() {
  const bought = listItems().filter((item) => item.bought);
  if (bought.length === 0) return;
  return removeWithUndo(
    bought.map((item) => item.id),
    `Cleared ${bought.length} bought ${bought.length === 1 ? "item" : "items"}`,
  );
}

export function bindList() {
  bindTabs();
  bindListSettings();
  onClick("invite-button", shareInvite);
  onClick("share-list", shareCurrentList);
  onClick("switch-button", () => openPanel("households"));
  onClick("history-button", () => {
    openPanel("history");
    scrollTo(0, 0);
  });
  onClick("clear-bought", clearBought);
  onClick("add-staples", addDueStaples);
  onSubmit("add-form", async (form) => {
    const names = splitItemNames(inputById("item-name").value);
    if (names.length === 0) return;
    const quantity = inputById("item-quantity").value.trim();
    form.reset();
    inputById("item-name").focus();
    // One quantity can't belong to several items, so it's only used when adding one.
    await submitItems(names.map((name) => ({ name, quantity: names.length === 1 ? quantity : "" })));
  });
}
