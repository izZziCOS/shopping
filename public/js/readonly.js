const MUTATING_METHODS = new Set([
  "add",
  "clear",
  "copyWithin",
  "delete",
  "fill",
  "pop",
  "push",
  "reverse",
  "set",
  "shift",
  "sort",
  "splice",
  "unshift",
]);

const views = new WeakMap();

export class ReadOnlyStateError extends TypeError {
  constructor(property) {
    super(`App state is read-only outside store.js (tried to change "${String(property)}"). Use an action from store.js.`);
    this.name = "ReadOnlyStateError";
  }
}

function refuse(property) {
  return () => {
    throw new ReadOnlyStateError(property);
  };
}

function isCollection(value) {
  return Array.isArray(value) || value instanceof Set || value instanceof Map;
}

export function readOnly(value) {
  if (typeof value !== "object" || value === null) return value;
  const existing = views.get(value);
  if (existing) return existing;
  const view = new Proxy(value, {
    get(target, property) {
      const result = Reflect.get(target, property, target);
      const descriptor = Reflect.getOwnPropertyDescriptor(target, property);
      if (descriptor && !descriptor.configurable && !descriptor.writable && "value" in descriptor) return result;
      if (typeof result !== "function") return readOnly(result);
      if (isCollection(target) && MUTATING_METHODS.has(String(property))) return refuse(property);
      return Array.isArray(target) ? result : result.bind(target);
    },
    set(target, property) {
      throw new ReadOnlyStateError(property);
    },
    defineProperty(target, property) {
      throw new ReadOnlyStateError(property);
    },
    deleteProperty(target, property) {
      throw new ReadOnlyStateError(property);
    },
    setPrototypeOf() {
      throw new ReadOnlyStateError("prototype");
    },
  });
  views.set(value, view);
  return view;
}
