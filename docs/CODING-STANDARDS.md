# TeamRun coding standards

**Scope:** Source code, tests, scripts, and generated-code ownership

These standards define how TeamRun code is written, organized, secured, and verified. Architecture and product decisions are documented separately. The rules here must be understandable without access to another repository or an earlier decision log.

Never overcode. Use the simplest direct implementation that preserves correctness, ownership and clarity. Add code, files or abstractions only for a present requirement. Needless indirection or generality is a defect even when the code works.

## 1. Ownership and design principles

Every behavior has one clearly named owner responsible for its state and invariants. A generic file or function does not resolve unclear ownership.

Apply SOLID through cohesive responsibilities, valid objects, explicit dependency direction, small intentional APIs, and genuine polymorphic boundaries. Apply DRY to duplicated knowledge and domain behavior, not similar-looking code; DRY never justifies a helper bucket, premature base class, or abstraction without one owner.

Place behavior with its owner instead of keeping a local copy "for now":

1. The host platform (Node, Electron, Angular, the browser) already provides it: use the host form, except for the explicitly required foundation conventions in section 3.
2. Exactly one package needs it: it becomes a method of that package's owning concept.
3. The need is genuinely shared: the lowest package that owns the concept gains it; the dependency direction stays explicit.

### Lifetime and performance

TeamRun streams provider events, keeps long histories, and supervises long-running processes; speed and memory are review concerns from the first line.

- Keep temporary builders, buffers, and worklists local to their work. Published results must not retain producer machinery unnecessarily; shared input or result data keeps the lifetime its contract requires.
- Own retained objects, callbacks, subscriptions, timers, child processes and caches, including their release. Review references escaping through returns, fields, closures and package boundaries. Document non-obvious retention in its contract or a focused comment.
- Copy when an independent snapshot is required, not as a blanket policy. Shallow copies still share their elements. Views and stored callbacks are valid when their retention, mutation and lifetime contracts are clear.
- `readonly` and concrete types do not establish exclusive ownership or deep immutability. A local variable's last use does not prove that no other reference retains its object. Do not invalidate shared data based on that assumption.
- Bound every collection that grows with history (transcripts, events, logs); unbounded retention is a defect.
- Virtual history may retain lightweight visited-row metadata under the [history contract](ARCHITECTURE.md#9-renderer-synchronization-and-history). That exception permits no message content or unbounded body cache.
- Avoid hot-path allocations, repeated scans, and per-event reparsing; add pooling or batching only for a demonstrated need. Optimizing lifetime does not excuse repeated work or unnecessary copying.
- Keep observable cleanup separate from garbage collection. Close processes, files, sockets and database handles according to their owner's contract on normal and exceptional exits; do not close a shared resource early merely because one caller no longer uses it.

## 2. No helpers

Ownerless behavior is not a helper abstraction. Do not create generic `helper`, `helpers`, `util`, `utils`, `utility`, `common`, `shared` or `misc` files/directories, `Helper` or `Utility` classes, static grab bags, or collections of unrelated free functions. Renaming a bucket does not give it an owner; an incidental word in a precise domain term is not prohibited.

Behavior used by one owner becomes its method. An independent responsibility becomes a precisely named concept, such as a reader, parser, tracker or policy. Free functions are permitted only where a language, framework or platform surface requires them; substantive behavior behind them remains owned by a class.

Canonical package values belong in `Resources` by default: messages, report labels, protocol tokens, file extensions, environment and command names, regular expressions, formatting values and meaningful limits. A literal may remain in an algorithm when it is self-evident, local and clearer there. An index increment by `1` is an example; a timeout or attachment-size limit expresses policy and must be named. Semantic alternatives are enums or concrete value objects rather than loose strings or numbers.

When centralizing package values, use one `src/resources.ts` and one `Resources` class with camelCase `static readonly` members. This data owner is not a helper bucket; add no resource directories or parallel resource classes. Static formatters compose owned text with runtime values. Exceptions use the owning resources or diagnostic templates; catalog-owned text is not duplicated in resources.

Enums own their values. Empty values, module specifiers, type declarations and declarative configuration retain their language or toolchain's required form. Tests keep the inputs, expected results and fixture data they verify independent of production `Resources`; changing production output must not automatically change the expected answer.

Bootstrap and maintenance scripts are not packages. Their canonical text and structural values are named constants on the owning script class; they do not require a shared `scripts/resources.ts`. Genuinely shared behavior or data still needs one precise owner. Test infrastructure follows the same ownership rules, with precisely named fixtures, builders, fakes and hosts rather than a `tests/helpers` dumping ground.

## 3. Object-oriented design

TeamRun uses class-first, full object-oriented design.

- Production behavior belongs to a class that represents one named concept and owns its behavior, state, and invariants.
- Constructors establish valid objects; callers do not assemble partially valid state through unrelated assignments. A constructor validates first and assigns second, and one blank line separates the checks (including a `super` call) from the assignments; a constructor without checks has no blank line.
- Every field is an explicit class member; constructor parameter properties are not used. The constructor assigns its parameters to the declared fields so the class's shape reads in one place.
- Instance methods are preferred when behavior depends on owned state. A static method is appropriate when the operation belongs to the concept and needs no instance state; static classes still represent a cohesive concept.
- Modules and namespaces do not act as surrogate objects containing unrelated functions. Composition is preferred when an object delegates a distinct responsibility to another owner.
- Add behavior to the concrete type instead of `if` or `switch` ladders over kind tags. A dispatcher is permitted only at a genuine runtime-dynamic boundary (parsing provider events, decoding wire messages) and is narrow, named, and tested as such.
- TeamRun writes no extension methods by declaration merging or prototype grafting outside `src/foundation`. Reuse behavior already owned by this repository's foundation packages; do not create a second implementation elsewhere. New foundation behavior is reviewed and tested here. Contributors are not required to consult or copy from an external private repository.
- Production packages use the foundation Core's additions to the global `Object` and `String` constructors: value checks are `Object.isUndefined`, `Object.isNull`, `Object.isNullOrUndefined`, `Object.isString`, `Object.isNumber`, `Object.isBoolean`, `Object.isObject`, `Object.isFunction`, `String.isNullOrEmpty`, and `String.isNullOrWhitespace`; the empty string is `String.empty`. Production consumers use these instead of `=== undefined`, `=== null`, `typeof x === "..."`, or `""`. A file that uses them starts its imports with `import "@noldova/teamrun-foundation-core";`. The foundation implementations themselves use the host language's operations, and their declarations must preserve TypeScript narrowing. Import and verify the required foundation package before importing its consumers. Automation scripts use native checks as specified in section 11.

TeamRun methods return concrete classes, primitives, enums or concrete runtime collections. Structured results use named classes; return-side polymorphism uses a meaningful base or abstract class. Interfaces describe consumed or implemented contracts, not result data. Do not return interfaces, data-shape aliases, anonymous objects or tuples, or property bags. Wire serializers are the explicit exception below.

### The wire contract

Every message and model in `src/protocol` owns its wire form: the constructor checks invariants, `toJson()` returns explicitly typed plain JSON, and `static fromJson(value: unknown)` narrows fields through the protocol's `JsonReader`, throwing a named protocol error that identifies an invalid field. Plain JSON results are permitted at this serialization boundary; do not add wrapper classes to satisfy the domain-return rule. Missing required fields and invalid known values are errors; optional fields define absence/default semantics. Domain operations use validated instances, with plain representations confined to serialization and deserialization. Core owns one row-mapping class per table, producing the same domain classes.

Define supported protocol versions and any capability negotiation explicitly. Reject unsupported operations and incompatible versions before performing their work. Ignore additional informational fields only where the wire contract permits extension; unknown fields alone are not a compatibility strategy. Security-sensitive requests have an explicit schema and reject unsupported authorization options. Compatibility tests cover supported older/newer peers, missing required fields, optional additions, and incompatible changes. Serialization round trips alone do not prove compatibility.

## 4. Types and APIs

- Every TeamRun TypeScript project uses the strict repository profile in the root `tsconfig.base.json`.
- Declare explicit access modifiers and return types.
- Do not use `any`, double casts, or unchecked assertions to bypass a missing model. An external declaration that requires `any` keeps it at that boundary; TeamRun code accepts and narrows `unknown`.
- The `Reflect` API is not used to bypass typing, visibility, construction, invocation, or invariants, and neither are `any`, casts, `Object` APIs, or call indirection used to evade this rule. The one exception is the runtime's `PseudoTerminal`: after a shell exits, it releases the thread `node-pty` keeps reading the Windows pseudo-console's output, because `node-pty` offers no public way to release it and otherwise keeps it for the life of the runtime ([microsoft/node-pty#887](https://github.com/microsoft/node-pty/issues/887)). It checks the shape of each member it reads, the open-resource check of the Windows test runs fails if that shape changes, and the exception ends when `node-pty` releases the thread itself.
- Narrow untrusted values at their boundary: IPC payloads, runtime messages, provider events, persisted rows, environment input, and repository content are untrusted. Inside, trust declared types; do not repeat them with `typeof`, `instanceof`, `Array.isArray`, or null guards. Semantic invariants the type system cannot express (ranges, ordering, non-empty values, cross-field consistency) are validated once by their owner, expressed in the type where possible, and never replaced by non-null assertions or silent fallbacks.
- `undefined` means missing; `null` means explicitly set to nothing. A value that may be absent is an optional member or parameter (`?`); a value that is known and empty is `T | null`; no member or parameter is `T | null | undefined`. On the wire an absent key is `undefined` and a JSON `null` is `null`, and `fromJson` keeps the distinction. `exactOptionalPropertyTypes` is on, so optional members are never assigned `undefined` explicitly.
- Declare every public interface and type alias in its owning source code.
- Prefer immutable and `readonly` data when mutation is not part of the concept; copy caller-owned collections when an independent snapshot is required; do not freeze objects at runtime.
- Keep public APIs small and intentional; internal mechanics remain private.

## 5. Classes and files

- An implementation file declares exactly one class, interface, type alias, enum, or other named concept and is named for it. Two concepts never share a file, even when they reference each other; they import each other. Subordinate and private concepts get their own files; coupling or convenience does not permit colocating them. A concept has one predictable home following its domain and responsibility.
- Source interfaces live beneath `interfaces/`, grouped by domain when needed.
- Do not declare an empty constructor when the implicit one is the complete contract.
- Prefer small, cohesive classes and files; no god objects or generic context/state containers. Split a file only when a subordinate concept can be named independently. Cohesion outranks a line limit; file length is a review signal, not permission to extract ownerless behavior.

### Package organization

Application icons and fonts live in `assets/icons` and `assets/fonts`, with their license notices. Renderer styles, including font-face declarations, live in `src/renderer/src/styles`.

Theme-specific icons use `dark` or `light` for the intended background theme. PNG names include their square pixel size, such as `icon-dark-128.png` or `icon-light-512.png`. Purpose-specific icons use a descriptive variant, such as `icon-dock-512.png`; ICO files contain multiple resolutions and omit a single-size suffix.

Package source trees use the concept categories `api`, `enums`, `exceptions`, `interfaces`, `models`, `services`, and `types`; create only those the package uses. Domain subfolders are optional and added only when they make current navigation clearer. Models hold state, identities, options, and results; services own operations such as tracking, supervising, dispatching, parsing, reading, writing, and verifying. The package manifest, TypeScript configuration, and `resources.ts` stay at the source root; tests mirror the full path.

The Angular renderer (`src/renderer`) follows the same rules for services and models under `src/app`; a production component pairs `<name>.component.ts` with a neighboring `<name>.component.html`, referenced through `templateUrl`. Its class is named `<Name>Component` and its selector is prefixed `tr-`, under `src/app/components/<name>/`; services end in `.service.ts`. Specs live in the sibling `tests` directory, mirroring each source file's path relative to `src` and replacing `.ts` with `.spec.ts`: `src/app/services/chat-store.service.ts` has `tests/app/services/chat-store.service.spec.ts`. Shared fixtures live in `tests/fixtures`, and test-environment configuration lives directly under `tests`. The renderer has its own `resources.ts` and follows the literal rule; template text comes from it through a `resources` field.

## 6. Methods and control flow

- Methods perform one coherent operation at the abstraction level of their owner, with direct, readable control flow and inputs, outputs, mutation, and failure visible in the API.
- Do not rely on ambient mutable state, hidden fallback, or distant side effects, and avoid boolean flags that make one method perform unrelated operations.
- Omit braces around a control-flow body of exactly one statement; use them for multiple statements.
- Name a single identifier arrow parameter `t` and omit its parentheses when untyped: `values.filter(t => t.isValid)`. Keep parentheses for zero or multiple parameters, type annotations, destructuring, defaults, or rest parameters.
- Stream potentially unlimited text or enforce a documented size limit before retaining it. Arrays of chunks also consume memory; they do not make unbounded input safe. For bounded accumulation, join chunks once when appropriate and keep small, bounded concatenation direct.

Handwritten TypeScript prefers 160 columns as a soft signal, not a gate; a cohesive signature, indivisible string, pattern, URL, or test input may exceed it. Never shorten names, add wrappers, or extract code to satisfy width. Multiline parameter and argument lists have no trailing comma; the closing parenthesis follows the final item:

```ts
public constructor(
  name: string,
  value: number) {
}

this.write(
  name,
  value);
```

## 7. Failure behavior

- Fail explicitly with a domain-specific error class that names what went wrong.
- Do not replace missing knowledge with zero, an empty value, a guessed match, or a silent fallback; a requested model, effort, or account is never reported as the observed one.
- Validate untrusted input at the owning boundary and reject invalid state before it spreads.
- Preserve the original cause when translating errors between layers, and redact secrets before an error is stored or shown.

Repair the cause a failure reveals. Do not add a guard, retry, fallback, skipped step or widened type whose only purpose is to hide an unexplained defect. Do not weaken an assertion, silently remove a failing case or narrow a verification scope to make a gate pass. When an accepted requirement changes, update its owning contract and tests deliberately; a failed check alone does not establish that its expectation is wrong.

Recovery is valid for a modeled condition: a classified transient network failure, a supported provider-session recovery path or a documented user cancellation. State when recovery applies, preserve the failure evidence, and verify the resulting behavior. It must obey the lifetime and retry rules below and must not guess that an uncertain side effect did not occur. Boundary-validation tests may deliberately supply malformed input; do not invent impossible internal states solely to justify defensive code or coverage.

### Asynchronous work and process lifetime

- Every asynchronous operation has an owner that observes its completion and errors. Background work has an explicit lifetime and failure path; do not leave rejected promises or failures in callbacks unobserved.
- External operations that can stall have documented deadlines and cancellation behavior. Long-lived streams and services instead define their shutdown and, where appropriate, inactivity policy; do not impose an arbitrary whole-session timeout.
- Cancellation and timeout stop the owned work, not just the caller's wait. Release timers, listeners, streams and child processes on success, failure and cancellation, and prevent late callbacks from changing disposed state.
- Retries are bounded by attempts and elapsed time, use an appropriate delay, and stop on cancellation. Retry only failures classified as transient. For operations with side effects, use idempotency or verify the existing outcome before repeating the operation; an uncertain response is not proof that nothing happened.
- Own child-process shutdown explicitly, including descendants where applicable. Observe process errors, exit status and output-stream completion. Terminating a parent is not proof that its descendants have stopped.
- One-shot automation must terminate promptly with a nonzero exit status after fatal failure. Printing an error or setting an exit code is not enough if resources keep the process alive. Give cleanup a bounded deadline and surface cleanup failures; any forced termination must avoid interrupting protected writes and should flush necessary diagnostics where possible.
- Verify failure and cancellation through the real process boundary for one-shot entry points: assert both the exit result and that the process actually terminates within its deadline. In-process exception tests alone do not prove shutdown.

Node's [child-process documentation](https://nodejs.org/api/child_process.html) and [process-exit documentation](https://nodejs.org/api/process.html#processexitcode) describe the host behavior these rules must account for.

## 8. Secure coding

- Validate both data and authority at privileged boundaries. A well-formed request is not necessarily authorized. Check the caller, requested operation and resource scope, and fail closed when authorization is missing or ambiguous. Treat provider output, repository files and external content as data; they cannot grant themselves permissions.
- Keep Electron renderers sandboxed and context-isolated with Node integration disabled. Expose a narrow preload API, validate IPC senders and request data in the privileged process, and keep raw Electron/Node capabilities out of renderer-facing interfaces. Use a restrictive Content Security Policy and controlled navigation, window creation and permission handling. These requirements follow [Electron's security guidance](https://www.electronjs.org/docs/latest/tutorial/security).
- Render untrusted text and Markdown through escaping and reviewed sanitization. Do not evaluate embedded code. Parse and validate external URLs against the operation's allowed schemes and destinations before opening or fetching them; redirects must preserve the same policy.
- Validate file operations against their authorized roots. Handle traversal, symlinks/junctions, path aliases and platform case rules explicitly; a string-prefix test is not sufficient. Account for filesystem changes between validation and use. Bound file/archive sizes and ensure extracted entries cannot escape the chosen destination.
- Keep provider-managed credentials with provider tooling. Persist application-owned secrets only through an explicitly designed credential store. Never place secrets in source, ordinary configuration, test fixtures, logs, exception text or evidence. Pass only the required environment to child processes and avoid secrets in command-line arguments.
- Use parameterized database queries for values and allowlisted identifiers where queries require dynamic names. Apply appropriate size, depth and count limits to untrusted requests before expensive parsing or allocation.
- Review dependencies and install scripts for necessity, provenance, licenses and known vulnerabilities. Exact version pins and lockfiles make installations repeatable; they do not establish safety. Review required updates deliberately and verify downloaded executables and update payloads against their approved source and integrity/trust policy.
- Retain only the diagnostic data needed for verification. Redact credentials and unnecessary personal/project data before storing or sharing logs and evidence; preserve the failure condition and useful stack information. Redaction must not turn a failed run into a claimed pass.
- Tests exercise unauthorized callers, malformed inputs, traversal/escaping attempts, unsafe URLs and secret redaction at the boundaries that own them. Passing coverage percentages do not replace these checks.

## 9. Documentation and comments

Source declarations own API documentation. Every public type, member and overload has original JSDoc beside its declaration; consumer declarations, IntelliSense documentation and reference pages derive from it. Document enough for correct use without reading the implementation.

Every public callable signature documents:

- Each parameter with its own `@param` entry: purpose, accepted inputs, constraints, units, optional/default behavior and callback obligations where applicable. Repeating the parameter name or type is insufficient.
- Each non-void return with `@returns`: meaning, ownership, ordering, absence semantics and asynchronous completion where relevant. Constructors do not need this tag.
- Contractual failures with `@throws`: the exception type and triggering condition, distinguishing synchronous throws from promise rejection. Do not invent exception contracts or add empty tags.
- Useful normal and boundary-case usage with `@example`. Related signatures may share a linked example; examples must compile or run during verification.

Document generic-parameter roles, property meaning, mutation, lifecycle, performance constraints and deprecation when relevant. Use `@remarks` and links to related symbols where they help. Keep conceptual guides separate and link them to API symbols. Simple APIs need no repetitive prose, but a signature or summary alone does not replace argument documentation.

Internal code, tests and scripts may use JSDoc where caller obligations, results, invariants, ownership or performance need explanation. Self-explanatory members need no boilerplate. Plain comments explain non-obvious reasons, not code narration, editing history, obsolete alternatives or internal rule references. License headers are separate.

External references may establish behavior; their prose is not copied. Every JSDoc uses the multiline form with separate opening and closing lines; parameter tags use `@param name description`, without a hyphen after the name:

```ts
/**
 * Describes the public contract.
 */
```

`src/api/index.ts` exposes the package's intended public surface. Consumer declarations and reference documentation are generated build outputs, not a second handwritten authority. Verify generation preserves public signatures, overloads, documentation and links, and excludes private implementation details from the public reference. Use compiler-aware tooling rather than a text or regular-expression extractor.

During migration, an imported package may retain its handwritten `src/api/index.d.ts` as the sole public-documentation authority until its source-owned generation path is verified. Record that package's temporary status and migrate its comments and generation together. Do not maintain two handwritten documentation copies, remove installed API documentation during the transition, or claim generation exists before it has been tested. Establish and verify source-owned generation before publishing new packages.

Automated API checks verify the packaged declarations against the intended implementation API: exports, constructors, parameter and property types, optionality/nullability, generic constraints, overloads, visibility and return types. Checking exported names alone is insufficient. Check missing documentation, broken links and drift; human review checks the meaning. Compile positive and expected-error consumer examples against the packaged declarations and exercise the installed runtime for the behavior its contracts promise. Require an intentional version/compatibility decision for breaking public API changes.

## 10. Naming and formatting

- Package names are `@noldova/teamrun-<name>`. Form `<name>` from the package-root path relative to `src/`, joining its lowercase kebab-case segments with hyphens: `src/core` becomes `@noldova/teamrun-core`, and `src/foundation/testing` becomes `@noldova/teamrun-foundation-testing`. Each name identifies exactly one package; paths must not create colliding names.
- The root manifest's application version owns TeamRun product and package versions. Package manifests under `src/` use `__VERSION__` for their own version and references to other TeamRun packages; the build stamps them consistently. External dependency versions are exact pins. Protocol and data-format versions remain independently declared contracts, not copies of the application version.
- Concept directories use lowercase kebab-case. A type's filename preserves the words in its name: neither adds a word the other lacks.
- Use a dot before a final role word in a type's filename: `node`, `parser`, `lexer`, `reader`, `validator`, `exception`, or `service`. For example, `ArgumentException` lives in `argument.exception.ts`, `SourceReader` in `source.reader.ts`, and `BinarySearchService` in `binary-search.service.ts`. Other words remain lowercase kebab-case, as in `snapshot-tracker.ts` for `SnapshotTracker`. A single-word type keeps its name, such as `exception.ts` for `Exception`; do not add `.model`, `.enum`, or `.interface` markers.
- Supporting files use their kind suffix: `.test.ts`, `.extensions.ts`, `.fixture.ts`, and `.d.ts`. Package entry points (`api/index.ts`), `resources.ts`, manifests, TypeScript configuration and scripts keep their fixed names. Angular filenames follow section 5.
- Classes, abstract classes, enums, type aliases and other named types use descriptive PascalCase; interfaces use `I` plus PascalCase (`IProviderAdapter`); decorators use PascalCase.
- Name a type for its responsibility. A name such as `SourceReader`, `SnapshotTracker`, or `DiagnosticCollector` needs no additional `Service` suffix. Use `Service` only when a more specific role does not describe the type; retain established API names such as `Assert`.
- `Component` is reserved for Angular UI building blocks.
- Methods, properties, parameters, locals, and fields use camelCase; private fields have no leading underscore.
- A method name is a verb phrase naming its action (`readString`, `formatChildPath`, `throwWrongTypeException`, `fromValue`); a property or accessor is a noun. A `Resources` method that composes a message starts with `format`. Booleans use predicate forms (`isEmpty`, `hasValue`, `canRead`).
- Generic type parameters use `T` or `T` plus role (`TKey`, `TValue`).
- Internal constants use UPPER_SNAKE_CASE; `Resources` members and state fields stay camelCase. Literal placement follows section 2, including local algorithm values and constants owned by scripts.
- Files tested through foundation Testing replace the source filename's `.ts` with `.test.ts`, preserving role suffixes: `argument.exception.ts` has `argument.exception.test.ts`. Test classes add `Tests` to the production type (`ArgumentExceptionTests`). Angular and Playwright conventions follow section 13.
- Two-space indentation; semicolons; explicit names rather than abbreviations, and no adoption of a provider's own abbreviations.
- Enum members use PascalCase, and TeamRun-owned string values exactly match their member names (`InvalidParams = "InvalidParams"`). Values fixed by an external compatibility contract keep that spelling. Use explicit string values by default and explicit numeric values only when numeric meaning or representation is required, such as bit flags, binary formats or native interop; never mix strings and numbers or rely on implicit ordering. The enum owns its literals, not `Resources`.
- API declarations mirror enum values exactly, and tests keep independent expected literals. Before changing values, inspect comparisons, reverse lookups and serialization dependencies; update declarations, consumers and tests together. A casing change also changes serialized values.
- Member order in a class or interface: fields grouped by visibility, private first, then protected, then public, static members before instance members within a group; then the constructor; then accessors and public methods; then protected methods; then private methods. Fields of one group have no blank line between them; one blank line separates groups and every other member. Enum members have no blank lines between them. Handwritten declarations follow the same rules; generated outputs use the verified generator's formatting and are not edited by hand.
- Every text file ends with exactly one newline, the terminator of its last line, and no blank line after it. Use LF line endings and require `.gitattributes` to enforce them.
- Keep formatting mechanical and consistent; automate it when tooling exists.

Imports are grouped by origin:

1. Host built-in modules, such as `node:fs/promises`.
2. Package imports, including `@noldova/...` and external packages.
3. Relative imports, including parent and sibling paths.

Separate non-empty groups with one blank line and add no blank lines within a group. Type-only, value, namespace and side-effect imports belong to their origin group. Within each group, sort declarations and named imports consistently with VS Code's Organize Imports. Required side-effect initialization order takes precedence, including the foundation initialization required by section 3; formatting must not change initialization behavior.

## 11. Automation and scripts

Keep runnable entry points and bootstrap configuration directly in `scripts/`. Group supporting implementations by responsibility, such as `scripts/build/` and `scripts/packaging/`; their tests mirror those paths under `scripts/tests/`, with fixtures beside the tests they support.

Standalone repository automation is TypeScript: build, test, packaging, generation, fixtures, live checks, developer tools. No standalone shell, PowerShell, batch, Python, or other-language scripts or wrappers. Scripts follow the same ownership, OOP, no-helper, naming, and licensing rules; npm commands expose TypeScript entry points and pass arguments rather than inline shell. Subprocesses are spawned without a shell with explicit argument arrays. Validate the executable, argument meaning, working directory and inherited environment; shell-free spawning alone does not establish safety. Follow section 7 for deadlines, retries and shutdown. External dependencies require an explicit decision, exact pins, and a present need. Scripts keep the language's own value checks instead of the Core predicates so they can run before foundation packages have been built.

GitHub-native configuration uses YAML under `.github`. Files in `.github/workflows` may contain inline workflow scripts and invoke toolchain commands or existing npm entry points. Inline scripts follow the same security, failure-handling and verification requirements; pass untrusted event data through environment variables or API responses, never interpolate it into executable script text. Actions are pinned to full commit SHAs with their release versions recorded.

Shells: on Windows, explicitly use Git for Windows Bash (plain `bash.exe` launches WSL; enter WSL only through `wsl.exe` for Linux-native work). On Linux and macOS use Bash from PATH. Do not substitute PowerShell, `cmd.exe`, or batch for repository operations, and never encode machine-specific paths in workflows.

## 12. License header

TeamRun's own code is intended for distribution under the MIT license. The root `LICENSE` file must contain that license before distribution and is the license authority; this standards document does not replace it. Every repository-owned source, test, script, and generated file that supports comments begins with this exact header; generators emit it themselves, and formats without comments (such as JSON) are excluded:

```ts
/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
```

Third-party material is never copied in without checking its license and recording any obligation; AGPL-licensed references are read, not copied.

YAML configuration uses `#` comments containing the same license notice; it cannot use the TypeScript block-comment delimiters.

## 13. Tests

Packages tested through foundation Testing keep production and tests in sibling `src/` and `tests/` directories with separate compilation boundaries. Their tests mirror the source structure and filenames:

```text
src/services/snapshot-tracker.ts
tests/services/snapshot-tracker.test.ts
```

Never change production code solely to accommodate tests or coverage: no widened APIs, weakened visibility, test-only paths, or altered ownership. A test uses an accepted product boundary or is redesigned around one.

Every production file with executable behavior has a corresponding test file. Tests run by foundation Testing use the production type's name plus `Tests`; methods name the behavior they prove. Angular's mirrored `.spec.ts` files follow section 5. Playwright desktop workflows live in `src/desktop/tests/e2e`, with support files in its `fixtures` directory. They use `.spec.ts` files and descriptive test titles, without test classes or a one-to-one mapping to production files. Their TypeScript project and runner are separate from package-test compilation.

Tests exercise observable behavior, branches, boundaries and failures through the owning public API. Provider doubles are named fakes with scripted behavior. Regression tests record required behavior; live-provider tests are labelled and excluded from the default gate.

This section owns test authoring and placement; [TESTING.md](TESTING.md) owns runner behavior, coverage and evidence. Public API verification follows section 9, and failure handling follows section 7.

## 14. Enforcement

Standards that can be checked mechanically receive an automated guard when tooling exists; a guard enforces the rule's intent, not a filename spelling. Exceptions require an explicit reviewed change to this document, never an allowlist that silently weakens it.
