import fs from "fs";

const platforms = ["cognodb", "neo4j", "memgraph", "falkordb", "arangodb"];

function loadJson(path) {
  try {
    return JSON.parse(fs.readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

function fmt(entry) {
  if (!entry) return "N/A";
  if (entry.failed) return "FAILED (see caveats)";
  return `${entry.p50} / ${entry.p95}`;
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
lines.push(row("1-hop p50/p95 (ms)", ({ bench }) => bench && fmt(bench.hop1)));
lines.push(row("2-hop p50/p95 (ms)", ({ bench }) => bench && fmt(bench.hop2)));
lines.push(row("3-hop p50/p95 (ms)", ({ bench }) => bench && fmt(bench.hop3)));
lines.push(row("Point lookup p50/p95 (ms)", ({ bench }) => bench && fmt(bench.pointLookup)));
lines.push(row("Indexed lookup p50/p95 (ms)", ({ bench }) => bench && fmt(bench.indexedLookup)));
lines.push(row("Aggregation p50/p95 (ms)", ({ bench }) => bench && fmt(bench.aggregation)));
lines.push(row("Mixed workload throughput (ops/s)", ({ bench }) =>
  bench?.mixedWorkload?.failed ? "FAILED (see caveats)" : bench?.mixedWorkload?.throughputOpsPerSec
));

const out = lines.join("\n");
console.log(out);
fs.writeFileSync("results/RESULTS_TABLE.md", out);
console.log("\nSaved to results/RESULTS_TABLE.md -- paste this into your README.");