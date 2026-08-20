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
        const cursor = await db.query({ query: queryText, bindVars: params });
        await cursor.all();
      },
      async close() {},
    };
  }

  throw new Error(`Unknown platform: ${platformName}`);
}
