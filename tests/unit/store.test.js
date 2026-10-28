import assert from "node:assert/strict";
import { beforeEach, describe, test } from "node:test";

const frames = [];
globalThis.requestAnimationFrame = (callback) => frames.push(callback);

const { changed, holdRenders, subscribe } = await import("../../public/js/store.js");

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
