// Loads data/nodes.csv + data/edges.csv into ArangoDB.
// ArangoDB is multi-model and uses AQL, not Cypher -- included deliberately
// so the README can discuss real query-language differences (see 5.3).

import fs from "fs";
import readline from "readline";
import { Database } from "arangojs";
import { ARANGO } from "../config.js";

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
  const sysDb = new Database({ url: ARANGO.url, auth: { username: ARANGO.user, password: ARANGO.password } });
  const dbs = await sysDb.listDatabases();
  if (!dbs.includes(ARANGO.db)) await sysDb.createDatabase(ARANGO.db);
  const db = sysDb.database(ARANGO.db);

  let personCol = db.collection("persons");
  if (!(await personCol.exists())) await personCol.create();
  let friendCol = db.collection("friends");
  if (!(await friendCol.exists())) await friendCol.create({ type: 3 }); // edge collection

  const nodeRows = await readCsv("data/nodes.csv");
  const edgeRows = await readCsv("data/edges.csv");

  const t0 = Date.now();
  for (let i = 0; i < nodeRows.length; i += BATCH_SIZE) {
    const batch = nodeRows.slice(i, i + BATCH_SIZE).map(([id]) => ({ _key: id, id }));
    await db.query({
      query: `FOR row IN @batch INSERT row INTO persons OPTIONS { overwriteMode: "ignore" }`,
      bindVars: { batch },
    });
    process.stdout.write(`\r  nodes: ${Math.min(i + BATCH_SIZE, nodeRows.length)}/${nodeRows.length}`);
  }
  console.log();
  const tNodesDone = Date.now();

  try {
    await personCol.ensureIndex({ type: "persistent", fields: ["id"] });
  } catch (e) {
    console.warn("Index creation warning:", e.message);
  }

  for (let i = 0; i < edgeRows.length; i += BATCH_SIZE) {
    const batch = edgeRows.slice(i, i + BATCH_SIZE).map(([a, b]) => ({
      _from: `persons/${a}`,
      _to: `persons/${b}`,
    }));
    await db.query({
      query: `FOR row IN @batch INSERT row INTO friends OPTIONS { overwriteMode: "ignore" }`,
      bindVars: { batch },
    });
    process.stdout.write(`\r  edges: ${Math.min(i + BATCH_SIZE, edgeRows.length)}/${edgeRows.length}`);
  }
  console.log();
  const tDone = Date.now();

  const summary = {
    platform: "arangodb",
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
  fs.writeFileSync("results/arangodb-load.json", JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
