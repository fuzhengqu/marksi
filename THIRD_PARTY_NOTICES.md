# Third-party notices

MarkSI is MIT licensed. It depends on the following open-source projects; their
licenses remain in effect.

## Application dependencies

| Project | License |
|---|---|
| Tauri and official Tauri plugins | Apache-2.0 OR MIT |
| React and React DOM | MIT |
| Zustand | MIT |
| CodeMirror 6 packages | MIT |
| Lezer packages | MIT |
| Lucide icons | ISC |
| encoding_rs | Apache-2.0 OR MIT |
| chardetng | Apache-2.0 OR MIT |
| serde | Apache-2.0 OR MIT |
| tempfile | Apache-2.0 OR MIT |
| dunce | Apache-2.0 OR MIT |
| windows-sys | Apache-2.0 OR MIT |

## Build and test tooling

| Project | License |
|---|---|
| Vite | MIT |
| TypeScript | Apache-2.0 |
| Vitest | MIT |
| Tauri CLI | Apache-2.0 OR MIT |

The complete dependency tree and exact license texts are available from the
package manifests, `node_modules`, and the Cargo registry used for a given build.
When producing a binary release, run the dependency license audit for the locked
dependency graph and include the resulting notices with the installer.
