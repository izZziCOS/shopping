import { expect, test } from "@playwright/test";
import { addItems, bought, lastSharedText, lastSharedUrl, newUser, resetEmulators, signIn, toBuy } from "./helpers.js";

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
    const groceries = alice.getByRole("tab", { name: /Groceries/ });
    await expect(pharmacy).toHaveAttribute("aria-selected", "true");
    await addItems(alice, "plasters");
    await expect(alice.getByRole("tabpanel")).toContainText("plasters");

    await pharmacy.focus();
    await alice.keyboard.press("ArrowLeft");
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
