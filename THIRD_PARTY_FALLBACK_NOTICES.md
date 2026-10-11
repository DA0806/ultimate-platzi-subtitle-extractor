# Fallback license-source ledger

This ledger covers locked packages whose installed directory does not contain a standalone `LICENSE`, `LICENCE`, `COPYING`, or `NOTICE` file. The package version comes from `package-lock.json`; the source path is the exact installed package used by the build. The corresponding README is copied into `THIRD_PARTY_LICENSES/` in the release ZIP when it contains the only available upstream license reference. A metadata-only entry is deliberately not described as a complete license text.

| Package and locked version | SPDX metadata | Source provenance | Evidence status |
| --- | --- | --- | --- |
| `@humanfs/types@0.15.0` | Apache-2.0 | `node_modules/@humanfs/types/README.md`, package-lock resolved package | README says “Apache 2.0”; metadata-only, full Apache terms are not claimed |
| `@rolldown/binding-win32-x64-msvc@1.0.0` | MIT | `node_modules/@rolldown/binding-win32-x64-msvc/README.md`, package-lock resolved package | README identifies the binary but contains no license terms; metadata-only |
| `dlv@1.1.3` | MIT | `node_modules/dlv/README.md`, package-lock resolved package | README links to the MIT license; link-only, full terms are not claimed |
| `esrecurse@4.3.0` | BSD-2-Clause | `node_modules/esrecurse/README.md`, package-lock resolved package | README contains copyright and the complete BSD-2-Clause notice; packaged as fallback |
| `imurmurhash@0.1.4` | MIT | `node_modules/imurmurhash/README.md`, package-lock resolved package | README contains copyright and the complete MIT terms; packaged as fallback |
| `isarray@1.0.0` | MIT | `node_modules/isarray/README.md`, package-lock resolved package | Runtime dependency of `jszip`; README contains Julian Gruber attribution and complete MIT terms; packaged as fallback |
| `keyv@4.5.4` | MIT | `node_modules/keyv/README.md`, package-lock resolved package | README states “MIT © Jared Wray”; metadata-only, full terms are not claimed |
| `natural-compare@1.4.0` | MIT | `node_modules/natural-compare/README.md`, package-lock resolved package | README gives copyright and links to the MIT license; link-only, full terms are not claimed |

The checker reports these five metadata/link-only cases on every run. The remaining fallback README sources contain complete terms according to the bounded signal checks in `scripts/check-third-party-licenses.mjs`. This ledger is a provenance record, not a replacement for upstream license files or legal advice.
