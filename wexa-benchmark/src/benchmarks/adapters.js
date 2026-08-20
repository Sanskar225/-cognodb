import neo4j from "neo4j-driver";
import { FalkorDB } from "falkordb";
import { Database } from "arangojs";
import { BOLT_PLATFORMS, FALKORDB, ARANGO } from "../config.js";
import { CYPHER, AQL } from "./queries.js";

export async function getAdapter(platformName) {
  if (["cognodb", "neo4j", "memgraph"].includes(platformName)) {
    const cfg = BOLT_PLATFORMS[platformName];
    if (!cfg?.uri) throw new Error(`Missing config for ${platformName} in .env`);
    const driver = neo4j.driver(cfg.uri, neo4j.auth.basic(cfg.user, cfg.password));
    return {
      queries: CYPHER,
      async run(queryText, params) {
        const session = driver.session();
        try {
          await session.run(queryText, params);
        } finally {
          await session.close();
        }
      },
      // Point lookup uses the database's own internal node identity (no
      // application index involved) -- fetch a sample of real internal ids
      // once so the point-lookup workload hits real, varied nodes.
      async getSampleInternalIds(n) {
        const session = driver.session();
        try {
          const res = await session.run(
            `MATCH (p:Person) RETURN id(p) AS iid LIMIT $n`,
            { n: neo4j.int(n) }
          );
          return res.records.map((r) => r.get("iid"));
        } finally {
          await session.close();
        }
      },
      async close() {
        await driver.close();
      },
    };
  }

  if (platformName === "falkordb") {
    const client = await FalkorDB.connect({ socket: { host: FALKORDB.host, port: FALKORDB.port } });
    const graph = client.selectGraph(FALKORDB.graph);
    return {
      queries: CYPHER,
      async run(queryText, params) {
        await graph.query(queryText, { params });
      },
      async getSampleInternalIds(n) {
        const res = await graph.query(`MATCH (p:Person) RETURN id(p) AS iid LIMIT ${n}`);
        return (res.data || []).map((row) => row.iid);
      },
      async close() {
        await client.close();
      },
    };
  }

  if (platformName === "arangodb") {
    const db = new Database({ url: ARANGO.url, databaseName: ARANGO.db, auth: { username: ARANGO.user, password: ARANGO.password } });
    return {
      queries: AQL,
      async run(queryText, params) {
        // AQL rejects bind vars that aren't referenced in the query text
        // (unlike Cypher, which ignores extras) -- strip anything unused
        // so the same generic params object can be passed for every query.
        const usedKeys = new Set([...queryText.matchAll(/@(\w+)/g)].map((m) => m[1]));
        const bindVars = {};
        for (const k of usedKeys) if (params && k in params) bindVars[k] = params[k];
        const cursor = await db.query({ query: queryText, bindVars });
        await cursor.all();
      },
      // ArangoDB has no separate "unindexed internal id" concept -- _key IS
      // the primary index, so point lookup and indexed lookup are
      // necessarily the same operation here. No getSampleInternalIds ->
      // runBenchmark.js falls back to reusing the indexed-lookup query and
      // notes this equivalence as a caveat in the README.
      async close() {},
    };
  }

  throw new Error(`Unknown platform: ${platformName}`);
}