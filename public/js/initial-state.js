export function initialState() {
  return {
    user: null,
    households: [],
    householdsLoaded: false,
    householdId: null,
    lists: [],
    listsLoaded: false,
    listId: null,
    items: [],
    purchases: [],
    invites: [],
    pending: {},
    pendingSince: null,
    online: navigator.onLine,
    hiddenItemIds: new Set(),
    panel: null,
    editingItemId: null,
    pendingInvite: null,
  };
}
