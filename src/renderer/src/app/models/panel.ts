/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/teamrun-foundation-core";

import { PanelKind } from "../enums/panel-kind";
import { Resources } from "../resources";

export class Panel {
  public readonly kind: PanelKind;
  public readonly instance: string | null;
  public readonly key: string;

  public constructor(kind: PanelKind, instance: string | null = null) {
    if (!Panel.isValid(kind, instance))
      throw new RangeError(Resources.panelInstanceMessage);

    this.kind = kind;
    this.instance = instance;
    this.key = Object.isNull(instance) ? kind : `${kind}${Resources.panelKeySeparator}${instance}`;
  }

  public static fromKey(value: unknown): Panel | null {
    if (!Object.isString(value))
      return null;
    const separator = value.indexOf(Resources.panelKeySeparator);
    const kind = Object.values(PanelKind).find(t => t === (separator < 0 ? value : value.slice(0, separator)));
    const instance = separator < 0 ? null : value.slice(separator + 1);
    return Object.isUndefined(kind) || !Panel.isValid(kind, instance) ? null : new Panel(kind, instance);
  }

  public equals(other: Panel | null): boolean {
    return other?.key === this.key;
  }

  private static isValid(kind: PanelKind, instance: string | null): boolean {
    return Resources.singlePanelKinds.includes(kind) ? Object.isNull(instance) : !String.isNullOrEmpty(instance);
  }
}
