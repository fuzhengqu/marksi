# MarkSI engineering rules

These rules are mandatory for every change in this repository.

## Verification gate

Do not mark a feature complete and do not begin the next feature until all of
the following pass:

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e
cargo fmt --check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
```

`npm run test:e2e` drives the real Tauri WebView over CDP. Start the dev app with
remote debugging first:

```powershell
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=9222"
npm run tauri:dev
```

Then run the E2E gate with matching origin/port variables if they differ from
the defaults:

```powershell
$env:MARKSI_E2E_ORIGIN = "localhost:1420"
$env:MARKSI_CDP_PORT = "9222"
npm run test:e2e
```

## Required practice

- Add unit tests for every new pure function or parser change.
- Add Rust tests for every new filesystem, encoding, image, or workspace path.
- Add an E2E check for every user-visible flow touched by the change.
- Reproduce each fixed bug with an automated regression check first when
  possible.
- Run the entire gate, not only the focused test.
- Reset the app to a clean state after runtime testing.
- Verify that user documents were not modified when the task touched files.
- Record native-dialog and OS-level limitations in
  `docs/verification.md`; do not claim those paths are automated when they are
  not.

No finite suite can prove mathematical zero-defect status. The delivery
standard is zero known reproducible failures in the automated gate, plus the
documented native-dialog checks before a release.

See `docs/verification.md` for the full coverage matrix and limitations.
