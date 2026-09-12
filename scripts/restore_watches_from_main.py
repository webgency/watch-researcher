#!/usr/bin/env python3
"""Rebuild data/watches.json as origin/main watches + scripts/four_new_watches.json."""
import json
import pathlib
import subprocess

main = subprocess.check_output(["git", "show", "origin/main:data/watches.json"])
watches = json.loads(main)
four = json.loads(pathlib.Path("scripts/four_new_watches.json").read_text())
assert len(watches) == 50, len(watches)
assert len(four) == 4, len(four)
out = watches + four
text = json.dumps(out, indent=2, ensure_ascii=False) + "\n"
pathlib.Path("data/watches.json").write_text(text)
print("wrote", len(out), "watches", len(text), "bytes")
print("last brands", [w.get("brand") for w in out[-4:]])
