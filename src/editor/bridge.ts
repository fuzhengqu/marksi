import type { EditorCommand } from "./format";

export const EDITOR_COMMAND_EVENT = "marksi:editor-command";
export const EDITOR_SEARCH_EVENT = "marksi:editor-search";
export const EDITOR_INSERT_EVENT = "marksi:editor-insert";
export const EDITOR_PASTE_IMAGE_EVENT = "marksi:editor-paste-image";
export const EDITOR_IMAGE_RESIZE_EVENT = "marksi:editor-image-resize";

export interface EditorInsertRequest {
  text: string;
  block?: boolean;
}

export interface EditorImageResizeRequest {
  imageIndex: number;
  width: number;
  alt: string;
}

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

export function dispatchEditorInsert(text: string, block = false): void {
  window.dispatchEvent(
    new CustomEvent<EditorInsertRequest>(EDITOR_INSERT_EVENT, {
      detail: { text, block },
    }),
  );
}

export function dispatchEditorImageResize(
  request: EditorImageResizeRequest,
): void {
  window.dispatchEvent(
    new CustomEvent<EditorImageResizeRequest>(EDITOR_IMAGE_RESIZE_EVENT, {
      detail: request,
    }),
  );
}
