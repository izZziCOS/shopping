import { addItems } from "../data/items.js";
import { MAX_ITEM_NAME_LENGTH, limitMessage, summarizeAdds } from "../logic.js";
import { showError, toast } from "../toast.js";

export async function submitItems(names, quantity) {
  const valid = names.filter((name) => name.length <= MAX_ITEM_NAME_LENGTH);
  const tooLong = names.length - valid.length;
  if (valid.length === 0) {
    toast(`Item names can be at most ${MAX_ITEM_NAME_LENGTH} characters.`);
    return;
  }
  try {
    const { results, dropped, reason, saved } = await addItems(valid, valid.length === 1 ? quantity : "");
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
