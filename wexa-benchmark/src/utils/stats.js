export function percentile(sortedArr, p) {
  if (sortedArr.length === 0) return null;
  const idx = Math.ceil((p / 100) * sortedArr.length) - 1;
  return sortedArr[Math.min(Math.max(idx, 0), sortedArr.length - 1)];
}

export function summarizeLatencies(latenciesMs) {
  const sorted = [...latenciesMs].sort((a, b) => a - b);
  return {
    count: sorted.length,
    p50: +percentile(sorted, 50).toFixed(2),
    p95: +percentile(sorted, 95).toFixed(2),
    p99: +percentile(sorted, 99).toFixed(2),
    min: +sorted[0].toFixed(2),
    max: +sorted[sorted.length - 1].toFixed(2),
    mean: +(sorted.reduce((a, b) => a + b, 0) / sorted.length).toFixed(2),
  };
}
