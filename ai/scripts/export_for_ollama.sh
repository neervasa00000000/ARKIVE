#!/usr/bin/env bash
# Fuse a local MLX LoRA (if present) and print the Ollama create command.
# Does not call any hosted training API.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ADAPTER="${ROOT}/adapters/arkive-labels"
EXPORT="${ROOT}/export"
MODELFILE="${ROOT}/modelfiles/Modelfile.arkive-labels"
FUSED="${EXPORT}/arkive-labels-fused"
GGUF_ADAPTER="${ADAPTER}/arkive-labels.gguf"

mkdir -p "${EXPORT}"

if python3 -c "import mlx_lm" >/dev/null 2>&1 && [[ -d "${ADAPTER}" ]]; then
  echo "Fusing MLX adapter into a local checkpoint..."
  python3 -m mlx_lm.fuse \
    --model Qwen/Qwen2.5-7B-Instruct \
    --adapter-path "${ADAPTER}" \
    --save-path "${FUSED}"
  echo "Fused model: ${FUSED}"
  echo "Optional: convert that checkpoint to GGUF with llama.cpp, then point FROM at the GGUF."
else
  echo "No MLX adapter to fuse. The Modelfile still works: FROM qwen2.5:7b plus a JSON system prompt."
fi

if [[ -f "${GGUF_ADAPTER}" ]]; then
  if ! grep -q '^ADAPTER ' "${MODELFILE}"; then
    printf '\nADAPTER %s\n' "${GGUF_ADAPTER}" >> "${MODELFILE}"
    echo "Attached GGUF adapter in ${MODELFILE}"
  fi
fi

echo
echo "Create the local Ollama model (still on this machine):"
echo "  ollama create arkive-labels -f ${MODELFILE}"
echo "Then in ARKIVE Profile → Local suggestions, set model to arkive-labels."
echo "Default remains qwen2.5:7b until you switch."
