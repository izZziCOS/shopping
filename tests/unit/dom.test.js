import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";
import { Window } from "happy-dom";

const window = new Window();
Object.assign(globalThis, {
  document: window.document,
  HTMLElement: window.HTMLElement,
  HTMLButtonElement: window.HTMLButtonElement,
  HTMLInputElement: window.HTMLInputElement,
});

const { runBusy, syncChildren } = await import("../../public/js/dom.js");

let container;
let builds;

function entry(key, signature = key) {
  return {
    key,
    signature,
    build() {
      builds.push(key);
      const node = document.createElement("li");
      node.textContent = signature;
      return node;
    },
  };
}

function keysOf(node) {
  return [...node.children].map((child) => child.dataset.key);
}

beforeEach(() => {
  container = document.createElement("ul");
  builds = [];
});

describe("syncChildren", () => {
  test("builds every entry in order", () => {
    syncChildren(container, [entry("a"), entry("b"), entry("c")]);
    assert.deepEqual(keysOf(container), ["a", "b", "c"]);
    assert.deepEqual(builds, ["a", "b", "c"]);
  });

  test("reuses rows whose signature is unchanged", () => {
    syncChildren(container, [entry("a"), entry("b")]);
    const [first, second] = container.children;
    builds = [];
    syncChildren(container, [entry("a"), entry("b")]);
    assert.equal(container.children[0], first);
    assert.equal(container.children[1], second);
    assert.deepEqual(builds, []);
  });

  test("rebuilds only rows whose signature changed", () => {
    syncChildren(container, [entry("a", "Milk"), entry("b", "Eggs")]);
    const [first] = container.children;
    builds = [];
    syncChildren(container, [entry("a", "Milk"), entry("b", "Eggs (12)")]);
    assert.equal(container.children[0], first);
    assert.equal(container.children[1].textContent, "Eggs (12)");
    assert.deepEqual(builds, ["b"]);
  });

  test("moves rows without rebuilding them", () => {
    syncChildren(container, [entry("a"), entry("b"), entry("c")]);
    const nodes = Object.fromEntries([...container.children].map((child) => [child.dataset.key, child]));
    builds = [];
    syncChildren(container, [entry("c"), entry("a"), entry("b")]);
    assert.deepEqual(keysOf(container), ["c", "a", "b"]);
    assert.equal(container.children[0], nodes.c);
    assert.deepEqual(builds, []);
  });

  test("removes rows that are no longer listed", () => {
    syncChildren(container, [entry("a"), entry("b"), entry("c")]);
    syncChildren(container, [entry("b")]);
    assert.deepEqual(keysOf(container), ["b"]);
    syncChildren(container, []);
    assert.equal(container.children.length, 0);
  });

  test("handles additions, removals, changes and moves together", () => {
    syncChildren(container, [entry("a"), entry("b"), entry("c"), entry("d")]);
    const b = container.children[1];
    builds = [];
    syncChildren(container, [entry("e"), entry("b"), entry("d", "changed"), entry("a")]);
    assert.deepEqual(keysOf(container), ["e", "b", "d", "a"]);
    assert.equal(container.children[1], b);
    assert.deepEqual(builds.sort(), ["d", "e"]);
  });
});

describe("runBusy", () => {
  test("disables buttons while the task runs and re-enables them afterwards", async () => {
    const button = document.createElement("button");
    let release;
    const task = runBusy([button], () => new Promise((resolve) => (release = resolve)));
    assert.equal(button.disabled, true);
    assert.equal(button.getAttribute("aria-busy"), "true");
    release();
    await task;
    assert.equal(button.disabled, false);
    assert.equal(button.hasAttribute("aria-busy"), false);
  });

  test("ignores a second press while busy", async () => {
    const button = document.createElement("button");
    let runs = 0;
    let release;
    const first = runBusy([button], () => {
      runs += 1;
      return new Promise((resolve) => (release = resolve));
    });
    await runBusy([button], () => {
      runs += 1;
    });
    release();
    await first;
    assert.equal(runs, 1);
  });

  test("re-enables buttons when the task fails", async () => {
    const button = document.createElement("button");
    await assert.rejects(
      runBusy([button], async () => {
        throw new Error("boom");
      }),
    );
    assert.equal(button.disabled, false);
  });
});
