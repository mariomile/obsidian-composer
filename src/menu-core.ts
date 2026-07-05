export interface ComposerItem {
  id: string;
  label: string;
  icon: string;
  section: string;
  keywords?: string[];
  run: () => void | Promise<void>;
}

export function filterItems<T extends { label: string; section: string; keywords?: string[] }>(
  items: T[], query: string,
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter(
    (i) =>
      i.label.toLowerCase().includes(q) ||
      i.section.toLowerCase().includes(q) ||
      (i.keywords ?? []).some((k) => k.toLowerCase().includes(q)),
  );
}
