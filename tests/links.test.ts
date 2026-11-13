import { describe, expect, it } from "vitest";
import {
  classifyLinkTarget,
  normalizeReferenceLabel,
  resolveLocalLinkPath,
} from "../src/lib/links";

describe("classifyLinkTarget", () => {
  it("opens http, https, and mailto links externally", () => {
    expect(classifyLinkTarget("https://example.com")).toEqual({
      kind: "external",
      url: "https://example.com",
    });
    expect(classifyLinkTarget(" HTTPS://example.com/path ")).toEqual({
      kind: "external",
      url: "HTTPS://example.com/path",
    });
    expect(classifyLinkTarget("mailto:hello@example.com")).toEqual({
      kind: "external",
      url: "mailto:hello@example.com",
    });
  });

  it("keeps fragment links inside the document", () => {
    expect(classifyLinkTarget("#Section%20One")).toEqual({
      kind: "anchor",
      id: "Section One",
    });
    expect(classifyLinkTarget("#%E0%A4%A")).toEqual({
      kind: "anchor",
      id: "#%E0%A4%A".slice(1),
    });
  });

  it("classifies relative paths as local", () => {
    expect(classifyLinkTarget("notes/other.md")).toEqual({
      kind: "local",
      href: "notes/other.md",
    });
    expect(classifyLinkTarget("./image.png")).toEqual({
      kind: "local",
      href: "./image.png",
    });
  });

  it("rejects other schemes instead of handing them to the OS", () => {
    for (const href of [
      "javascript:alert(1)",
      "data:text/html,hello",
      "file:///C:/secret.txt",
      "ftp://example.com/file",
      "vbscript:msgbox(1)",
    ]) {
      expect(classifyLinkTarget(href).kind).toBe("unsupported");
    }
  });
});

describe("normalizeReferenceLabel", () => {
  it("matches bracketed, empty-bracket, and case variants", () => {
    expect(normalizeReferenceLabel("[Docs]")).toBe("docs");
    expect(normalizeReferenceLabel("[docs][]")).toBe("docs");
    expect(normalizeReferenceLabel("  My   Label ")).toBe("my label");
  });
});

describe("resolveLocalLinkPath", () => {
  const documentPath = "C:\\Docs\\index.md";

  it("resolves relative Markdown and text links", () => {
    expect(resolveLocalLinkPath("other.md", documentPath)).toBe(
      "C:/Docs/other.md",
    );
    expect(resolveLocalLinkPath("../notes/other.markdown", documentPath)).toBe(
      "C:/Docs/../notes/other.markdown",
    );
    expect(resolveLocalLinkPath("notes/nested.txt", documentPath)).toBe(
      "C:/Docs/notes/nested.txt",
    );
  });

  it("decodes percent escapes and ignores fragments and queries", () => {
    expect(resolveLocalLinkPath("notes%20one.md#section", documentPath)).toBe(
      "C:/Docs/notes one.md",
    );
    expect(resolveLocalLinkPath("other.txt?raw=1", documentPath)).toBe(
      "C:/Docs/other.txt",
    );
  });

  it("rejects unsaved documents, absolute paths, and unsupported files", () => {
    expect(resolveLocalLinkPath("other.md", null)).toBeNull();
    expect(resolveLocalLinkPath("/etc/passwd.md", documentPath)).toBeNull();
    expect(resolveLocalLinkPath("C:\\Windows\\note.md", documentPath)).toBeNull();
    expect(resolveLocalLinkPath("image.png", documentPath)).toBeNull();
    expect(resolveLocalLinkPath("README", documentPath)).toBeNull();
    expect(resolveLocalLinkPath("javascript:alert(1)", documentPath)).toBeNull();
  });
});
