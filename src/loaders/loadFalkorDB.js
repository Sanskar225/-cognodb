// Loads data/nodes.csv + data/edges.csv into FalkorDB.
// FalkorDB speaks an openCypher subset over the Redis protocol, so the
// query text is intentionally kept as close as possible to the Bolt loader.

import fs from "fs";
import readline from "readline";
import { FalkorDB } from "falkordb";
import { FALKORDB } from "../config.js";

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

async function main() {
  const nodeRows = await readCsv("data/nodes.csv");
  const edgeRows = await readCsv("data/edges.csv");

  const client = await FalkorDB.connect({
    socket: { host: FALKORDB.host, port: FALKORDB.port },
  });
  const graph = client.selectGraph(FALKORDB.graph);

  const t0 = Date.now();
  for (let i = 0; i < nodeRows.length; i += BATCH_SIZE) {
    const batch = nodeRows.slice(i, i + BATCH_SIZE).map(([id]) => ({ id }));
    await graph.query(`UNWIND $batch AS row MERGE (p:Person {id: row.id})`, {
      params: { batch },
    });
    process.stdout.write(`\r  nodes: ${Math.min(i + BATCH_SIZE, nodeRows.length)}/${nodeRows.length}`);
  }
  console.log();
  const tNodesDone = Date.now();

  try {
    await graph.query(`CREATE INDEX FOR (p:Person) ON (p.id)`);
  } catch (e) {
    console.warn("Index creation warning:", e.message);
  }

  for (let i = 0; i < edgeRows.length; i += BATCH_SIZE) {
    const batch = edgeRows.slice(i, i + BATCH_SIZE).map(([a, b]) => ({ a, b }));
    await graph.query(
      `UNWIND $batch AS row
       MATCH (a:Person {id: row.a}), (b:Person {id: row.b})
       MERGE (a)-[:FRIEND]->(b)`,
      { params: { batch } }
    );
    process.stdout.write(`\r  edges: ${Math.min(i + BATCH_SIZE, edgeRows.length)}/${edgeRows.length}`);
  }
  console.log();
  const tDone = Date.now();

  const summary = {
    platform: "falkordb",
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
  fs.writeFileSync("results/falkordb-load.json", JSON.stringify(summary, null, 2));

  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
