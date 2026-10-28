import { expect, test } from "@playwright/test";
import {
  addItems,
  bought,
  emailedLink,
  lastSharedText,
  lastSharedUrl,
  newUser,
  requestSignInLink,
  resetEmulators,
  seedPurchases,
  signIn,
  toBuy,
} from "./helpers.js";

test.beforeEach(async ({ request }) => {
  await resetEmulators(request);
});

function row(scope, name) {
  return scope.locator("li.item", { hasText: name });
}

test("two people share a household list in real time", async ({ browser }) => {
  const alice = await newUser(browser);
  await signIn(alice, { name: "Alice", email: "alice@example.com" });

  await alice.getByLabel("Household name").fill("Home");
  await alice.getByRole("button", { name: "Create", exact: true }).click();
  await expect(alice.getByRole("heading", { name: "Home", level: 1 })).toBeVisible();
  await expect(alice.getByRole("tab", { name: /Groceries/ })).toHaveAttribute("aria-selected", "true");

  await test.step("add several items at once, grouped by shop section", async () => {
    await addItems(alice, "milk, eggs, bread");
    await expect(alice.getByText("Added 3 items")).toBeVisible();
    await expect(toBuy(alice).getByRole("heading", { name: "Dairy & eggs" })).toBeVisible();
    await expect(toBuy(alice).getByRole("heading", { name: "Bakery" })).toBeVisible();
    await addItems(alice, "Milk");
    await expect(alice.getByText("milk is already on the list")).toBeVisible();
    await expect(row(toBuy(alice), "milk")).toHaveCount(1);
  });

  const bob = await newUser(browser);

  await test.step("invite a second person who signs in from the link", async () => {
    await alice.getByRole("button", { name: "Invite", exact: true }).click();
    const inviteUrl = await lastSharedUrl(alice);
    await bob.goto(inviteUrl);
    await expect(bob.getByText("You've been invited to a household")).toBeVisible();
    await signIn(bob, { name: "Bob", email: "bob@example.com", url: inviteUrl });
    await expect(bob.getByText("You joined the household")).toBeVisible();
    await expect(bob.getByRole("heading", { name: "Home", level: 1 })).toBeVisible();
    await expect(row(toBuy(bob), "bread")).toBeVisible();
    await expect(alice.getByText("Alice and Bob")).toBeVisible();
  });

  await test.step("ticking an item shows up for everyone with who bought it", async () => {
    await row(toBuy(bob), "bread").getByRole("checkbox").click();
    await expect(row(bought(alice), "bread")).toContainText("by Bob");
  });

  await test.step("unticking someone else's purchase keeps it in history", async () => {
    await row(bought(alice), "bread").getByRole("checkbox").click();
    await expect(row(toBuy(alice), "bread")).toBeVisible();
    await alice.getByRole("button", { name: "Purchase history" }).click();
    await expect(alice.locator("#history-groups")).toContainText("bread");
    await alice.getByRole("button", { name: "← Back" }).click();
  });

  await test.step("unticking your own purchase straight away removes it from history", async () => {
    await row(toBuy(alice), "milk").getByRole("checkbox").click();
    await expect(row(bought(alice), "milk")).toBeVisible();
    await row(bought(alice), "milk").getByRole("checkbox").click();
    await expect(row(toBuy(alice), "milk")).toBeVisible();
    await alice.getByRole("button", { name: "Purchase history" }).click();
    await expect(alice.locator("#history-groups")).toContainText("bread");
    await expect(alice.locator("#history-groups")).not.toContainText("milk");
    await alice.getByRole("button", { name: "← Back" }).click();
  });

  await test.step("notes are saved and shared", async () => {
    await alice.getByRole("button", { name: "Edit milk" }).click();
    await alice.getByLabel("Note", { exact: true }).fill("The oat one with the blue lid");
    await alice.getByRole("button", { name: "Save", exact: true }).click();
    await expect(row(toBuy(bob), "milk")).toContainText("The oat one with the blue lid");
  });

  await test.step("the list can be shared as text, grouped by section", async () => {
    await alice.getByRole("button", { name: "Share", exact: true }).click();
    await expect.poll(() => lastSharedText(alice)).toContain("Groceries (Home)");
    const text = await lastSharedText(alice);
    expect(text).toContain("Dairy & eggs");
    expect(text).toContain("• milk – The oat one with the blue lid");
    expect(text).toContain("• bread");
  });

  await test.step("removing an item can be undone", async () => {
    await alice.getByRole("button", { name: "Edit eggs" }).click();
    await alice.getByRole("button", { name: "Remove item" }).click();
    await expect(row(toBuy(alice), "eggs")).toHaveCount(0);
    await alice.getByRole("button", { name: "Undo" }).click();
    await expect(row(toBuy(alice), "eggs")).toBeVisible();
  });

  await test.step("a very long paste is capped at 50 items", async () => {
    await alice.getByRole("button", { name: "New list" }).click();
    await alice.getByRole("textbox", { name: "New list" }).fill("Party");
    await alice.getByRole("button", { name: "Create", exact: true }).click();
    await expect(alice.getByRole("tab", { name: /Party/ })).toHaveAttribute("aria-selected", "true");
    await addItems(alice, Array.from({ length: 60 }, (_, index) => `snack ${index + 1}`).join(", "));
    await expect(alice.getByText("Added 50 items. 10 more not added")).toBeVisible();
    await expect(alice.getByRole("tab", { name: "Party, 50 to buy" })).toBeVisible();
    await alice.getByRole("tab", { name: /Groceries/ }).click();
  });

  await test.step("lists are keyboard-accessible tabs", async () => {
    await alice.getByRole("button", { name: "New list" }).click();
    await alice.getByRole("textbox", { name: "New list" }).fill("Pharmacy");
    await alice.getByRole("button", { name: "Create", exact: true }).click();
    const pharmacy = alice.getByRole("tab", { name: /Pharmacy/ });
    const party = alice.getByRole("tab", { name: /Party/ });
    const groceries = alice.getByRole("tab", { name: /Groceries/ });
    await expect(pharmacy).toHaveAttribute("aria-selected", "true");
    await addItems(alice, "plasters");
    await expect(alice.getByRole("tabpanel")).toContainText("plasters");

    await pharmacy.focus();
    await alice.keyboard.press("ArrowLeft");
    await expect(party).toHaveAttribute("aria-selected", "true");
    await expect(party).toBeFocused();

    await alice.keyboard.press("Home");
    await expect(groceries).toHaveAttribute("aria-selected", "true");
    await expect(groceries).toBeFocused();
    await expect(groceries).toHaveAttribute("tabindex", "0");
    await expect(pharmacy).toHaveAttribute("tabindex", "-1");
    await expect(alice.getByRole("tabpanel")).toContainText("bread");

    await alice.keyboard.press("End");
    await expect(pharmacy).toHaveAttribute("aria-selected", "true");
    await expect(pharmacy).toBeFocused();
  });

  await test.step("the owner can remove a member, who then loses access", async () => {
    await alice.getByRole("button", { name: "Households" }).click();
    await alice.locator("#member-list").getByRole("button", { name: "Remove" }).click();
    await alice.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
    await expect(alice.locator("#member-list")).not.toContainText("Bob");
    await expect(bob.getByRole("heading", { name: "Create a household" })).toBeVisible();
  });
});

test("an invalid invite link explains what went wrong", async ({ browser }) => {
  const carol = await newUser(browser);
  const invite = "/?join=AAAAAAAAAAAAAAAAAAAA-BBBBBBBBBBBBBBBBBBBB";
  await signIn(carol, { name: "Carol", email: "carol@example.com", url: invite });
  await expect(carol.getByText("This invite link isn't valid any more")).toBeVisible();
  await expect(carol.getByRole("heading", { name: "Create a household" })).toBeVisible();
});

test("joining while offline says so instead of blaming the link", async ({ browser }) => {
  const dave = await newUser(browser);
  await signIn(dave, { name: "Dave", email: "dave@example.com" });
  await expect(dave.getByRole("heading", { name: "Join a household" })).toBeVisible();
  await dave.context().setOffline(true);
  await dave.getByLabel("Invite link or code").fill("AAAAAAAAAAAAAAAAAAAA-BBBBBBBBBBBBBBBBBBBB");
  await dave.getByRole("button", { name: "Join", exact: true }).click();
  await expect(dave.getByText("You're offline")).toBeVisible();
});

test("items and shop sections can be reordered by dragging or with the keyboard", async ({ browser }) => {
  const erin = await newUser(browser);
  await signIn(erin, { name: "Erin", email: "erin@example.com" });
  await erin.getByLabel("Household name").fill("Flat");
  await erin.getByRole("button", { name: "Create", exact: true }).click();
  await expect(erin.getByRole("heading", { name: "Flat", level: 1 })).toBeVisible();
  for (const name of ["apples", "pears", "plums"]) {
    await addItems(erin, name);
    await expect(row(toBuy(erin), name)).toBeVisible();
  }
  const names = toBuy(erin).locator("li.item .item-name");
  await expect(names).toHaveText(["plums", "pears", "apples"]);

  await test.step("drag an item to the top", async () => {
    const handle = erin.getByRole("button", { name: "Move apples" }).boundingBox();
    const target = row(toBuy(erin), "plums").boundingBox();
    const [from, to] = await Promise.all([handle, target]);
    if (!from || !to) throw new Error("Rows are not on screen");
    await erin.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await erin.mouse.down();
    await erin.mouse.move(from.x + from.width / 2, to.y + 4, { steps: 10 });
    await erin.mouse.up();
    await expect(names).toHaveText(["apples", "plums", "pears"]);
  });

  await test.step("move an item with the arrow keys", async () => {
    await erin.getByRole("button", { name: "Move apples" }).focus();
    await erin.keyboard.press("ArrowDown");
    await expect(names).toHaveText(["plums", "apples", "pears"]);
    await expect(erin.getByRole("button", { name: "Move apples" })).toBeFocused();
  });

  await test.step("the order is saved", async () => {
    await erin.reload();
    await expect(names).toHaveText(["plums", "apples", "pears"]);
  });

  await test.step("moving an item into another section changes its section", async () => {
    await addItems(erin, "milk");
    await expect(toBuy(erin).getByRole("heading", { name: "Dairy & eggs" })).toBeVisible();
    await erin.getByRole("button", { name: "Move milk" }).focus();
    await erin.keyboard.press("ArrowUp");
    await expect(toBuy(erin).getByRole("heading")).toHaveCount(0);
    await expect(names).toHaveText(["plums", "apples", "pears", "milk"]);
  });

  await test.step("shop sections can be reordered", async () => {
    await erin.getByRole("button", { name: "Households" }).click();
    await erin.getByText("Shop route").click();
    const sections = erin.locator("#section-order li");
    await expect(sections.nth(2)).toHaveText(/Dairy & eggs/);
    await erin.getByRole("button", { name: "Move Dairy & eggs" }).focus();
    await erin.keyboard.press("ArrowUp");
    await expect(sections.nth(1)).toHaveText(/Dairy & eggs/);
    await erin.reload();
    await erin.getByRole("button", { name: "Households" }).click();
    await erin.getByText("Shop route").click();
    await expect(sections.nth(1)).toHaveText(/Dairy & eggs/);
  });
});

test("the link from the sign-in email can be pasted into the app", async ({ browser }) => {
  const frank = await newUser(browser);
  await requestSignInLink(frank, { name: "Frank", email: "frank@example.com" });
  await frank.getByLabel("Sign-in link from the email").fill("https://example.com/not-a-sign-in-link");
  await frank.getByRole("button", { name: "Sign in with this link" }).click();
  await expect(frank.getByText("That isn't a sign-in link")).toBeVisible();
  await frank.getByLabel("Sign-in link from the email").fill(await emailedLink(frank.request, "frank@example.com"));
  await frank.getByRole("button", { name: "Sign in with this link" }).click();
  await expect(frank.getByRole("heading", { name: "Create a household" })).toBeVisible();
  await expect(frank.getByText("Signed in as")).toContainText("Frank");
});

test("things bought regularly are suggested when they're due again", async ({ browser }) => {
  const gina = await newUser(browser);
  await signIn(gina, { name: "Gina", email: "gina@example.com" });
  await gina.getByLabel("Household name").fill("Home");
  await gina.getByRole("button", { name: "Create", exact: true }).click();
  await expect(gina.getByRole("heading", { name: "Home", level: 1 })).toBeVisible();

  await seedPurchases(gina.request, { name: "milk", quantity: "2 L", daysAgo: [7, 14, 21] });
  await seedPurchases(gina.request, { name: "yoghurt", daysAgo: [3, 10, 17] });
  await seedPurchases(gina.request, { name: "cheese", daysAgo: [8, 22] });
  await gina.reload();

  const staples = gina.locator("#staples-section");
  await expect(staples.getByRole("button", { name: /milk/ })).toContainText("weekly");
  await expect(staples.getByRole("button", { name: /yoghurt/ })).toHaveCount(0);
  await expect(gina.locator("#suggestions-section").getByRole("button", { name: "cheese" })).toBeVisible();
  await expect(gina.getByRole("button", { name: /^Add all/ })).toBeHidden();

  await staples.getByRole("button", { name: /milk/ }).click();
  await expect(toBuy(gina).locator("li.item", { hasText: "milk" })).toContainText("2 L");
  await expect(staples).toBeHidden();
});
