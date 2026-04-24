#!/usr/bin/env python3
"""
search_code.py — Search source files with regex, print matches with context.

Usage:
    python search_code.py <pattern> [options]

Options:
    --dir DIR           Root directory to search (default: .)
    --ext EXT [EXT...]  File extensions to include (default: tsx ts jsx js css)
    --context N         Lines of context around each match (default: 2)
    --no-color          Disable ANSI color output
    --files-only        Only print filenames, not match lines
    --replace OLD NEW   Replace OLD pattern with NEW string in all matched files (dry-run by default)
    --apply             Actually write replacements (use with --replace)

Examples:
    python search_code.py "px-4.*text-sm" --ext tsx
    python search_code.py "<button" --dir app-shell/src --ext tsx --context 3
    python search_code.py "whitespace-nowrap" --ext tsx ts
    python search_code.py "px-4" --replace "px-4" "px-3" --apply --ext tsx
"""

import re
import sys
import os
import argparse
from pathlib import Path


# ── ANSI colours ──────────────────────────────────────────────────────────────
RESET  = "\033[0m"
RED    = "\033[31m"
GREEN  = "\033[32m"
YELLOW = "\033[33m"
CYAN   = "\033[36m"
BOLD   = "\033[1m"
DIM    = "\033[2m"


def colorize(text: str, color: str, use_color: bool) -> str:
    return f"{color}{text}{RESET}" if use_color else text


# ── File walker ───────────────────────────────────────────────────────────────
SKIP_DIRS = {".git", "node_modules", "target", "dist", ".next", "__pycache__", ".venv"}

def walk_files(root: Path, extensions: list[str]) -> list[Path]:
    exts = {e if e.startswith(".") else f".{e}" for e in extensions}
    results = []
    for dirpath, dirnames, filenames in os.walk(root):
        # prune skip dirs in-place
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fname in filenames:
            if Path(fname).suffix in exts:
                results.append(Path(dirpath) / fname)
    return sorted(results)


# ── Search ────────────────────────────────────────────────────────────────────
def search(
    pattern: str,
    root: Path,
    extensions: list[str],
    context: int,
    use_color: bool,
    files_only: bool,
) -> list[tuple[Path, list[tuple[int, str]]]]:
    """Return list of (file, [(lineno, line), ...]) for files with matches."""
    rx = re.compile(pattern)
    file_matches: list[tuple[Path, list[tuple[int, str]]]] = []

    for fpath in walk_files(root, extensions):
        try:
            lines = fpath.read_text(encoding="utf-8", errors="replace").splitlines()
        except OSError:
            continue

        hits: list[tuple[int, str]] = []
        for i, line in enumerate(lines):
            if rx.search(line):
                hits.append((i, line))

        if hits:
            file_matches.append((fpath, hits))

    return file_matches


def print_results(
    file_matches: list[tuple[Path, list[tuple[int, str]]]],
    pattern: str,
    root: Path,
    context: int,
    use_color: bool,
    files_only: bool,
) -> int:
    rx = re.compile(pattern)
    total = 0

    for fpath, hits in file_matches:
        rel = fpath.relative_to(root) if fpath.is_relative_to(root) else fpath
        print(colorize(f"\n{rel}", CYAN + BOLD, use_color))

        if files_only:
            print(f"  {len(hits)} match(es)")
            total += len(hits)
            continue

        try:
            lines = fpath.read_text(encoding="utf-8", errors="replace").splitlines()
        except OSError:
            continue

        printed_lines: set[int] = set()
        for lineno, _ in hits:
            start = max(0, lineno - context)
            end   = min(len(lines), lineno + context + 1)
            for i in range(start, end):
                if i in printed_lines:
                    continue
                printed_lines.add(i)
                prefix = f"  {i+1:>4} "
                line_text = lines[i]
                if i == lineno:
                    # highlight the match within the line
                    highlighted = rx.sub(
                        lambda m: colorize(m.group(), RED + BOLD, use_color),
                        line_text,
                    )
                    print(colorize(prefix, YELLOW, use_color) + highlighted)
                else:
                    print(colorize(prefix, DIM, use_color) + colorize(line_text, DIM, use_color))
            # separator between hit groups
            if context > 0:
                print(colorize("  " + "·" * 40, DIM, use_color))

        total += len(hits)

    return total


# ── Replace ───────────────────────────────────────────────────────────────────
def replace_in_files(
    file_matches: list[tuple[Path, list[tuple[int, str]]]],
    old_pattern: str,
    new_str: str,
    apply: bool,
    use_color: bool,
) -> None:
    rx = re.compile(old_pattern)
    for fpath, _ in file_matches:
        try:
            original = fpath.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue

        replaced, count = rx.subn(new_str, original)
        if count == 0:
            continue

        if apply:
            fpath.write_text(replaced, encoding="utf-8", newline="\n")
            print(colorize(f"  ✓ {fpath}  ({count} replacement(s))", GREEN, use_color))
        else:
            print(colorize(f"  ~ {fpath}  ({count} replacement(s)) [dry-run]", YELLOW, use_color))


# ── CLI ───────────────────────────────────────────────────────────────────────
def main() -> None:
    parser = argparse.ArgumentParser(
        description="Search (and optionally replace) patterns in source files.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("pattern", help="Regex pattern to search for")
    parser.add_argument("--dir", default=".", help="Root directory (default: .)")
    parser.add_argument("--ext", nargs="+", default=["tsx", "ts", "jsx", "js", "css"],
                        help="File extensions to search")
    parser.add_argument("--context", type=int, default=2, help="Context lines (default: 2)")
    parser.add_argument("--no-color", action="store_true", help="Disable colour output")
    parser.add_argument("--files-only", action="store_true", help="Only list filenames")
    parser.add_argument("--replace", nargs=2, metavar=("OLD", "NEW"),
                        help="Replace OLD regex with NEW string")
    parser.add_argument("--apply", action="store_true",
                        help="Actually write replacements (requires --replace)")

    args = parser.parse_args()
    use_color = not args.no_color and sys.stdout.isatty()
    root = Path(args.dir).resolve()

    print(f"Searching  {colorize(args.pattern, YELLOW, use_color)}"
          f"  in  {colorize(str(root), CYAN, use_color)}"
          f"  [{', '.join(args.ext)}]")

    file_matches = search(args.pattern, root, args.ext, args.context, use_color, args.files_only)

    if not file_matches:
        print(colorize("\nNo matches found.", DIM, use_color))
        return

    total = print_results(file_matches, args.pattern, root, args.context, use_color, args.files_only)
    print(f"\n{colorize(str(total), BOLD, use_color)} match(es) in "
          f"{colorize(str(len(file_matches)), BOLD, use_color)} file(s)")

    if args.replace:
        old_pat, new_str = args.replace
        action = "Applying" if args.apply else "Dry-run"
        print(f"\n{action} replacement: {colorize(old_pat, RED, use_color)} → {colorize(new_str, GREEN, use_color)}")
        replace_in_files(file_matches, old_pat, new_str, args.apply, use_color)
        if not args.apply:
            print(colorize("  (use --apply to write changes)", DIM, use_color))


if __name__ == "__main__":
    main()
