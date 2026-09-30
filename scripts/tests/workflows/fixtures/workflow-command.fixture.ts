/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mock } from "node:test";

import WorkflowScriptFixture from "./workflow-script.fixture.ts";

mock.module("../../../script.ts", { exports: { default: WorkflowScriptFixture } });
