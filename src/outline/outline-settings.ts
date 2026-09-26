export interface OutlineSettings {
  enabled: boolean;
  minHeadings: number;
  showInReadingView: boolean;
  disableOnMobile: boolean;
}

export const DEFAULT_OUTLINE_SETTINGS: OutlineSettings = {
  enabled: true,
  minHeadings: 2,
  showInReadingView: true,
  disableOnMobile: false,
};

/** Where the retired standalone Notion Outline plugin kept its settings. */
export function legacyOutlineDataPath(configDir: string): string {
  return `${configDir}/plugins/notion-outline/data.json`;
}

/**
 * Pick the outline settings out of the old `notion-outline` data.json, keeping
 * only keys with the right type. Anything else (missing file, bad JSON, a
 * foreign shape) yields an empty object, so the defaults stand.
 */
export function parseLegacyOutlineSettings(raw: string | null): Partial<OutlineSettings> {
  if (!raw) return {};
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!data || typeof data !== "object") return {};
  const src = data as Record<string, unknown>;
  const out: Partial<OutlineSettings> = {};
  if (typeof src.minHeadings === "number" && Number.isFinite(src.minHeadings) && src.minHeadings > 0) {
    out.minHeadings = src.minHeadings;
  }
  if (typeof src.showInReadingView === "boolean") out.showInReadingView = src.showInReadingView;
  if (typeof src.disableOnMobile === "boolean") out.disableOnMobile = src.disableOnMobile;
  return out;
}
