export function byId(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node;
}

export function inputById(id) {
  const node = byId(id);
  if (!(node instanceof HTMLInputElement)) throw new Error(`#${id} is not an input`);
  return node;
}

export function textAreaById(id) {
  const node = byId(id);
  if (!(node instanceof HTMLTextAreaElement)) throw new Error(`#${id} is not a textarea`);
  return node;
}

export function selectById(id) {
  const node = byId(id);
  if (!(node instanceof HTMLSelectElement)) throw new Error(`#${id} is not a select`);
  return node;
}

export function buttonById(id) {
  const node = byId(id);
  if (!(node instanceof HTMLButtonElement)) throw new Error(`#${id} is not a button`);
  return node;
}

export function formById(id) {
  const node = byId(id);
  if (!(node instanceof HTMLFormElement)) throw new Error(`#${id} is not a form`);
  return node;
}

export function dialogById(id) {
  const node = byId(id);
  if (!(node instanceof HTMLDialogElement)) throw new Error(`#${id} is not a dialog`);
  return node;
}

export function element(tag, className = "", text = "") {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

export function textButton(text, className, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = text;
  button.addEventListener("click", onClick);
  return button;
}

export function iconButton(symbol, label, onClick) {
  const button = textButton(symbol, "icon-button", onClick);
  button.setAttribute("aria-label", label);
  return button;
}

export function option(value, label) {
  const node = document.createElement("option");
  node.value = value;
  node.textContent = label;
  return node;
}

export async function runBusy(controls, task) {
  if (controls.some((control) => control.dataset.busy === "true")) return;
  for (const control of controls) {
    control.dataset.busy = "true";
    control.setAttribute("aria-busy", "true");
    if (control instanceof HTMLButtonElement) control.disabled = true;
  }
  try {
    await task();
  } finally {
    for (const control of controls) {
      delete control.dataset.busy;
      control.removeAttribute("aria-busy");
      if (control instanceof HTMLButtonElement) control.disabled = false;
    }
  }
}

export function onSubmit(formId, handler) {
  const form = formById(formId);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const buttons = [...form.querySelectorAll("button")].filter((button) => button instanceof HTMLButtonElement);
    runBusy([form, ...buttons], () => handler(form, event));
  });
}

export function onClick(buttonId, handler) {
  const button = byId(buttonId);
  button.addEventListener("click", (event) => runBusy([button], () => handler(event)));
}

export function syncChildren(container, entries) {
  const existing = new Map();
  for (const child of container.children) {
    if (child instanceof HTMLElement && child.dataset.key) existing.set(child.dataset.key, child);
  }
  const nodes = entries.map(({ key, signature, build }) => {
    const current = existing.get(key);
    if (current && current.dataset.signature === signature) return current;
    const node = build();
    node.dataset.key = key;
    node.dataset.signature = signature;
    return node;
  });
  nodes.forEach((node, index) => {
    if (container.children[index] !== node) {
      container.insertBefore(node, container.children[index] ?? null);
    }
  });
  while (container.children.length > nodes.length) {
    container.lastElementChild?.remove();
  }
}
