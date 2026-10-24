# Security policy

## Reporting a vulnerability

Please report security issues privately through
[GitHub Security Advisories](https://github.com/fuzhengqu/marksi/security/advisories/new).
Do not disclose sensitive details in a public issue or pull request.

Please include:

- The affected version and platform
- A description of the impact
- Steps to reproduce
- Any relevant logs or proof-of-concept details, with secrets removed

Reports will be acknowledged as soon as practical. Please allow time for a fix
and coordinated disclosure before publishing details.

## Scope

MarkSI is a local-first desktop editor. Security-sensitive areas include file
path validation, image import and data-URL handling, Markdown sanitization,
external link handling, custom export command execution, custom CSS themes, and
the Tauri capability configuration. Custom export and optional Pandoc export/import are
opt-in external-process features: only configure executables that you trust.
Pandoc is not bundled and may fetch remote resources referenced by the document.
Remote image caching is also opt-in and off by default; it validates schemes,
credentials, hosts, private addresses, response size, and image type, does not
follow redirects, and never uploads images. Local history snapshots are stored
as plaintext in the application data folder, capped and never uploaded; protect
access to your user profile accordingly. Custom CSS themes are local-only files
from the app data themes folder. MarkSI removes remote imports and URL loads
before applying them, but this is a best-effort filter rather than a CSS
sandbox; only install theme files that you trust.

## Supported versions

Security fixes target the latest published source version. Older source
snapshots may not receive backports.
