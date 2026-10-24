export const SHORTCUT_GROUPS = [
  "File",
  "View",
  "Editing",
  "Writing",
] as const;

export type ShortcutGroup = (typeof SHORTCUT_GROUPS)[number];

export const SHORTCUT_DEFINITIONS = [
  { id: "new", label: "New document", group: "File", defaultBinding: "Ctrl+N" },
  { id: "open", label: "Open file", group: "File", defaultBinding: "Ctrl+O" },
  {
    id: "openFolder",
    label: "Open folder",
    group: "File",
    defaultBinding: "Ctrl+Shift+O",
  },
  { id: "save", label: "Save", group: "File", defaultBinding: "Ctrl+S" },
  {
    id: "saveAs",
    label: "Save as",
    group: "File",
    defaultBinding: "Ctrl+Shift+S",
  },
  {
    id: "quickOpen",
    label: "Quick open",
    group: "File",
    defaultBinding: "Ctrl+P",
  },
  {
    id: "searchWorkspace",
    label: "Search in folder",
    group: "File",
    defaultBinding: "Ctrl+Shift+F",
  },
  {
    id: "insertImage",
    label: "Insert image",
    group: "Editing",
    defaultBinding: "Ctrl+Shift+I",
  },
  {
    id: "find",
    label: "Find in document",
    group: "Editing",
    defaultBinding: "Ctrl+F",
  },
  {
    id: "replace",
    label: "Replace in document",
    group: "Editing",
    defaultBinding: "Ctrl+H",
  },
  {
    id: "copyMarkdown",
    label: "Copy as Markdown",
    group: "Editing",
    defaultBinding: "Ctrl+Alt+C",
  },
  {
    id: "copyHtml",
    label: "Copy as HTML",
    group: "Editing",
    defaultBinding: "Ctrl+Alt+H",
  },
  {
    id: "copyText",
    label: "Copy as plain text",
    group: "Editing",
    defaultBinding: "Ctrl+Alt+P",
  },
  {
    id: "toggleSidebar",
    label: "Toggle sidebar",
    group: "View",
    defaultBinding: "Ctrl+Shift+B",
  },
  {
    id: "toggleView",
    label: "Toggle source and preview",
    group: "View",
    defaultBinding: "Ctrl+/",
  },
  {
    id: "zoomIn",
    label: "Zoom in",
    group: "View",
    defaultBinding: "Ctrl+=",
  },
  {
    id: "zoomOut",
    label: "Zoom out",
    group: "View",
    defaultBinding: "Ctrl+-",
  },
  {
    id: "zoomReset",
    label: "Reset zoom",
    group: "View",
    defaultBinding: "Ctrl+0",
  },
  {
    id: "settings",
    label: "Preferences",
    group: "View",
    defaultBinding: "Ctrl+,",
  },
  {
    id: "focusMode",
    label: "Focus mode",
    group: "Writing",
    defaultBinding: "Ctrl+Alt+F",
  },
  {
    id: "typewriterMode",
    label: "Typewriter mode",
    group: "Writing",
    defaultBinding: "Ctrl+Alt+T",
  },
  {
    id: "readOnly",
    label: "Read-only mode",
    group: "Writing",
    defaultBinding: "Ctrl+Alt+R",
  },
] as const;

export type ShortcutId = (typeof SHORTCUT_DEFINITIONS)[number]["id"];

export type ShortcutMap = Record<ShortcutId, string>;

export const DEFAULT_SHORTCUTS: ShortcutMap = Object.fromEntries(
  SHORTCUT_DEFINITIONS.map((definition) => [
    definition.id,
    definition.defaultBinding,
  ]),
) as ShortcutMap;

export interface ShortcutKeyEvent {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}

function normalizeKey(key: string): string | null {
  if (key === " " || key === "Spacebar") {
    return "Space";
  }
  if (key === "+") {
    return "=";
  }
  if (key.length === 1) {
    return key.toUpperCase();
  }
  if (/^F\d{1,2}$/i.test(key)) {
    return key.toUpperCase();
  }
  return null;
}

export function eventToShortcut(
  event: ShortcutKeyEvent,
): string | null {
  if (!event.ctrlKey && !event.metaKey) {
    return null;
  }
  const key = normalizeKey(event.key);
  if (!key) {
    return null;
  }
  const parts = ["Ctrl"];
  if (event.altKey) {
    parts.push("Alt");
  }
  if (event.shiftKey && key !== "=") {
    parts.push("Shift");
  }
  parts.push(key);
  return parts.join("+");
}

export function isValidBinding(binding: string): boolean {
  if (!binding) {
    return true;
  }
  const parts = binding.split("+");
  if (parts[0] !== "Ctrl" || parts.length < 2) {
    return false;
  }
  const key = parts[parts.length - 1];
  if (!key || key === "Ctrl" || key === "Alt" || key === "Shift") {
    return false;
  }
  const modifiers = parts.slice(1, -1);
  return (
    modifiers.every((part) => part === "Alt" || part === "Shift") &&
    new Set(modifiers).size === modifiers.length
  );
}

export function normalizeShortcuts(value: unknown): ShortcutMap {
  const source =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const result = {} as ShortcutMap;
  const used = new Set<string>();
  for (const definition of SHORTCUT_DEFINITIONS) {
    const candidate = source[definition.id];
    let binding =
      typeof candidate === "string" && isValidBinding(candidate)
        ? candidate
        : definition.defaultBinding;
    if (binding && used.has(binding)) {
      binding = "";
    }
    if (binding) {
      used.add(binding);
    }
    result[definition.id] = binding;
  }
  return result;
}

export function conflictLabel(
  shortcuts: ShortcutMap,
  id: ShortcutId,
  binding: string,
): string | null {
  if (!binding) {
    return null;
  }
  const conflict = SHORTCUT_DEFINITIONS.find(
    (definition) =>
      definition.id !== id && shortcuts[definition.id] === binding,
  );
  return conflict?.label ?? null;
}

export function shortcutForEvent(
  shortcuts: ShortcutMap,
  event: ShortcutKeyEvent,
): ShortcutId | null {
  const binding = eventToShortcut(event);
  if (!binding) {
    return null;
  }
  return (
    SHORTCUT_DEFINITIONS.find(
      (definition) => shortcuts[definition.id] === binding,
    )?.id ?? null
  );
}
