// Same logical workloads across every platform. Cypher text is shared by
// CognoDB / Neo4j / Memgraph / FalkorDB (all openCypher-family). ArangoDB
// gets an AQL translation of the identical logical query -- note this in
// the README as the one unavoidable query-language difference (5.3).

export const CYPHER = {
  hop1: `MATCH (a:Person {id: $id})-[:FRIEND]->(b) RETURN count(b) AS c`,
  hop2: `MATCH (a:Person {id: $id})-[:FRIEND]->()-[:FRIEND]->(b) RETURN count(DISTINCT b) AS c`,
  hop3: `MATCH (a:Person {id: $id})-[:FRIEND]->()-[:FRIEND]->()-[:FRIEND]->(b) RETURN count(DISTINCT b) AS c`,
  pointLookup: `MATCH (a:Person) WHERE id(a) = $internalId RETURN a LIMIT 1`,
  indexedLookup: `MATCH (a:Person {id: $id}) RETURN a`,
  aggregation: `MATCH (:Person)-[r:FRIEND]->() RETURN count(r) AS totalEdges`,
  writeOne: `MATCH (a:Person {id: $id}) SET a.touched = timestamp() RETURN a`,
};

export const AQL = {
  hop1: `FOR v IN 1..1 OUTBOUND CONCAT('persons/', @id) friends RETURN v`,
  hop2: `FOR v IN 2..2 OUTBOUND CONCAT('persons/', @id) friends RETURN DISTINCT v`,
  hop3: `FOR v IN 3..3 OUTBOUND CONCAT('persons/', @id) friends RETURN DISTINCT v`,
  pointLookup: `FOR p IN persons LIMIT 1 FILTER p._key == @id RETURN p`,
  indexedLookup: `FOR p IN persons FILTER p.id == @id RETURN p`,
  aggregation: `RETURN LENGTH(friends)`,
  writeOne: `FOR p IN persons FILTER p.id == @id UPDATE p WITH { touched: DATE_NOW() } IN persons`,
};
