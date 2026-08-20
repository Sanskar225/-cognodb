import { execSync } from "child_process";

const platforms = ["cognodb", "neo4j", "memgraph", "falkordb", "arangodb"];

for (const p of platforms) {
  console.log(`\n=== ${p} ===`);
  try {
    execSync(`node src/benchmarks/runBenchmark.js ${p}`, { stdio: "inherit" });
  } catch (e) {
    console.error(`Benchmark FAILED for ${p}: ${e.message}`);
    console.error("Record this as a caveat in the README instead of hiding it.");
  }
}
