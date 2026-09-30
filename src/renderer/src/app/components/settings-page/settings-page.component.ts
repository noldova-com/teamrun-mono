/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { MatIconModule } from "@angular/material/icon";
import { MatListModule } from "@angular/material/list";

import { SettingsSection } from "../../enums/settings-section";
import { Resources } from "../../resources";
import { NavigationService } from "../../services/navigation.service";
import { SettingsAboutComponent } from "../settings-about/settings-about.component";
import { SettingsTeammatesComponent } from "../settings-teammates/settings-teammates.component";
import { SettingsAppearanceComponent } from "../settings-appearance/settings-appearance.component";
import { SettingsGalleryComponent } from "../settings-gallery/settings-gallery.component";
import { SettingsGeneralComponent } from "../settings-general/settings-general.component";
import { SettingsProvidersComponent } from "../settings-providers/settings-providers.component";
import { SettingsShortcutsComponent } from "../settings-shortcuts/settings-shortcuts.component";
import { SettingsTerminalComponent } from "../settings-terminal/settings-terminal.component";

@Component({
  selector: "tr-settings-page",
  imports: [
    MatIconModule, MatListModule, SettingsAboutComponent, SettingsTeammatesComponent, SettingsAppearanceComponent,
    SettingsGalleryComponent, SettingsGeneralComponent, SettingsProvidersComponent, SettingsShortcutsComponent, SettingsTerminalComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: "block" },
  templateUrl: "./settings-page.component.html"
})
export class SettingsPageComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly navigation: NavigationService = inject(NavigationService);
  protected readonly sections: readonly SettingsSection[] = Object.values(SettingsSection);
  protected readonly general: SettingsSection = SettingsSection.General;
  protected readonly appearance: SettingsSection = SettingsSection.Appearance;
  protected readonly providers: SettingsSection = SettingsSection.Providers;
  protected readonly teammates: SettingsSection = SettingsSection.Teammates;
  protected readonly terminal: SettingsSection = SettingsSection.Terminal;
  protected readonly shortcuts: SettingsSection = SettingsSection.Shortcuts;
  protected readonly gallery: SettingsSection = SettingsSection.Gallery;
}
