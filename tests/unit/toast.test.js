import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, mock, test } from "node:test";
import { Window } from "happy-dom";

const window = new Window();
Object.assign(globalThis, {
  document: window.document,
  HTMLElement: window.HTMLElement,
  HTMLButtonElement: window.HTMLButtonElement,
  HTMLInputElement: window.HTMLInputElement,
});

const { UNDO_DELAY_MS } = await import("../../public/js/logic.js");
const { hideToasts, toast } = await import("../../public/js/toast.js");

function shown() {
  return [...document.querySelectorAll(".toast-message")].map((node) => node.textContent);
}

function undoButton() {
  const button = document.querySelector(".toast-action");
  assert.ok(button instanceof window.HTMLButtonElement);
  return button;
}

describe("toast", () => {
  beforeEach(() => {
    mock.timers.enable({ apis: ["setTimeout"] });
    document.body.innerHTML = '<div id="toasts"></div>';
  });

  afterEach(() => {
    hideToasts();
    mock.timers.reset();
  });

  test("a new message replaces the previous one", () => {
    toast("Saved");
    toast("Copied");
    assert.deepEqual(shown(), ["Copied"]);
  });

  test("a message shown during the undo window doesn't take Undo away", () => {
    let undone = 0;
    toast("Removed Milk", { actionLabel: "Undo", onAction: () => (undone += 1) });
    toast("Copied");
    assert.deepEqual(shown(), ["Removed Milk", "Copied"]);
    undoButton().click();
    assert.equal(undone, 1);
    assert.deepEqual(shown(), ["Copied"]);
  });

  test("each Undo stays for the whole undo window", () => {
    toast("Removed Milk", { actionLabel: "Undo" });
    toast("Removed Bread", { actionLabel: "Undo" });
    assert.deepEqual(shown(), ["Removed Milk", "Removed Bread"]);
    mock.timers.tick(UNDO_DELAY_MS - 1);
    assert.equal(shown().length, 2);
    mock.timers.tick(1);
    assert.deepEqual(shown(), []);
  });
});
