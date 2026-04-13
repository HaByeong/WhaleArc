#!/usr/bin/env bash
# main 브랜치의 최신 코드를 prod 환경에 배포합니다.
# 실 사용자 트래픽이 있는 환경이므로 수 초의 downtime이 발생합니다.
#
# 사용법:
#   ./scripts/deploy-prod.sh          # 전체 배포
#   ./scripts/deploy-prod.sh frontend  # 프론트만
#   ./scripts/deploy-prod.sh backend   # 백엔드만

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${1:-all}"
TMUX_SESSION="WhaleArc"

log() { printf '\033[0;32m[deploy-prod]\033[0m %s\n' "$*"; }
warn() { printf '\033[0;33m[deploy-prod]\033[0m %s\n' "$*"; }
err() { printf '\033[0;31m[deploy-prod]\033[0m %s\n' "$*" >&2; exit 1; }

cd "$REPO_ROOT"

current_branch=$(git rev-parse --abbrev-ref HEAD)
if [[ "$current_branch" != "main" ]]; then
  err "현재 브랜치가 'main'이 아닙니다 (현재: $current_branch). 'git checkout main' 먼저 하세요."
fi

warn "prod 배포입니다. 수 초간 downtime이 발생할 수 있습니다. 계속하려면 Enter, 취소하려면 Ctrl+C."
read -r _

log "git pull origin main"
git pull --ff-only origin main

tmux has-session -t "$TMUX_SESSION" 2>/dev/null || err "tmux 세션 '$TMUX_SESSION'이 없습니다."

if [[ "$TARGET" == "all" || "$TARGET" == "backend" ]]; then
  log "백엔드 빌드"
  (cd backend && ./gradlew bootJar -x test)
  log "백엔드 재시작 (tmux: $TMUX_SESSION:backend)"
  tmux send-keys -t "$TMUX_SESSION:backend" C-c
  sleep 2
  tmux send-keys -t "$TMUX_SESSION:backend" 'source ~/.config/whalearc/prod.env && ./gradlew bootRun' Enter
fi

if [[ "$TARGET" == "all" || "$TARGET" == "frontend" ]]; then
  log "프론트 빌드 (mode=production → dist-prod)"
  (cd frontend && npm ci && npm run build:prod)
  log "프론트 재시작 (tmux: $TMUX_SESSION:frontend)"
  tmux send-keys -t "$TMUX_SESSION:frontend" C-c
  sleep 1
  tmux send-keys -t "$TMUX_SESSION:frontend" 'npm run serve:prod' Enter
fi

log "배포 완료. 확인: https://whale-arc.com"
