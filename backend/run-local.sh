#!/usr/bin/env bash
# 로컬 백엔드 실행 — .env(gitignore됨)에서 시크릿을 환경변수로 로드한 뒤 Spring Boot 기동.
# 사용법:  ./run-local.sh
# (.env 가 없으면 시세/거래소 기능이 비활성 상태로 뜬다)
set -euo pipefail
cd "$(dirname "$0")"

if [ -f .env ]; then
  set -a            # 이후 source 되는 변수들을 자동 export
  . ./.env
  set +a
  echo "[run-local] .env 로드 완료 (KIS/암호화 키 주입)"
else
  echo "[run-local] 경고: .env 없음 — KIS 시세/거래소 연동이 비활성화됩니다."
fi

exec ./gradlew bootRun
