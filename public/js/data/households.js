import { arrayRemove, arrayUnion, collection, deleteField, doc, getDoc, getDocs, serverTimestamp, updateDoc } from "../sdk.js";
import { errorCode } from "../errors.js";
import { millis } from "../format.js";
import { MAX_MEMBERS, nextOwner, parseInvite } from "../logic.js";
import { householdRecord, listRecord, memberInfoRecord } from "../records.js";
import { SELECTED_HOUSEHOLD_KEY, writeStorage } from "../storage.js";
import { requireUser, state, userName } from "../store.js";
import { DEFAULT_LIST_NAME, commitDeletes, firestore, householdRef, newBatch } from "./firestore.js";
import { chooseHousehold } from "./watch.js";

const OFFLINE_CODES = new Set(["unavailable", "deadline-exceeded"]);

function isOffline(error) {
  return OFFLINE_CODES.has(errorCode(error));
}

export async function createHousehold(name) {
  const uid = requireUser().uid;
  const ref = doc(collection(firestore(), "households"));
  writeStorage(SELECTED_HOUSEHOLD_KEY, ref.id);
  const batch = newBatch();
  batch.set(ref, householdRecord({ name, ownerId: uid, ownerName: userName(), createdAt: serverTimestamp() }));
  batch.set(doc(collection(ref, "lists")), listRecord({ name: DEFAULT_LIST_NAME, createdBy: uid, createdAt: serverTimestamp() }));
  await batch.commit();
}

export async function renameHousehold(householdId, name) {
  await updateDoc(householdRef(householdId), { name });
}

export async function saveSectionOrder(householdId, order) {
  await updateDoc(householdRef(householdId), { sectionOrder: order });
}

export async function changeMemberName(name) {
  const uid = requireUser().uid;
  const batch = newBatch();
  state.households.forEach((household) => batch.update(householdRef(household.id), { [`memberInfo.${uid}.name`]: name }));
  await batch.commit();
}

async function isMemberOf(ref) {
  try {
    await getDoc(ref);
    return true;
  } catch (error) {
    if (errorCode(error) === "permission-denied") return false;
    throw error;
  }
}

async function checkInvite(ref, code) {
  try {
    if (await isMemberOf(ref)) return "already-member";
    const inviteSnapshot = await getDoc(doc(ref, "invites", code));
    if (!inviteSnapshot.exists()) return "missing";
    if (millis(inviteSnapshot.data().expiresAt) <= Date.now()) return "expired";
    return "valid";
  } catch (error) {
    if (isOffline(error)) return "offline";
    if (errorCode(error) === "permission-denied") return "missing";
    throw error;
  }
}

export async function joinWithInvite(input) {
  const invite = parseInvite(input);
  if (!invite) return { result: "invalid", householdId: null };
  if (!state.online) return { result: "offline", householdId: null };
  const { householdId, code } = invite;
  const ref = householdRef(householdId);
  const check = await checkInvite(ref, code);
  if (check === "already-member") {
    chooseHousehold(householdId);
    return { result: "already-member", householdId };
  }
  if (check !== "valid") return { result: check, householdId: null };
  const uid = requireUser().uid;
  try {
    await updateDoc(ref, {
      members: arrayUnion(uid),
      [`memberInfo.${uid}`]: memberInfoRecord({ name: userName(), joinedAt: serverTimestamp(), invite: code }),
    });
  } catch (error) {
    if (errorCode(error) === "permission-denied") return { result: "full-or-expired", householdId: null };
    throw error;
  }
  chooseHousehold(householdId);
  return { result: "joined", householdId };
}

export async function leaveHousehold(household) {
  const uid = requireUser().uid;
  const newOwner = nextOwner(household, uid);
  await updateDoc(householdRef(household.id), {
    members: arrayRemove(uid),
    [`memberInfo.${uid}`]: deleteField(),
    ...(newOwner ? { ownerId: newOwner.uid } : {}),
  });
}

export async function deleteHousehold(household) {
  const ref = householdRef(household.id);
  const snapshots = await Promise.all(
    ["items", "purchases", "invites", "lists"].map((name) => getDocs(collection(ref, name))),
  );
  const refs = snapshots.flatMap((snapshot) => snapshot.docs.map((snap) => snap.ref));
  await commitDeletes([...refs, ref]);
}

export async function removeMember(household, memberUid) {
  const ref = householdRef(household.id);
  const batch = newBatch();
  batch.update(ref, { members: arrayRemove(memberUid), [`memberInfo.${memberUid}`]: deleteField() });
  state.invites.forEach((invite) => batch.delete(doc(ref, "invites", invite.id)));
  await batch.commit();
}

export function isHouseholdFull(household) {
  return household.members.length >= MAX_MEMBERS;
}
