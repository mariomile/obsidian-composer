import { PluginSettingTab, Setting, type App } from 'obsidian';
import type ComposerPlugin from './main.ts';

export interface ComposerSettings {
  hoverDelayMs: number;
  insertPosition: 'below' | 'above';
  /** '' = same folder as the note */
  baseFolder: string;
  templateFolder: string;
  artifactFolder: string;
  aiEnabled: boolean;
  exoCommandId: string;
}

export const DEFAULT_SETTINGS: ComposerSettings = {
  hoverDelayMs: 150,
  insertPosition: 'below',
  baseFolder: '',
  templateFolder: 'Resources/Templates',
  artifactFolder: 'Resources/_artifacts',
  aiEnabled: true,
  exoCommandId: 'exo:inline-edit',
};

export class ComposerSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: ComposerPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName('Hover delay')
      .setDesc('Milliseconds before the handle appears.')
      .addText((t) => t
        .setValue(String(this.plugin.settings.hoverDelayMs))
        .onChange(async (v) => {
          const n = Number(v);
          if (Number.isFinite(n) && n >= 0) {
            this.plugin.settings.hoverDelayMs = n;
            await this.plugin.saveSettings();
          }
        }));

    new Setting(containerEl)
      .setName('Default insert position')
      .setDesc('Where + inserts relative to the hovered block (⌥-click flips it).')
      .addDropdown((d) => d
        .addOption('below', 'Below')
        .addOption('above', 'Above')
        .setValue(this.plugin.settings.insertPosition)
        .onChange(async (v) => {
          this.plugin.settings.insertPosition = v as 'below' | 'above';
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('New base folder')
      .setDesc('Folder for bases created from the menu. Empty = same folder as the note.')
      .addText((t) => t
        .setPlaceholder('Same folder as note')
        .setValue(this.plugin.settings.baseFolder)
        .onChange(async (v) => {
          this.plugin.settings.baseFolder = v.trim();
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Template folder')
      .addText((t) => t
        .setValue(this.plugin.settings.templateFolder)
        .onChange(async (v) => {
          this.plugin.settings.templateFolder = v.trim();
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Artifact folder')
      .addText((t) => t
        .setValue(this.plugin.settings.artifactFolder)
        .onChange(async (v) => {
          this.plugin.settings.artifactFolder = v.trim();
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('AI section')
      .setDesc('Show "Ask Exo" in the insert menu (requires the Exo plugin).')
      .addToggle((t) => t
        .setValue(this.plugin.settings.aiEnabled)
        .onChange(async (v) => {
          this.plugin.settings.aiEnabled = v;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Exo command id')
      .addText((t) => t
        .setValue(this.plugin.settings.exoCommandId)
        .onChange(async (v) => {
          this.plugin.settings.exoCommandId = v.trim();
          await this.plugin.saveSettings();
        }));
  }
}
