import { moveItem, setBought } from "../data/items.js";
import { byId, element, iconButton, syncChildren } from "../dom.js";
import { formatDaysAgo, formatFull, formatWhen, millis } from "../format.js";
import { compareItems, groupByName, groupBySection, normalize } from "../logic.js";
import { sectionLabel } from "../sections.js";
import { dragHandle } from "../sortable.js";
import { findItem, listItems, personName, state } from "../store.js";
import { showError } from "../toast.js";
import { openEditor } from "./editor.js";

function describeItem(item, purchases) {
  if (item.bought) {
    return `Bought ${formatWhen(item.boughtAt)} by ${personName(item.boughtBy, item.boughtByName)}`;
  }
  const [lastPurchase] = purchases;
  return [
    `Added by ${personName(item.addedBy, item.addedByName)}`,
    lastPurchase && `last bought ${formatDaysAgo(lastPurchase.boughtAt)}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

function itemEntry(item, purchases, showPending) {
  const shownDate = item.bought ? item.boughtAt : item.createdAt;
  const model = {
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    note: item.note ?? "",
    bought: item.bought,
    meta: describeItem(item, purchases),
    title: shownDate ? formatFull(shownDate) : "",
    pending: showPending && item.pending,
    sortable: !item.bought,
  };
  return { key: model.id, signature: JSON.stringify(model), build: () => buildItemRow(model) };
}

function buildItemRow(model) {
  const row = element("li", "item");
  const label = element("label", "item-main");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = model.bought;
  checkbox.addEventListener("change", () => {
    setBought(model.id, checkbox.checked).catch((error) => {
      checkbox.checked = model.bought;
      showError(error);
    });
  });

  const name = element("span", "item-name", model.name);
  if (model.quantity) name.append(element("span", "item-quantity", model.quantity));
  const meta = element("span", "item-meta", model.meta);
  meta.title = model.title;
  if (model.pending) meta.prepend(element("span", "pending-badge", "not synced"));
  const text = element("span", "item-text");
  text.append(name);
  if (model.note) text.append(element("span", "item-note", model.note));
  text.append(meta);
  label.append(checkbox, text);

  row.append(label, iconButton("✎", `Edit ${model.name}`, () => openEditor(model.id)));
  if (model.sortable) row.append(dragHandle(model.name, dropItem));
  return row;
}

// Dropping an item into another section's group also moves it to that section.
function dropItem({ key, container, keys }) {
  const section = container.dataset.section;
  if (!section) return;
  const index = keys.indexOf(key);
  const neighbour = (offset) => {
    const id = keys[index + offset];
    return id ? findItem(id) : null;
  };
  moveItem(key, section, neighbour(-1), neighbour(1)).catch((error) => showError(error));
}

function groupEntry(key, showHeadings) {
  return {
    key,
    signature: JSON.stringify([key, showHeadings]),
    build() {
      const section = element("section", "group");
      if (showHeadings) section.append(element("h3", "group-title", sectionLabel(key)));
      const list = element("ul", "items");
      list.dataset.sortGroup = "items";
      list.dataset.section = key;
      section.append(list);
      return section;
    },
  };
}

export function renderItems(household, showPending) {
  const items = listItems();
  const purchaseGroups = groupByName(state.purchases);
  const entry = (item) => itemEntry(item, purchaseGroups.get(normalize(item.name)) ?? [], showPending);
  const toBuy = items
    .filter((item) => !item.bought)
    .sort(compareItems);
  const bought = items
    .filter((item) => item.bought)
    .sort((a, b) => millis(b.boughtAt) - millis(a.boughtAt));

  const groups = groupBySection(toBuy, household.sectionOrder);
  const showHeadings = groups.length > 1;
  const groupsContainer = byId("to-buy-groups");
  syncChildren(groupsContainer, groups.map((group) => groupEntry(group.key, showHeadings)));
  groups.forEach((group, index) => {
    const list = groupsContainer.children[index]?.querySelector("ul");
    if (list) syncChildren(list, group.items.map(entry));
  });

  syncChildren(byId("bought-list"), bought.map(entry));
  byId("to-buy-count").textContent = toBuy.length ? String(toBuy.length) : "";
  byId("bought-count").textContent = bought.length ? String(bought.length) : "";
  byId("to-buy-empty").hidden = toBuy.length > 0;
  byId("share-list").hidden = toBuy.length === 0;
  byId("bought-section").hidden = bought.length === 0;
}
