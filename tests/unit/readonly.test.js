import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ReadOnlyStateError, readOnly } from "../../public/js/readonly.js";

class Stamp {
  #millis;

  constructor(millis) {
    this.#millis = millis;
  }

  toMillis() {
    return this.#millis;
  }
}

function sample() {
  return {
    panel: null,
    items: [{ id: "a", name: "Milk", tags: ["dairy"] }],
    hidden: new Set(["x"]),
    names: new Map([["a", "Alice"]]),
    stamp: new Stamp(42),
    frozen: Object.freeze({ value: { nested: true } }),
  };
}

describe("readOnly", () => {
  test("reads work as usual", () => {
    const state = readOnly(sample());
    assert.equal(state.items[0].name, "Milk");
    assert.equal(state.items.find((item) => item.id === "a")?.tags[0], "dairy");
    assert.equal(state.items.map((item) => item.name).join(), "Milk");
    assert.equal(state.hidden.has("x"), true);
    assert.equal(state.names.get("a"), "Alice");
    assert.equal(state.stamp.toMillis(), 42);
    assert.equal(state.frozen.value.nested, true);
    assert.equal(JSON.stringify(state.items), '[{"id":"a","name":"Milk","tags":["dairy"]}]');
  });

  test("returns the same view each time", () => {
    const state = readOnly(sample());
    assert.equal(state.items, state.items);
    assert.equal(state.items[0], state.items[0]);
  });

  test("refuses assignment and deletion at any depth", () => {
    const state = readOnly(sample());
    assert.throws(() => {
      state.panel = "history";
    }, ReadOnlyStateError);
    assert.throws(() => {
      state.items[0].name = "Eggs";
    }, ReadOnlyStateError);
    assert.throws(() => {
      delete state.items[0].tags;
    }, ReadOnlyStateError);
  });

  test("refuses changes made through another name for the same thing", () => {
    const state = readOnly(sample());
    const items = state.items;
    assert.throws(() => items.push({ id: "b" }), ReadOnlyStateError);
    assert.throws(() => items.sort(), ReadOnlyStateError);
    const tags = state.items[0].tags;
    assert.throws(() => tags.splice(0, 1), ReadOnlyStateError);
  });

  test("refuses changing sets and maps", () => {
    const state = readOnly(sample());
    assert.throws(() => state.hidden.add("y"), ReadOnlyStateError);
    assert.throws(() => state.hidden.clear(), ReadOnlyStateError);
    assert.throws(() => state.names.set("b", "Bob"), ReadOnlyStateError);
  });

  test("copies are ordinary, changeable values", () => {
    const state = readOnly(sample());
    const copy = [...state.items].sort((a, b) => a.name.localeCompare(b.name));
    copy.push({ id: "b", name: "Eggs", tags: [] });
    assert.equal(copy.length, 2);
    assert.equal(state.items.length, 1);
  });

  test("leaves the original object changeable", () => {
    const original = sample();
    const state = readOnly(original);
    original.panel = "history";
    original.items = [];
    assert.equal(state.panel, "history");
    assert.equal(state.items.length, 0);
  });
});
