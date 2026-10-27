import { showCopyableText } from "../dialogs.js";
import { listAsText } from "../logic.js";
import { currentHousehold, currentList, listItems } from "../store.js";
import { toast } from "../toast.js";

function isCancelled(error) {
  return error instanceof DOMException && error.name === "AbortError";
}

export async function shareText({ title, text, url = "", copiedMessage, dialogTitle, dialogMessage }) {
  if (navigator.share) {
    try {
      await navigator.share(url ? { title, text, url } : { title, text });
      return;
    } catch (error) {
      if (isCancelled(error)) return;
    }
  }
  const value = url || text;
  try {
    await navigator.clipboard.writeText(value);
    toast(copiedMessage);
  } catch {
    await showCopyableText({ title: dialogTitle, message: dialogMessage, value });
  }
}

export async function shareCurrentList() {
  const household = currentHousehold();
  const list = currentList();
  if (!household || !list) return;
  const text = listAsText({
    listName: list.name,
    householdName: household.name,
    items: listItems().filter((item) => !item.bought),
    savedOrder: household.sectionOrder,
  });
  await shareText({
    title: list.name,
    text,
    copiedMessage: "List copied. Paste it into any chat.",
    dialogTitle: `Share "${list.name}"`,
    dialogMessage: "Copy this text and paste it into a message.",
  });
}
