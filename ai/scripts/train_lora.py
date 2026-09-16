#!/usr/bin/env python3
"""Local LoRA train for ARKIVE labels. No hosted training APIs."""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PREPARED = ROOT / "datasets" / "prepared"
ADAPTER = ROOT / "adapters" / "arkive-labels"
BASE_MODEL = "Qwen/Qwen2.5-7B-Instruct"


UNSLOTH_HINT = """
MLX-LM is for Apple Silicon. On Linux with an NVIDIA GPU, use Unsloth locally instead:

  python -m venv .venv && source .venv/bin/activate
  pip install unsloth
  # Train Qwen2.5-7B-Instruct LoRA against ai/datasets/prepared/*.jsonl
  # Export GGUF, then: ollama create arkive-labels -f ai/modelfiles/Modelfile.arkive-labels

Do not call any hosted training API.
"""


def has_mlx() -> bool:
    try:
        import mlx_lm  # noqa: F401
        return True
    except Exception:
        return False


def main() -> int:
    if not (PREPARED / "train.jsonl").exists() or not (PREPARED / "valid.jsonl").exists():
        print("Run: python3 ai/scripts/prepare_dataset.py", file=sys.stderr)
        return 1

    if sys.platform != "darwin" or not has_mlx():
        print("Apple Silicon + MLX-LM not available.")
        print(UNSLOTH_HINT)
        if shutil.which("uname"):
            print("Expected RAM: 32 GB unified memory is comfortable for Qwen2.5-7B LoRA on MLX.")
            print("16 GB machines should use a smaller base (qwen2.5:3b) or skip training.")
        return 2

    ADAPTER.mkdir(parents=True, exist_ok=True)
    cmd = [
        sys.executable,
        "-m",
        "mlx_lm.lora",
        "--model",
        BASE_MODEL,
        "--data",
        str(PREPARED),
        "--adapter-path",
        str(ADAPTER),
        "--batch-size",
        "1",
        "--lora-layers",
        "8",
        "--iters",
        "200",
    ]
    print("Running local MLX LoRA (this downloads the base model from Hugging Face once, then trains offline):")
    print(" ", " ".join(cmd))
    return subprocess.call(cmd)


if __name__ == "__main__":
    sys.exit(main())
