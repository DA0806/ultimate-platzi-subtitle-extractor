# Third-party notices

UPSE original code is released under the MIT License in [`LICENSE`](LICENSE). This file records the dependency inventory used to build UPSE 1.0.10. The exact versions and resolved integrity values are locked in [`package-lock.json`](package-lock.json), and `npm run check:licenses` verifies declared license metadata for every installed non-optional package (238 packages in the release environment). Metadata validation is an audit aid; it is not a legal opinion or a substitute for the upstream terms.

## Direct dependencies

| Package | Locked version | License expression | Role |
| --- | ---: | --- | --- |
| `@tanstack/react-query` | 5.100.10 | MIT | application state/query support |
| `axios` | 1.16.0 | MIT | HTTP client |
| `file-saver` | 2.0.5 | MIT | browser file save effect |
| `jszip` | 3.10.1 | MIT OR GPL-3.0-or-later | ZIP writer; UPSE elects the MIT terms |
| `lucide-react` | 1.14.0 | ISC | UI icons |
| `react` / `react-dom` | 19.2.6 | MIT | UI runtime |
| `zustand` | 5.0.13 | MIT | application state |

The locked development and verification tools are also audited: `playwright` 1.60.0 (Apache-2.0), `vite` 8.0.12 (MIT), `eslint` 10.3.0 (MIT), `tailwindcss` 3.4.19 (MIT), `@vitejs/plugin-react` 6.0.1 (MIT), `postcss` 8.5.14 (MIT), `autoprefixer` 10.5.0 (MIT), and the remaining direct tooling listed in `package-lock.json`. Tooling is not bundled as an extension runtime or an authorization service.

The transitive lock graph contains MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, BlueOak-1.0.0, CC-BY-4.0, ISC, MPL-2.0, and combined expressions. `pako` 1.0.11 is explicitly `MIT AND Zlib`; both terms are preserved. `caniuse-lite` data is CC-BY-4.0 where included. No package is granted permission to access Platzi accounts or content.

## Upstream texts and attributions in the release ZIP

`dist/upse-extension.zip` contains `THIRD_PARTY_LICENSES/`, populated during packaging from the installed lockfile packages. It preserves each available upstream file whose name begins with `LICENSE`, `LICENCE`, `COPYING`, or `NOTICE`, including copyright and notice text. When a package publishes its license only in `README`, that README is included as the fallback source. The archive path encodes the package path, so nested packages remain distinguishable. `THIRD_PARTY_FALLBACK_NOTICES.md` records the eight fallback packages, exact versions, source paths and whether their README contains complete terms or only metadata/link evidence. This summary does not replace upstream terms. `npm run check:licenses` reports the five metadata/link-only cases explicitly.

The standard terms most relevant to direct dependencies are reproduced here for quick review. The package files in `THIRD_PARTY_LICENSES/` remain authoritative.

### MIT License

Copyright (c) the respective copyright holders.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

### ISC License

Copyright (c) the respective copyright holders.

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

### Zlib License

This software is provided 'as-is', without any express or implied warranty. In no event will the authors be held liable for any damages arising from the use of this software.

Permission is granted to anyone to use this software for any purpose, including commercial applications, and to alter it and redistribute it freely, subject to these restrictions: the origin of this software must not be misrepresented; altered source versions must be plainly marked as such; and this notice may not be removed or altered from any source distribution.

### Scope and exclusions

UPSE distributes original source and synthetic subtitle fixtures only. It does not distribute Platzi course content, subtitles, logos, trademarks, cookies, tokens, or user profiles. “Platzi” identifies the service targeted by the integration; no affiliation or provider authorization is claimed. The package checks intentionally reject test-only authorization markers before a release.
