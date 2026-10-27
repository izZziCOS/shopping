import { selectList } from "../data/watch.js";
import { byId, element, syncChildren, textButton } from "../dom.js";
import { listItems, state } from "../store.js";

function tabId(listId) {
  return `tab-${listId}`;
}

function updateTabsOverflow() {
  const tabs = byId("list-tabs");
  const maxScroll = tabs.scrollWidth - tabs.clientWidth;
  tabs.classList.toggle("fade-start", tabs.scrollLeft > 1);
  tabs.classList.toggle("fade-end", tabs.scrollLeft < maxScroll - 1);
}

function chooseTab(listId, { focus = false } = {}) {
  selectList(listId);
  const tab = document.getElementById(tabId(listId));
  if (focus) tab?.focus();
  tab?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
}

function onTabKeydown(event) {
  const ids = state.lists.map((list) => list.id);
  const index = state.listId ? ids.indexOf(state.listId) : -1;
  if (index < 0) return;
  const targets = new Map([
    ["ArrowRight", (index + 1) % ids.length],
    ["ArrowLeft", (index - 1 + ids.length) % ids.length],
    ["Home", 0],
    ["End", ids.length - 1],
  ]);
  const target = targets.get(event.key);
  if (target === undefined) return;
  event.preventDefault();
  chooseTab(ids[target], { focus: true });
}

function tabEntry(list) {
  const remaining = listItems(list.id).filter((item) => !item.bought).length;
  return {
    key: list.id,
    signature: JSON.stringify([list.name, remaining]),
    build() {
      const tab = textButton(list.name, "tab", () => chooseTab(list.id));
      tab.id = tabId(list.id);
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-controls", "list-content");
      tab.setAttribute("aria-label", remaining ? `${list.name}, ${remaining} to buy` : list.name);
      tab.append(element("span", "count", remaining ? String(remaining) : ""));
      return tab;
    },
  };
}

export function renderTabs() {
  const tabs = byId("list-tabs");
  syncChildren(tabs, state.lists.map(tabEntry));
  const selectedId = state.listId ? tabId(state.listId) : "";
  for (const tab of tabs.children) {
    const selected = tab.id === selectedId;
    tab.setAttribute("aria-selected", String(selected));
    tab.setAttribute("tabindex", selected ? "0" : "-1");
  }
  if (selectedId) byId("list-content").setAttribute("aria-labelledby", selectedId);
  requestAnimationFrame(updateTabsOverflow);
}

export function bindTabs() {
  const tabs = byId("list-tabs");
  tabs.addEventListener("scroll", updateTabsOverflow, { passive: true });
  tabs.addEventListener("keydown", onTabKeydown);
  window.addEventListener("resize", updateTabsOverflow);
}
