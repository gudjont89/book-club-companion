"""
Epub extraction tool for Book Club Companion.

Usage:
    python tools/extract.py <epub_file> [--output <output_dir>]

Extracts chapter text from an epub file and outputs chapters.json.
"""

import argparse
import glob
import json
import os
import zipfile
from pathlib import Path

try:
    from bs4 import BeautifulSoup
except ImportError:
    print("Error: beautifulsoup4 is required. Run: pip install beautifulsoup4 lxml")
    exit(1)


def extract_epub(epub_path: str, output_dir: str) -> None:
    """Extract chapter text from an epub file."""
    epub_path = Path(epub_path)
    output_dir = Path(output_dir)

    if not epub_path.exists():
        print(f"Error: {epub_path} not found")
        return

    # Create extraction directory
    extract_dir = output_dir / "book_extracted"
    extract_dir.mkdir(parents=True, exist_ok=True)

    # Unzip epub
    print(f"Extracting {epub_path}...")
    with zipfile.ZipFile(epub_path, "r") as z:
        z.extractall(extract_dir)

    # Find content files (look in common locations)
    content_dirs = ["OEBPS", "text", "Text", "content", "OPS"]
    xhtml_files = []

    for cdir in content_dirs:
        pattern = str(extract_dir / cdir / "*.xhtml")
        xhtml_files.extend(glob.glob(pattern))
        pattern = str(extract_dir / cdir / "*.html")
        xhtml_files.extend(glob.glob(pattern))

    # Fallback: search recursively
    if not xhtml_files:
        for ext in ["*.xhtml", "*.html"]:
            xhtml_files.extend(glob.glob(str(extract_dir / "**" / ext), recursive=True))

    xhtml_files.sort()

    if not xhtml_files:
        print("Error: No XHTML/HTML content files found in epub")
        return

    print(f"Found {len(xhtml_files)} content files")

    # Extract text from each file
    chapters = []
    for filepath in xhtml_files:
        with open(filepath, encoding="utf-8") as f:
            soup = BeautifulSoup(f.read(), "html.parser")

        text = soup.get_text(separator="\n").strip()

        # Skip very short pages (title pages, copyright, etc.)
        if len(text) < 200:
            continue

        chapters.append(
            {
                "file": os.path.basename(filepath),
                "text": text,
            }
        )

    # Write output
    output_file = output_dir / "chapters.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(chapters, f, indent=2, ensure_ascii=False)

    print(f"Extracted {len(chapters)} chapters to {output_file}")


def main():
    parser = argparse.ArgumentParser(description="Extract chapter text from an epub file")
    parser.add_argument("epub", help="Path to the epub file")
    parser.add_argument(
        "--output",
        "-o",
        default=None,
        help="Output directory (defaults to same directory as epub)",
    )
    args = parser.parse_args()

    output_dir = args.output or os.path.dirname(args.epub)
    extract_epub(args.epub, output_dir)


if __name__ == "__main__":
    main()
