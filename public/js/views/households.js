import { signOutUser, updateDisplayName } from "../auth.js";
import {
  changeMemberName,
  createHousehold,
  deleteHousehold,
  leaveHousehold,
  moveSection,
  removeMember,
  renameHousehold,
} from "../data/households.js";
import { revokeInvite } from "../data/invites.js";
import { flushPendingRemovals } from "../data/items.js";
import { chooseHousehold } from "../data/watch.js";
import { askForText, askToConfirm } from "../dialogs.js";
import { byId, element, iconButton, inputById, onClick, onSubmit, syncChildren, textButton } from "../dom.js";
import { formatExpiry } from "../format.js";
import { activeInvites, memberEntries, nextOwner } from "../logic.js";
import { orderedSections, sectionLabel } from "../sections.js";
import { changed, closePanel, currentHousehold, personName, requireUser, state, userName } from "../store.js";
import { showError, toast } from "../toast.js";
import { runJoin, shareInviteLink, shareNewInvite } from "./invites.js";
import { renderInstall } from "./install.js";

export function renderHouseholds(household) {
  syncChildren(byId("household-list"), state.households.map(householdEntry));
  byId("households-section").hidden = state.households.length === 0;
  byId("households-back").hidden = !household;
  byId("account-name").textContent = userName();
  renderHouseholdDetails(household);
  renderInstall();
}

function householdEntry(household) {
  const current = household.id === state.householdId;
  return {
    key: household.id,
    signature: JSON.stringify([household.name, current]),
    build() {
      const row = element("li", "item");
      const open = textButton(household.name, "household-open", () => {
        chooseHousehold(household.id);
        closePanel();
      });
      if (current) open.append(element("span", "badge", "current"));
      row.append(open);
      return row;
    },
  };
}

function renderHouseholdDetails(household) {
  byId("current-household").hidden = !household;
  if (!household) return;
  const viewerIsOwner = household.ownerId === requireUser().uid;
  byId("current-household-name").textContent = household.name;
  syncChildren(
    byId("member-list"),
    memberEntries(household).map((member) => memberEntry(household, member, viewerIsOwner)),
  );
  const invites = activeInvites(state.invites, Date.now());
  syncChildren(byId("invite-list"), invites.map(inviteEntry));
  byId("invite-empty").hidden = invites.length > 0;
  const order = orderedSections(household.sectionOrder);
  syncChildren(byId("section-order"), order.map((key, index) => sectionEntry(key, index, order.length)));
}

function memberEntry(household, member, viewerIsOwner) {
  const isOwner = member.uid === household.ownerId;
  const isYou = member.uid === requireUser().uid;
  const canRemove = viewerIsOwner && !isYou;
  return {
    key: member.uid,
    signature: JSON.stringify([member.name, isOwner, isYou, canRemove]),
    build() {
      const row = element("li", "row");
      const label = element("span", "row-label", member.name);
      if (isOwner) label.append(element("span", "badge", "owner"));
      if (isYou) label.append(element("span", "badge subtle", "you"));
      row.append(label);
      if (canRemove) {
        row.append(textButton("Remove", "ghost danger small", () => confirmRemoveMember(member.uid)));
      }
      return row;
    },
  };
}

function inviteEntry(invite) {
  const expiry = `Expires ${formatExpiry(invite.expiresAt)}`;
  const creator = `Created by ${personName(invite.createdBy, invite.createdByName)}`;
  return {
    key: invite.id,
    signature: JSON.stringify([expiry, creator]),
    build() {
      const row = element("li", "row");
      const text = element("span", "item-text");
      text.append(element("span", "", expiry), element("span", "item-meta", creator));
      row.append(
        text,
        textButton("Share", "ghost small", () => shareInviteLink(invite.id)),
        textButton("Cancel", "ghost danger small", () => {
          revokeInvite(invite.id).catch((error) => showError(error));
          toast("Invite link cancelled");
        }),
      );
      return row;
    },
  };
}

function sectionEntry(key, index, count) {
  const label = sectionLabel(key);
  return {
    key,
    signature: JSON.stringify([label, index, count]),
    build() {
      const row = element("li", "row");
      const move = (offset) => {
        const household = currentHousehold();
        if (household) moveSection(household, index, offset).catch((error) => showError(error));
      };
      const up = iconButton("↑", `Move ${label} earlier`, () => move(-1));
      const down = iconButton("↓", `Move ${label} later`, () => move(1));
      up.disabled = index === 0;
      down.disabled = index === count - 1;
      row.append(element("span", "row-label", label), up, down);
      return row;
    },
  };
}

async function confirmRemoveMember(memberUid) {
  const household = currentHousehold();
  const member = household && memberEntries(household).find((entry) => entry.uid === memberUid);
  if (!member) return;
  const confirmed = await askToConfirm({
    title: `Remove ${member.name}?`,
    message: `${member.name} will lose access to "${household.name}". All current invite links will be cancelled too, so old links can't be used to rejoin.`,
    confirmLabel: "Remove",
    danger: true,
  });
  if (confirmed) removeMember(household, memberUid).catch((error) => showError(error));
}

async function confirmLeave() {
  const household = currentHousehold();
  if (!household) return;
  if (household.members.length === 1) {
    const confirmed = await askToConfirm({
      title: `Delete "${household.name}"?`,
      message: "You're the last member, so leaving deletes the household with all its lists and purchase history.",
      confirmLabel: "Leave and delete",
      danger: true,
    });
    if (!confirmed) return;
    try {
      await deleteHousehold(household);
      toast("Household deleted");
    } catch (error) {
      showError(error);
    }
    return;
  }
  const newOwner = nextOwner(household, requireUser().uid);
  const ownerNote = newOwner ? ` ${newOwner.name} will become the owner.` : "";
  const confirmed = await askToConfirm({
    title: `Leave "${household.name}"?`,
    message: `You'll need a new invite to rejoin.${ownerNote}`,
    confirmLabel: "Leave",
    danger: true,
  });
  if (confirmed) leaveHousehold(household).catch((error) => showError(error));
}

async function changeName() {
  const name = await askForText({ title: "Your name", value: userName(), maxLength: 40 });
  if (!name || name === userName()) return;
  try {
    await Promise.all([updateDisplayName(name), changeMemberName(name)]);
    toast("Name updated");
  } catch (error) {
    showError(error);
  }
  changed();
}

async function renameCurrentHousehold() {
  const household = currentHousehold();
  if (!household) return;
  const name = await askForText({ title: "Rename household", value: household.name, maxLength: 60 });
  if (name && name !== household.name) {
    renameHousehold(household.id, name).catch((error) => showError(error));
  }
}

export function bindHouseholds() {
  onClick("households-back", closePanel);
  onClick("rename-household", renameCurrentHousehold);
  onClick("new-invite", shareNewInvite);
  onClick("leave-household", confirmLeave);
  onClick("change-name", changeName);
  onClick("signout-button", () => {
    flushPendingRemovals();
    signOutUser().catch((error) => showError(error));
  });
  onSubmit("create-form", (form) => {
    const name = inputById("create-name").value.trim();
    if (!name) return;
    closePanel();
    createHousehold(name).catch((error) => showError(error));
    form.reset();
  });
  onSubmit("join-form", async (form) => {
    const input = inputById("join-code").value;
    await runJoin(input);
    form.reset();
  });
}
