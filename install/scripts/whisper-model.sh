#!/usr/bin/env bash
set -euo pipefail

# Whisper model for whisper-cpp (used by the meeting-segment-editor Claude skill)
# Downloads ggml-large-v3-q5_0 (~1.1 GB) to ~/.local/share/whisper-cpp/models

MODEL="ggml-large-v3-q5_0.bin"
MODEL_DIR="$HOME/.local/share/whisper-cpp/models"
URL="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/$MODEL"

if [[ -f "$MODEL_DIR/$MODEL" ]]; then
  echo "Whisper model already installed at $MODEL_DIR/$MODEL"
  exit 0
fi

echo "Downloading $MODEL to $MODEL_DIR..."
mkdir -p "$MODEL_DIR"
curl -fSL --progress-bar "$URL" -o "$MODEL_DIR/$MODEL.partial"
mv "$MODEL_DIR/$MODEL.partial" "$MODEL_DIR/$MODEL"

echo "Whisper model installed to $MODEL_DIR/$MODEL"
