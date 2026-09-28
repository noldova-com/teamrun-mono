/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

import { Guid } from "@noldova/teamrun-foundation-core";
import type { JsonValue } from "@noldova/teamrun-foundation-json";
import { ServiceException } from "@noldova/teamrun-foundation-services";
import { type IProjectsService, RequestDispatcher } from "@noldova/teamrun-core";
import {
  ErrorCode,
  MethodName,
  type Project,
  type Request,
  Response,
  TerminalAcknowledgeParams,
  TerminalIdParams,
  TerminalInputParams,
  TerminalLinesParams,
  TerminalOpenParams,
  TerminalResizeParams,
  type TerminalSize
} from "@noldova/teamrun-protocol";

import type { IShellLocator } from "../../interfaces/i-shell-locator.js";
import type { ITerminalOwner } from "../../interfaces/i-terminal-owner.js";
import type { TerminalSettings } from "../../models/terminal-settings.js";
import { Resources } from "../../resources.js";
import { HostedTerminal } from "./hosted-terminal.js";
import type { TerminalEnvironment } from "./terminal-environment.js";

export class TerminalHost {
  private static readonly methods: ReadonlySet<string> = new Set([
    MethodName.TerminalList, MethodName.TerminalOpen, MethodName.TerminalInput, MethodName.TerminalResize, MethodName.TerminalRestart,
    MethodName.TerminalClose, MethodName.TerminalScreen, MethodName.TerminalLines, MethodName.TerminalAcknowledge
  ]);
  private readonly terminals: Map<string, HostedTerminal> = new Map();
  private readonly work: Set<Promise<void>> = new Set();
  private readonly projects: IProjectsService;
  private readonly directory: string;
  private readonly shells: IShellLocator;
  private readonly environment: TerminalEnvironment;
  private readonly settings: TerminalSettings;
  private stopped: boolean = false;

  public constructor(projects: IProjectsService, directory: string, shells: IShellLocator, environment: TerminalEnvironment, settings: TerminalSettings) {
    this.projects = projects;
    this.directory = directory;
    this.shells = shells;
    this.environment = environment;
    this.settings = settings;
  }

  public prepare(): void {
    rmSync(this.directory, { recursive: true, force: true });
    mkdirSync(this.directory, { recursive: true, mode: Resources.terminalDirectoryMode });
  }

  public handles(method: string): boolean {
    return TerminalHost.methods.has(method);
  }

  public async dispatch(owner: ITerminalOwner, request: Request): Promise<Response> {
    try {
      return Response.success(request.id, await this.invoke(owner, request.method, request.payload));
    }
    catch (error) {
      return Response.failure(request.id, RequestDispatcher.describe(error));
    }
  }

  public endOwnedBy(owner: ITerminalOwner): void {
    for (const terminal of [...this.terminals.values()].filter(t => t.owner === owner))
      this.end(terminal);
  }

  public async shutdown(): Promise<void> {
    this.stopped = true;
    for (const terminal of [...this.terminals.values()])
      this.end(terminal);
    await Promise.all(this.work);
  }

  private async invoke(owner: ITerminalOwner, method: string, payload: JsonValue): Promise<JsonValue> {
    switch (method) {
      case MethodName.TerminalList:
        return [...this.terminals.values()].filter(t => t.owner === owner).map(t => t.state.toJson());
      case MethodName.TerminalOpen:
        return (await this.open(owner, TerminalOpenParams.fromJson(payload))).state.toJson();
      case MethodName.TerminalInput: {
        const params = TerminalInputParams.fromJson(payload);
        this.find(owner, params.terminalId).input(params.data);
        return null;
      }
      case MethodName.TerminalResize: {
        const params = TerminalResizeParams.fromJson(payload);
        this.find(owner, params.terminalId).resize(params.size);
        return null;
      }
      case MethodName.TerminalRestart: {
        const terminal = this.find(owner, TerminalIdParams.fromJson(payload).terminalId);
        await terminal.restart(await this.environment.create());
        return terminal.state.toJson();
      }
      case MethodName.TerminalClose: {
        const terminal = this.find(owner, TerminalIdParams.fromJson(payload).terminalId);
        await this.end(terminal);
        return null;
      }
      case MethodName.TerminalScreen:
        return this.find(owner, TerminalIdParams.fromJson(payload).terminalId).screen().toJson();
      case MethodName.TerminalLines: {
        const params = TerminalLinesParams.fromJson(payload);
        return (await this.find(owner, params.terminalId).lines(params.start, params.limit)).toJson();
      }
      case MethodName.TerminalAcknowledge: {
        const params = TerminalAcknowledgeParams.fromJson(payload);
        this.find(owner, params.terminalId).acknowledge(params.characters);
        return null;
      }
      default:
        throw new ServiceException(ErrorCode.UnknownMethod, Resources.formatUnknownTerminalMethod(method), [method]);
    }
  }

  private async open(owner: ITerminalOwner, params: TerminalOpenParams): Promise<HostedTerminal> {
    const project = this.projects.find(params.projectId);
    if (Object.isNull(project))
      throw new ServiceException(ErrorCode.NotFound, Resources.terminalProjectNotFound, [params.projectId]);
    if (statSync(project.rootPath, { throwIfNoEntry: false })?.isDirectory() !== true)
      throw new ServiceException(ErrorCode.NotFound, Resources.terminalFolderMissing, [params.projectId]);

    const opening = this.start(owner, project, params.size);
    this.track(opening.then(() => undefined));
    return opening;
  }

  private async start(owner: ITerminalOwner, project: Project, size: TerminalSize): Promise<HostedTerminal> {
    if (this.stopped)
      throw new ServiceException(ErrorCode.Unavailable, Resources.terminalsStopped);
    const environment = await this.environment.create();
    const id = Guid.createVersion7().toString();
    const terminal = HostedTerminal.start(id, owner, project, this.shells.findDefault(environment), environment, size,
      join(this.directory, `${id}${Resources.terminalHistoryExtension}`), this.settings);
    if (this.stopped || owner.isClosed) {
      await terminal.close();
      throw new ServiceException(ErrorCode.Unavailable, Resources.terminalsStopped);
    }

    this.terminals.set(id, terminal);
    return terminal;
  }

  private find(owner: ITerminalOwner, terminalId: string): HostedTerminal {
    const terminal = this.terminals.get(terminalId);
    if (Object.isUndefined(terminal) || terminal.owner !== owner)
      throw new ServiceException(ErrorCode.NotFound, Resources.terminalNotFound, [terminalId]);

    return terminal;
  }

  private end(terminal: HostedTerminal): Promise<void> {
    this.terminals.delete(terminal.id);
    const closing = terminal.close();
    this.track(closing);
    return closing;
  }

  private track(work: Promise<void>): void {
    const settled = work.then(() => undefined, () => undefined);
    this.work.add(settled);
    void settled.then(() => this.work.delete(settled));
  }
}
