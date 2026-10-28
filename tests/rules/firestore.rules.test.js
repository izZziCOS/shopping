import { readFileSync } from "node:fs";
import { after, before, beforeEach, describe, test } from "node:test";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import {
  Timestamp,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUSEHOLD = "household1";
const LIST = "groceries1";
const OTHER_LIST = "pharmacy01";
const ITEM = "itemmilk01";
const BOUGHT_ITEM = "itembread1";
const VALID_INVITE = "validinvite1";
const EXPIRED_INVITE = "expiredinv1";
const SOLO_HOUSEHOLD = "household2";

let env;

const NOT_BOUGHT = { bought: false, boughtAt: null, boughtBy: null, boughtByName: null, purchaseId: null };

function firestoreAs(uid) {
  return uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore();
}

function householdPath(...segments) {
  return ["households", HOUSEHOLD, ...segments].join("/");
}

function fromNow(ms) {
  return Timestamp.fromMillis(Date.now() + ms);
}

function memberInfo(name, invite = null) {
  return { name, joinedAt: Timestamp.now(), invite };
}

function newItem(uid, overrides = {}) {
  return {
    listId: LIST,
    name: "Eggs",
    quantity: "12",
    note: "",
    section: "dairy",
    ...NOT_BOUGHT,
    addedBy: uid,
    addedByName: uid,
    createdAt: serverTimestamp(),
    ...overrides,
  };
}

function newPurchase(uid, overrides = {}) {
  return {
    itemId: ITEM,
    listId: LIST,
    name: "Milk",
    quantity: "",
    section: "dairy",
    boughtAt: serverTimestamp(),
    boughtBy: uid,
    boughtByName: uid,
    expireAt: fromNow(365 * DAY_MS),
    ...overrides,
  };
}

function newInvite(uid, overrides = {}) {
  return {
    createdBy: uid,
    createdByName: uid,
    createdAt: serverTimestamp(),
    expiresAt: fromNow(7 * DAY_MS),
    ...overrides,
  };
}

function joinChanges(uid, invite) {
  return {
    members: arrayUnion(uid),
    [`memberInfo.${uid}`]: { name: uid, joinedAt: serverTimestamp(), invite },
  };
}

async function seed() {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, householdPath()), {
      name: "Home",
      ownerId: "alice",
      members: ["alice", "bob"],
      memberInfo: { alice: memberInfo("Alice"), bob: memberInfo("Bob", VALID_INVITE) },
      createdAt: Timestamp.now(),
    });
    await setDoc(doc(db, householdPath("lists", LIST)), { name: "Groceries", createdBy: "alice", createdAt: Timestamp.now() });
    await setDoc(doc(db, householdPath("lists", OTHER_LIST)), { name: "Pharmacy", createdBy: "alice", createdAt: Timestamp.now() });
    await setDoc(doc(db, householdPath("items", ITEM)), {
      ...newItem("alice", { name: "Milk", quantity: "" }),
      createdAt: Timestamp.now(),
    });
    await setDoc(doc(db, householdPath("items", BOUGHT_ITEM)), {
      ...newItem("alice", { name: "Bread", section: "bakery" }),
      createdAt: Timestamp.now(),
      bought: true,
      boughtAt: Timestamp.now(),
      boughtBy: "bob",
      boughtByName: "Bob",
      purchaseId: "purchase001",
    });
    await setDoc(doc(db, householdPath("purchases", "purchase001")), {
      ...newPurchase("bob", { itemId: BOUGHT_ITEM, name: "Bread", section: "bakery" }),
      boughtAt: Timestamp.now(),
    });
    await setDoc(doc(db, householdPath("purchases", "purchase008")), {
      ...newPurchase("bob", { name: "Cheese" }),
      boughtAt: Timestamp.fromMillis(Date.now() - 11 * 60 * 1000),
    });
    await setDoc(doc(db, householdPath("invites", VALID_INVITE)), { ...newInvite("alice"), createdAt: Timestamp.now() });
    await setDoc(doc(db, householdPath("invites", EXPIRED_INVITE)), {
      ...newInvite("alice"),
      createdAt: Timestamp.now(),
      expiresAt: fromNow(-DAY_MS),
    });
    await setDoc(doc(db, "households", SOLO_HOUSEHOLD), {
      name: "Flat",
      ownerId: "dave",
      members: ["dave"],
      memberInfo: { dave: memberInfo("Dave") },
      createdAt: Timestamp.now(),
    });
    await setDoc(doc(db, "households", SOLO_HOUSEHOLD, "purchases", "purchase009"), {
      ...newPurchase("erin"),
      boughtAt: Timestamp.now(),
    });
  });
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-shopping",
    firestore: { rules: readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8") },
  });
});

after(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await seed();
});

describe("households", () => {
  test("members can read their household", async () => {
    await assertSucceeds(getDoc(doc(firestoreAs("bob"), householdPath())));
  });

  test("outsiders and signed-out visitors cannot read a household", async () => {
    await assertFails(getDoc(doc(firestoreAs("carol"), householdPath())));
    await assertFails(getDoc(doc(firestoreAs(null), householdPath())));
  });

  test("a user can list the households they belong to", async () => {
    const db = firestoreAs("alice");
    await assertSucceeds(getDocs(query(collection(db, "households"), where("members", "array-contains", "alice"))));
  });

  test("a user cannot list every household", async () => {
    await assertFails(getDocs(collection(firestoreAs("alice"), "households")));
  });

  test("a user can create a household with themselves as owner and its first list", async () => {
    const db = firestoreAs("carol");
    const ref = doc(db, "households", "household3");
    const batch = writeBatch(db);
    batch.set(ref, {
      name: "Cabin",
      ownerId: "carol",
      members: ["carol"],
      memberInfo: { carol: { name: "Carol", joinedAt: serverTimestamp(), invite: null } },
      createdAt: serverTimestamp(),
    });
    batch.set(doc(ref, "lists", "firstlist1"), { name: "Groceries", createdBy: "carol", createdAt: serverTimestamp() });
    await assertSucceeds(batch.commit());
  });

  test("a user cannot create a household that includes someone else", async () => {
    await assertFails(
      setDoc(doc(firestoreAs("carol"), "households", "household3"), {
        name: "Cabin",
        ownerId: "carol",
        members: ["carol", "alice"],
        memberInfo: {
          carol: { name: "Carol", joinedAt: serverTimestamp(), invite: null },
          alice: { name: "Alice", joinedAt: serverTimestamp(), invite: null },
        },
        createdAt: serverTimestamp(),
      }),
    );
  });

  test("a user cannot create a household owned by someone else", async () => {
    await assertFails(
      setDoc(doc(firestoreAs("carol"), "households", "household3"), {
        name: "Cabin",
        ownerId: "alice",
        members: ["carol"],
        memberInfo: { carol: { name: "Carol", joinedAt: serverTimestamp(), invite: null } },
        createdAt: serverTimestamp(),
      }),
    );
  });

  test("a member can rename the household and reorder its sections", async () => {
    const ref = doc(firestoreAs("bob"), householdPath());
    await assertSucceeds(updateDoc(ref, { name: "Our home" }));
    await assertSucceeds(updateDoc(ref, { sectionOrder: ["dairy", "produce"] }));
  });

  test("the shop route can only hold known sections, each once", async () => {
    const ref = doc(firestoreAs("bob"), householdPath());
    await assertFails(updateDoc(ref, { sectionOrder: ["dairy", "made-up"] }));
    await assertFails(updateDoc(ref, { sectionOrder: ["dairy", "dairy"] }));
    await assertFails(updateDoc(ref, { sectionOrder: [42] }));
  });

  test("an outsider cannot rename the household", async () => {
    await assertFails(updateDoc(doc(firestoreAs("carol"), householdPath()), { name: "Mine now" }));
  });

  test("a member cannot make themselves the owner", async () => {
    await assertFails(updateDoc(doc(firestoreAs("bob"), householdPath()), { ownerId: "bob" }));
  });

  test("the last member can delete the household", async () => {
    await assertSucceeds(deleteDoc(doc(firestoreAs("dave"), "households", SOLO_HOUSEHOLD)));
  });

  test("a household with other members cannot be deleted", async () => {
    await assertFails(deleteDoc(doc(firestoreAs("alice"), householdPath())));
  });
});

describe("joining", () => {
  test("a user with a valid invite can join", async () => {
    await assertSucceeds(updateDoc(doc(firestoreAs("carol"), householdPath()), joinChanges("carol", VALID_INVITE)));
  });

  test("an expired invite cannot be used", async () => {
    await assertFails(updateDoc(doc(firestoreAs("carol"), householdPath()), joinChanges("carol", EXPIRED_INVITE)));
  });

  test("a made-up invite cannot be used", async () => {
    await assertFails(updateDoc(doc(firestoreAs("carol"), householdPath()), joinChanges("carol", "madeupcode1")));
  });

  test("a joining user cannot add someone else", async () => {
    await assertFails(
      updateDoc(doc(firestoreAs("carol"), householdPath()), {
        members: arrayUnion("carol", "eve"),
        "memberInfo.carol": { name: "Carol", joinedAt: serverTimestamp(), invite: VALID_INVITE },
        "memberInfo.eve": { name: "Eve", joinedAt: serverTimestamp(), invite: VALID_INVITE },
      }),
    );
  });

  test("nobody can join a household that already has 20 members", async () => {
    const members = Array.from({ length: 20 }, (_, index) => `member${index}`);
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "households", "fullhouse1"), {
        name: "Full",
        ownerId: members[0],
        members,
        memberInfo: Object.fromEntries(members.map((uid) => [uid, memberInfo(uid)])),
        createdAt: Timestamp.now(),
      });
      await setDoc(doc(db, "households", "fullhouse1", "invites", VALID_INVITE), { ...newInvite(members[0]), createdAt: Timestamp.now() });
    });
    await assertFails(updateDoc(doc(firestoreAs("carol"), "households", "fullhouse1"), joinChanges("carol", VALID_INVITE)));
  });

  test("a joining user cannot rename the household at the same time", async () => {
    await assertFails(
      updateDoc(doc(firestoreAs("carol"), householdPath()), { ...joinChanges("carol", VALID_INVITE), name: "Carol's" }),
    );
  });
});

describe("leaving and removing members", () => {
  test("a member can leave", async () => {
    await assertSucceeds(
      updateDoc(doc(firestoreAs("bob"), householdPath()), { members: arrayRemove("bob"), "memberInfo.bob": deleteField() }),
    );
  });

  test("the owner cannot leave without handing over ownership", async () => {
    await assertFails(
      updateDoc(doc(firestoreAs("alice"), householdPath()), { members: arrayRemove("alice"), "memberInfo.alice": deleteField() }),
    );
  });

  test("the owner can leave by handing ownership to a remaining member", async () => {
    await assertSucceeds(
      updateDoc(doc(firestoreAs("alice"), householdPath()), {
        members: arrayRemove("alice"),
        "memberInfo.alice": deleteField(),
        ownerId: "bob",
      }),
    );
  });

  test("the owner cannot hand ownership to an outsider", async () => {
    await assertFails(
      updateDoc(doc(firestoreAs("alice"), householdPath()), {
        members: arrayRemove("alice"),
        "memberInfo.alice": deleteField(),
        ownerId: "carol",
      }),
    );
  });

  test("the owner can remove a member", async () => {
    await assertSucceeds(
      updateDoc(doc(firestoreAs("alice"), householdPath()), { members: arrayRemove("bob"), "memberInfo.bob": deleteField() }),
    );
  });

  test("a member who is not the owner cannot remove others", async () => {
    await assertFails(
      updateDoc(doc(firestoreAs("bob"), householdPath()), { members: arrayRemove("alice"), "memberInfo.alice": deleteField() }),
    );
  });

  test("removing a member must also remove their member info", async () => {
    await assertFails(updateDoc(doc(firestoreAs("alice"), householdPath()), { members: arrayRemove("bob") }));
  });
});

describe("member names", () => {
  test("a member can change their own name", async () => {
    await assertSucceeds(updateDoc(doc(firestoreAs("bob"), householdPath()), { "memberInfo.bob.name": "Bobby" }));
  });

  test("a member cannot change someone else's name", async () => {
    await assertFails(updateDoc(doc(firestoreAs("bob"), householdPath()), { "memberInfo.alice.name": "Al" }));
  });

  test("a member cannot change when they joined", async () => {
    await assertFails(updateDoc(doc(firestoreAs("bob"), householdPath()), { "memberInfo.bob.joinedAt": Timestamp.now() }));
  });
});

describe("lists", () => {
  test("a member can create, rename and delete a list", async () => {
    const ref = doc(firestoreAs("bob"), householdPath("lists", "hardware01"));
    await assertSucceeds(setDoc(ref, { name: "Hardware", createdBy: "bob", createdAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref, { name: "DIY" }));
    await assertSucceeds(deleteDoc(ref));
  });

  test("an outsider cannot create or read lists", async () => {
    const db = firestoreAs("carol");
    await assertFails(
      setDoc(doc(db, householdPath("lists", "hardware01")), { name: "Hardware", createdBy: "carol", createdAt: serverTimestamp() }),
    );
    await assertFails(getDocs(collection(db, householdPath("lists"))));
  });

  test("a list's creator cannot be changed", async () => {
    await assertFails(updateDoc(doc(firestoreAs("bob"), householdPath("lists", LIST)), { createdBy: "bob" }));
  });
});

describe("items", () => {
  test("a member can add an item", async () => {
    await assertSucceeds(setDoc(doc(firestoreAs("bob"), householdPath("items", "itemeggs01")), newItem("bob")));
  });

  test("an outsider cannot add or read items", async () => {
    const db = firestoreAs("carol");
    await assertFails(setDoc(doc(db, householdPath("items", "itemeggs01")), newItem("carol")));
    await assertFails(getDocs(collection(db, householdPath("items"))));
  });

  test("an item cannot be added in someone else's name", async () => {
    await assertFails(setDoc(doc(firestoreAs("bob"), householdPath("items", "itemeggs01")), newItem("alice")));
  });

  test("an item cannot be added already bought", async () => {
    await assertFails(
      setDoc(
        doc(firestoreAs("bob"), householdPath("items", "itemeggs01")),
        newItem("bob", { bought: true, boughtAt: serverTimestamp(), boughtBy: "bob", boughtByName: "Bob", purchaseId: "purchase002" }),
      ),
    );
  });

  test("an item cannot be added to a list that doesn't exist", async () => {
    await assertFails(setDoc(doc(firestoreAs("bob"), householdPath("items", "itemeggs01")), newItem("bob", { listId: "missinglist" })));
  });

  test("an item cannot have extra fields or a made-up section", async () => {
    const db = firestoreAs("bob");
    await assertFails(setDoc(doc(db, householdPath("items", "itemeggs01")), { ...newItem("bob"), secret: true }));
    await assertFails(setDoc(doc(db, householdPath("items", "itemeggs02")), newItem("bob", { section: "Dairy & eggs" })));
  });

  test("a member can tick an item together with its purchase record", async () => {
    const db = firestoreAs("bob");
    const batch = writeBatch(db);
    batch.set(doc(db, householdPath("purchases", "purchase002")), newPurchase("bob"));
    batch.update(doc(db, householdPath("items", ITEM)), {
      bought: true,
      boughtAt: serverTimestamp(),
      boughtBy: "bob",
      boughtByName: "Bob",
      purchaseId: "purchase002",
    });
    await assertSucceeds(batch.commit());
  });

  test("an item cannot be ticked without a purchase record", async () => {
    await assertFails(
      updateDoc(doc(firestoreAs("bob"), householdPath("items", ITEM)), {
        bought: true,
        boughtAt: serverTimestamp(),
        boughtBy: "bob",
        boughtByName: "Bob",
        purchaseId: "purchase002",
      }),
    );
  });

  test("the bought time must be the server's time", async () => {
    const db = firestoreAs("bob");
    const batch = writeBatch(db);
    batch.set(doc(db, householdPath("purchases", "purchase002")), newPurchase("bob"));
    batch.update(doc(db, householdPath("items", ITEM)), {
      bought: true,
      boughtAt: Timestamp.fromMillis(Date.now() - DAY_MS),
      boughtBy: "bob",
      boughtByName: "Bob",
      purchaseId: "purchase002",
    });
    await assertFails(batch.commit());
  });

  test("an item cannot be ticked in someone else's name", async () => {
    const db = firestoreAs("bob");
    const batch = writeBatch(db);
    batch.set(doc(db, householdPath("purchases", "purchase002")), newPurchase("bob"));
    batch.update(doc(db, householdPath("items", ITEM)), {
      bought: true,
      boughtAt: serverTimestamp(),
      boughtBy: "alice",
      boughtByName: "Alice",
      purchaseId: "purchase002",
    });
    await assertFails(batch.commit());
  });

  test("a bought item can be unticked", async () => {
    await assertSucceeds(updateDoc(doc(firestoreAs("alice"), householdPath("items", BOUGHT_ITEM)), NOT_BOUGHT));
  });

  test("a bought item can be put back on the list by someone new", async () => {
    await assertSucceeds(
      updateDoc(doc(firestoreAs("bob"), householdPath("items", BOUGHT_ITEM)), {
        ...NOT_BOUGHT,
        addedBy: "bob",
        addedByName: "Bob",
        createdAt: serverTimestamp(),
      }),
    );
  });

  test("who added an item cannot be changed while it is on the list", async () => {
    await assertFails(
      updateDoc(doc(firestoreAs("bob"), householdPath("items", ITEM)), {
        addedBy: "bob",
        addedByName: "Bob",
        createdAt: serverTimestamp(),
      }),
    );
  });

  test("the bought details cannot be changed while editing an item", async () => {
    await assertFails(
      updateDoc(doc(firestoreAs("alice"), householdPath("items", BOUGHT_ITEM)), { name: "Rye bread", boughtByName: "Alice" }),
    );
  });

  test("a member can edit the name, quantity, note and section", async () => {
    await assertSucceeds(
      updateDoc(doc(firestoreAs("bob"), householdPath("items", ITEM)), {
        name: "Oat milk",
        quantity: "2",
        note: "The barista one",
        section: "drinks",
      }),
    );
  });

  test("a member can move an item, and putting it back resets its place", async () => {
    const ref = doc(firestoreAs("bob"), householdPath("items", ITEM));
    await assertSucceeds(updateDoc(ref, { order: -1234.5, section: "drinks" }));
    await assertSucceeds(updateDoc(ref, { order: null }));
    await assertFails(updateDoc(ref, { order: "first" }));
  });

  test("a note cannot be longer than 200 characters", async () => {
    await assertFails(updateDoc(doc(firestoreAs("bob"), householdPath("items", ITEM)), { note: "x".repeat(201) }));
  });

  test("an item can move to another existing list but not to a missing one", async () => {
    const ref = doc(firestoreAs("bob"), householdPath("items", ITEM));
    await assertSucceeds(updateDoc(ref, { listId: OTHER_LIST }));
    await assertFails(updateDoc(ref, { listId: "missinglist" }));
  });

  test("a member can delete an item", async () => {
    await assertSucceeds(deleteDoc(doc(firestoreAs("bob"), householdPath("items", ITEM))));
  });
});

describe("purchases", () => {
  test("a member can record a purchase", async () => {
    await assertSucceeds(setDoc(doc(firestoreAs("bob"), householdPath("purchases", "purchase002")), newPurchase("bob")));
  });

  test("a purchase cannot be backdated or recorded for someone else", async () => {
    const db = firestoreAs("bob");
    await assertFails(
      setDoc(doc(db, householdPath("purchases", "purchase002")), newPurchase("bob", { boughtAt: Timestamp.fromMillis(Date.now() - DAY_MS) })),
    );
    await assertFails(setDoc(doc(db, householdPath("purchases", "purchase003")), newPurchase("alice")));
  });

  test("a purchase must expire about a year from now", async () => {
    await assertFails(
      setDoc(doc(firestoreAs("bob"), householdPath("purchases", "purchase002")), newPurchase("bob", { expireAt: fromNow(30 * DAY_MS) })),
    );
  });

  test("purchases cannot be edited", async () => {
    await assertFails(updateDoc(doc(firestoreAs("bob"), householdPath("purchases", "purchase001")), { name: "Cake" }));
  });

  test("the buyer can delete their own purchase", async () => {
    await assertSucceeds(deleteDoc(doc(firestoreAs("bob"), householdPath("purchases", "purchase001"))));
  });

  test("the buyer cannot delete their purchase after 10 minutes", async () => {
    await assertFails(deleteDoc(doc(firestoreAs("bob"), householdPath("purchases", "purchase008"))));
  });

  test("another member cannot delete someone else's purchase", async () => {
    await assertFails(deleteDoc(doc(firestoreAs("alice"), householdPath("purchases", "purchase001"))));
  });

  test("the last member can delete any purchase when deleting the household", async () => {
    await assertSucceeds(deleteDoc(doc(firestoreAs("dave"), "households", SOLO_HOUSEHOLD, "purchases", "purchase009")));
  });

  test("an outsider cannot read purchase history", async () => {
    await assertFails(getDocs(collection(firestoreAs("carol"), householdPath("purchases"))));
  });
});

describe("invites", () => {
  test("any signed-in user can look up an invite by its code", async () => {
    await assertSucceeds(getDoc(doc(firestoreAs("carol"), householdPath("invites", VALID_INVITE))));
  });

  test("signed-out visitors cannot look up invites", async () => {
    await assertFails(getDoc(doc(firestoreAs(null), householdPath("invites", VALID_INVITE))));
  });

  test("only members can list invites", async () => {
    await assertSucceeds(getDocs(collection(firestoreAs("bob"), householdPath("invites"))));
    await assertFails(getDocs(collection(firestoreAs("carol"), householdPath("invites"))));
  });

  test("a member can create and cancel an invite", async () => {
    const ref = doc(firestoreAs("bob"), householdPath("invites", "newinvite01"));
    await assertSucceeds(setDoc(ref, newInvite("bob")));
    await assertSucceeds(deleteDoc(ref));
  });

  test("an invite cannot last longer than a week", async () => {
    await assertFails(
      setDoc(doc(firestoreAs("bob"), householdPath("invites", "newinvite01")), newInvite("bob", { expiresAt: fromNow(30 * DAY_MS) })),
    );
  });

  test("an outsider cannot create an invite", async () => {
    await assertFails(setDoc(doc(firestoreAs("carol"), householdPath("invites", "newinvite01")), newInvite("carol")));
  });
});
