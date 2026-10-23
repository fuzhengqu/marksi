export interface QuickOpenItem {
  path: string;
  name: string;
  relativePath?: string;
  recent?: boolean;
}

export interface RankedQuickOpenItem extends QuickOpenItem {
  score: number;
}

function fuzzyScore(query: string, target: string): number | null {
  if (!query) {
    return 0;
  }

  const direct = target.indexOf(query);
  if (direct !== -1) {
    const startBonus = target.startsWith(query) ? 80 : Math.max(0, 50 - direct);
    const tightBonus = Math.max(0, 60 - (target.length - query.length));
    return 1_000 + startBonus + tightBonus;
  }

  let queryIndex = 0;
  let score = 0;
  let streak = 0;

  for (let targetIndex = 0; targetIndex < target.length; targetIndex += 1) {
    if (target[targetIndex] !== query[queryIndex]) {
      streak = 0;
      continue;
    }
    const previous = target[targetIndex - 1] ?? "";
    const boundary = /[\\/_.\-\s]/.test(previous);
    score += 10 + streak * 3 + (boundary ? 24 : 0);
    streak += 1;
    queryIndex += 1;
    if (queryIndex === query.length) {
      return score - Math.max(0, target.length - query.length);
    }
  }

  return null;
}

export function rankQuickOpen(
  items: QuickOpenItem[],
  query: string,
  limit = 60,
): RankedQuickOpenItem[] {
  const normalized = query.trim().toLocaleLowerCase();
  const ranked: RankedQuickOpenItem[] = [];

  for (const item of items) {
    const name = item.name.toLocaleLowerCase();
    const relativePath = (item.relativePath ?? item.path).toLocaleLowerCase();
    const nameScore = fuzzyScore(normalized, name);
    const pathScore = fuzzyScore(normalized, relativePath);
    if (nameScore === null && pathScore === null) {
      continue;
    }
    ranked.push({
      ...item,
      score:
        (nameScore ?? 0) * 2 +
        (pathScore ?? 0) +
        (item.recent ? 18 : 0),
    });
  }

  ranked.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return (left.relativePath ?? left.name).localeCompare(
      right.relativePath ?? right.name,
    );
  });

  return ranked.slice(0, limit);
}
