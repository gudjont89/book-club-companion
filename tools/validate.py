"""
Structural validation tool for Book Club Companion data.

Usage:
    python tools/validate.py <book_slug>

Validates the JSON data files for a book against the expected schema
and cross-reference integrity rules.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Union


def load_json(path: Path) -> Union[dict, list]:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def validate_book(slug: str, data_dir: str = "data") -> list[str]:
    """Validate a book's data files. Returns a list of error messages."""
    errors = []
    book_dir = Path(data_dir) / slug

    if not book_dir.exists():
        return [f"Book directory not found: {book_dir}"]

    # Load all data files
    try:
        meta = load_json(book_dir / "meta.json")
        chunks = load_json(book_dir / "chunks.json")
        characters = load_json(book_dir / "characters.json")
        locations = load_json(book_dir / "locations.json")
    except FileNotFoundError as e:
        return [f"Missing data file: {e.filename}"]
    except json.JSONDecodeError as e:
        return [f"Invalid JSON: {e}"]

    char_meta = characters.get("meta", {})
    char_descs = characters.get("descriptions", {})
    loc_meta = locations.get("meta", {})
    loc_descs = locations.get("descriptions", {})
    sections = meta.get("sections", [])

    chunk_ids = {c["id"] for c in chunks}
    chunk_id_list = [c["id"] for c in chunks]

    # Check chunk IDs are unique
    if len(chunk_ids) != len(chunks):
        errors.append("Duplicate chunk IDs found")

    # Check every character ID in chunks exists in char_meta
    for chunk in chunks:
        for char_id in chunk.get("chars", []):
            if char_id not in char_meta:
                errors.append(
                    f"Chunk {chunk['id']}: character '{char_id}' not in character meta"
                )

    # Check every location ID in chunks exists in loc_meta
    for chunk in chunks:
        for loc_id in chunk.get("locs", []):
            if loc_id not in loc_meta:
                errors.append(
                    f"Chunk {chunk['id']}: location '{loc_id}' not in location meta"
                )

    # Check every intro reference is a valid chunk ID
    for char_id, char in char_meta.items():
        if char.get("intro") not in chunk_ids:
            errors.append(
                f"Character '{char_id}': intro '{char.get('intro')}' is not a valid chunk ID"
            )

    for loc_id, loc in loc_meta.items():
        if loc.get("intro") not in chunk_ids:
            errors.append(
                f"Location '{loc_id}': intro '{loc.get('intro')}' is not a valid chunk ID"
            )

    # Check every 'from' reference in descriptions is a valid chunk ID
    for char_id, descs in char_descs.items():
        for desc in descs:
            if desc.get("from") not in chunk_ids:
                errors.append(
                    f"Character '{char_id}' description: from '{desc.get('from')}' is not a valid chunk ID"
                )

    for loc_id, descs in loc_descs.items():
        for desc in descs:
            if desc.get("from") not in chunk_ids:
                errors.append(
                    f"Location '{loc_id}' description: from '{desc.get('from')}' is not a valid chunk ID"
                )

    # Check every character in meta has at least one description
    for char_id in char_meta:
        if char_id not in char_descs or len(char_descs[char_id]) == 0:
            errors.append(f"Character '{char_id}' has no descriptions")

    # Check every location in meta has at least one description
    for loc_id in loc_meta:
        if loc_id not in loc_descs or len(loc_descs[loc_id]) == 0:
            errors.append(f"Location '{loc_id}' has no descriptions")

    # Check section labels array length matches distinct part values
    part_values = {c["part"] for c in chunks}
    if len(sections) < len(part_values):
        errors.append(
            f"Section labels array has {len(sections)} entries but chunks use {len(part_values)} distinct part values"
        )

    # Check percentages increase monotonically
    prev_pct = -1
    for chunk in chunks:
        pct = chunk.get("pct", 0)
        if pct < prev_pct:
            errors.append(
                f"Chunk {chunk['id']}: percentage {pct} is less than previous {prev_pct}"
            )
        prev_pct = pct

    return errors


def main():
    parser = argparse.ArgumentParser(description="Validate book data files")
    parser.add_argument("slug", help="Book slug (directory name under data/)")
    parser.add_argument(
        "--data-dir",
        default="data",
        help="Path to data directory (default: data/)",
    )
    args = parser.parse_args()

    errors = validate_book(args.slug, args.data_dir)

    if errors:
        print(f"Found {len(errors)} error(s):")
        for err in errors:
            print(f"  - {err}")
        sys.exit(1)
    else:
        print(f"Validation passed for '{args.slug}'")


if __name__ == "__main__":
    main()
