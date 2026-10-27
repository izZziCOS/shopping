import { NOT_BOUGHT, sectionOf } from "./logic.js";

export function memberInfoRecord({ name, joinedAt, invite }) {
  return { name, joinedAt, invite };
}

export function householdRecord({ name, ownerId, ownerName, createdAt }) {
  return {
    name,
    ownerId,
    members: [ownerId],
    memberInfo: { [ownerId]: memberInfoRecord({ name: ownerName, joinedAt: createdAt, invite: null }) },
    createdAt,
  };
}

export function listRecord({ name, createdBy, createdAt }) {
  return { name, createdBy, createdAt };
}

export function itemRecord({ listId, name, quantity, section, addedBy, addedByName, createdAt }) {
  return {
    listId,
    name,
    quantity,
    note: "",
    section,
    ...NOT_BOUGHT,
    addedBy,
    addedByName,
    createdAt,
  };
}

export function readdedItemChanges({ quantity, addedBy, addedByName, createdAt }) {
  return { ...NOT_BOUGHT, quantity, addedBy, addedByName, createdAt };
}

export function boughtItemChanges({ boughtAt, boughtBy, boughtByName, purchaseId }) {
  return { bought: true, boughtAt, boughtBy, boughtByName, purchaseId };
}

export function purchaseRecord({ item, boughtAt, boughtBy, boughtByName, expireAt }) {
  return {
    itemId: item.id,
    listId: item.listId,
    name: item.name,
    quantity: item.quantity,
    section: sectionOf(item),
    boughtAt,
    boughtBy,
    boughtByName,
    expireAt,
  };
}

export function inviteRecord({ createdBy, createdByName, createdAt, expiresAt }) {
  return { createdBy, createdByName, createdAt, expiresAt };
}
