/**
 * Given the pixel tops of each heading and the current scrollTop, return the
 * index of the active heading: the last heading whose top is at or above
 * (scrollTop + offset). Returns 0 if none qualify but headings exist, -1 if
 * the list is empty.
 */
export function activeHeadingIndex(
  tops: number[],
  scrollTop: number,
  offset: number,
): number {
  if (tops.length === 0) return -1;
  const threshold = scrollTop + offset;
  let active = 0;
  for (let i = 0; i < tops.length; i++) {
    if ((tops[i] ?? Infinity) <= threshold) active = i;
    else break;
  }
  return active;
}
