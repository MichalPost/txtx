#!/usr/bin/env python3
"""Run npm build and show only errors/warnings/result."""
import subprocess, sys, os

result = subprocess.run(
    "npm run build",
    shell=True,
    cwd=os.path.join(os.path.dirname(__file__), "app-shell"),
    capture_output=True,
)

output = (result.stdout + result.stderr).decode("utf-8", errors="replace")
keywords = ("error", "Error", "warning", "built in", "✓")
lines = [l for l in output.splitlines() if any(k in l for k in keywords)]
for l in lines[:20]:
    print(l)

sys.exit(result.returncode)
