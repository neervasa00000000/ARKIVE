# Optional local fine-tune for ARKIVE labels

This is **not** `ollama run` and it is **not** required for Suggest. Training is Phase 3, after Suggest already works and you have 20–50 corrected samples.

Inference in the app still talks only to `http://127.0.0.1:11434`. Each user runs Ollama on their own machine. There is no cloud-free public inference without local Ollama.

The app default remains `qwen2.5:7b` until you switch the Profile setting to `arkive-labels`.

Use synthetic or redacted notes only. Do not dump real vault plaintext or secrets into git.

## Hardware

| Machine | What works |
|---------|------------|
| Apple Silicon, 32 GB unified memory | MLX-LM LoRA on Qwen2.5-7B-Instruct is comfortable |
| Apple Silicon, 16 GB | Prefer a smaller base, fewer LoRA layers, or skip training and keep `qwen2.5:7b` |
| Linux NVIDIA, ~12 GB+ VRAM | Unsloth LoRA (see `scripts/train_lora.py` hint) |
| CPU-only | Do not train 7B. Use stock `qwen2.5:7b` in Ollama |

No hosted training APIs.

## Collect samples (Phase 2)

1. Use Suggest, then Accept or manually correct the title/tags/summary.
2. Click **Export suggestion sample (local)** — a JSONL line downloads. Nothing is uploaded.
3. Keep real collections in `ai/datasets/collected/` (gitignored). Copy only redacted/synthetic rows into `labels.train.jsonl`.

Collect 20–50 corrected examples before Phase 3.

```bash
python3 ai/scripts/prepare_dataset.py
# prints how many collected/*.jsonl files are present
```

## 1. Prepare dataset

```bash
python3 ai/scripts/prepare_dataset.py
```

Reads `ai/datasets/labels.train.jsonl` and `labels.valid.jsonl`, rejects secret-like rows, writes MLX chat JSONL to `ai/datasets/prepared/`.

Each source row:

```json
{"input":"NOTE PLAINTEXT HERE","output":{"title":"...","tags":["a","b"],"summary":"..."}}
```

## 2. Train LoRA (Apple Silicon)

```bash
pip install mlx-lm
python3 ai/scripts/train_lora.py
```

Adapter output: `ai/adapters/arkive-labels`.

The first run may download `Qwen/Qwen2.5-7B-Instruct` from Hugging Face onto this Mac. Training itself is local. This is not a hosted training API.

## 3. Export and create the Ollama model

```bash
bash ai/scripts/export_for_ollama.sh
ollama create arkive-labels -f ai/modelfiles/Modelfile.arkive-labels
```

Smoke test:

```bash
ollama run arkive-labels "Return JSON only: {\"title\":\"t\",\"tags\":[\"a\"],\"summary\":\"s\"}"
```

`Modelfile.arkive-labels` starts `FROM qwen2.5:7b` and forces JSON `{title,tags,summary}`. If you produce a GGUF adapter, the export script attaches `ADAPTER`.

## 4. Point ARKIVE at it

Profile → Local suggestions → model name `arkive-labels`. Endpoint must stay `http://127.0.0.1:11434` (or `http://localhost:11434`). Then re-test Suggest. Switching back to `qwen2.5:7b` still works.
