import {
  classifyImageSource,
  resolveImageRootUrl,
  resolveLocalImagePath,
  resolveRootImagePath,
} from "./images";
import {
  isTauri,
  readImageDataUrl,
  remoteImageDataUrl,
} from "./platform";

export interface ImageLoadOptions {
  baseDirectory: string | null;
  rootDirectory: string | null;
  rootUrl: string | null;
  loadRemote: boolean;
}

export interface LoadedImage {
  source: string;
  path: string;
  remote: boolean;
}

const imageCache = new Map<string, Promise<string>>();

export function clearImageCache(): void {
  imageCache.clear();
}

export function loadCachedImage(path: string): Promise<string> {
  let request = imageCache.get(path);
  if (!request) {
    request = readImageDataUrl(path);
    imageCache.set(path, request);
    void request.catch(() => imageCache.delete(path));
  }
  return request;
}

function uniqueCandidates(candidates: Array<string | null>): string[] {
  return [
    ...new Set(
      candidates.filter((value): value is string => Boolean(value)),
    ),
  ];
}

/**
 * Resolves and loads a Markdown image without starting a network request unless
 * the caller has explicitly enabled remote loading. Local images use the
 * document-relative path first, then the optional image root.
 */
export async function loadImageSource(
  raw: string,
  options: ImageLoadOptions,
): Promise<LoadedImage> {
  const source = classifyImageSource(raw);
  if (source.kind === "data") {
    return { source: source.value, path: source.value, remote: false };
  }
  if (source.kind === "remote") {
    if (!options.loadRemote) {
      throw new Error("Remote image loading is disabled.");
    }
    return {
      source: await remoteImageDataUrl(source.value),
      path: source.value,
      remote: true,
    };
  }
  if (source.kind === "unsafe" || !source.value) {
    throw new Error(`Unsupported image source: ${raw || "(empty)"}`);
  }
  if (!isTauri()) {
    throw new Error("Local images are available in the desktop app.");
  }

  const candidates = imagePathCandidates(
    raw,
    options.baseDirectory,
    options.rootDirectory,
  );

  let lastError: unknown = new Error(raw);
  for (const path of candidates) {
    try {
      return {
        source: await loadCachedImage(path),
        path,
        remote: false,
      };
    } catch (error) {
      lastError = error;
    }
  }

  const remote = options.loadRemote
    ? resolveImageRootUrl(options.rootUrl ?? "", raw)
    : null;
  if (remote) {
    return {
      source: await remoteImageDataUrl(remote),
      path: remote,
      remote: true,
    };
  }

  throw lastError ?? new Error(raw);
}

/**
 * Candidate paths for diagnostics and tests. Kept separate so the loader and
 * the preview placeholder describe the same search order.
 */
export function imagePathCandidates(
  raw: string,
  baseDirectory: string | null,
  rootDirectory: string | null,
): string[] {
  const primary = resolveLocalImagePath(raw, baseDirectory);
  const root = resolveRootImagePath(raw, rootDirectory);
  const rootFirst = /^[/\\]/.test(raw.trim());
  return uniqueCandidates(rootFirst ? [root, primary] : [primary, root]);
}
