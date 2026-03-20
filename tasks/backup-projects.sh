#!/bin/bash
set -e

OUTPUT=~/projects.tar.gz

echo "Creating $OUTPUT..."
tar --exclude='go' \
    --exclude='.go' \
    --exclude='node_modules' \
    --exclude='vendor' \
    --exclude='tmp' \
    --exclude='.gems' \
    --exclude='dotfiles' \
    -czvf "$OUTPUT" -C ~ projects

echo ""
echo "✓ Created: $OUTPUT"
ls -lh "$OUTPUT"
echo ""
echo "Copy this to your backup drive before resetting."
