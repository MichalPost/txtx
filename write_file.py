#!/usr/bin/env python3
"""
write_file.py — Reliably write text content to a file (UTF-8, LF endings).

Usage:
    python write_file.py <target> <source_file>
        Copy source_file → target

    python write_file.py <target> --string "some text"
        Write a literal string to target

    echo "hello" | python write_file.py <target> --stdin
        Read from stdin and write to target

    python write_file.py --batch pairs.txt
        Batch mode: pairs.txt contains lines of "target<TAB>source" pairs

Examples:
    python write_file.py app-shell/src/router.tsx _router_content.txt
    python write_file.py out.txt --string "hello world"
    python write_file.py --batch _batch.txt
"""

import sys
import os
import argparse


def write(target: str, content: str) -> None:
    content = content.replace("\r\n", "\n").replace("\r", "\n")
    parent = os.path.dirname(target)
    if parent:
        os.makedirs(parent, exist_ok=True)
    with open(target, "w", encoding="utf-8", newline="\n") as f:
        f.write(content)
    print(f"✓  {len(content):>8,} chars  →  {target}")


def read_file(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Write content to a file (UTF-8, LF line endings).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("target", nargs="?", help="Destination file path")

    src = parser.add_mutually_exclusive_group()
    src.add_argument("source_file", nargs="?", help="Source file to copy from")
    src.add_argument("--stdin",  action="store_true", help="Read content from stdin")
    src.add_argument("--string", metavar="TEXT",      help="Write this literal string")
    src.add_argument("--batch",  metavar="PAIRS_FILE",
                     help="Batch mode: file with 'target<TAB>source' lines")

    args = parser.parse_args()

    # ── Batch mode ──────────────────────────────────────────────────────────
    if args.batch:
        pairs = read_file(args.batch).splitlines()
        ok = 0
        for line in pairs:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split("\t", 1)
            if len(parts) != 2:
                print(f"⚠  Skipping malformed line: {line!r}", file=sys.stderr)
                continue
            tgt, src_path = parts
            write(tgt.strip(), read_file(src_path.strip()))
            ok += 1
        print(f"\nBatch done: {ok} file(s) written.")
        return

    # ── Single-file mode ────────────────────────────────────────────────────
    if not args.target:
        parser.error("target is required in single-file mode")

    if args.stdin:
        content = sys.stdin.read()
    elif args.string is not None:
        content = args.string
    elif args.source_file:
        content = read_file(args.source_file)
    else:
        parser.error("provide a source_file, --stdin, or --string")

    write(args.target, content)


if __name__ == "__main__":
    main()
