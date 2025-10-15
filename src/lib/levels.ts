export type LevelInfo = { level: number; curCap: number; nextCap: number; progressPct: number };

export function parseThresholds(): number[] {
  const raw = process.env.LEVEL_THRESHOLDS || "0,1000,2500,5000,10000,25000";
  const arr = raw.split(",").map(s => Number(s.trim())).filter(Number.isFinite) as number[];
  if (arr.length < 2) throw new Error("LEVEL_THRESHOLDS must include at least 2 numbers");
  return arr;
}

export function computeLevel(points = 0, thresholds = parseThresholds()): LevelInfo {
  const last = thresholds.length - 1;
  let level = 0;
  for (let i = 0; i < thresholds.length; i++) {
    const cur = thresholds[i], next = thresholds[i + 1] ?? thresholds[last];
    if (points >= cur && (i === last || points < next)) { level = i; break; }
  }
  const curCap = thresholds[level];
  const nextCap = thresholds[Math.min(level + 1, last)];
  const denom = Math.max(1, nextCap - curCap);
  const progressPct = Math.max(0, Math.min(100, Math.round(((points - curCap) / denom) * 100)));
  return { level, curCap, nextCap, progressPct };
}