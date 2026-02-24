"""Cross-check all IDs between heart-of-darkness data files."""

import json
import sys
from pathlib import Path


def main():
    data_dir = Path(__file__).resolve().parent.parent / "data" / "heart-of-darkness"

    with open(data_dir / "chunks.json", encoding="utf-8") as f:
        chunks = json.load(f)
    with open(data_dir / "characters.json", encoding="utf-8") as f:
        chars = json.load(f)
    with open(data_dir / "locations.json", encoding="utf-8") as f:
        locs = json.load(f)
    with open(data_dir / "summaries.json", encoding="utf-8") as f:
        summaries = json.load(f)

    char_ids = set(chars["meta"].keys())
    loc_ids = set(locs["meta"].keys())
    chunk_ids = set(c["id"] for c in chunks)
    summary_ids = set(s["chunkId"] for s in summaries)

    errors = []

    # Check all char/loc IDs in chunks exist in meta
    for chunk in chunks:
        for cid in chunk["chars"]:
            if cid not in char_ids:
                errors.append(f'Chunk {chunk["id"]}: char {cid} not in characters.meta')
        for lid in chunk["locs"]:
            if lid not in loc_ids:
                errors.append(f'Chunk {chunk["id"]}: loc {lid} not in locations.meta')

    # Check all chunk IDs have summaries and vice versa
    for cid in chunk_ids:
        if cid not in summary_ids:
            errors.append(f"Chunk {cid} has no summary")
    for sid in summary_ids:
        if sid not in chunk_ids:
            errors.append(f"Summary {sid} has no matching chunk")

    # Check descriptions reference valid chunk IDs
    for cid, descs in chars["descriptions"].items():
        if cid not in char_ids:
            errors.append(f"Character description for {cid} not in characters.meta")
        for d in descs:
            if d["from"] not in chunk_ids:
                errors.append(
                    f'Character {cid} description from {d["from"]} not a valid chunk'
                )

    for lid, descs in locs["descriptions"].items():
        if lid not in loc_ids:
            errors.append(f"Location description for {lid} not in locations.meta")
        for d in descs:
            if d["from"] not in chunk_ids:
                errors.append(
                    f'Location {lid} description from {d["from"]} not a valid chunk'
                )

    # Check intro fields reference valid chunk IDs
    for cid, meta in chars["meta"].items():
        if meta["intro"] not in chunk_ids:
            errors.append(f'Character {cid} intro {meta["intro"]} not a valid chunk')

    for lid, meta in locs["meta"].items():
        if meta["intro"] not in chunk_ids:
            errors.append(f'Location {lid} intro {meta["intro"]} not a valid chunk')

    # Check every character/location with meta also has descriptions
    desc_char_ids = set(chars["descriptions"].keys())
    for cid in char_ids:
        if cid not in desc_char_ids:
            errors.append(f"Character {cid} has meta but no descriptions")

    desc_loc_ids = set(locs["descriptions"].keys())
    for lid in loc_ids:
        if lid not in desc_loc_ids:
            errors.append(f"Location {lid} has meta but no descriptions")

    if errors:
        for e in errors:
            print(f"ERROR: {e}")
        sys.exit(1)
    else:
        print("All cross-checks passed!")
        print(f"  Chunks: {len(chunks)}")
        print(f"  Characters: {len(char_ids)}")
        print(f"  Locations: {len(loc_ids)}")
        print(f"  Summaries: {len(summaries)}")
        pcts = [c["pct"] for c in chunks]
        print(f"  PCT range: {min(pcts)} - {max(pcts)}")
        print(f"  Chunk IDs: {[c['id'] for c in chunks]}")


if __name__ == "__main__":
    main()
