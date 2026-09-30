# TeamRun testing contract

**Scope:** Test discovery, execution, isolation, result accounting, coverage and verification evidence.

This document defines TeamRun's testing and verification requirements. The [coding standards](CODING-STANDARDS.md) own test authoring, placement, public API documentation and secure coding. The [architecture](ARCHITECTURE.md) owns product behavior and process, data and delivery boundaries. [AGENTS.md](../AGENTS.md) owns agent permissions and review; live provider execution requires the authorization it specifies.

## 1. Ownership and proof boundaries

| Boundary | Responsibility |
|---|---|
| Foundation Testing (`src/foundation/testing`) | Package-test discovery, execution, assertions, structured results, reporting and coverage measurement/enforcement |
| Renderer test configuration | Component and service execution through Angular's supported testing surface, including framework error propagation and DOM-state isolation |
| Playwright desktop UI suite | User workflows through the running Electron application, named screenshot checkpoints, traces and cross-platform results |
| Tests of the owning application package | Domain, protocol, persistence, provider and process behavior through the boundary being verified |
| Build and verification entry points | Select the source state and scope, prepare the required installed artifacts, invoke the relevant checks and aggregate their outcomes |
| Native installer and update checks | Exercise the packaged application and installation lifecycle on the stated OS and CPU |

Tests establish their environment through owned fixtures; the package runner does not bootstrap the application, connect provider accounts or install global product state. Angular keeps its framework runner. Execution implementations may differ while satisfying this shared evidence contract.

A build establishes that selected sources produced the expected outputs. Tests establish only the behavior they exercise. Coverage measures execution of the declared production inventory. Neither coverage nor byte identity establishes behavioral correctness, provider compatibility or native installation acceptance.

## 2. Discovery and selection

The foundation runner receives explicit package identities and compiled test locations and discovers tests through its declared markers and naming rules. It must not infer package identity from an incidental working directory or discover tests outside the selected scope.

In foundation Testing, test identities contain package, relative file, class, method and, for data-driven cases, row identity. Angular and Playwright retain their framework's project/file/suite/title identities; do not invent class or method names for them. Each runner must account for its selected scope without duplicate identities or silent omissions. Foundation discovery and selection order are deterministic and independent of host locale and filesystem enumeration; malformed declarations, invalid data rows and unexpectedly empty test files fail discovery.

A filtered run reports its selection and discovered, selected and unselected counts; no matches is a failure, and a filtered pass is not the complete gate. Only a package without executable production code may have a justified empty inventory; failed discovery or a missing build is an error.

Supported test markers, data-row rules and filter syntax are public runner contracts documented with the implementation. Introduce only capabilities needed by the accepted suite; do not invent an extensible plugin system or a second discovery registry.

## 3. Execution, isolation and shutdown

Each method or data row run by foundation Testing receives a fresh test-class instance. Angular and Playwright use their supported fixture lifecycles. All tests establish and release their own state independently of test order. Observe synchronous methods and returned promises to completion; assertions, throws, rejections and attributable unexpected errors fail the test. Unattributable unexpected errors fail the enclosing run.

The execution boundary owns test deadlines, cancellation and cleanup. A timeout fails the test and stops or contains its owned work. Merely rejecting the runner's wait does not interrupt a synchronous loop or an asynchronous operation. Work requiring forced interruption must run behind a separately terminable process or worker boundary, with owned descendants and resources accounted for. An uncontained timed-out test must not be followed by a run claimed to be isolated or successful. The concrete isolation mechanism must be verified before its guarantees are claimed.

Observe pending failures before declaring the run complete. Late errors must not disappear after a passing result is printed; attribute them where possible and otherwise fail the run. Test-runner crashes, forced termination, cancellation and incomplete cleanup remain explicit unsuccessful or incomplete outcomes. A one-shot verification command must actually terminate with the appropriate exit status under the coding standards' process-lifetime rules.

Tests involving files, repositories, databases or profiles use owned disposable locations. Cleanup touches only resources created for that fixture, preserves failure diagnostics and runs on success, failure and cancellation. Tests do not mutate real conversations, user profiles, project checkouts or the user's clipboard and desktop as incidental fixture setup.

Desktop terminal workflows use the installed default shell with disposable startup configuration and command history, including after terminal restarts. They verify that commands reach the disposable history while continuing to exercise the real shell and its output; personal shell profiles and history files are not test fixtures.

Tests may advance a scoped mock clock to exercise long deadlines while preserving production defaults. Wait for the relevant work to start, check behavior before and at the deadline, and retain real process/socket cleanup checks. Keep a real-time guard against stalled test control and restore timers on success and failure. Global timer mocks require serial execution or process isolation; advancing a clock does not prove elapsed wall time or native-process termination.

Renderer tests install a throwing Angular `ErrorHandler` through the unit-test builder's provider configuration. Unexpected framework errors must fail the run; a test of an expected error asserts it explicitly. Specs that depend on styles, storage, preferences or document focus establish their own initial state and restore it after pending effects and fixtures are destroyed. A passing assertion alongside an unhandled framework error is not a pass.

## 4. Results and reporting

Assertions compare values according to a documented operation; truthiness or formatted strings must not replace the required value comparison. Structured assertion failures retain meaningful expected and actual values and their cause, subject to redaction.

Package results carry stable identities, outcomes, durations and failure/skip details, accounting for each data row. Distinguish executed, skipped, unselected and unreached tests. Totals reconcile with discovery and selection; missing results never pass.

Console results retain their package/file/class headings and test details, printed as each class completes. Reduced-detail mode hides passing tests and entirely passing classes. Final totals and GitHub summaries describe the complete run; a completed class does not establish that the whole run passed.

Console, GitHub and machine-readable reports derive from structured results; machine consumers do not parse console text. Reduced detail may hide passing details, but preserves failures, skip reasons, incomplete coverage and totals. Setup, discovery, coverage and reporting failures make the run unsuccessful even if every executed test passed.

A deliberate skip requires a declared reason and remains visible in the report. Do not turn failures into skips automatically or use hidden exclusion lists. A full gate cannot pass while a required test is unaccounted, interrupted or silently not run. A declared skip does not waive required behavior or coverage; any accepted exception must state its scope explicitly.

## 5. Coverage requirements

The coverage and configuration requirements are:

| Scope | Requirement |
|---|---|
| Foundation packages, including Testing itself, plus `src/protocol`, `src/core`, `src/runtime` and `src/cli` | 100% of executable production code; CLI verification includes arguments, failure paths and process exit |
| Repository-owned executable automation, including build, test, packaging and release logic | 100% executable-code coverage, with behavior and process-boundary checks appropriate to the operation |
| YAML and other non-executable configuration | Applicable schema/configuration validation and workflow checks; no executable-code coverage percentage |
| `src/providers` | Complete coverage through doubles for parsing, routing and lifecycle; behavior only a real provider can exercise needs separately authorized live verification and explicit accounting of uncovered lines |
| `src/renderer` | Component and service verification through the framework's testing surface, plus the desktop UI workflow gate in section 6 |
| `src/desktop` | Application-launch verification, process-boundary tests through appropriate doubles and real-process checks, and the desktop UI workflow gate in section 6 |

Define coverage requirements for additional packages with their accepted verification scope before claiming a complete gate. Non-executable definitions need no artificial tests. Any other exclusion is explicit, justified and reported; live-only provider behavior must not disappear through an exclusion. Executable automation is not exempt because it lives in a script. Inline workflow scripts are permitted under the coding standards and retain the same verification obligations; moving logic into YAML does not remove them.

If bootstrap work cannot yet be measured because the build or testing infrastructure is still being established, identify the exact files, missing measurement capability and checks actually performed in the issue or PR. This is an incomplete verification state, not a passing coverage exception. Close the gap before claiming the complete gate passes; neither a successful build nor a script's successful exit substitutes for its required coverage and behavior checks.

Measure against the complete executable production inventory for the selected gate, including files that no test loads. An unloaded file is uncovered. Missing coverage, invalid ranges, malformed reports or unusable required source maps fail coverage analysis rather than yielding a smaller passing inventory. Paths and package identities remain unambiguous across operating systems and installation locations.

During the Node bootstrap, the coverage adapter consumes the selected runtime's coverage and the build's source maps; its accepted formats and mapping behavior must be verified against the pinned toolchain. A source change requires fresh production artifacts and matching maps before its coverage can be trusted. Source or package drift invalidates the result.

Report covered/executable file counts and percentage against the tested source identity. Raw coverage block totals are per-run diagnostics, not reproducible revision fingerprints. Preserve uncertainty or discrepancies rather than changing historical observations to match a later run.

## 6. Verification scope

Documentation changes require content, consistency, link and formatting checks. Verified commands and prerequisites belong in README or the owning tooling guide when available; do not invent commands for missing tooling.

For automatic PR and `main` push runs, the Build and test workflow skips its code build and test matrix only when every changed path is a Markdown file at the repository root, under `docs/`, or under `.github/`. Markdown under source or scripts, other file types, and mixed changes require the full matrix. Renames account for both paths. PRs are compared from their merge base; pushes to `main` are compared with the newest revision in their history whose `main` run succeeded, so one run covers every push since. Empty comparisons, unavailable history or no such revision select the full matrix. Manual runs always select it.

Every push to `main` is verified on `main`. A later push never cancels a `main` run; pushes that arrive while it runs wait, and only the newest waiting run starts, covering all of them. A new push to a PR cancels that PR's run in progress.

The required aggregate check reports a documentation-only skip explicitly. Failed change classification, a failed, cancelled or unexpectedly skipped build, or any failed, cancelled or unexpectedly skipped required target fails that check. PR-description and issue validation still run for documentation changes. Installer packaging and releases remain explicit manual or tag-triggered operations with their complete verification.

Package verification builds, packs and installs the selected source state before tests consume its package API. Dependency resolution must reach the intended fresh installed artifacts. The Build and test workflow builds once, on Linux x64, because the build output is byte-identical on all six targets; each target installs those package archives and that renderer bundle with its own native dependencies, and the build evidence check confirms they match the checked-out sources. The build scripts' own tests still run on every target, and installer packaging and releases build natively on each target. Targeted checks are useful during development; before an implementation handoff, run the complete applicable gate for the actual snapshot being handed over. Do not repeat successful checks without a new change, failure or unresolved concern.

Name additional evidence according to the claim:

- Fixtures verify TeamRun's adapter inputs, outputs and lifecycle. They do not prove that a real provider applies supplied instructions or supports a control.
- Protocol and persistence changes need the relevant serialization, compatibility, migration, interruption and recovery checks through their owning boundaries.
- Renderer specs verify component behavior. Native-window evidence is needed for claims involving Electron, OS integration or actual desktop interaction.
- Packaging or cross-compilation does not establish execution on a target. Installer and update claims require the corresponding native checks under the architecture's delivery contract, including existing data and install scope where relevant.

Ordinary checks use fixtures without provider sign-in or paid turns. Separately authorized live checks record the actual provider, harness version, observed settings and scope; missing observations remain unknown.

Performance claims use representative workloads, recorded inputs and conditions, and repeated measurements outside coverage. Check scaling separately from correctness; ordinary unit tests do not enforce machine-dependent speed thresholds. Missing measurements remain unavailable, and a faster run alone does not prove less allocation or lower memory retention.

### Desktop UI automation

Playwright is the selected tool for automated desktop UI workflows. The UI suite is a required verification layer alongside package and Angular component tests. It drives the actual Electron renderer and preload/runtime boundaries with generated data and fixture providers; a browser-only page with a mocked bridge cannot stand in for that integration check. UI behavior and accessibility requirements remain owned by [UI-STANDARDS.md](UI-STANDARDS.md).

The complete UI gate runs shared critical workflows on all six targets:

| Operating system | Native architectures |
|---|---|
| Windows | x64 and ARM64 |
| Linux | x64 and ARM64 |
| macOS | x64 and ARM64 |

Keep shared scenarios in one suite, with explicit platform-specific launch, path, keyboard and display behavior. Record the actual OS, CPU, runner image or local environment, application revision, Playwright version, Electron version and host Node version; Electron's embedded Node is a separate observation. Cross-compilation, emulation or a pass on another architecture does not certify a native target. A missing, failed, cancelled or skipped required target leaves the complete UI gate unsuccessful or incomplete. Targeted local runs remain useful investigation evidence.

Pin the test dependencies when tooling is introduced. Verify the exact Playwright/Electron combination and its application configuration on each target before relying on it, and repeat the relevant compatibility checks when those dependencies or runner images change. The test host must supply the required native libraries and a working display; Linux CI may use Xvfb. A local WSL graphical-session pass is not a GitHub-hosted VM or Xvfb witness.

Keep the application's sandbox, context isolation, web security and content security policy intact. Inspect packaging and debugger/fuse requirements explicitly; do not weaken a production binary merely to let automation attach. If an automation-specific launch configuration or test build is required, record its differences and retain separate acceptance checks for the actual distributed binary. The shared suite launches with GPU acceleration and software GL turned off, so WebGL is unavailable and terminals draw with the DOM renderer, whose text Playwright can read and show in traces; drawing with WebGL needs its own check in the application with GPU acceleration. Native OS dialogs, clipboard integration, installers and updates need their own applicable checks; substituting a fixture for one of those operations does not verify the OS behavior.

The shared workflows cover conversation navigation, Settings transitions, composer editing and sending, draft and tab restoration, attachments and image previews, a reply that streams in uneven pieces, and relevant focus, keyboard and popup behavior. Extend them when an accepted UI capability adds a distinct user workflow. Assert meaningful application results, not merely that a click succeeded. Use stable accessible roles and names where possible, wait for observable state rather than arbitrary sleeps, and collect unexpected main-process, preload and renderer failures as part of the result.

Run with owned disposable data and fixture providers. Verify normal closure, interruption and failure cleanup, including owned child processes. Qualification runs use retries disabled. Any later diagnostic retry preserves the original failure and cannot turn flaky behavior into an unqualified passing claim.

### UI screenshots and reports

Choose named screenshot checkpoints deliberately, such as Settings opened, an image preview displayed or the composer cleared after sending. Attach each capture to its test or step, including on passing runs; capture the relevant page or component. Also capture a screenshot on failure when a usable window remains, and retain a diagnostic trace. A capture failure must remain visible without replacing the original test failure.

Capture after the expected UI state is established, with a declared animation policy. Use the automation framework's supported stabilization behavior; animation cancellation must not be mistaken for an application failure by a generic wait. Tests of animation behavior still exercise that behavior explicitly. Record the platform, viewport, scale, theme and font settings needed to interpret a visual result.

The shared desktop UI suite uses a 1920 × 1080 renderer viewport at one device pixel per CSS pixel at normal zoom. Captures remain 1920 × 1080 pixels during zoom tests; the recorded CSS viewport and pixel ratio reflect the zoom. Verify the actual viewport and PNG dimensions so host display defaults cannot silently reduce the evidence resolution.

Screenshot attachments are review evidence. Pixel comparison is a separately selected assertion against a deliberately reviewed baseline. Control the rendering environment, use appropriate platform baselines and update expected images only through review; verification never rewrites them to accept a difference. Screenshots do not replace behavioral, computed-style, contrast or accessibility checks.

CI reports expose identities, steps, outcomes, screenshots and traces, retaining run artifacts under an explicit retention policy. Commit evidence only under section 8's lasting-value rule. Aggregation preserves startup, execution, capture and cleanup failures. Evidence applies only to its recorded build and environment.

GitHub Actions job summaries include desktop UI outcomes, duration and bounded failure details beside package results. Totals account for all selected tests even when displayed details are limited. A main-window checkpoint is retained as a separate PNG artifact per target, linked from the summary for browser viewing; the full HTML report and traces remain downloadable artifacts, without separate report hosting.

## 7. Verification of the testing infrastructure

Before relying on the package runner or a changed reporting path, use controlled negative fixtures through its real entry point. Verify assertion failures, throws, rejected promises, timeouts, unexpected late errors, malformed discovery, declared skips and incomplete results. The outer test asserts their expected failure classifications without allowing the deliberately failing child to appear as a successful product test run.

Coverage checks must demonstrate that an unloaded executable file, a genuine uncovered branch and malformed required coverage data cannot produce a complete result. Aggregation checks must demonstrate that a failing prerequisite, cancelled process or missing report cannot produce a green summary. Verify process exit as well as the reported failure; a printed error is not evidence that the runner stopped.

## 8. Evidence and handoff

Record scope, source revision or file snapshot, toolchain, platform, commands, outcomes and material limits in the issue or linked PR. Link CI results and selected redacted artifacts. Verification evidence is not a second progress document or an amendment to the product contract.

Retain stdout and stderr separately for each attempt as artifacts under the retention policy. Keep essential redacted failure details directly in the issue or PR, including reproduction steps and relevant assertion/stack output, so they remain useful after artifacts expire. Link the full logs, screenshots and traces. A successful rerun does not erase an unexplained failure.

Commit diagnostic files only through deliberate review when they have lasting regression or reference value, alongside any reviewed visual baselines and regression fixtures. Do not accumulate routine run logs in source control. All evidence follows the coding standards' redaction requirements.

If a required check could not run, state the missing claim plainly. Old evidence, a copied package, user-reported success or a fixture-only run must not be presented as newly verified implementation.
