// Runs the full required workload set (5.2) against one platform and
// writes results/<platform>-bench.json.
//
// Usage: node src/benchmarks/runBenchmark.js <cognodb|neo4j|memgraph|falkordb|arangodb>

import fs from "fs";
import readline from "readline";
import { getAdapter } from "./adapters.js";
import { summarizeLatencies } from "../utils/stats.js";
import { BENCH } from "../config.js";

async function readNodeIds(path, sampleSize) {
  const rl = readline.createInterface({ input: fs.createReadStream(path) });
  const ids = [];
  let header;
  for await (const line of rl) {
    if (!header) {
      header = true;
      continue;
    }
    ids.push(line.split(",")[0]);
  }
  // shuffle + sample
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, sampleSize);
}

async function timeQuery(adapter, queryText, params) {
  const t0 = performance.now();
  await adapter.run(queryText, params);
  return performance.now() - t0;
}

async function runWorkload(adapter, name, queryText, sampleIds) {
  // warm-up
  for (let i = 0; i < BENCH.warmup; i++) {
    const id = sampleIds[i % sampleIds.length];
    await timeQuery(adapter, queryText, { id, internalId: 0 });
  }
  // measured
  const latencies = [];
  for (let i = 0; i < BENCH.iterations; i++) {
    const id = sampleIds[i % sampleIds.length];
    latencies.push(await timeQuery(adapter, queryText, { id, internalId: 0 }));
  }
  const summary = summarizeLatencies(latencies);
  console.log(`  ${name}: p50=${summary.p50}ms p95=${summary.p95}ms`);
  return summary;
}

async function runMixedWorkload(adapter, sampleIds) {
  const { concurrency, iterations } = BENCH;
  const perClient = Math.ceil(iterations / concurrency);
  const start = performance.now();
  let opsCompleted = 0;

  const worker = async () => {
    for (let i = 0; i < perClient; i++) {
      const id = sampleIds[Math.floor(Math.random() * sampleIds.length)];
      // 80/20 read/write mix
      if (Math.random() < 0.8) {
        await adapter.run(adapter.queries.hop1, { id });
      } else {
        await adapter.run(adapter.queries.writeOne, { id });
      }
      opsCompleted++;
    }
  };

  await Promise.all(Array.from({ length: concurrency }, worker));
  const elapsedSec = (performance.now() - start) / 1000;
  return {
    concurrency,
    totalOps: opsCompleted,
    elapsedSec: +elapsedSec.toFixed(2),
    throughputOpsPerSec: +(opsCompleted / elapsedSec).toFixed(1),
    readWriteMix: "80/20",
  };
}

async function main() {
  const platformName = process.argv[2];
  if (!platformName) {
    console.error("Usage: node src/benchmarks/runBenchmark.js <platform>");
    process.exit(1);
  }

  console.log(`Benchmarking ${platformName} ...`);
  const adapter = await getAdapter(platformName);
  const sampleIds = await readNodeIds("data/nodes.csv", Math.max(BENCH.iterations, 200));

  const results = { platform: platformName, config: BENCH, ranAt: new Date().toISOString() };

  results.hop1 = await runWorkload(adapter, "1-hop traversal", adapter.queries.hop1, sampleIds);
  results.hop2 = await runWorkload(adapter, "2-hop traversal", adapter.queries.hop2, sampleIds);
  results.hop3 = await runWorkload(adapter, "3-hop traversal", adapter.queries.hop3, sampleIds);
  results.indexedLookup = await runWorkload(adapter, "indexed lookup", adapter.queries.indexedLookup, sampleIds);
  results.aggregation = await runWorkload(adapter, "aggregation (count edges)", adapter.queries.aggregation, sampleIds);

  console.log("  mixed read/write workload...");
  results.mixedWorkload = await runMixedWorkload(adapter, sampleIds);

  await adapter.close();

  fs.mkdirSync("results", { recursive: true });
  fs.writeFileSync(`results/${platformName}-bench.json`, JSON.stringify(results, null, 2));
  console.log(`Saved results/${platformName}-bench.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
