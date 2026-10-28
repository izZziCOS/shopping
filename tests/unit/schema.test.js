import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { NOT_BOUGHT } from "../../public/js/logic.js";
import {
  boughtItemChanges,
  householdRecord,
  inviteRecord,
  itemRecord,
  listRecord,
  memberInfoRecord,
  purchaseRecord,
  readdedItemChanges,
} from "../../public/js/records.js";
import { SECTIONS } from "../../public/js/sections.js";

const rules = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");
const types = readFileSync(new URL("../../public/js/types.d.ts", import.meta.url), "utf8");

function quoted(text) {
  return [...text.matchAll(/'([^']+)'/g)].map((match) => match[1]);
}

function functionBody(name) {
  const start = rules.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `firestore.rules defines ${name}()`);
  const open = rules.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < rules.length; index += 1) {
    if (rules[index] === "{") depth += 1;
    if (rules[index] === "}") depth -= 1;
    if (depth === 0) return rules.slice(open + 1, index);
  }
  throw new Error(`Unclosed function ${name}`);
}

function rulesAllowedKeys(functionName) {
  const match = functionBody(functionName).match(/keys\(\)\.hasOnly\(\[([^\]]*)\]\)/);
  assert.ok(match, `${functionName}() limits its keys with hasOnly`);
  return quoted(match[1]).sort();
}

function rulesList(functionName) {
  const match = functionBody(functionName).match(/\[([\s\S]*?)\]/);
  assert.ok(match, `${functionName}() returns a list`);
  return quoted(match[1]);
}

function rulesItemFields() {
  return rulesList("itemFields").sort();
}

function interfaceFields(name) {
  const match = types.match(new RegExp(`export interface ${name} \\{([\\s\\S]*?)\\n\\}`));
  assert.ok(match, `types.d.ts declares ${name}`);
  return [...match[1].matchAll(/^\s+(\w+)(\?)?:/gm)]
    .map((field) => ({ name: field[1], optional: Boolean(field[2]) }))
    .filter((field) => field.name !== "id" && field.name !== "pending");
}

function requiredInterfaceFields(name) {
  return interfaceFields(name).filter((field) => !field.optional).map((field) => field.name).sort();
}

function optionalInterfaceFields(name) {
  return interfaceFields(name).filter((field) => field.optional).map((field) => field.name).sort();
}

function keys(record) {
  return Object.keys(record).sort();
}

const now = { seconds: 0, nanoseconds: 0 };

describe("written records match the security rules and the types", () => {
  test("items", () => {
    const record = itemRecord({
      listId: "list",
      name: "Milk",
      quantity: "",
      section: "dairy",
      addedBy: "uid",
      addedByName: "Alice",
      createdAt: now,
    });
    assert.deepEqual(keys(record), rulesItemFields());
    assert.deepEqual(keys(record), requiredInterfaceFields("Item"));
  });

  test("optional item fields are optional in both the rules and the types", () => {
    assert.deepEqual(rulesList("optionalItemFields").sort(), optionalInterfaceFields("Item"));
  });

  test("item updates only touch item fields", () => {
    const fields = new Set([...rulesItemFields(), ...rulesList("optionalItemFields")]);
    const updates = [
      NOT_BOUGHT,
      readdedItemChanges({ quantity: "", addedBy: "uid", addedByName: "Alice", createdAt: now }),
      boughtItemChanges({ boughtAt: now, boughtBy: "uid", boughtByName: "Alice", purchaseId: "purchase" }),
    ];
    for (const update of updates) {
      for (const key of Object.keys(update)) assert.ok(fields.has(key), `${key} is an item field`);
    }
  });

  test("purchases", () => {
    const item = { id: "item", listId: "list", name: "Milk", quantity: "", section: "dairy" };
    const record = purchaseRecord({ item, boughtAt: now, boughtBy: "uid", boughtByName: "Alice", expireAt: now });
    assert.deepEqual(keys(record), rulesAllowedKeys("isValidNewPurchase"));
    assert.deepEqual(keys(record), requiredInterfaceFields("Purchase"));
  });

  test("invites", () => {
    const record = inviteRecord({ createdBy: "uid", createdByName: "Alice", createdAt: now, expiresAt: now });
    assert.deepEqual(keys(record), rulesAllowedKeys("isValidNewInvite"));
    assert.deepEqual(keys(record), requiredInterfaceFields("Invite"));
  });

  test("lists", () => {
    const record = listRecord({ name: "Groceries", createdBy: "uid", createdAt: now });
    assert.deepEqual(keys(record), rulesAllowedKeys("isValidNewList"));
    assert.deepEqual(keys(record), requiredInterfaceFields("ShoppingList"));
  });

  test("households", () => {
    const record = householdRecord({ name: "Home", ownerId: "uid", ownerName: "Alice", createdAt: now });
    assert.deepEqual(keys(record), rulesAllowedKeys("isValidNewHousehold"));
    assert.deepEqual(keys(record), requiredInterfaceFields("Household"));
    assert.deepEqual(record.members, ["uid"]);
    assert.deepEqual(Object.keys(record.memberInfo), ["uid"]);
  });

  test("the rules know every shop section", () => {
    assert.deepEqual(rulesList("sectionKeys"), SECTIONS.map((section) => section.key));
  });

  test("member info", () => {
    const record = memberInfoRecord({ name: "Alice", joinedAt: now, invite: null });
    assert.deepEqual(keys(record), rulesAllowedKeys("isValidMemberInfo"));
    assert.deepEqual(keys(record), requiredInterfaceFields("MemberInfo"));
  });
});
