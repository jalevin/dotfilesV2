# ── ZSH ────────────────────────────────────────────────────────────────────────

# History
HISTFILE=~/.histfile
HISTSIZE=1000000
SAVEHIST=100000
setopt hist_expire_dups_first
setopt hist_find_no_dups
setopt hist_verify
setopt inc_append_history

# Options
unsetopt autocd beep extendedglob notify

# Keybindings
bindkey -e
bindkey "^[[H" beginning-of-line
bindkey "^[[F" end-of-line

# Completion
zstyle :compinstall filename "$HOME/.zshrc"
autoload -Uz compinit && compinit
autoload -U +X bashcompinit && bashcompinit

# ── Environment ─────────────────────────────────────────────────────────────────

# XDG Base Directory
export XDG_CONFIG_HOME="$HOME/.config"
export XDG_DATA_HOME="$HOME/.local/share"
export XDG_CACHE_HOME="$HOME/.cache"

# Homebrew
if [[ $(sysctl -n machdep.cpu.brand_string) =~ "Apple" ]]; then
  export BREW_PATH="/opt/homebrew/"
else
  export BREW_PATH="/usr/local/"
fi
export HOMEBREW_NO_ANALYTICS=1
export HOMEBREW_NO_AUTO_UPDATE=1
export HOMEBREW_GITHUB_API_TOKEN="ea146b5cef777f50d0078d34149cfe4b5acfdb34"

# PATH
export PATH="${BREW_PATH}/opt/libpq/bin:$PATH"
export PATH="${BREW_PATH}/opt/ansible@2.0/bin:$PATH"
export PATH="${BREW_PATH}/opt/awscli:$PATH"
export PATH="/Users/jeff/google-cloud-sdk/bin:$PATH"
export PATH="/Users/jeff/projects/g/deployment_tools/scripts/gcom/:$PATH"

# General
export EDITOR="nvim"
export TERM=xterm-256color
export CLICOLOR=1
ulimit -S -n 16384

# ── Tools ──────────────────────────────────────────────────────────────────────

# Go
export GOPATH="$HOME/projects/go"
#export GOPRIVATE=github.com/grafana/*
export PATH="${PATH}:$GOPATH/bin"
alias gor="go run"
godoc() { go doc -u "$@" | bat -l go }
gosrc() { go doc -u -src "$@" | bat -l go }

# mise — universal version manager (replaces pyenv, rbenv)
eval "$(mise activate zsh)"

# pnpm
export PNPM_HOME="/Users/jeff/Library/pnpm"
case ":$PATH:" in
  *":$PNPM_HOME:"*) ;;
  *) export PATH="$PNPM_HOME:$PATH" ;;
esac

# AWS
alias aws-ident="aws sts get-caller-identity"
alias aws-unset="unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN AWS_DEFAULT_REGION && echo 'Cleared AWS Credentials'"

# Kubernetes / Grafana
export USE_GKE_GCLOUD_AUTH_PLUGIN=True
alias k="kubectl"
alias gk="$HOME/projects/g/grafana/bin/grafana kubectl"
argo-auth() {
  export ARGO_SERVER="argo-workflows.grafana.net:443"
  export ARGO_HTTP1=true
  export ARGO_SECURE=true
  export ARGO_TOKEN="Bearer $(kubectl get secret argo-workflows-server.service-account-token -n argo-workflows -o=jsonpath="{.data.token}" | base64 --decode)"
}

# Docker
export DOCKER_ID_USER="levinology"
alias cleandocker="docker system prune -f"

# gcloud
if [ -f '/Users/jeff/Downloads/google-cloud-sdk/path.zsh.inc' ]; then
  . '/Users/jeff/Downloads/google-cloud-sdk/path.zsh.inc'
fi
if [ -f '/Users/jeff/Downloads/google-cloud-sdk/completion.zsh.inc' ]; then
  . '/Users/jeff/Downloads/google-cloud-sdk/completion.zsh.inc'
fi

# ripgrep
export RIPGREP_CONFIG_PATH="$XDG_CONFIG_HOME/ripgrep/rg.conf"

# ── Aliases ─────────────────────────────────────────────────────────────────────

# System
alias rl="source ~/.zshrc"
alias nv="neovim"
alias v="neovim"
alias top="htop"
alias less="less -N"
alias sudo='sudo env PATH="$PATH"'
alias ..="cd .."
alias ...="cd ../.."
alias ....="cd ../../.."
alias projects="cd ~/projects"
alias cpu_usage="watch \"ps -Ao user,uid,comm,pid,pcpu,tty -r | head -n 6\""

# Git
alias g="git"
alias lg="lazygit"
alias gm="git commit"
alias gdiff="git --no-pager diff"

# Tmux
alias hv='tmux new-session -As hive hive'
alias t='tmux new-session -As $(basename $PWD)'

# ── Prompt ──────────────────────────────────────────────────────────────────────

autoload -Uz vcs_info
zstyle ':vcs_info:*' enable git
zstyle ':vcs_info:git*' formats "(%F{yellow}@%b%f)"
precmd() { vcs_info }
setopt prompt_subst
prompt='%F{green}%2/%f${vcs_info_msg_0_} %(?.%F{#00ff00}√.%F{#ff0000}%?)%f>'

# ── Completions ─────────────────────────────────────────────────────────────────

complete -o nospace -C /usr/local/bin/terraform terraform
source ${BREW_PATH}/share/zsh/site-functions/aws_zsh_completer.sh
complete -o nospace -C /Users/jeff/projects/g/rrc-stats/bin/rrc rrc
