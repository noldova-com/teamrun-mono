# Contributing to TeamRun

See the [README](../README.md) for TeamRun's purpose and product direction. Contributions follow the issue and PR workflow below.

## Issues and support

Use [GitHub Issues](https://github.com/noldova-com/teamrun/issues) for bugs, change requests, development tasks and questions. Search first and add relevant details to an existing report where appropriate. Security concerns follow [SECURITY.md](SECURITY.md) before opening an issue or PR.

Describe the problem or request; maintainers handle triage, missing information, labels, milestones and sub-issues. An open issue is not an implementation commitment. You need not assign labels or milestones, and there is no separate project board or repository roadmap to update.

For a bug, include:

- The expected behavior, actual behavior and smallest reliable reproduction.
- The TeamRun version or commit and where the build came from, when reporting application behavior.
- The operating system, CPU architecture and installation format, where relevant.
- The relevant provider and harness version, without credentials or provider profile files.
- A short redacted log excerpt or screenshot if it helps explain the failure.

Change requests describe the use case, desired outcome and workaround. Questions explain the goal and difficulty; documentation reports identify the file and passage. Use a matching issue form if available, or a plain issue with the same information.

Use synthetic data and a disposable project for reproductions. Review logs, screenshots and attached files before sharing; remove secrets and unrelated personal or project information. Do not upload real conversations, provider profiles or TeamRun data directories. Support is provided on a best-effort basis, with no response-time commitment.

### Labels and triage

You can submit an issue without choosing labels. Maintainers classify reports and manage their progress:

- `needs triage` marks a report awaiting assessment; remove it after that assessment.
- `needs information` marks missing details and stays until the required information is supplied.
- `good first issue` identifies clearly scoped work suitable for newcomers, with enough guidance to get started.

The [labels page](https://github.com/noldova-com/teamrun/labels) describes each label's meaning.

## Before making a change

Create or reuse a relevant issue in this repository for every change, including documentation, small fixes, dependencies and agent-assisted work. Discuss substantial product or architecture changes in the issue before implementing them. Agree on a bounded scope and observable acceptance criteria; split larger work into linked issues when needed.

Follow the [coding standards](../docs/CODING-STANDARDS.md), the [UI standards](../docs/UI-STANDARDS.md) for visual and interaction changes, and the [architecture](../docs/ARCHITECTURE.md) for changes to component or data boundaries. Update the owning document when a requirement changes instead of adding a competing rule elsewhere.

Dependency updates are proposed and reviewed manually through the same issue and PR workflow. Review their compatibility, installation behavior and verification needs under the coding standards.

## Development setup

Use a Node.js version within the range and the npm version declared in [package.json](../package.json). From the repository root, using Bash, install the pinned development tools:

```bash
npm ci
```

Build and install a selected package with:

```bash
npm run build -- foundation-core
```

Packages build in the configured order; a selected package's dependencies must already be built. The build installs the generated npm archives without changing the root manifest or lockfile. Running `npm ci` removes these local installations; build them again afterward. The command without package names builds all configured packages and the renderer. Renderer dependencies are installed from its lockfile when needed.

Build all configured packages before running their tests and coverage gate:

```bash
npm run build
npm run test -- --skip-test-details --skip-coverage-details
```

After building, list the available terminal commands with:

```bash
npm run cli -- help
```

## Run the desktop and UI checks

After installing dependencies, install the pinned Electron runtime once and launch the built application:

```bash
npm exec -- install-electron
npm run build
npm run desktop
```

Development launches prepare a TeamRun-branded copy of Electron in `_build/electron-dev`. The installed Electron distribution stays unchanged. The copy is reused until its branding inputs, Electron version, product version, platform or architecture changes. Close development windows before refreshing the copy.

`npm run desktop -- --prepare-only` prepares the binary without opening a window. On Linux hosts that require the setuid sandbox, apply the Electron sandbox ownership/mode setup to `_build/electron-dev/chrome-sandbox` after preparing it, as the workflows do; do not disable the sandbox.

Development launches keep their data in `~/.noldova/teamrun-dev`, apart from the installed TeamRun's `~/.noldova/teamrun`. To use another folder, set `TEAMRUN_DATA_DIR` before launching:

```bash
TEAMRUN_DATA_DIR=_build/dev-data npm run desktop
```

Run the renderer component tests and native desktop workflows with:

```bash
npm run test:renderer
npm run test:desktop
npm run test:ui
```

Linux needs a display; a headless host can use `xvfb-run --auto-servernum --server-args="-screen 0 2560x1440x24" npm run test:ui`. The UI suite uses disposable projects and a fixture provider, never provider sign-in or paid turns. It preserves Electron sandboxing and records selected screenshots and traces in `_build/ui-results/`, with the HTML report at `_build/ui-report/index.html`. These checks do not establish native clipboard/file-picker, installer, or live-provider behavior.

Actions job summaries show desktop UI outcomes and failure details beside the package results. Each target links its main-window PNG, uploaded without a ZIP for browser viewing, and the full UI report artifact. Both are retained for seven days; no report website is deployed. Local runs also write `_build/ui-results/summary.md`.

## Build installers

Build the application first, then package it on the target operating system:

```bash
npm run build
npm run test:package
npm run package
```

Packaging defaults to the host OS and CPU. Select `--platform windows|linux|mac` and `--arch x64|arm64` explicitly when needed; a different CPU may be packaged on the same OS, but execution still requires the native target. Use `--dir` for an unpacked application. Outputs are isolated under `_build/package/<platform>-<arch>`:

| Platform | Formats |
|---|---|
| Windows | NSIS installer |
| macOS | DMG, and the ZIP used for updates |
| Linux | AppImage |

Application code uses ASAR. Icons are physical resources; the renderer includes its fonts and notices. Foundation Testing and development dependencies are excluded. Packaging uses the locked production dependency versions and writes a report of artifact names, sizes and SHA-256 hashes.

Builds are unsigned by default for installation testing. `--signed` requires Windows signing credentials or macOS signing and notarization configuration. The packaging command always disables publication. Fresh Windows installs default to the current user, while existing installation scope is preserved.

Linux packaging pins AppImage toolset `1.0.3` with gzip compression. Its static runtime includes the FUSE library, so users do not need to install `libfuse2`. Normal mounting requires host FUSE support and permissions; `APPIMAGE_EXTRACT_AND_RUN=1 ./TeamRun-linux-<arch>.AppImage` runs from a temporary extraction when mounting is unavailable. Both paths require a host configuration that permits Electron sandboxing; the launcher does not disable the sandbox when the host cannot provide it.

The **Package installers** workflow is manually dispatched from `main`, with a platform and architecture selection or all six targets. It retains installers, reports and diagnostics as Actions artifacts for seven days. It does not create GitHub Releases. Its signing option signs the Windows and macOS builds, and notarizes the macOS builds, with the `release` environment described below, so signing can be checked before a release. Native installation and update acceptance are separate from producing these files; do not infer target support from an archive or installer alone.

## Publish a desktop release

The **Release desktop application** workflow starts when a `v*` tag is pushed, or manually from `main` with an existing tag. Publication requires explicit authorization. First merge the version change and release content through a reviewed PR. The tag must identify a commit on `main` and match `package.json` and both root application versions in `package-lock.json`.

Use numbered tags such as `v0.0.1` and `v0.0.2`, following the [release policy](../docs/ARCHITECTURE.md#10-build-installation-and-updates). Prerelease suffixes and build metadata are rejected. Each successful publication becomes the latest release. The release workflow does not change source files or create tags.

Both workflows call the same native packaging job. A release requires all six targets to build and pass their package, renderer and desktop UI checks. Build jobs have read-only repository access. Only the publisher receives write access, verifies the tag again, checks each report and payload, and creates a draft. It publishes only after every uploaded asset has the expected size and SHA-256 digest. Published files are never replaced.

The release workflow declares its signed platforms once, as `RELEASE_SIGNED_PLATFORMS` in its validation job: Windows and macOS. Packaging jobs for a signed platform run in the protected `release` environment, which holds the signing secrets and allows only `main` and `v*` tags. Unsigned jobs and pull-request checks never reach it. A reusable workflow receives environment secrets only when its caller passes `secrets: inherit`, so the Windows and macOS packaging calls pass it; the packaging workflow references only the signing secrets. On macOS the job signs with the Developer ID Application certificate and the hardened runtime, notarizes with an App Store Connect API key, staples the ticket, and checks the app with `codesign`, `spctl` and `stapler`. Notarization waits for Apple and can take more than half an hour, so signed jobs have a 90-minute limit instead of 45. On Windows it signs through Azure Artifact Signing with the `TeamRun` certificate profile; electron-builder installs the current version of Microsoft's `TrustedSigning` PowerShell module for this. The job then checks that the installer and `TeamRun.exe` carry a valid, timestamped signature. The publisher rejects any package whose signing differs from the declared platforms. The account holder creates the environment and its secrets: `MAC_CERTIFICATE` (the base64-encoded `.p12` with the certificate and its private key), `MAC_CERTIFICATE_PASSWORD`, `APPLE_API_KEY_P8` (the API key file contents), `APPLE_API_KEY_ID` and `APPLE_API_ISSUER` for macOS; `AZURE_TENANT_ID`, `AZURE_CLIENT_ID` and `AZURE_CLIENT_SECRET` for Windows, belonging to an app registration with the **Artifact Signing Certificate Profile Signer** role on that profile.

If publication fails, rerun the failed job within the seven-day artifact retention period. The publisher uses artifact IDs returned by the successful build jobs, including when they ran in an earlier attempt. It resumes a matching draft, verifies existing uploads and uploads missing files. Network interruptions and HTTP 500/502/503/504 responses get at most three mutation attempts with two- and four-second delays; each request has a two-minute deadline. Recovery may remove an empty `starter` asset left by a failed upload in that matching draft. Changed or unexpected assets, tag movement, authentication failures and expired artifacts require investigation. If artifacts have expired, rerun the builds; existing draft assets must still match before publication can resume.

The release includes all installers, the macOS ZIP archives, package reports, `SHA256SUMS`, and one update-info file per target, `latest-<platform>-<arch>.yml`, naming the file the updater downloads for that target. No file name contains the version, so `releases/latest/download/TeamRun-<platform>-<arch>.<ext>` always serves the newest build. The application installs updates on Windows x64 and from the Linux x64 AppImage. Windows ARM64 and Linux ARM64 await native update verification, and macOS awaits signed builds.

Run `npm run test:release` to check release validation, integrity checks and publication recovery with disposable repositories and a simulated GitHub API. These tests do not publish a release. The [release notes](RELEASE-NOTES.md) describe each platform's signing; change them together with `RELEASE_SIGNED_PLATFORMS`.

## Pull requests

Work on a focused branch in your fork, or a repository branch when you have the necessary access. Open the PR against `main`. Contributors do not need access to a maintainer's checkout; maintainers and agents working in a shared checkout follow [AGENTS.md](../AGENTS.md).

Each PR description includes a standalone line with its actual tracking issue. Use either form when the issue should stay open:

```text
Issue: #123
Issue #123
```

When the PR completes the issue, a GitHub closing reference such as `Closes #123` is sufficient on its own; no separate `Issue` line is needed. Accepted closing keywords are `close`, `closes`, `closed`, `fix`, `fixes`, `fixed`, `resolve`, `resolves` and `resolved`. Matching is case-insensitive and the colon is optional, for example `FIXES: #123`. Closing references close the issue when the PR merges into `main`; use an `Issue` reference for partial work.

Replace `123` with an existing issue from this repository, not a PR or another repository's issue. References in HTML comments or fenced examples do not count. Link additional issues as needed; reviewers verify relevance.

Use the [PR template](PULL_REQUEST_TEMPLATE.md). Fill `## Summary` with what changed and why, and `## Testing` with the checks run, results and remaining limitations; explain relevant checks that were not run or do not apply. These sections and a valid issue reference are required. HTML comments, headings and empty code blocks alone do not count as completed sections. `## Notes` is optional. Automated checks verify presence; reviewers assess accuracy and relevance.

Keep the change small enough to review coherently. Include before/after screenshots for visual changes when useful, using disposable data. Commit messages describe the concrete change.

An authorized human reviews and merges changes after the applicable requirements are met. A passing check does not authorize a release or establish that behavior outside the check's scope works.

### AI-assisted changes

Explain material AI involvement and how you reviewed and verified the result. The contributor remains responsible for correctness, security and licensing. Keep discussion constructive and address findings on their merits.

Credit each AI agent that contributed to the changes included in a commit, using its verified GitHub co-author identity. Include all contributing agents. For example:

```text
Co-authored-by: Claude <noreply@anthropic.com>
Co-authored-by: Codex <noreply@openai.com>
```

Keep the human contributor as the primary author. Preserve all applicable co-author trailers when squashing commits; do not credit an agent merely because it created the commit or opened the PR.

## Verification

For documentation-only changes, check accuracy, internal consistency, links and formatting. Do not invent build commands or describe unimplemented behavior as tested.

Use the revision's documented toolchain, setup and check commands, including required build-before-test order. Follow the coding standards for test authoring and [TESTING.md](../docs/TESTING.md) for execution, coverage and verification scope. Ordinary checks use disposable fixtures without provider sign-in or paid turns.

Record the tested revision/snapshot, commands, outcomes and limitations in the issue or PR, linking CI results and selected redacted evidence. Follow TESTING.md's evidence rules: identify the kind of verification, preserve unexplained failures and state which checks could not run.

## Licensing

Contributions to TeamRun's own code and documentation follow the [MIT License](../LICENSE). Introduce third-party material only when you have the necessary rights and have reviewed its license; preserve required notices and record its source. See the coding standards for dependency, source and generated-file requirements.
