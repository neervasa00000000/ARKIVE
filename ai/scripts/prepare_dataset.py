#!/usr/bin/env python3
"""Convert ARKIVE synthetic label JSONL into MLX-LM chat format. Local only."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "datasets"
OUT = ROOT / "datasets" / "prepared"

SYSTEM = (
    "You label ARKIVE vault notes. Reply with JSON only: "
    '{"title":"...","tags":["..."],"summary":"..."}. No markdown.'
)

SECRETISH = re.compile(
    r"(BEGIN (RSA |OPENSSH )?PRIVATE KEY|\bsk-[A-Za-z0-9]{16,}|0x[a-fA-F0-9]{64})",
    re.I,
)


def load_split(name: str) -> list[dict]:
    path = SRC / name
    rows = []
    for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip():
            continue
        row = json.loads(line)
        if "input" not in row or "output" not in row:
            raise SystemExit(f"{path}:{line_no} missing input/output")
        text = str(row["input"])
        out = row["output"]
        if not isinstance(out, dict) or "title" not in out or "tags" not in out or "summary" not in out:
            raise SystemExit(f"{path}:{line_no} output must be {{title, tags, summary}}")
        if SECRETISH.search(text) or SECRETISH.search(json.dumps(out)):
            raise SystemExit(f"{path}:{line_no} looks like a real secret — use synthetic notes only")
        if "SYNTHETIC" not in text.upper():
            raise SystemExit(f"{path}:{line_no} training notes must be marked SYNTHETIC EXAMPLE")
        rows.append(row)
    if not 8 <= len(rows) <= 80:
        raise SystemExit(f"{path} should contain 8–80 synthetic rows, found {len(rows)}")
    return rows


def to_mlx(row: dict) -> dict:
    return {
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": row["input"]},
            {"role": "assistant", "content": json.dumps(row["output"], ensure_ascii=False)},
        ]
    }


def write_split(name: str, rows: list[dict]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    dest = OUT / name
    with dest.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(to_mlx(row), ensure_ascii=False) + "\n")
    print(f"wrote {len(rows)} rows -> {dest}")


def count_collected() -> int:
    folder = SRC / "collected"
    if not folder.exists():
        return 0
    return len(list(folder.glob("*.jsonl")))


def main() -> int:
    collected = count_collected()
    print(f"collected local samples: {collected} (gitignored; copy redacted rows into labels.train.jsonl)")
    if collected < 20:
        print("Collect 20–50 corrected examples before Phase 3 if you want a style adapter.")
    train = load_split("labels.train.jsonl")
    valid = load_split("labels.valid.jsonl")
    write_split("train.jsonl", train)
    write_split("valid.jsonl", valid)
    print("Dataset ready for local LoRA. App default model stays qwen2.5:7b until you switch.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
