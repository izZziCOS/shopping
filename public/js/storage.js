export const SELECTED_HOUSEHOLD_KEY = "shopping:selectedHousehold";
export const EMAIL_SIGN_IN_KEY = "shopping:emailSignIn";

export function selectedListKey(householdId) {
  return `shopping:selectedList:${householdId}`;
}

export function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key, value) {
  try {
    if (value === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  } catch {
    return;
  }
}

export function readJson(key) {
  try {
    return JSON.parse(readStorage(key) ?? "null");
  } catch {
    return null;
  }
}
