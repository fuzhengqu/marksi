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
external link handling, custom export command execution, and the Tauri
capability configuration. Custom export is opt-in local code execution: only
configure executables and arguments that you trust.

## Supported versions

Security fixes target the latest published source version. Older source
snapshots may not receive backports.
