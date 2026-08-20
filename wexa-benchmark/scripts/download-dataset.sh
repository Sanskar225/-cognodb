#!/usr/bin/env bash
# Downloads the SNAP soc-Pokec social network dataset.
# Source: https://snap.stanford.edu/data/soc-Pokec.html
# Full graph: 1,632,803 nodes / 30,622,564 directed edges.
# We only need a small sample (see scripts/prepare-dataset.js), so we
# download the edge list once and sample locally rather than re-downloading.

set -e
mkdir -p data/raw
cd data/raw

if [ ! -f soc-pokec-relationships.txt ]; then
  echo "Downloading soc-pokec-relationships.txt.gz ..."
  curl -L -o soc-pokec-relationships.txt.gz \
    https://snap.stanford.edu/data/soc-pokec-relationships.txt.gz
  gunzip soc-pokec-relationships.txt.gz
fi

echo "Done. Raw edge list at data/raw/soc-pokec-relationships.txt"
echo "Next: npm run prepare-dataset"
