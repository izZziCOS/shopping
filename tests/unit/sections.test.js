import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { DEFAULT_SECTION, SECTIONS, guessSection, isKnownSection, orderedSections, sectionLabel } from "../../public/js/sections.js";

describe("guessSection", () => {
  const cases = [
    ["Milk", "dairy"],
    ["Oat milk", "dairy"],
    ["Ice cream", "frozen"],
    ["Rice", "pantry"],
    ["Orange juice", "drinks"],
    ["Oranges", "produce"],
    ["Pineapple", "produce"],
    ["Peanut butter", "pantry"],
    ["Tin foil", "household"],
    ["Dish soap", "household"],
    ["Eggplant", "produce"],
    ["Strawberries", "produce"],
    ["Frozen peas", "frozen"],
    ["Toilet paper", "household"],
    ["Steak", "meat"],
    ["Juice", "drinks"],
  ];

  for (const [name, section] of cases) {
    test(`${name} → ${section}`, () => {
      assert.equal(guessSection(name), section);
    });
  }

  test("only matches at the start of a word", () => {
    assert.equal(guessSection("Candles"), DEFAULT_SECTION);
    assert.equal(guessSection("Foil"), "household");
  });

  test("falls back to other for unknown words", () => {
    assert.equal(guessSection("Sūris"), DEFAULT_SECTION);
  });
});

describe("orderedSections", () => {
  const allKeys = SECTIONS.map((section) => section.key);

  test("uses the default order when nothing is saved", () => {
    assert.deepEqual(orderedSections(), allKeys);
  });

  test("puts saved sections first and appends the rest", () => {
    const order = orderedSections(["dairy", "produce"]);
    assert.deepEqual(order.slice(0, 2), ["dairy", "produce"]);
    assert.deepEqual([...order].sort(), [...allKeys].sort());
  });

  test("ignores unknown and repeated keys", () => {
    const order = orderedSections(["bogus", "dairy", "dairy"]);
    assert.equal(order[0], "dairy");
    assert.equal(order.length, allKeys.length);
  });
});

describe("section labels", () => {
  test("isKnownSection recognises every defined key", () => {
    assert.ok(allSectionsKnown());
    assert.equal(isKnownSection("nonsense"), false);
  });

  test("sectionLabel falls back to Other", () => {
    assert.equal(sectionLabel("dairy"), "Dairy & eggs");
    assert.equal(sectionLabel("nonsense"), "Other");
  });

  test("section keys fit the security rules", () => {
    for (const { key } of SECTIONS) assert.match(key, /^[a-z]{1,20}$/);
  });
});

function allSectionsKnown() {
  return SECTIONS.every((section) => isKnownSection(section.key));
}
