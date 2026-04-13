#!/usr/bin/env bash
# test 브랜치의 최신 코드를 받아서 test 환경에 배포합니다.
# - git pull (test 브랜치)
# - 백엔드: 새 JAR 빌드 → tmux 윈도우 재시작
# - 프론트: dist-test 리빌드 → tmux 윈도우 재시작
#
# 사용법:
#   ./scripts/deploy-test.sh          # 전체 배포
#   ./scripts/deploy-test.sh frontend  # 프론트만
#   ./scripts/deploy-test.sh backend   # 백엔드만

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="${1:-all}"
TMUX_SESSION="WhaleArc_test"

log() { printf '\033[0;36m[deploy-test]\033[0m %s\n' "$*"; }
err() { printf '\033[0;31m[deploy-test]\033[0m %s\n' "$*" >&2; exit 1; }

cd "$REPO_ROOT"

# 현재 브랜치 확인
current_branch=$(git rev-parse --abbrev-ref HEAD)
if [[ "$current_branch" != "test" ]]; then
  err "현재 브랜치가 'test'가 아닙니다 (현재: $current_branch). 'git checkout test' 먼저 하세요."
fi

log "git pull origin test"
git pull --ff-only origin test

tmux has-session -t "$TMUX_SESSION" 2>/dev/null || err "tmux 세션 '$TMUX_SESSION'이 없습니다. 먼저 생성하세요."

if [[ "$TARGET" == "all" || "$TARGET" == "backend" ]]; then
  log "백엔드 빌드"
  (cd backend && ./gradlew bootJar -x test)
  log "백엔드 재시작 (tmux: $TMUX_SESSION:backend)"
  tmux send-keys -t "$TMUX_SESSION:backend" C-c
  sleep 2
  tmux send-keys -t "$TMUX_SESSION:backend" 'source ~/.config/whalearc/test.env && ./gradlew bootRun' Enter
fi

if [[ "$TARGET" == "all" || "$TARGET" == "frontend" ]]; then
  log "프론트 빌드 (mode=test → dist-test)"
  (cd frontend && npm ci && npm run build:test)
  log "프론트 재시작 (tmux: $TMUX_SESSION:frontend)"
  tmux send-keys -t "$TMUX_SESSION:frontend" C-c
  sleep 1
  tmux send-keys -t "$TMUX_SESSION:frontend" 'npm run serve:test' Enter
fi

log "배포 완료. 확인: https://test.whale-arc.com"
