/**
 * @file tests/__mocks__/obsidian.ts
 * @summary Unit tests for obsidian behavior.
 *
 * @exports
 *  - TFile
 *  - TFolder
 *  - Notice
 *  - Plugin
 *  - ItemView
 *  - MarkdownRenderer
 */

// tests/__mocks__/obsidian.ts
// ---------------------------------------------------------------------------
// Minimal shim for the "obsidian" module so that source files which
// `import { TFile, Notice, ... } from "obsidian"` can be loaded by Vitest
// without the real Obsidian runtime.
// ---------------------------------------------------------------------------

export class TFile {
  name = "";
  path = "";
  basename = "";
  extension = "";
}

export class TFolder {
  name = "";
  path = "";
  children: any[] = [];
}

export class Notice {
  constructor(_message: string, _timeout?: number) {}
}

export class Plugin {
  app: any = {};
  manifest: any = {};
  async loadData() { return {}; }
  async saveData(_data: any) {}
}

export class ItemView {
  app: any = {};
  containerEl: any = { empty() {}, createDiv() { return {}; } };
}

export class Modal {
  app: any = {};
  containerEl: any = {
    empty() {},
    createDiv() { return {}; },
  };
  contentEl: any = {
    empty() {},
    createDiv() { return {}; },
  };
  constructor(app?: any) {
    this.app = app ?? {};
  }
  open() {}
  close() {}
}

/** Element creation helper shared by the shims below. Returns `{}` outside jsdom. */
function shimEl(): any {
  const doc = (globalThis as any).activeDocument as Document | undefined;
  return doc?.createElement?.("div") ?? {};
}

/**
 * Base class for settings tabs.
 *
 * Its absence made every module that transitively imports the settings tab
 * throw `Class extends value undefined is not a constructor or null` at import
 * time, which kept the whole settings/analytics/reviewer surface out of the
 * test suite. See tests/view-surfaces-smoke.test.ts.
 */
export class PluginSettingTab {
  app: any;
  plugin: any;
  containerEl: any = shimEl();
  constructor(app?: any, plugin?: any) {
    this.app = app ?? {};
    this.plugin = plugin ?? {};
  }
  display(): void {}
  hide(): void {}
}

/** Chainable no-op settings row, so `new Setting(el).setName(..).addToggle(..)` works. */
export class Setting {
  settingEl: any = shimEl();
  nameEl: any = shimEl();
  descEl: any = shimEl();
  controlEl: any = shimEl();
  infoEl: any = shimEl();
  components: any[] = [];
  constructor(_containerEl?: any) {}
  setName(_name: string): this { return this; }
  setDesc(_desc: string): this { return this; }
  setHeading(): this { return this; }
  setClass(_cls: string): this { return this; }
  setTooltip(_tooltip: string, _options?: any): this { return this; }
  setDisabled(_disabled: boolean): this { return this; }
  setDynamicTooltip(): this { return this; }
  addText(_cb: (c: any) => any): this { return this; }
  addTextArea(_cb: (c: any) => any): this { return this; }
  addToggle(_cb: (c: any) => any): this { return this; }
  addDropdown(_cb: (c: any) => any): this { return this; }
  addSlider(_cb: (c: any) => any): this { return this; }
  addButton(_cb: (c: any) => any): this { return this; }
  addExtraButton(_cb: (c: any) => any): this { return this; }
  addSearch(_cb: (c: any) => any): this { return this; }
  addMomentFormat(_cb: (c: any) => any): this { return this; }
}

export class MarkdownRenderer {
  static render() { return Promise.resolve(); }
}

export function setIcon(_parent: HTMLElement, _iconId: string): void {}

/** Renders a LaTeX source into a placeholder element tagged with `data-math`
 *  so jsdom tests can assert that math was typeset without a real MathJax runtime. */
export function renderMath(source: string, display: boolean): HTMLElement {
  const doc = (globalThis as any).activeDocument as Document | undefined;
  const el = (doc?.createElement?.("span") ?? {}) as HTMLElement;
  el.setAttribute?.("data-math", source);
  el.setAttribute?.("data-display", String(display));
  return el;
}

export function finishRenderMath(): Promise<void> {
  return Promise.resolve();
}

export async function requestUrl(_params: any): Promise<any> {
  throw new Error("requestUrl is not mocked – use vi.mocked(requestUrl) in your test");
}
