/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class Resources {
  public static readonly installationLinkFile: string = "installation.id";
  public static readonly installationIdPattern: RegExp = /^[a-f0-9]{64}$/;
  public static readonly installationLinkInvalid: string = "The installation link is invalid. Update preparation cannot safely continue.";
  public static readonly runtimeStopRequiresPause: string = "Only the connection holding an idle runtime pause can stop it for an update.";
  public static readonly runtimeShutdownFailed: string = "The runtime could not confirm a clean shutdown. The update was not installed.";
  public static readonly updateShutdownMilliseconds: number = 10_000;
  public static readonly updateRejectedPromise: string = "rejected";
  public static readonly stoppedForUpdate: string = "update";
  public static readonly installationIdField: string = "id";
  public static readonly installationRoleField: string = "role";
  public static readonly installationDataDirectoryField: string = "dataDirectory";
  public static readonly installationOwnerField: string = "ownerId";
  public static readonly installationTargetField: string = "targetVersion";
  public static readonly installationPhaseField: string = "phase";
  public static readonly installationExpiryField: string = "expiresAt";
  public static readonly installationEndpointInvalid: string = "An installation endpoint requires its capability token.";
  public static readonly installationArchiveName: string = "app.asar";
  public static readonly appImageVariable: string = "APPIMAGE";
  public static readonly installationHashAlgorithm: string = "sha256";
  public static readonly installationHashEncoding: "hex" = "hex";
  public static readonly installationRegistrySegments: readonly string[] = [".noldova", "teamrun-installations"];
  public static readonly installationRegistryFile: string = "instances.db";
  public static readonly installationDirectoryMode: number = 0o700;
  public static readonly installationJsonColumn: string = "json";
  public static readonly installationSchema: string = "CREATE TABLE IF NOT EXISTS members (id TEXT PRIMARY KEY, json TEXT NOT NULL); CREATE TABLE IF NOT EXISTS update_gate (id INTEGER PRIMARY KEY CHECK(id=1), json TEXT NOT NULL);";
  public static readonly installationBegin: string = "BEGIN IMMEDIATE";
  public static readonly installationCommit: string = "COMMIT";
  public static readonly installationRollback: string = "ROLLBACK";
  public static readonly installationPutMember: string = "INSERT OR REPLACE INTO members(id,json) VALUES (?,?)";
  public static readonly installationFindMember: string = "SELECT json FROM members WHERE id=?";
  public static readonly installationDeleteMember: string = "DELETE FROM members WHERE id=?";
  public static readonly installationSelectMembers: string = "SELECT json FROM members ORDER BY id";
  public static readonly installationSelectUpdate: string = "SELECT json FROM update_gate WHERE id=1";
  public static readonly installationPutUpdate: string = "INSERT OR REPLACE INTO update_gate(id,json) VALUES (1,?)";
  public static readonly installationDeleteUpdate: string = "DELETE FROM update_gate";
  public static readonly installationUpdating: string = "This TeamRun installation is preparing or installing an update. Try again when it finishes.";
  public static readonly installationMemberMissing: string = "A TeamRun instance is still starting or is not registered. Try again shortly.";
  public static readonly installationUpdateLost: string = "Update preparation expired or another process took ownership. The update was not installed.";
  public static formatRuntimeProductMismatch(expected: string, actual: string): string {
    return `TeamRun ${expected} cannot attach to runtime ${actual}. Close the other version after its work finishes, then retry.`;
  }
  public static readonly runtimePauseLeaseMilliseconds: number = 30_000;
  public static readonly runtimePauseBusy: string = "TeamRun is busy. Try preparing the update after active work finishes.";
  public static readonly runtimePaused: string = "TeamRun is preparing an update. New work is temporarily paused.";
  public static readonly runtimePauseOwned: string = "Another connection owns the runtime pause.";
  public static readonly runtimePausePayloadInvalid: string = "Runtime pause and resume require a null payload.";
  public static readonly grokProfileSegments: readonly string[] = ["profiles", "grok", "default"];
  public static readonly lockFileName: string = "runtime.lock";
  public static readonly processesFileName: string = "processes.json";
  public static readonly win32Platform: string = "win32";
  public static readonly taskListExecutable: string = "tasklist";
  public static readonly psExecutable: string = "ps";
  public static readonly linuxPlatform: string = "linux";
  public static readonly readLinkExecutable: string = "readlink";
  public static readonly quote: string = "\"";
  public static readonly unknownProcessId: number = 0;
  public static readonly lockTemporarySuffix: string = ".tmp";
  public static readonly ownershipFileSuffix: string = ".sqlite";
  public static readonly acquireOwnershipStatement: string = "BEGIN EXCLUSIVE";
  public static readonly socketFileName: string = "runtime.sock";
  public static readonly windowsPipePrefix: string = "\\\\.\\pipe\\teamrun-";
  public static readonly windowsPlatform: string = "win32";
  public static readonly loopbackHost: string = "127.0.0.1";
  public static readonly ephemeralPort: number = 0;
  public static readonly tokenByteLength: number = 32;
  public static readonly hexEncoding: BufferEncoding = "hex";
  public static readonly utf8Encoding: BufferEncoding = "utf8";
  public static readonly lockFileMode: number = 0o600;
  public static readonly lineSeparator: string = "\n";
  public static readonly requestIdSeparator: string = "-";
  public static readonly clientName: string = "teamrun";
  public static readonly clientTitle: string = "TeamRun";
  public static readonly pipeHashAlgorithm: string = "sha1";
  public static readonly pipeHashLength: number = 16;

  public static readonly dataEvent: string = "data";
  public static readonly closeEvent: string = "close";
  public static readonly errorEvent: string = "error";
  public static readonly endEvent: string = "end";
  public static readonly connectEvent: string = "connect";
  public static readonly listeningEvent: string = "listening";
  public static readonly interruptSignal: NodeJS.Signals = "SIGINT";
  public static readonly terminateSignal: NodeJS.Signals = "SIGTERM";

  public static readonly processIdField: string = "processId";
  public static readonly endpointField: string = "endpoint";
  public static readonly kindField: string = "kind";
  public static readonly portField: string = "port";
  public static readonly pathField: string = "path";
  public static readonly tokenField: string = "token";
  public static readonly protocolVersionField: string = "protocolVersion";
  public static readonly productVersionField: string = "productVersion";
  public static readonly startedAtField: string = "startedAt";

  public static readonly dataDirectoryArgument: string = "--data-dir";
  public static readonly productVersionArgument: string = "--product-version";
  public static readonly idleGraceArgument: string = "--idle-grace";
  public static readonly providersArgument: string = "--providers";
  public static readonly noProvidersValue: string = "none";
  public static readonly stopOnInputEndArgument: string = "--stop-on-input-end";
  public static readonly defaultProductVersion: string = "0.0.0";

  public static readonly helloTimeout: number = 5_000;
  public static readonly callTimeout: number = 600_000;
  public static readonly launchTimeout: number = 20_000;
  public static readonly launchPollInterval: number = 100;
  public static readonly idleGrace: number = 30_000;

  public static readonly dataDirectoryParameterName: string = "dataDirectory";
  public static readonly productVersionParameterName: string = "productVersion";
  public static readonly idleGraceParameterName: string = "idleGraceMilliseconds";
  public static readonly portParameterName: string = "port";
  public static readonly pathParameterName: string = "path";
  public static readonly socketPathParameterName: string = "socketPath";
  public static readonly tokenParameterName: string = "token";
  public static readonly processIdParameterName: string = "processId";
  public static readonly clientNameParameterName: string = "clientName";
  public static readonly helloTimeoutParameterName: string = "helloTimeout";
  public static readonly callTimeoutParameterName: string = "callTimeout";
  public static readonly launchTimeoutParameterName: string = "launchTimeout";
  public static readonly launchPollIntervalParameterName: string = "launchPollInterval";
  public static readonly entryPathParameterName: string = "entryPath";
  public static readonly executablePathParameterName: string = "executablePath";

  public static readonly tcpEndpointNeedsPort: string = "A TCP endpoint carries a port and no path.";
  public static readonly socketEndpointNeedsPath: string = "A socket endpoint carries a path and no port.";
  public static readonly dataDirectoryNotAbsolute: string = "The data directory must be an absolute path.";
  public static readonly serviceAlreadyStarted: string = "The runtime service was already started.";
  public static readonly serverAlreadyStarted: string = "The runtime server was already started.";
  public static readonly helloRequired: string = "The first message on a connection must be a hello.";
  public static readonly tokenRejected: string = "The capability token does not match this runtime.";
  public static readonly requestRequired: string = "Only requests are accepted after the hello.";
  public static readonly messageUnreadable: string = "The message could not be read.";
  public static readonly clientClosed: string = "The connection to the runtime is closed.";
  public static readonly helloTimedOut: string = "The runtime did not answer the hello in time.";
  public static readonly helloRefused: string = "The runtime refused the connection.";
  public static readonly invalidWelcomeVersion: string = "The runtime returned an invalid protocol version.";
  public static readonly launchTimedOut: string = "The runtime did not publish its endpoint in time.";
  public static readonly dataDirectoryRequired: string = "The --data-dir argument is required.";
  public static readonly stoppedByIdle: string = "idle";
  public static readonly stoppedBySignal: string = "signal";
  public static readonly stoppedByInputEnd: string = "input end";

  public static readonly macPlatform: string = "darwin";
  public static readonly versionSeparator: string = ".";
  public static readonly shellNameParameterName: string = "name";
  public static readonly executableParameterName: string = "executable";
  public static readonly variableNameParameterName: string = "name";
  public static readonly endMillisecondsParameterName: string = "endMilliseconds";
  public static readonly highWatermarkParameterName: string = "highWatermark";
  public static readonly lowWatermarkParameterName: string = "lowWatermark";
  public static readonly terminalsDirectoryName: string = "terminals";
  public static readonly terminalDirectoryMode: number = 0o700;
  public static readonly terminalHistoryExtension: string = ".jsonl";
  public static readonly terminalHistoryFlags: string = "w+";
  public static readonly terminalHistoryMode: number = 0o600;
  public static readonly terminalHistoryBlockLines: number = 64;
  public static readonly terminalHistoryReadBytes: number = 64 * 1024;
  public static readonly lineFeedByte: number = 0x0a;
  public static readonly terminalCaptureScrollback: number = 512;
  public static readonly terminalCompactionLines: number = 256;
  public static readonly terminalEndMilliseconds: number = 2_000;
  public static readonly terminalHighWatermark: number = 512 * 1024;
  public static readonly terminalLowWatermark: number = 128 * 1024;
  public static readonly forceKillSignal: string = "SIGKILL";
  public static readonly conptyBackend: "conpty" = "conpty";
  public static readonly normalBufferType: "normal" = "normal";
  public static readonly eraseInDisplayFinal: string = "J";
  public static readonly privatePrefix: string = "?";
  public static readonly fullResetFinal: string = "c";
  public static readonly eraseSavedLinesParameter: number = 3;
  public static readonly blankCell: string = " ";
  public static readonly terminalTermName: string = "xterm-256color";
  public static readonly termVariable: string = "TERM";
  public static readonly colorTermVariable: string = "COLORTERM";
  public static readonly trueColorValue: string = "truecolor";
  public static readonly languageVariable: string = "LANG";
  public static readonly characterTypeVariable: string = "LC_CTYPE";
  public static readonly localeVariables: readonly string[] = ["LANG", "LC_ALL", "LC_CTYPE"];
  public static readonly utf8Locale: string = "UTF-8";
  public static readonly launchVariables: readonly string[] = ["ELECTRON_RUN_AS_NODE", "APPIMAGE", "APPDIR", "ARGV0", "OWD"];
  public static readonly originalDesktopVariable: string = "ORIGINAL_XDG_CURRENT_DESKTOP";
  public static readonly desktopVariable: string = "XDG_CURRENT_DESKTOP";
  public static readonly shellVariable: string = "SHELL";
  public static readonly defaultUnixShell: string = "/bin/sh";
  public static readonly loginShellArgument: string = "-l";
  public static readonly pathVariable: string = "Path";
  public static readonly windowsPathSeparator: string = ";";
  public static readonly trailingPathSeparators: RegExp = /;+$/;
  public static readonly environmentReferencePattern: RegExp = /%([^%]+)%/g;
  public static readonly programFilesVariable: string = "ProgramFiles";
  public static readonly systemRootVariable: string = "SystemRoot";
  public static readonly powerShellName: string = "PowerShell";
  public static readonly powerShellExecutable: string = "pwsh.exe";
  public static readonly powerShellDirectorySegments: readonly string[] = ["PowerShell", "7"];
  public static readonly localAppDataVariable: string = "LOCALAPPDATA";
  public static readonly appAliasDirectorySegments: readonly string[] = ["Microsoft", "WindowsApps"];
  public static readonly windowsPowerShellName: string = "Windows PowerShell";
  public static readonly windowsPowerShellSegments: readonly string[] = ["System32", "WindowsPowerShell", "v1.0", "powershell.exe"];
  public static readonly windowsEnvironmentArguments: readonly string[] = ["-NoLogo", "-NoProfile", "-NonInteractive", "-EncodedCommand"];
  public static readonly windowsEnvironmentMilliseconds: number = 10_000;
  public static readonly windowsEnvironmentEnd: string = "End";
  public static readonly windowsEnvironmentFieldSeparator: string = " ";
  public static readonly windowsEnvironmentFieldCount: number = 4;
  public static readonly plainValueKind: string = "String";
  public static readonly expandableValueKind: string = "ExpandString";
  public static readonly base64Pattern: RegExp = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
  public static readonly base64Encoding: BufferEncoding = "base64";
  public static readonly utf16Encoding: BufferEncoding = "utf16le";
  public static readonly outputLinePattern: RegExp = /\r?\n/;
  public static readonly windowsEnvironmentScript: string = [
    "$ErrorActionPreference = 'Stop'",
    "$utf8 = [Text.Encoding]::UTF8",
    "$scopes = @(@('System', [Microsoft.Win32.Registry]::LocalMachine, 'SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment'), " +
      "@('User', [Microsoft.Win32.Registry]::CurrentUser, 'Environment'), " +
      "@('Session', [Microsoft.Win32.Registry]::CurrentUser, 'Volatile Environment'))",
    "foreach ($scope in $scopes) {",
    "  $key = $scope[1].OpenSubKey($scope[2])",
    "  if ($null -eq $key) { continue }",
    "  foreach ($name in $key.GetValueNames()) {",
    "    $kind = $key.GetValueKind($name)",
    "    if ($name -eq '' -or ($kind -ne 'String' -and $kind -ne 'ExpandString')) { continue }",
    "    $value = [string]$key.GetValue($name, '', 'DoNotExpandEnvironmentNames')",
    "    [Console]::Out.WriteLine(($scope[0], $kind, [Convert]::ToBase64String($utf8.GetBytes($name)), [Convert]::ToBase64String($utf8.GetBytes($value))) -join ' ')",
    "  }",
    "  $key.Close()",
    "}",
    "[Console]::Out.WriteLine('End')"
  ].join("\n");
  public static readonly windowsEnvironmentNotStarted: string = "Windows PowerShell could not start.";
  public static readonly windowsEnvironmentTimedOut: string = "Windows PowerShell did not answer in time.";
  public static readonly windowsEnvironmentUnreadable: string = "Windows PowerShell returned output TeamRun could not read.";
  public static readonly systemRootMissing: string = "Windows did not provide the SystemRoot variable, so TeamRun cannot find Windows PowerShell.";
  public static readonly terminalNotFound: string = "The terminal does not exist.";
  public static readonly terminalShellNotRunning: string = "The terminal's shell is not running. Restart the terminal to use it again.";
  public static readonly terminalProjectNotFound: string = "The project does not exist.";
  public static readonly terminalFolderMissing: string = "The project's folder does not exist.";
  public static readonly terminalsStopped: string = "TeamRun is closing its terminals, so no terminal can start now.";
  public static readonly storedLinesFailed: string = "The terminal's stored lines could not be written.";
  public static readonly storedLinesDamaged: string = "The terminal's stored lines are damaged.";

  public static formatVersionMismatch(client: string, runtime: string): string {
    return `The client speaks protocol ${client}, which runtime protocol ${runtime} cannot serve.`;
  }

  public static formatAlreadyRunning(processId: number, endpoint: string): string {
    return `A runtime for this data directory is already running (process ${processId}, endpoint ${endpoint}).`;
  }

  public static formatCallTimedOut(method: string): string {
    return `The runtime did not answer ${method} within the timeout.`;
  }

  public static formatLaunchFailed(reason: string): string {
    return `The runtime could not be started: ${reason}`;
  }

  public static formatTcpEndpoint(host: string, port: number): string {
    return `${host}:${port}`;
  }

  public static formatUnknownArgumentValue(argument: string, value: string): string {
    return `The argument ${argument} does not accept "${value}".`;
  }

  public static formatTaskListArguments(processId: number): readonly string[] {
    return ["/FI", `PID eq ${processId}`, "/FO", "CSV", "/NH"];
  }

  public static formatPsArguments(processId: number): readonly string[] {
    return ["-p", String(processId), "-o", "comm="];
  }

  public static formatProcessImageArguments(processId: number): readonly string[] {
    return [`/proc/${processId}/exe`];
  }

  public static formatUnknownTerminalMethod(method: string): string {
    return `${method} is not a terminal method.`;
  }

  public static formatWindowsEnvironmentFailed(reason: string): string {
    return `TeamRun could not read the environment variables from Windows. ${reason}`;
  }

  public static formatWindowsEnvironmentExit(exitCode: number | null): string {
    return `Windows PowerShell ended with exit code ${String(exitCode)}.`;
  }

  public static formatUtf8Locale(language: string, region: string): string {
    return `${language}_${region}.UTF-8`;
  }

}
