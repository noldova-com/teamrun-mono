/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";
import { ServiceException } from "@noldova/teamrun-foundation-services";
import { ErrorCode } from "@noldova/teamrun-protocol";
import { CommandRunner, ProcessTerminator } from "@noldova/teamrun-providers";

import { RegistryScope } from "../../enums/registry-scope.js";
import type { RegistryVariable } from "../../models/registry-variable.js";
import { ShellEnvironment } from "../../models/shell-environment.js";
import { Resources } from "../../resources.js";
import { WindowsEnvironmentReader } from "./windows-environment.reader.js";

export class TerminalEnvironment {
  private readonly platform: string;
  private readonly base: NodeJS.ProcessEnv;
  private readonly registry: WindowsEnvironmentReader | null;
  private readonly locale: string;

  public constructor(platform: string, base: NodeJS.ProcessEnv, registry: WindowsEnvironmentReader | null, locale: string) {
    this.platform = platform;
    this.base = base;
    this.registry = registry;
    this.locale = locale;
  }

  public static forPlatform(platform: string, base: NodeJS.ProcessEnv, locale: string): TerminalEnvironment {
    if (platform !== Resources.windowsPlatform)
      return new TerminalEnvironment(platform, base, null, locale);

    const systemRoot = base[Resources.systemRootVariable];
    if (Object.isUndefined(systemRoot))
      throw new ServiceException(ErrorCode.Unavailable, Resources.systemRootMissing);
    const reader = WindowsEnvironmentReader.forSystemRoot(systemRoot, new CommandRunner(new ProcessTerminator(platform)));
    return new TerminalEnvironment(platform, base, reader, locale);
  }

  public async create(): Promise<ShellEnvironment> {
    const environment = new ShellEnvironment(this.platform === Resources.windowsPlatform);
    for (const [name, value] of Object.entries(this.base))
      if (!Object.isUndefined(value))
        environment.set(name, value);
    for (const name of Resources.launchVariables)
      environment.delete(name);
    const desktop = environment.get(Resources.originalDesktopVariable);
    if (!Object.isUndefined(desktop)) {
      environment.set(Resources.desktopVariable, desktop);
      environment.delete(Resources.originalDesktopVariable);
    }
    if (!Object.isNull(this.registry))
      TerminalEnvironment.overlay(environment, await this.registry.read(this.base));
    environment.set(Resources.colorTermVariable, Resources.trueColorValue);
    if (this.platform !== Resources.windowsPlatform)
      environment.set(Resources.termVariable, Resources.terminalTermName);
    if (this.platform === Resources.macPlatform && Resources.localeVariables.every(t => Object.isUndefined(environment.get(t))))
      this.setLocale(environment);

    return environment;
  }

  private setLocale(environment: ShellEnvironment): void {
    const locale = new Intl.Locale(this.locale).maximize();
    if (Object.isUndefined(locale.region))
      environment.set(Resources.characterTypeVariable, Resources.utf8Locale);
    else
      environment.set(Resources.languageVariable, Resources.formatUtf8Locale(locale.language, locale.region));
  }

  private static overlay(environment: ShellEnvironment, variables: readonly RegistryVariable[]): void {
    const paths: string[] = [];
    for (const scope of [RegistryScope.System, RegistryScope.User, RegistryScope.Session]) {
      const scoped = variables.filter(t => t.scope === scope);
      for (const variable of [...scoped.filter(t => !t.isExpandable), ...scoped.filter(t => t.isExpandable)]) {
        const value = variable.isExpandable ? TerminalEnvironment.expand(variable.value, environment) : variable.value;
        if (variable.name.toUpperCase() === Resources.pathVariable.toUpperCase())
          paths.push(value.replace(Resources.trailingPathSeparators, String.empty));
        else
          environment.set(variable.name, value);
      }
    }
    if (paths.length > 0)
      environment.set(Resources.pathVariable, paths.join(Resources.windowsPathSeparator));
  }

  private static expand(value: string, environment: ShellEnvironment): string {
    return value.replace(Resources.environmentReferencePattern, (reference: string, name: string) => environment.get(name) ?? reference);
  }
}
