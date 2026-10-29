import { UNDO_DELAY_MS } from "../logic.js";
import { reportError } from "./firestore.js";

const pendingRemovals = new Set();

// Hides something straight away but only deletes it once the undo window has passed (or the page is hidden).
// Returns the undo function, which does nothing once the delete has started. If the delete fails, the thing is
// shown again.
export function removeAfterUndoWindow({ hide, show, remove }) {
  const removal = {
    commit() {
      if (!pendingRemovals.delete(removal)) return;
      clearTimeout(timer);
      remove().catch((error) => {
        show();
        reportError(error);
      });
    },
    undo() {
      if (!pendingRemovals.delete(removal)) return;
      clearTimeout(timer);
      show();
    },
  };
  hide();
  const timer = setTimeout(removal.commit, UNDO_DELAY_MS);
  pendingRemovals.add(removal);
  return removal.undo;
}

export function flushPendingRemovals() {
  const hadRemovals = pendingRemovals.size > 0;
  [...pendingRemovals].forEach((removal) => removal.commit());
  return hadRemovals;
}
