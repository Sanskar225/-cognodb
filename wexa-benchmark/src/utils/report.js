import fs from "fs";

const platforms = ["cognodb", "neo4j", "memgraph", "falkordb", "arangodb"];

function loadJson(path) {
  try {
    return JSON.parse(fs.readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

function row(label, getter) {
  const cells = platforms.map((p) => {
    const bench = loadJson(`results/${p}-bench.json`);
    const load = loadJson(`results/${p}-load.json`);
    const val = getter({ bench, load });
    return val === undefined || val === null ? "N/A" : val;
  });
  return `| ${label} | ${cells.join(" | ")} |`;
}

const lines = [];
lines.push(`| Metric | ${platforms.join(" | ")} |`);
lines.push(`|---|${platforms.map(() => "---").join("|")}|`);
lines.push(row("Load time (ms)", ({ load }) => load?.totalLoadMs));
lines.push(row("Nodes/sec", ({ load }) => load?.nodesPerSec));
lines.push(row("Relationships/sec", ({ load }) => load?.relsPerSec));
lines.push(row("1-hop p50/p95 (ms)", ({ bench }) => bench && `${bench.hop1.p50} / ${bench.hop1.p95}`));
lines.push(row("2-hop p50/p95 (ms)", ({ bench }) => bench && `${bench.hop2.p50} / ${bench.hop2.p95}`));
lines.push(row("3-hop p50/p95 (ms)", ({ bench }) => bench && `${bench.hop3.p50} / ${bench.hop3.p95}`));
lines.push(row("Point lookup p50/p95 (ms)", ({ bench }) => bench && `${bench.pointLookup.p50} / ${bench.pointLookup.p95}`));
lines.push(row("Indexed lookup p50/p95 (ms)", ({ bench }) => bench && `${bench.indexedLookup.p50} / ${bench.indexedLookup.p95}`));
lines.push(row("Aggregation p50/p95 (ms)", ({ bench }) => bench && `${bench.aggregation.p50} / ${bench.aggregation.p95}`));
lines.push(row("Mixed workload throughput (ops/s)", ({ bench }) => bench?.mixedWorkload?.throughputOpsPerSec));

const out = lines.join("\n");
console.log(out);
fs.writeFileSync("results/RESULTS_TABLE.md", out);
console.log("\nSaved to results/RESULTS_TABLE.md -- paste this into your README.");