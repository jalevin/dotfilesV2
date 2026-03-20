#!/usr/bin/env bash
export GITHUB_PERSONAL_ACCESS_TOKEN=$(gh auth token)
exec npx -y @modelcontextprotocol/server-github "$@"
