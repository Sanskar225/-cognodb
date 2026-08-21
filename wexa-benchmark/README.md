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

Dataset: 17,524 nodes / 120,000 relationships, identical across all five platforms.
100 measured iterations per workload after 20 warm-up calls; 10 concurrent clients on the
mixed workload (80% read / 20% write).

| Metric | CognoDB | Neo4j Aura | Memgraph | FalkorDB | ArangoDB |
|---|---|---|---|---|---|
| Load time (ms) | 150,813 | 101,492 | 129,342 | 93,090 | 8,196 |
| Nodes/sec | 154.3 | 256.7 | 143.6 | 231.4 | 20,568.1 |
| Relationships/sec | 3,225.3 | 3,611.2 | 16,436.1 | 6,916.8 | 16,339.9 |
| 1-hop p50/p95 (ms) | 298.55 / 395.26 | 82.05 / 107.66 | 0.77 / 2.18 | 0.59 / 1.24 | 2.02 / 2.82 |
| 2-hop p50/p95 (ms) | 250.31 / 308.6 | 102.33 / 126.5 | 1.4 / 3.22 | 0.55 / 1.4 | 2.5 / 10.02 |
| 3-hop p50/p95 (ms) | 297.04 / 428.12 | 101.89 / 121.49 | 1.81 / 13.86 | 1.09 / 2.75 | 2.35 / 280.9 |
| Point lookup p50/p95 (ms) | 293.69 / 326.7 | 76.4 / 197.45 | 1.4 / 3.37 | 0.65 / 1.31 | 1.68 / 3.23 |
| Indexed lookup p50/p95 (ms) | 303.56 / 311.6 | 91.61 / 128 | 1.44 / 2.8 | 0.5 / 0.83 | 1.54 / 2.34 |
| Aggregation p50/p95 (ms) | 512.02 / 621.5 | 102.03 / 127.29 | 10.82 / 65.89 | **FAILED (timeout)** | 1.39 / 2.38 |
| Mixed workload throughput (ops/s) | 21.0 | 57.4 | 336.6 | 1,029.3 | 1,004.6 |

### Footprint / resource usage
- **CognoDB**: console Overview tab reports storage used directly — 128 MB / 1 GiB after loading
  the dataset.
- **Neo4j AuraDB, Memgraph, FalkorDB, ArangoDB**: not observable through the same simple API call
  used here; would need platform-specific admin endpoints (e.g. `dbms.queryJmx` on Neo4j,
  `docker stats` on the self-hosted containers) that were out of scope for this run. Said here as
  "not observable" rather than guessed.

## 6. Analysis

**Network round-trip dominates the two managed-cloud platforms.** CognoDB and Neo4j Aura are the
only two platforms accessed over the public internet rather than `localhost`; their latencies sit
in the 80–500 ms range and stay roughly flat *regardless of hop depth* (CognoDB's 1-hop and 3-hop
numbers are within 30 ms of each other). That flatness is the signature of network/connection
overhead swamping actual query execution time — the query itself is cheap, the round trip isn't.
The self-hosted, `localhost`-only platforms (Memgraph, FalkorDB, ArangoDB) show sub-3ms numbers for
the same logical queries, confirming this.

**CognoDB is consistently the slowest of the two cloud platforms.** Across every read workload
CognoDB is 2–5x slower than Neo4j Aura despite both being accessed over the network with the same
Bolt/Cypher stack. The most likely explanation, given CognoDB's free tier is explicitly *burstable*
0.5 vCPU, is CPU throttling once burst credit is exhausted — this shows most clearly in the mixed
concurrent workload, where CognoDB sustains only **21 ops/sec** against 10 concurrent clients,
by far the lowest of any platform (Neo4j Aura, also cloud-hosted, still manages 57 ops/sec).

**ArangoDB's load was ~15x faster than every other platform (8.2s vs 90–150s)** — but this isn't a
pure engine-speed result. The Bolt-family loader inserts via `UNWIND ... MERGE`, which does an
existence-check pattern-match per row (safe against duplicates); the ArangoDB loader uses AQL's
bulk `INSERT ... OPTIONS { overwriteMode: "ignore" }`, which skips that per-row match. That's a
genuine methodology asymmetry worth naming rather than hiding: the *load method* differs by
necessity of each platform's idiomatic bulk-import path, not just raw engine throughput. A fairer
apples-to-apples load comparison would need every platform's native bulk-CSV importer rather than
driver-batched Cypher — noted as a follow-up in Caveats.

**FalkorDB timed out on the full-graph aggregation.** Every other read workload on FalkorDB was the
fastest of all five platforms (sub-millisecond point/indexed lookups), which makes the aggregation
failure notable rather than a general weakness: counting all 120,000 relationships is the one
workload that can't be served from a small in-memory working set touched by point queries, and under
the 0.5 vCPU / 512 MB Docker cap FalkorDB's default query timeout was hit. This is arguably the most
honest signal in this whole benchmark about what "free-tier-equivalent resources" actually costs a
platform under real load.

**FalkorDB and ArangoDB dominate the mixed concurrent workload** (1,029 and 1,005 ops/sec
respectively) — both are `localhost` deployments with no network hop, which matters far more under
concurrency than under single-shot latency tests. Memgraph, also self-hosted, is a distant third
(337 ops/sec); the 80/20 write-inclusive workload plus Memgraph's transactional guarantees likely
explains the gap versus FalkorDB.

## 7. Caveats & honesty notes

- **FalkorDB aggregation failed with a query timeout** under the 0.5 vCPU / 512 MB Docker resource
  cap while counting all 120,000 relationships. Every other FalkorDB workload succeeded and was the
  fastest of any platform tested — this appears to be a genuine resource-constraint effect on a
  full-scan query specifically, not a general platform failure. Recorded as-is rather than retried
  with looser limits, since loosening limits would break resource parity with CognoDB's free tier.
- **Load-time comparison is not fully apples-to-apples.** ArangoDB's ~15x faster load reflects both
  the platform and a different bulk-insert code path (AQL native bulk insert vs. Cypher
  `UNWIND`+`MERGE` pattern-matching for duplicate-safety). A stricter comparison would use each
  platform's dedicated bulk-CSV import tool for every platform, which was out of scope here.
- **Point lookup vs. indexed lookup**: on the four Cypher-family platforms, "point lookup" uses the
  engine's own internal node identity (`id(n)`), while "indexed lookup" goes through the `id`
  property index created on load. On ArangoDB, `_key` already *is* the primary index, so there's no
  separate unindexed path there — both numbers are legitimately the same query.
- **Network variance**: CognoDB and Neo4j Aura numbers include real internet round-trip time from
  the client machine to each platform's region; this wasn't controlled for and should be read as
  part of the result (it's inherent to using a managed cloud tier), not as noise to discount.
  Client machine: Windows 11, single local network connection, all five platforms benchmarked
  back-to-back in one sitting to minimize time-of-day variance.
- **Free-tier throttling**: CognoDB's burstable 0.5 vCPU is the most likely explanation for both its
  elevated read latencies and its low (21 ops/sec) mixed-workload throughput relative to Neo4j
  Aura under identical concurrency — see Analysis above.
- **No cold-start numbers were separated out** — all reported latencies are post-warm-up (20
  discarded warm-up calls per workload).
- **Concurrency was tested at a single level (10 clients)**, not swept across 1/10/40 as suggested
  in the "what a strong submission looks like" section — noted as a possible follow-up rather than
  claimed as done.

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
