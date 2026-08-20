// Loads data/nodes.csv + data/edges.csv into any Bolt+Cypher platform
// (CognoDB, Neo4j AuraDB, Memgraph). Same code, same queries, same batch
// size for every one of them -> fair comparison.
//
// Usage: node src/loaders/loadBoltDB.js <cognodb|neo4j|memgraph>

import fs from "fs";
import readline from "readline";
import neo4j from "neo4j-driver";
import { BOLT_PLATFORMS } from "../config.js";

const BATCH_SIZE = 1000;

async function readCsv(path) {
  const rl = readline.createInterface({ input: fs.createReadStream(path) });
  const rows = [];
  let header;
  for await (const line of rl) {
    if (!header) {
      header = line.split(",");
      continue;
    }
    rows.push(line.split(","));
  }
  return rows;
}

async function loadNodes(session, nodes) {
  for (let i = 0; i < nodes.length; i += BATCH_SIZE) {
    const batch = nodes.slice(i, i + BATCH_SIZE).map(([id, label]) => ({ id }));
    await session.run(
      `UNWIND $batch AS row
       MERGE (p:Person {id: row.id})`,
      { batch }
    );
    process.stdout.write(`\r  nodes: ${Math.min(i + BATCH_SIZE, nodes.length)}/${nodes.length}`);
  }
  console.log();
}

async function ensureIndex(session) {
  // Indexed lookup workload needs this. Document it in the README per DB.
  try {
    await session.run(`CREATE INDEX person_id IF NOT EXISTS FOR (p:Person) ON (p.id)`);
  } catch (e) {
    console.warn("Index creation warning (may already exist / unsupported syntax):", e.message);
  }
}

async function loadEdges(session, edges) {
  for (let i = 0; i < edges.length; i += BATCH_SIZE) {
    const batch = edges.slice(i, i + BATCH_SIZE).map(([a, b]) => ({ a, b }));
    await session.run(
      `UNWIND $batch AS row
       MATCH (a:Person {id: row.a}), (b:Person {id: row.b})
       MERGE (a)-[:FRIEND]->(b)`,
      { batch }
    );
    process.stdout.write(`\r  edges: ${Math.min(i + BATCH_SIZE, edges.length)}/${edges.length}`);
  }
  console.log();
}

async function main() {
  const platformName = process.argv[2];
  const cfg = BOLT_PLATFORMS[platformName];
  if (!cfg || !cfg.uri) {
    console.error(`Unknown or unconfigured platform "${platformName}". Check your .env.`);
    process.exit(1);
  }

  console.log(`Loading into ${platformName} ...`);
  const nodeRows = await readCsv("data/nodes.csv");
  const edgeRows = await readCsv("data/edges.csv");

  const driver = neo4j.driver(cfg.uri, neo4j.auth.basic(cfg.user, cfg.password));
  const session = driver.session();

  const t0 = Date.now();
  await loadNodes(session, nodeRows);
  const tNodesDone = Date.now();
  await ensureIndex(session);
  await loadEdges(session, edgeRows);
  const tDone = Date.now();

  const summary = {
    platform: platformName,
    nodeCount: nodeRows.length,
    edgeCount: edgeRows.length,
    nodeLoadMs: tNodesDone - t0,
    edgeLoadMs: tDone - tNodesDone,
    totalLoadMs: tDone - t0,
    nodesPerSec: +(nodeRows.length / ((tNodesDone - t0) / 1000)).toFixed(1),
    relsPerSec: +(edgeRows.length / ((tDone - tNodesDone) / 1000)).toFixed(1),
  };
  console.log("Load summary:", summary);

  fs.mkdirSync("results", { recursive: true });
  fs.writeFileSync(
    `results/${platformName}-load.json`,
    JSON.stringify(summary, null, 2)
  );

  await session.close();
  await driver.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
