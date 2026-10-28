import { HISTORY_LIMIT } from "../data/watch.js";
import { byId, element, onClick, syncChildren } from "../dom.js";
import { formatDay, formatFull, formatTime } from "../format.js";
import { closePanel, personName, state } from "../store.js";

function listLabel(purchase) {
  if (!state.listsLoaded) return null;
  const list = state.lists.find((entry) => entry.id === purchase.listId);
  if (!list) return "deleted list";
  return state.lists.length > 1 ? list.name : null;
}

function purchaseModel(purchase) {
  const listName = listLabel(purchase);
  return {
    name: purchase.name,
    quantity: purchase.quantity,
    meta: [formatTime(purchase.boughtAt), personName(purchase.boughtBy, purchase.boughtByName), listName]
      .filter(Boolean)
      .join(" · "),
    title: formatFull(purchase.boughtAt),
  };
}

function buildPurchaseRow(model) {
  const row = element("li", "item history-row");
  const text = element("span", "item-text");
  const name = element("span", "item-name", model.name);
  if (model.quantity) name.append(element("span", "item-quantity", model.quantity));
  const meta = element("span", "item-meta", model.meta);
  meta.title = model.title;
  text.append(name, meta);
  row.append(text);
  return row;
}

export function renderHistory() {
  const groups = new Map();
  for (const purchase of state.purchases) {
    const label = formatDay(purchase.boughtAt);
    groups.set(label, [...(groups.get(label) ?? []), purchaseModel(purchase)]);
  }
  syncChildren(
    byId("history-groups"),
    [...groups].map(([label, models]) => ({
      key: label,
      signature: JSON.stringify(models),
      build() {
        const group = element("section", "history-group");
        const list = element("ul", "items");
        list.append(...models.map(buildPurchaseRow));
        group.append(element("h2", "section-title", label), list);
        return group;
      },
    })),
  );
  byId("history-empty").hidden = state.purchases.length > 0;
  byId("history-limit").hidden = state.purchases.length < HISTORY_LIMIT;
}

export function bindHistory() {
  onClick("history-back", closePanel);
}
