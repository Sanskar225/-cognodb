import dotenv from "dotenv";
dotenv.config();

export const BENCH = {
  iterations: parseInt(process.env.BENCH_ITERATIONS || "100", 10),
  warmup: parseInt(process.env.BENCH_WARMUP || "20", 10),
  concurrency: parseInt(process.env.BENCH_CONCURRENCY || "10", 10),
};

// Platforms that speak Bolt + Cypher (loaded/benchmarked the same way).
export const BOLT_PLATFORMS = {
  cognodb: {
    uri: process.env.COGNODB_URI,
    user: process.env.COGNODB_USER,
    password: process.env.COGNODB_PASSWORD,
  },
  neo4j: {
    uri: process.env.NEO4J_URI,
    user: process.env.NEO4J_USER,
    password: process.env.NEO4J_PASSWORD,
  },
  memgraph: {
    uri: process.env.MEMGRAPH_URI,
    user: process.env.MEMGRAPH_USER || "",
    password: process.env.MEMGRAPH_PASSWORD || "",
  },
};

export const FALKORDB = {
  host: process.env.FALKORDB_HOST || "localhost",
  port: parseInt(process.env.FALKORDB_PORT || "6379", 10),
  graph: process.env.FALKORDB_GRAPH || "benchmark",
};

export const ARANGO = {
  url: process.env.ARANGO_URL || "http://localhost:8529",
  db: process.env.ARANGO_DB || "benchmark",
  user: process.env.ARANGO_USER || "root",
  password: process.env.ARANGO_PASSWORD || "",
};
