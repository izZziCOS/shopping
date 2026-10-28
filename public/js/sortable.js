import { iconButton } from "./dom.js";
import { holdRenders } from "./store.js";

// Reordering by dragging a handle (mouse, touch or pen), or with the arrow keys while the handle has focus.
// Rows are the keyed children of every element with the same data-sort-group, so a row can move between those
// containers. The row is moved in the page while dragging, and onDrop is told where it ended up. The next render
// then finds the rows already in place. Renders wait until the drag ends, so changes made by other people while
// dragging can't move or rebuild the rows under the pointer.

const EDGE_PX = 56;
const SCROLL_STEP_PX = 10;

function containersOf(group) {
  return [...document.querySelectorAll(`[data-sort-group="${group}"]`)].filter(
    (container) => container instanceof HTMLElement && container.getClientRects().length > 0,
  );
}

function rowOf(handle) {
  const row = handle.closest("[data-key]");
  return row instanceof HTMLElement && row.parentElement?.dataset.sortGroup ? row : null;
}

function keysIn(container) {
  return [...container.children].flatMap((child) => (child instanceof HTMLElement && child.dataset.key ? [child.dataset.key] : []));
}

function report(row, onDrop) {
  const container = row.parentElement;
  const key = row.dataset.key;
  if (container && key) onDrop({ key, container, keys: keysIn(container) });
}

function distanceTo(rect, y) {
  if (y < rect.top) return rect.top - y;
  if (y > rect.bottom) return y - rect.bottom;
  return 0;
}

function placeRow(row, group, y) {
  const containers = containersOf(group);
  const target = containers.reduce(
    (best, container) => (distanceTo(container.getBoundingClientRect(), y) < distanceTo(best.getBoundingClientRect(), y) ? container : best),
    containers[0],
  );
  if (!target) return;
  const before = [...target.children].find((child) => {
    if (child === row) return false;
    const rect = child.getBoundingClientRect();
    return y < rect.top + rect.height / 2;
  }) ?? null;
  if (row.parentElement !== target || row.nextElementSibling !== before) target.insertBefore(row, before);
}

function startDrag(event, handle, onDrop) {
  if (event.button !== 0) return;
  const row = rowOf(handle);
  const from = row?.parentElement;
  const group = from?.dataset.sortGroup;
  if (!row || !from || !group) return;
  event.preventDefault();
  // Touch pointers are captured by the handle. Releasing them lets the events reach the window even after the
  // handle has been moved within the page.
  if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
  const startNext = row.nextElementSibling;
  let lastY = event.clientY;
  const releaseRenders = holdRenders();
  row.classList.add("dragging");
  document.body.classList.add("sorting");

  const scroller = setInterval(() => {
    const step = lastY < EDGE_PX ? -SCROLL_STEP_PX : lastY > innerHeight - EDGE_PX ? SCROLL_STEP_PX : 0;
    if (step === 0) return;
    scrollBy(0, step);
    placeRow(row, group, lastY);
  }, 16);

  const onMove = (moveEvent) => {
    if (moveEvent.pointerId !== event.pointerId) return;
    lastY = moveEvent.clientY;
    placeRow(row, group, lastY);
  };

  const finish = (endEvent) => {
    if (endEvent.pointerId !== event.pointerId) return;
    clearInterval(scroller);
    removeEventListener("pointermove", onMove);
    removeEventListener("pointerup", finish);
    removeEventListener("pointercancel", finish);
    row.classList.remove("dragging");
    document.body.classList.remove("sorting");
    if (endEvent.type === "pointercancel") {
      from.insertBefore(row, startNext?.parentElement === from ? startNext : null);
    } else if (row.parentElement !== from || row.nextElementSibling !== startNext) {
      report(row, onDrop);
    }
    releaseRenders();
  };

  addEventListener("pointermove", onMove);
  addEventListener("pointerup", finish);
  addEventListener("pointercancel", finish);
}

function moveWithKeys(event, handle, onDrop) {
  const offset = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
  const row = rowOf(handle);
  const container = row?.parentElement;
  const group = container?.dataset.sortGroup;
  if (offset === 0 || !row || !container || !group) return;
  event.preventDefault();
  const containers = containersOf(group);
  const neighbour = containers[containers.indexOf(container) + offset];
  if (offset < 0) {
    const previous = row.previousElementSibling;
    if (previous) container.insertBefore(row, previous);
    else if (neighbour) neighbour.append(row);
    else return;
  } else {
    const next = row.nextElementSibling;
    if (next) container.insertBefore(row, next.nextElementSibling);
    else if (neighbour) neighbour.prepend(row);
    else return;
  }
  handle.focus();
  report(row, onDrop);
}

export function dragHandle(name, onDrop) {
  const handle = iconButton("⠿", `Move ${name}`, () => {});
  handle.classList.add("drag-handle");
  handle.title = "Drag to move, or use the arrow keys";
  handle.addEventListener("pointerdown", (event) => startDrag(event, handle, onDrop));
  handle.addEventListener("keydown", (event) => moveWithKeys(event, handle, onDrop));
  return handle;
}
