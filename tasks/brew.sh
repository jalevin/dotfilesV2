#!/bin/bash

# Override SSH URL rewrites for this process only (1Password SSH agent may not be set up yet)
export GIT_CONFIG_COUNT=2
export GIT_CONFIG_KEY_0=url.https://github.com/.insteadOf
export GIT_CONFIG_VALUE_0=https://github.com/
export GIT_CONFIG_KEY_1=url.https://gitlab.com/.insteadOf
export GIT_CONFIG_VALUE_1=https://gitlab.com/

brew bundle --no-upgrade --file=install/Brewfile || true
