import { joinWithInvite } from "../data/households.js";
import { INVITE_REUSE_MIN_REMAINING_MS, createInvite } from "../data/invites.js";
import { UserFacingError } from "../errors.js";
import { MAX_MEMBERS, reusableInvite } from "../logic.js";
import { closePanel, currentHousehold, state } from "../store.js";
import { showError, toast } from "../toast.js";
import { shareText } from "./share.js";

const JOIN_MESSAGES = new Map([
  ["invalid", "That invite link doesn't look right."],
  ["missing", "This invite link isn't valid any more. Ask for a new one."],
  ["expired", "This invite link has expired. Ask for a new one."],
  ["offline", "You're offline. Connect to the internet and open the invite link again."],
  ["full-or-expired", `Couldn't join. The household may already have ${MAX_MEMBERS} members, or the link has just expired.`],
  ["joined", "You joined the household"],
]);

export async function runJoin(input) {
  try {
    const { result } = await joinWithInvite(input);
    if (result === "joined" || result === "already-member") closePanel();
    const message = JOIN_MESSAGES.get(result);
    if (message) toast(message);
  } catch (error) {
    showError(error, "Couldn't join. Ask for a new invite link.");
  }
}

export async function shareInviteLink(code) {
  const household = currentHousehold();
  if (!household) return;
  await shareText({
    title: "Shopping List",
    text: `Join our "${household.name}" shopping list`,
    url: `${location.origin}${location.pathname}?join=${household.id}-${code}`,
    copiedMessage: "Invite link copied",
    dialogTitle: "Invite link",
    dialogMessage: "Send this link to the person you want to invite. It works for 7 days.",
  });
}

function ensureRoom() {
  const household = currentHousehold();
  if (household && household.members.length >= MAX_MEMBERS) {
    throw new UserFacingError(`"${household.name}" already has the maximum of ${MAX_MEMBERS} members.`);
  }
}

export async function shareNewInvite() {
  try {
    ensureRoom();
    const { code, saved } = await createInvite();
    saved.catch((error) => showError(error));
    await shareInviteLink(code);
  } catch (error) {
    showError(error);
  }
}

export async function shareInvite() {
  try {
    ensureRoom();
  } catch (error) {
    showError(error);
    return;
  }
  const reusable = reusableInvite(state.invites, Date.now(), INVITE_REUSE_MIN_REMAINING_MS);
  if (reusable) {
    await shareInviteLink(reusable.id);
  } else {
    await shareNewInvite();
  }
}
