import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  MAX_ITEMS_PER_ADD,
  MAX_ITEMS_PER_LIST,
  PURCHASE_UNDO_WINDOW_MS,
  SLOW_SYNC_MS,
  activeInvites,
  canUndoPurchase,
  extractJoinParam,
  frequentItems,
  groupByName,
  groupBySection,
  knownSection,
  limitAdds,
  limitMessage,
  listAsText,
  memberEntries,
  moveEntry,
  nextOwner,
  normalize,
  parseInvite,
  planAdd,
  randomCode,
  reusableInvite,
  sectionOf,
  splitItemNames,
  summarizeAdds,
  syncStatus,
  uniqueByKey,
} from "../../public/js/logic.js";
import { NOW, daysBefore, hoursBefore, timestamp } from "./helpers.js";

const HOUSEHOLD_ID = "AbCdEfGhIjKlMnOpQrSt";
const CODE = "invitecode1234567890";

describe("normalize and uniqueByKey", () => {
  test("normalize ignores case and surrounding spaces", () => {
    assert.equal(normalize("  Oat MILK "), "oat milk");
  });

  test("uniqueByKey keeps the first spelling of each name", () => {
    assert.deepEqual(uniqueByKey(["Milk", "milk", "Eggs", " MILK "]), ["Milk", "Eggs"]);
  });
});

describe("splitItemNames", () => {
  test("splits on commas, semicolons and new lines", () => {
    assert.deepEqual(splitItemNames("milk, eggs; bread\ncheese"), ["milk", "eggs", "bread", "cheese"]);
  });

  test("drops empty entries, duplicates and extra spaces", () => {
    assert.deepEqual(splitItemNames(" milk ,, Milk ,  olive   oil , "), ["milk", "olive oil"]);
  });

  test("keeps a single item as it is", () => {
    assert.deepEqual(splitItemNames("Sourdough bread"), ["Sourdough bread"]);
  });
});

describe("planAdd", () => {
  const onList = { id: "a", name: "Milk", quantity: "1 L", bought: false };
  const bought = { id: "b", name: "Bread", quantity: "", bought: true };

  test("creates an item that isn't on the list", () => {
    assert.deepEqual(planAdd([onList, bought], "Eggs", ""), { action: "create", item: null });
  });

  test("reports an item that is already on the list", () => {
    assert.deepEqual(planAdd([onList], "milk", ""), { action: "exists", item: onList });
    assert.deepEqual(planAdd([onList], "milk", "1 L"), { action: "exists", item: onList });
  });

  test("updates the quantity when a new one is given", () => {
    assert.deepEqual(planAdd([onList], "Milk", "2 L"), { action: "update-quantity", item: onList });
  });

  test("moves a bought item back onto the list", () => {
    assert.deepEqual(planAdd([bought], "bread", ""), { action: "readd", item: bought });
  });

  test("prefers the copy that is still on the list", () => {
    const boughtMilk = { ...onList, id: "c", bought: true };
    assert.equal(planAdd([boughtMilk, onList], "Milk", "").item, onList);
  });
});

describe("canUndoPurchase", () => {
  const now = NOW.getTime();
  const item = { purchaseId: "purchase1", boughtBy: "alice", boughtAt: timestamp(now - 60_000) };

  test("allows the buyer to undo shortly after ticking", () => {
    assert.equal(canUndoPurchase(item, "alice", now), true);
  });

  test("does not let someone else undo the purchase", () => {
    assert.equal(canUndoPurchase(item, "bob", now), false);
  });

  test("stops allowing undo after the window", () => {
    const old = { ...item, boughtAt: timestamp(now - PURCHASE_UNDO_WINDOW_MS - 1) };
    assert.equal(canUndoPurchase(old, "alice", now), false);
  });

  test("needs a purchase record", () => {
    assert.equal(canUndoPurchase({ ...item, purchaseId: null }, "alice", now), false);
  });
});

describe("invites", () => {
  test("parses a bare invite code", () => {
    assert.deepEqual(parseInvite(` ${HOUSEHOLD_ID}-${CODE} `), { householdId: HOUSEHOLD_ID, code: CODE });
  });

  test("parses a full invite link", () => {
    const link = `https://example.github.io/shopping/?join=${HOUSEHOLD_ID}-${CODE}`;
    assert.deepEqual(parseInvite(link), { householdId: HOUSEHOLD_ID, code: CODE });
  });

  test("rejects malformed invites", () => {
    for (const input of ["", "nonsense", `${HOUSEHOLD_ID}`, `${HOUSEHOLD_ID}-${CODE}-extra`, `${HOUSEHOLD_ID}-bad/code`, "https://example.com/"]) {
      assert.equal(parseInvite(input), null, input);
    }
  });

  test("extractJoinParam returns plain text unchanged", () => {
    assert.equal(extractJoinParam("abc-def"), "abc-def");
  });

  test("randomCode makes 20 letters and digits", () => {
    assert.match(randomCode(), /^[A-Za-z0-9]{20}$/);
    assert.equal(randomCode(new Uint8Array([0, 1, 61, 62])), "AB9A");
  });

  test("activeInvites hides expired ones and puts the longest-lasting first", () => {
    const now = NOW.getTime();
    const expired = { id: "old", expiresAt: timestamp(now - 1) };
    const soon = { id: "soon", expiresAt: timestamp(now + 60_000) };
    const later = { id: "later", expiresAt: timestamp(now + 3_600_000) };
    assert.deepEqual(activeInvites([soon, expired, later], now).map((invite) => invite.id), ["later", "soon"]);
  });

  test("reusableInvite only reuses an invite with enough time left", () => {
    const now = NOW.getTime();
    const soon = { id: "soon", expiresAt: timestamp(now + 60_000) };
    assert.equal(reusableInvite([soon], now, 3_600_000), null);
    assert.equal(reusableInvite([soon], now, 1_000), soon);
  });
});

describe("purchase history helpers", () => {
  const purchases = [
    { name: "Milk", quantity: "2 L" },
    { name: "eggs", quantity: "" },
    { name: "milk", quantity: "1 L" },
    { name: "Bread", quantity: "" },
    { name: "Eggs", quantity: "12" },
    { name: "MILK", quantity: "" },
  ];

  test("groupByName groups different spellings together", () => {
    const groups = groupByName(purchases);
    assert.equal(groups.get("milk").length, 3);
    assert.equal(groups.get("eggs").length, 2);
  });

  test("frequentItems sorts by count and uses the latest spelling", () => {
    const frequent = frequentItems(purchases);
    assert.deepEqual(frequent.map((entry) => [entry.name, entry.count]), [["Milk", 3], ["eggs", 2], ["Bread", 1]]);
    assert.equal(frequent[0].quantity, "2 L");
  });
});

describe("sections", () => {
  test("sectionOf falls back to other for unknown sections", () => {
    assert.equal(sectionOf({ section: "dairy" }), "dairy");
    assert.equal(sectionOf({ section: "nonsense" }), "other");
    assert.equal(sectionOf({}), "other");
  });

  test("knownSection prefers what the household already uses", () => {
    const items = [{ name: "Sūris", section: "dairy" }];
    const purchases = [{ name: "Duona", section: "bakery" }];
    assert.equal(knownSection("sūris", items, purchases), "dairy");
    assert.equal(knownSection("DUONA", items, purchases), "bakery");
    assert.equal(knownSection("Bananas", items, purchases), "produce");
  });
});

describe("moveEntry", () => {
  test("swaps neighbours", () => {
    assert.deepEqual(moveEntry(["a", "b", "c"], 1, -1), ["b", "a", "c"]);
    assert.deepEqual(moveEntry(["a", "b", "c"], 1, 1), ["a", "c", "b"]);
  });

  test("refuses to move past either end", () => {
    assert.equal(moveEntry(["a", "b"], 0, -1), null);
    assert.equal(moveEntry(["a", "b"], 1, 1), null);
  });
});

describe("members", () => {
  const household = {
    ownerId: "alice",
    memberInfo: {
      carol: { name: "Carol", joinedAt: daysBefore(1) },
      alice: { name: "Alice", joinedAt: daysBefore(30) },
      bob: { name: "Bob", joinedAt: daysBefore(10) },
    },
  };

  test("memberEntries lists members in the order they joined", () => {
    assert.deepEqual(memberEntries(household).map((member) => member.uid), ["alice", "bob", "carol"]);
  });

  test("nextOwner picks the longest-standing other member", () => {
    assert.equal(nextOwner(household, "alice").uid, "bob");
  });

  test("nextOwner is null when someone other than the owner leaves", () => {
    assert.equal(nextOwner(household, "bob"), null);
  });

  test("memberEntries copes with a household without member info", () => {
    assert.deepEqual(memberEntries({}), []);
  });
});

describe("syncStatus", () => {
  const now = NOW.getTime();

  test("is hidden when online with nothing pending", () => {
    assert.equal(syncStatus({ online: true, pending: {}, pendingSince: null }, now).visible, false);
  });

  test("is shown when offline", () => {
    const status = syncStatus({ online: false, pending: { items: 2 }, pendingSince: now }, now);
    assert.deepEqual(status, { count: 2, offline: true, slow: false, visible: true });
  });

  test("waits before reporting slow syncing", () => {
    const pending = { items: 1, purchases: 1 };
    assert.equal(syncStatus({ online: true, pending, pendingSince: now - 100 }, now).visible, false);
    const slow = syncStatus({ online: true, pending, pendingSince: now - SLOW_SYNC_MS }, now);
    assert.deepEqual(slow, { count: 2, offline: false, slow: true, visible: true });
  });
});

describe("summarizeAdds", () => {
  const milk = { name: "Milk" };

  test("says nothing for a single new item", () => {
    assert.equal(summarizeAdds([{ action: "create", item: null }]), null);
    assert.equal(summarizeAdds([{ action: "readd", item: milk }]), null);
  });

  test("explains a single item that was already there", () => {
    assert.equal(summarizeAdds([{ action: "exists", item: milk }]), "Milk is already on the list");
    assert.equal(summarizeAdds([{ action: "update-quantity", item: milk }]), "Updated Milk");
  });

  test("summarises several items", () => {
    const results = [
      { action: "create", item: null },
      { action: "readd", item: milk },
      { action: "exists", item: milk },
    ];
    assert.equal(summarizeAdds(results), "Added 2 items, 1 already on the list");
  });

  test("capitalises a summary without new items", () => {
    const results = [
      { action: "update-quantity", item: milk },
      { action: "exists", item: milk },
    ];
    assert.equal(summarizeAdds(results), "Updated 1, 1 already on the list");
  });
});

describe("helpers used by these tests", () => {
  test("hoursBefore moves back in time", () => {
    assert.equal(NOW.getTime() - hoursBefore(2).toMillis(), 2 * 60 * 60 * 1000);
  });
});

describe("limits", () => {
  const names = (count) => Array.from({ length: count }, (_, index) => `item ${index}`);

  test("accepts everything within the limits", () => {
    assert.deepEqual(limitAdds(names(3), 10), { accepted: names(3), dropped: 0, reason: null });
  });

  test("caps a single paste", () => {
    const result = limitAdds(names(MAX_ITEMS_PER_ADD + 7), 0);
    assert.equal(result.accepted.length, MAX_ITEMS_PER_ADD);
    assert.deepEqual([result.dropped, result.reason], [7, "too-many"]);
  });

  test("stops at the list size limit", () => {
    const result = limitAdds(names(10), MAX_ITEMS_PER_LIST - 4);
    assert.equal(result.accepted.length, 4);
    assert.deepEqual([result.dropped, result.reason], [6, "list-full"]);
    assert.equal(limitAdds(names(2), MAX_ITEMS_PER_LIST).accepted.length, 0);
  });

  test("explains what was dropped", () => {
    assert.equal(limitMessage(0, null), "");
    assert.match(limitMessage(7, "too-many"), new RegExp(`7 more not added: you can add up to ${MAX_ITEMS_PER_ADD}`));
    assert.match(limitMessage(6, "list-full"), new RegExp(`list is full \\(${MAX_ITEMS_PER_LIST} items\\)`));
  });
});

describe("groupBySection", () => {
  const items = [
    { name: "Milk", section: "dairy" },
    { name: "Bananas", section: "produce" },
    { name: "Mystery", section: "nonsense" },
    { name: "Eggs", section: "dairy" },
  ];

  test("follows the saved shop route and drops empty sections", () => {
    const groups = groupBySection(items, ["dairy", "produce"]);
    assert.deepEqual(groups.map((group) => group.key), ["dairy", "produce", "other"]);
    assert.deepEqual(groups[0].items.map((item) => item.name), ["Milk", "Eggs"]);
    assert.deepEqual(groups[2].items.map((item) => item.name), ["Mystery"]);
  });
});

describe("listAsText", () => {
  test("groups items by section with quantities and notes", () => {
    const text = listAsText({
      listName: "Groceries",
      householdName: "Home",
      items: [
        { name: "Milk", quantity: "2 L", note: "the oat one", section: "dairy" },
        { name: "Bananas", quantity: "", note: "", section: "produce" },
      ],
      savedOrder: [],
    });
    assert.equal(text, "Groceries (Home)\n\nFruit & veg\n• Bananas\n\nDairy & eggs\n• Milk (2 L) – the oat one");
  });

  test("skips section headings when everything is in one section", () => {
    const text = listAsText({
      listName: "Pharmacy",
      householdName: "",
      items: [{ name: "Plasters", quantity: "", note: "", section: "personal" }],
      savedOrder: [],
    });
    assert.equal(text, "Pharmacy\n\n• Plasters");
  });

  test("says when there is nothing to buy", () => {
    assert.equal(listAsText({ listName: "Groceries", householdName: "Home", items: [], savedOrder: [] }), "Groceries (Home)\n\nNothing left to buy.");
  });
});
