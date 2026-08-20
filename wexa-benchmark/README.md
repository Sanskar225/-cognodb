# CognoDB Cloud vs. Managed Graph Databases — A Fair Benchmark

Benchmarking [CognoDB Cloud](https://console.cognodb.com) against four other managed/self-hosted
graph database platforms on an identical dataset and identical workloads.

> ⚠️ **TODO before submitting**: run every `npm run bench:*` command, then `npm run report`,
> and paste the generated table from `results/RESULTS_TABLE.md` into the Results section below.
> Also fill in the Analysis and Caveats sections with what you actually observed.

## 1. Platforms compared

| Platform | Tier used | vCPU | RAM | Storage | Query language |
|---|---|---|---|---|---|
| **CognoDB Cloud** | Free (c0) | burst to 0.5 vCPU | 512 MB | 1 GiB | Cypher (Bolt) |
| **Neo4j AuraDB** | Free | shared | 1 GB (limited to 200k nodes / 400k rels) | — | Cypher (Bolt) |
| **Memgraph** | Self-hosted, docker-capped | 0.5 vCPU | 512 MB | 1 GiB volume | Cypher (Bolt) |
| **FalkorDB** | Self-hosted, docker-capped | 0.5 vCPU | 512 MB | 1 GiB volume | Cypher subset (Redis protocol) |
| **ArangoDB** | Self-hosted, docker-capped | 0.5 vCPU | 512 MB | 1 GiB volume | AQL |

**Why these five:** CognoDB and Neo4j Aura are both native property-graph, Bolt/Cypher platforms,
so they're the most directly comparable pair. Memgraph and FalkorDB are also Cypher-family but
run on very different storage engines (in-memory vs. Redis-module), which lets us compare
*engine* differences while holding the *query language* constant. ArangoDB is included
deliberately as the odd one out — a multi-model database with a different query language (AQL) —
so the analysis can discuss real language/engine trade-offs rather than just "who's faster."

### Fairness / resource parity

CognoDB's free tier is the smallest (burstable 0.5 vCPU / 512 MB RAM / 1 GiB disk), so that's
the ceiling every other platform is held to:

- Neo4j AuraDB Free is used as-is (Aura doesn't expose a vCPU dial on the free tier; its
  advertised limits are documented above).
- Memgraph, FalkorDB and ArangoDB are self-hosted via Docker with hard resource limits
  (see `docker/docker-compose.yml`: `cpus: "0.5"`, `memory: 512M`) so they never get more
  hardware than CognoDB's free tier.
- All benchmark client code runs from the same machine/region for every platform in a single
  run, back-to-back, to avoid network-variance bias.

## 2. Dataset

Source: [SNAP soc-Pokec social network](https://snap.stanford.edu/data/soc-Pokec.html)
(full graph: 1,632,803 nodes / 30,622,564 directed edges).

We sample an **induced subgraph** (not random disconnected edges, so multi-hop traversals stay
meaningful) down to roughly 150,000 relationships so it comfortably fits every platform's free
tier. Exact final counts:

- Nodes: `<TODO fill in after running prepare-dataset.js>`
- Relationships: `<TODO fill in>`

Reproduce it yourself:
```bash
bash scripts/download-dataset.sh      # downloads the raw SNAP edge list (needs internet)
npm run prepare-dataset               # samples down to data/nodes.csv + data/edges.csv
```

## 3. Setup

### 3.1 Install dependencies
```bash
npm install
cp .env.example .env
```

### 3.2 CognoDB Cloud
Already have an instance (see `console.cognodb.com` → Instances). Copy the connection URI and
the one-time password into `.env` as `COGNODB_URI` / `COGNODB_PASSWORD`.

### 3.3 Neo4j AuraDB Free
1. Sign up at https://console.neo4j.io, create a Free instance.
2. Download/copy the generated password immediately (shown once).
3. Fill `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD` in `.env`.

### 3.4 Memgraph / FalkorDB / ArangoDB (self-hosted, resource-capped)
```bash
cd docker
docker compose up -d
```
This starts all three with `--cpus=0.5 --memory=512m`. Default `.env` values already point at
`localhost` with the compose ports.

## 4. Running the benchmark

```bash
# 1. Load the identical dataset into every platform
npm run load:cognodb
npm run load:neo4j
npm run load:memgraph
npm run load:falkordb
npm run load:arangodb

# 2. Run the full workload suite against every platform (or run bench:<platform> individually)
npm run bench:all

# 3. Generate the Markdown results table
npm run report
```

Each `bench:*` run does, per platform, with `BENCH_WARMUP` warm-up calls discarded first and
`BENCH_ITERATIONS` measured calls (defaults: 20 warm-up / 100 measured, both configurable in `.env`):

- 1-hop / 2-hop / 3-hop traversal latency (p50 / p95)
- Indexed lookup latency (p50 / p95) — `id` is indexed on every platform (see loaders)
- Aggregation latency (p50 / p95) — count of all `FRIEND` edges
- Mixed workload — `BENCH_CONCURRENCY` concurrent clients, 80/20 read/write mix, sustained ops/sec

## 5. Results

*(Run `npm run report` and paste `results/RESULTS_TABLE.md` here.)*

| Metric | CognoDB | Neo4j Aura | Memgraph | FalkorDB | ArangoDB |
|---|---|---|---|---|---|
| Load time (ms) | | | | | |
| Nodes/sec | | | | | |
| Relationships/sec | | | | | |
| 1-hop p50/p95 (ms) | | | | | |
| 2-hop p50/p95 (ms) | | | | | |
| 3-hop p50/p95 (ms) | | | | | |
| Indexed lookup p50/p95 (ms) | | | | | |
| Aggregation p50/p95 (ms) | | | | | |
| Mixed workload throughput (ops/s) | | | | | |
| Stored data size | | | | | |

### Footprint / resource usage
CognoDB's console exposes storage used (see Overview tab). Note here what each platform exposes
vs. "not observable" for platforms that don't surface this on their free tier.

## 6. Analysis

*(TODO: write 1-2 paragraphs per notable finding once you have real numbers — e.g. "Memgraph's
in-memory engine gave the lowest traversal p95 because...", "CognoDB's burstable vCPU showed
higher variance under the concurrent mixed workload because...", etc. Tie every claim back to a
number in the table above.)*

## 7. Caveats & honesty notes

- Free-tier throttling: `<note anything you observed, e.g. Aura free connection limits, CognoDB
  burst-CPU throttling under sustained load>`
- Network variance: all runs were made from `<your location/region>`; cross-region latency to
  each platform's region is *not* controlled for and should be read as part of the result, not
  noise.
- Query-language differences: ArangoDB's AQL traversal (`FOR v IN 1..N OUTBOUND ...`) is not a
  byte-for-byte equivalent of Cypher's pattern match — both return the same logical result
  (reachable nodes at hop depth N) but the engines may optimize them differently.
- `<add any failed runs, timeouts, or anything else that happened during your actual runs>`

## 8. Repo structure

```
docker/                docker-compose.yml for self-hosted platforms (resource-capped)
scripts/                dataset download + sampling
src/config.js            reads all connection info from .env
src/loaders/              one loader per platform family (Bolt / FalkorDB / ArangoDB)
src/benchmarks/           workload definitions + generic runner + adapters
src/utils/                percentile stats + Markdown report generator
results/                  raw JSON output per platform, gitignored except final summary
```

## 9. Security note
No credentials are committed to this repo. All connection URIs and passwords are read from
environment variables via `.env` (gitignored) — copy `.env.example` and fill in your own.
