import { describe, expect, it } from "vitest";
import {
  buildLicenseCatalog,
  copyrightLines,
  detectLicenseIds,
  isCopyrightNotice,
  licenseBody,
  licenseComponents,
  normalizeLicenseExpression,
  parseCargoTree,
  renderNotices,
} from "../scripts/notices.mjs";

const MIT_TEXT = `MIT License

Copyright (c) 2024 Example Authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction.
`;

const APACHE_TEXT = `Apache License
Version 2.0, January 2004

"Licensor" shall mean the copyright owner or entity authorized by
the copyright owner that is granting the License.

2. Grant of Copyright License. Subject to the terms and conditions of
this License, each Contributor hereby grants to You a perpetual license.

Copyright [yyyy] [name of copyright owner]
`;

describe("third-party notice helpers", () => {
  it("normalizes legacy license separators", () => {
    expect(normalizeLicenseExpression("(MPL-2.0 OR Apache-2.0)")).toBe(
      "MPL-2.0 OR Apache-2.0",
    );
    expect(licenseComponents("MIT/Apache-2.0")).toEqual([
      "MIT",
      "Apache-2.0",
    ]);
    expect(licenseComponents("(Apache-2.0 OR MIT) AND BSD-3-Clause")).toEqual([
      "Apache-2.0",
      "MIT",
      "BSD-3-Clause",
    ]);
  });

  it("extracts only real copyright notices", () => {
    expect(copyrightLines(MIT_TEXT)).toEqual([
      "Copyright (c) 2024 Example Authors",
    ]);
    expect(copyrightLines(APACHE_TEXT)).toEqual([]);
    expect(
      isCopyrightNotice("(c) 2020 Some Holder"),
    ).toBe(true);
    expect(isCopyrightNotice("(c) You must retain the notice")).toBe(false);
    expect(isCopyrightNotice("copyright notice that is included")).toBe(false);
    expect(isCopyrightNotice("Copyright [yyyy] [name of copyright owner]")).toBe(
      false,
    );
  });

  it("removes the notice but keeps the license body intact", () => {
    const mit = licenseBody(MIT_TEXT);
    expect(mit).not.toContain("Copyright (c) 2024");
    expect(mit).toContain("Permission is hereby granted");

    const apache = licenseBody(APACHE_TEXT);
    expect(apache).toContain("copyright owner or entity authorized by");
    expect(apache).toContain("Grant of Copyright License");
    expect(apache).toContain("Copyright [yyyy] [name of copyright owner]");
    expect(licenseBody("line with spaces  \nnext\t\n")).toBe(
      "line with spaces\nnext",
    );
  });

  it("detects common license families", () => {
    expect(detectLicenseIds(MIT_TEXT)).toEqual(["MIT"]);
    expect(detectLicenseIds(APACHE_TEXT)).toEqual(["Apache-2.0"]);
    expect(
      detectLicenseIds(
        "Redistribution and use in source and binary forms, with or without modification, are permitted. Neither the name of the copyright holder nor the names of its contributors may be used.",
      ),
    ).toEqual(["BSD-3-Clause"]);
  });

  it("deduplicates shared license bodies", () => {
    const packages = [
      {
        ecosystem: "npm",
        name: "alpha",
        version: "1.0.0",
        license: "MIT",
        texts: [{ file: "LICENSE", text: MIT_TEXT }],
      },
      {
        ecosystem: "npm",
        name: "beta",
        version: "2.0.0",
        license: "MIT",
        texts: [
          {
            file: "LICENSE",
            text: MIT_TEXT.replace("Example Authors", "Beta Authors"),
          },
        ],
      },
      {
        ecosystem: "cargo",
        name: "gamma",
        version: "3.0.0",
        license: "Apache-2.0",
        texts: [{ file: "LICENSE", text: APACHE_TEXT }],
      },
    ];
    const catalog = buildLicenseCatalog(packages);
    expect(catalog).toHaveLength(2);
    expect(packages[0].licenseIds).toEqual(packages[1].licenseIds);
    expect(packages[0].copyrights).toEqual([
      "Copyright (c) 2024 Example Authors",
    ]);
    expect(packages[1].copyrights).toEqual([
      "Copyright (c) 2024 Beta Authors",
    ]);
    expect(packages[2].licenseIds).toHaveLength(1);
  });

  it("parses cargo tree output deterministically", () => {
    const parsed = parseCargoTree(
      [
        "marksi v0.35.0 (D:\\workspace\\src-tauri)|MIT",
        "serde v1.0.0|MIT OR Apache-2.0",
        "serde v1.0.0|MIT OR Apache-2.0",
        "windows-sys v0.59.0|MIT OR Apache-2.0",
      ].join("\n"),
    );
    expect(parsed).toEqual([
      { name: "serde", version: "1.0.0", license: "MIT OR Apache-2.0" },
      {
        name: "windows-sys",
        version: "0.59.0",
        license: "MIT OR Apache-2.0",
      },
    ]);
  });

  it("renders package tables, license texts, and missing files", () => {
    const packages = [
      {
        ecosystem: "npm",
        name: "alpha",
        version: "1.0.0",
        license: "MIT",
        texts: [{ file: "LICENSE", text: MIT_TEXT }],
      },
      {
        ecosystem: "cargo",
        name: "missing",
        version: "0.1.0",
        license: "UNKNOWN",
        texts: [],
      },
    ];
    const licenses = buildLicenseCatalog(packages);
    const text = renderNotices({
      target: "x86_64-pc-windows-msvc",
      npm: [packages[0]],
      rust: [packages[1]],
      licenses,
      version: "0.35.0",
    });
    expect(text).toContain("# Third-party notices");
    expect(text).toContain("npm production packages: 1");
    expect(text).toContain("Rust crates for this target: 1");
    expect(text).toContain("| alpha | 1.0.0 | MIT |");
    expect(text).toContain("Permission is hereby granted");
    expect(text).toContain("Packages without a cached license file");
    expect(text).toContain("cargo missing@0.1.0 (UNKNOWN)");
  });
});
