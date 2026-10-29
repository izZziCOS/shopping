import { byId, element, option, syncChildren, textButton } from "../dom.js";
import { formatDaysAgo } from "../format.js";
import { describeInterval, normalize, uniqueByKey } from "../logic.js";
import { frequentlyBought, listItems, suggestionsForList, visibleItems } from "../store.js";
import { submitItems } from "./add-items.js";

const SUGGESTION_CHIP_COUNT = 8;

let shownStaples = [];

function stapleChip(staple) {
  const usually = describeInterval(staple.intervalDays);
  return {
    key: staple.key,
    signature: JSON.stringify([staple.name, staple.quantity, usually]),
    build() {
      const chip = textButton(staple.name, "chip staple", () => submitItems([staple]));
      chip.append(element("span", "chip-meta", usually));
      chip.title = `Usually bought ${usually}. Last bought ${formatDaysAgo(staple.lastBoughtAt)}.`;
      return chip;
    },
  };
}

function frequentChip(entry) {
  return {
    key: entry.key,
    signature: JSON.stringify([entry.name, entry.quantity]),
    build: () => textButton(entry.name, "chip", () => submitItems([entry])),
  };
}

function renderChips() {
  const suggestions = suggestionsForList();
  const onList = new Set(listItems().filter((item) => !item.bought).map((item) => normalize(item.name)));
  shownStaples = suggestions.staples.filter((staple) => !onList.has(staple.key));
  const staples = new Set(shownStaples.map((staple) => staple.key));
  const frequent = suggestions.frequent
    .filter((entry) => !onList.has(entry.key) && !staples.has(entry.key))
    .slice(0, SUGGESTION_CHIP_COUNT);

  syncChildren(byId("staples"), shownStaples.map(stapleChip));
  byId("staples-section").hidden = shownStaples.length === 0;
  byId("add-staples").hidden = shownStaples.length < 2;
  byId("add-staples").textContent = `Add all ${shownStaples.length}`;
  syncChildren(byId("suggestions"), frequent.map(frequentChip));
  byId("suggestions-section").hidden = frequent.length === 0;
}

function renderAutocomplete() {
  const names = uniqueByKey([
    ...frequentlyBought().map((entry) => entry.name),
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

export function addDueStaples() {
  return submitItems(shownStaples);
}
