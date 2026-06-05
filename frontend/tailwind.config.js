/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // 시세·금액 등 숫자에 JetBrains Mono 적용 (index.html에서 로드)
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        // ── 기존 브랜드 블루 (개편본 팔레트로 리튠) ──
        'whale-dark': '#1a2b4d',   // 다크 네이비 (텍스트/딥 배경) — 유지
        'whale-light': '#2c6fe6',  // 액션 블루 (개편본 --accent) ← was #4a90e2
        'whale-accent': '#5b9dff', // 소나 블루 (개편본 --sonar/--accent-glow) ← was #5ba3f5

        // ── 개편본 정식 토큰 (source of truth: /디자인 개편 폴더) ──
        'whale-abyss': '#060b1f',   // 최심 페이지 배경 (다크)
        'whale-abyss-1': '#0a1230', // 패널 표면
        'whale-abyss-2': '#0e1a3d', // 상승 표면
        'whale-abyss-3': '#13234d', // hover
        'whale-sonar': '#5b9dff',   // 글로우/하이라이트
        'whale-action': '#2c6fe6',  // 솔리드 액션/버튼
        'whale-compass': '#f5d061', // 보조 amber
        // 상승/하락 — 한국식(상승=빨강, 하락=파랑)
        'whale-up': '#ef4d4d',      // 다크 상승
        'whale-down': '#4d8aff',    // 다크 하락
        'whale-up-lt': '#dc2626',   // 라이트 상승
        'whale-down-lt': '#2563eb', // 라이트 하락

        // ── cyan 팔레트를 sonar 블루 계열로 리맵 ──
        // 앱 전역의 cyan 강조색(text-cyan-400 등 100+곳)을 개편본 sonar 블루로 통일.
        // 로그인/로딩 포함 전체 통일(2026-05-31 결정). 400=sonar, 600=action 기준 램프.
        cyan: {
          50:  '#eff5ff',
          100: '#dbe9ff',
          200: '#b9d4ff',
          300: '#8bbcff',
          400: '#5b9dff', // sonar (메인 강조)
          500: '#4d8aff',
          600: '#2c6fe6', // action
          700: '#2257c8',
          800: '#1d4ed8',
          900: '#1e3a8a',
          950: '#172554',
        },
      },
    },
  },
  plugins: [],
}
