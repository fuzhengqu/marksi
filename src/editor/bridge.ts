import type { EditorCommand } from "./format";

export const EDITOR_COMMAND_EVENT = "marksi:editor-command";
export const EDITOR_SEARCH_EVENT = "marksi:editor-search";

export function dispatchEditorCommand(command: EditorCommand): void {
  window.dispatchEvent(
    new CustomEvent<EditorCommand>(EDITOR_COMMAND_EVENT, { detail: command }),
  );
}

export function dispatchEditorSearch(replace: boolean): void {
  window.dispatchEvent(
    new CustomEvent<boolean>(EDITOR_SEARCH_EVENT, { detail: replace }),
  );
}
