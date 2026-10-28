import { addItems } from "../data/items.js";
import { MAX_ITEM_NAME_LENGTH, limitMessage, summarizeAdds } from "../logic.js";
import { showError, toast } from "../toast.js";

// Each entry is { name, quantity }.
export async function submitItems(entries) {
  const valid = entries.filter((entry) => entry.name.length <= MAX_ITEM_NAME_LENGTH);
  const tooLong = entries.length - valid.length;
  if (valid.length === 0) {
    toast(`Item names can be at most ${MAX_ITEM_NAME_LENGTH} characters.`);
    return;
  }
  try {
    const { results, dropped, reason, saved } = await addItems(valid);
    saved.catch((error) => showError(error));
    const messages = [
      summarizeAdds(results),
      limitMessage(dropped, reason),
      tooLong > 0 ? `${tooLong} skipped for being longer than ${MAX_ITEM_NAME_LENGTH} characters` : "",
    ].filter(Boolean);
    if (messages.length > 0) toast(messages.join(". "));
  } catch (error) {
    showError(error);
  }
}
