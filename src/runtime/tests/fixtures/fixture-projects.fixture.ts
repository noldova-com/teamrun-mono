/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IProjectsService } from "@noldova/teamrun-core";
import type { Project, ProjectIdParams, ProjectOpenParams } from "@noldova/teamrun-protocol";

export class FixtureProjects implements IProjectsService {
  private readonly projects: readonly Project[];

  public constructor(projects: readonly Project[]) {
    this.projects = projects;
  }

  public list(): readonly Project[] {
    return this.projects;
  }

  public find(projectId: string): Project | null {
    return this.projects.find(t => t.id === projectId) ?? null;
  }

  public open(_params: ProjectOpenParams): Project {
    throw new Error("Fixture projects are fixed.");
  }

  public forget(_params: ProjectIdParams): void {
    throw new Error("Fixture projects are fixed.");
  }
}
