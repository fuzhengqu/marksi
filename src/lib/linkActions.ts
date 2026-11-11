import { openExternal } from "./platform";

export type ExternalLinkHandler = (url: string) => Promise<void>;

const systemHandler: ExternalLinkHandler = openExternal;
let handler: ExternalLinkHandler = systemHandler;

/** Opens an external link through the current handler. */
export function openExternalLink(url: string): Promise<void> {
  return handler(url);
}

/**
 * Replaces the external opener for controlled tests. Passing `null` restores
 * the system opener; the development hook is the only caller.
 */
export function setExternalLinkHandler(
  next: ExternalLinkHandler | null,
): void {
  handler = next ?? systemHandler;
}
