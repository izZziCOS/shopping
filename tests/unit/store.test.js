import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";

const frames = [];
globalThis.requestAnimationFrame = (callback) => frames.push(callback);

const {
  changed,
  currentList,
  hideList,
  holdRenders,
  purchasesByName,
  setListId,
  setLists,
  setPurchases,
  showList,
  subscribe,
  visibleLists,
} = await import("../../public/js/store.js");

let renders = 0;
subscribe(() => {
  renders += 1;
});

function runFrames() {
  while (frames.length > 0) frames.shift()();
}

describe("holdRenders", () => {
  beforeEach(() => {
    runFrames();
    renders = 0;
  });

  test("batches changes into one render per frame", () => {
    changed();
    changed();
    runFrames();
    assert.equal(renders, 1);
  });

  test("waits for every hold to be released, then renders once", () => {
    const releaseFirst = holdRenders();
    const releaseSecond = holdRenders();
    changed();
    runFrames();
    changed();
    runFrames();
    assert.equal(renders, 0);
    releaseFirst();
    releaseFirst();
    runFrames();
    assert.equal(renders, 0);
    releaseSecond();
    runFrames();
    assert.equal(renders, 1);
  });

  test("doesn't render on release when nothing changed", () => {
    holdRenders()();
    runFrames();
    assert.equal(renders, 0);
  });
});

describe("lists being deleted", () => {
  test("are hidden until shown again", () => {
    setLists([{ id: "groceries", name: "Groceries" }, { id: "pharmacy", name: "Pharmacy" }], true);
    setListId("pharmacy");
    hideList("pharmacy");
    assert.deepEqual(visibleLists().map((list) => list.id), ["groceries"]);
    assert.equal(currentList(), null);
    showList("pharmacy");
    assert.equal(visibleLists().length, 2);
    assert.equal(currentList()?.id, "pharmacy");
  });
});

describe("purchasesByName", () => {
  test("is only worked out again when the purchases change", () => {
    setPurchases([{ name: "Milk" }, { name: "milk" }]);
    const first = purchasesByName();
    assert.equal(purchasesByName(), first);
    assert.equal(first.get("milk")?.length, 2);
    setPurchases([{ name: "Bread" }]);
    assert.notEqual(purchasesByName(), first);
    assert.equal(purchasesByName().get("milk"), undefined);
  });
});
