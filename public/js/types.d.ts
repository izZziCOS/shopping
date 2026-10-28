import type { User } from "firebase/auth";
import type { Timestamp } from "firebase/firestore";

export interface MemberInfo {
  name: string;
  joinedAt: Timestamp;
  invite: string | null;
}

export interface Household {
  id: string;
  name: string;
  ownerId: string;
  members: string[];
  memberInfo: Record<string, MemberInfo>;
  sectionOrder?: string[];
  createdAt: Timestamp;
  pending: boolean;
}

export interface ShoppingList {
  id: string;
  name: string;
  createdBy: string;
  createdAt: Timestamp;
  pending: boolean;
}

export interface Item {
  id: string;
  listId: string;
  name: string;
  quantity: string;
  note: string;
  section: string;
  bought: boolean;
  boughtAt: Timestamp | null;
  boughtBy: string | null;
  boughtByName: string | null;
  purchaseId: string | null;
  addedBy: string;
  addedByName: string;
  createdAt: Timestamp;
  order?: number | null;
  pending: boolean;
}

export interface Purchase {
  id: string;
  itemId: string;
  listId: string;
  name: string;
  quantity: string;
  section: string;
  boughtAt: Timestamp;
  boughtBy: string;
  boughtByName: string;
  expireAt: Timestamp;
  pending: boolean;
}

export interface Invite {
  id: string;
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  pending: boolean;
}

export type Panel = "households" | "history" | null;

export interface AppState {
  user: User | null;
  households: Household[];
  householdsLoaded: boolean;
  householdId: string | null;
  lists: ShoppingList[];
  listsLoaded: boolean;
  listId: string | null;
  items: Item[];
  purchases: Purchase[];
  invites: Invite[];
  pending: Record<string, number>;
  pendingSince: number | null;
  online: boolean;
  hiddenItemIds: Set<string>;
  panel: Panel;
  editingItemId: string | null;
  pendingInvite: string | null;
}
