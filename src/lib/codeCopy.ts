import { copyText } from "./clipboardText";

export type CodeCopyHandler = (text: string) => Promise<void>;

const systemHandler: CodeCopyHandler = copyText;
let handler: CodeCopyHandler = systemHandler;

/** Copies fenced-code text through the current handler. */
export function copyCodeText(text: string): Promise<void> {
  return handler(text);
}

/**
 * Replaces the clipboard writer for controlled tests. Passing `null` restores
 * the system clipboard path; the development hook is the only caller.
 */
export function setCodeCopyHandler(next: CodeCopyHandler | null): void {
  handler = next ?? systemHandler;
}
