// Samples the raw SNAP soc-Pokec edge list down to a size that comfortably
// fits every platform's free tier (target: ~150,000 relationships), and
// writes out clean nodes.csv / edges.csv for the loaders to consume.
//
// Sampling strategy: take an induced subgraph on a random set of "seed"
// node ids so the sample still has realistic graph structure (not just
// random disconnected edges) — needed for meaningful multi-hop traversals.
//
// Usage: node scripts/prepare-dataset.js [targetEdgeCount]

import fs from "fs";
import readline from "readline";

const RAW_PATH = "data/raw/soc-pokec-relationships.txt";
const TARGET_EDGES = parseInt(process.argv[2] || "150000", 10);
const SEED_NODE_COUNT = Math.round(TARGET_EDGES / 6); // heuristic, tuned below

async function main() {
  if (!fs.existsSync(RAW_PATH)) {
    console.error(
      `Missing ${RAW_PATH}. Run scripts/download-dataset.sh first.`
    );
    process.exit(1);
  }

  console.log("Pass 1: sampling seed node ids...");
  const allNodeIds = new Set();
  {
    const rl = readline.createInterface({
      input: fs.createReadStream(RAW_PATH),
    });
    let count = 0;
    for await (const line of rl) {
      if (!line.trim()) continue;
      const [a] = line.split("\t");
      count++;
      // reservoir-ish sample: keep every Nth-ish node id until we have enough
      if (allNodeIds.size < SEED_NODE_COUNT && Math.random() < 0.02) {
        allNodeIds.add(a);
      }
    }
    console.log(`Scanned ${count} raw edges, picked ${allNodeIds.size} seed nodes.`);
  }

  console.log("Pass 2: extracting induced edges among seed nodes...");
  const edges = [];
  const usedNodes = new Set();
  {
    const rl = readline.createInterface({
      input: fs.createReadStream(RAW_PATH),
    });
    for await (const line of rl) {
      if (!line.trim()) continue;
      const [a, b] = line.split("\t");
      if (allNodeIds.has(a) && allNodeIds.has(b)) {
        edges.push([a, b]);
        usedNodes.add(a);
        usedNodes.add(b);
        if (edges.length >= TARGET_EDGES) break;
      }
    }
  }

  console.log(`Final sample: ${usedNodes.size} nodes, ${edges.length} edges.`);

  fs.mkdirSync("data", { recursive: true });
  const nodesOut = fs.createWriteStream("data/nodes.csv");
  nodesOut.write("id:ID,label\n");
  for (const id of usedNodes) nodesOut.write(`${id},Person\n`);
  nodesOut.end();

  const edgesOut = fs.createWriteStream("data/edges.csv");
  edgesOut.write(":START_ID,:END_ID,type\n");
  for (const [a, b] of edges) edgesOut.write(`${a},${b},FRIEND\n`);
  edgesOut.end();

  console.log("Wrote data/nodes.csv and data/edges.csv");
  console.log("Update your README with these exact counts (section 5.1).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
