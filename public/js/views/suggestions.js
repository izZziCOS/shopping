import { byId, option, syncChildren, textButton } from "../dom.js";
import { frequentItems, normalize, uniqueByKey } from "../logic.js";
import { listItems, state, visibleItems } from "../store.js";
import { submitItems } from "./add-items.js";

const SUGGESTION_CHIP_COUNT = 8;

function renderChips() {
  const frequent = frequentItems(state.purchases.filter((purchase) => purchase.listId === state.listId));
  const onList = new Set(listItems().filter((item) => !item.bought).map((item) => normalize(item.name)));
  const chips = frequent.filter((entry) => !onList.has(entry.key)).slice(0, SUGGESTION_CHIP_COUNT);
  syncChildren(
    byId("suggestions"),
    chips.map((chip) => ({
      key: chip.key,
      signature: JSON.stringify([chip.name, chip.quantity]),
      build: () => textButton(chip.name, "chip", () => submitItems([chip.name], chip.quantity)),
    })),
  );
  byId("suggestions-section").hidden = chips.length === 0;
}

function renderAutocomplete() {
  const names = uniqueByKey([
    ...frequentItems(state.purchases).map((entry) => entry.name),
    ...visibleItems().map((item) => item.name),
  ]);
  syncChildren(
    byId("item-suggestions"),
    names.map((name) => ({ key: normalize(name), signature: name, build: () => option(name, name) })),
  );
}

export function renderSuggestions() {
  renderChips();
  renderAutocomplete();
}
