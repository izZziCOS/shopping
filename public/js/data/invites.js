import { Timestamp, deleteDoc, doc, serverTimestamp, setDoc } from "../sdk.js";
import { UserFacingError } from "../errors.js";
import { DAY_MS } from "../format.js";
import { MAX_ACTIVE_INVITES, activeInvites, randomCode } from "../logic.js";
import { inviteRecord } from "../records.js";
import { requireUser, state, userName } from "../store.js";
import { householdRef } from "./firestore.js";

export const INVITE_LIFETIME_MS = 7 * DAY_MS;
export const INVITE_REUSE_MIN_REMAINING_MS = DAY_MS;

export async function createInvite() {
  if (activeInvites(state.invites, Date.now()).length >= MAX_ACTIVE_INVITES) throw new UserFacingError(`There can be at most ${MAX_ACTIVE_INVITES} active invite links. Cancel one first.`);
  const code = randomCode();
  const saved = setDoc(
    doc(householdRef(), "invites", code),
    inviteRecord({
      createdBy: requireUser().uid,
      createdByName: userName(),
      createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + INVITE_LIFETIME_MS),
    }),
  );
  return { code, saved };
}

export async function revokeInvite(inviteId) {
  await deleteDoc(doc(householdRef(), "invites", inviteId));
}
