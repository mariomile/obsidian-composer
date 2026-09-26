import { PluginSettingTab, Setting, type App } from 'obsidian';
import type ComposerPlugin from './main.ts';
import { DEFAULT_OUTLINE_SETTINGS, type OutlineSettings } from './outline/outline-settings.ts';

export interface ComposerSettings {
  hoverDelayMs: number;
  insertPosition: 'below' | 'above';
  /** '' = same folder as the note */
  baseFolder: string;
  templateFolder: string;
  artifactFolder: string;
  aiEnabled: boolean;
  exoCommandId: string;
  outline: OutlineSettings;
}

export const DEFAULT_SETTINGS: ComposerSettings = {
  hoverDelayMs: 150,
  insertPosition: 'below',
  baseFolder: '',
  templateFolder: 'Resources/Templates',
  artifactFolder: 'Resources/_artifacts',
  aiEnabled: true,
  exoCommandId: 'exo-agent:inline-edit',
  outline: { ...DEFAULT_OUTLINE_SETTINGS },
};

export class ComposerSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: ComposerPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName('Block handle')
      .setDesc('The hover handle with the + insert menu and block actions. Desktop only.')
      .setHeading();

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

    this.displayOutline(containerEl);
  }

  private displayOutline(containerEl: HTMLElement): void {
    const outline = this.plugin.settings.outline;
    const save = async (): Promise<void> => {
      await this.plugin.saveSettings();
      this.plugin.refreshOutline();
    };

    new Setting(containerEl)
      .setName('Outline')
      .setDesc('Heading ticks docked to the right edge of the note, expanding into a titled panel.')
      .setHeading();

    new Setting(containerEl)
      .setName('Show outline')
      .addToggle((t) => t
        .setValue(outline.enabled)
        .onChange(async (v) => {
          outline.enabled = v;
          await this.plugin.saveSettings();
          this.plugin.setOutlineEnabled(v);
        }));

    new Setting(containerEl)
      .setName('Minimum headings')
      .setDesc('Hide the outline when a note has fewer headings than this.')
      .addText((t) => t
        .setValue(String(outline.minHeadings))
        .onChange(async (v) => {
          const n = Number.parseInt(v, 10);
          outline.minHeadings = Number.isFinite(n) && n > 0 ? n : DEFAULT_OUTLINE_SETTINGS.minHeadings;
          await save();
        }));

    new Setting(containerEl)
      .setName('Show in reading view')
      .setDesc('Also show the outline in reading mode.')
      .addToggle((t) => t
        .setValue(outline.showInReadingView)
        .onChange(async (v) => {
          outline.showInReadingView = v;
          await save();
        }));

    new Setting(containerEl)
      .setName('Disable on mobile')
      .setDesc('Hide the outline on phone and tablet, keep it on desktop.')
      .addToggle((t) => t
        .setValue(outline.disableOnMobile)
        .onChange(async (v) => {
          outline.disableOnMobile = v;
          await save();
        }));
  }
}
