# WhaleArc (non-Virt) 로고 + 텍스트 이펙트 — 디자인 핸드오프용

non-Virt 다크 네비 헤더에 들어가는 **와이어프레임 캔들차트 로고**와 그 옆 **"WHALEARC" 그라데이션 텍스트** 이펙트입니다.
(Virt 쪽은 고래 꼬리 로고라 다릅니다. 여기 담긴 건 non-Virt 전용입니다.)
React(TSX) + 순수 CSS, 외부 라이브러리 없음.

발동 조건: `showNav && isDark` 일 때 (= 로그인 후 다크 모드 non-Virt 화면).

색상 토큰
- 다크 배경: `whale-dark` (#0f2240 계열)
- 강조선/노드: rgba(56,189,248,…) (sky-400)
- 텍스트 그라데이션: #ffffff → #a8d4ff → #4a90e2

---

## 1. 사용 예시 (헤더)

```tsx
<Link to="/" className="flex items-center gap-1.5">
  <WhaleTailLogo size={40} darkNav />
  <span className="text-xl whalearc-text">WHALEARC</span>
</Link>
```

---

## 2. 로고 컴포넌트 — 와이어프레임 변형 (`WhaleTailLogo.tsx`)

> 이미지 에셋 `/tail-sample-2.png`(와이어프레임 캔들차트) 위에 SVG 외곽선 빛 + 글로우를 얹습니다.
> 애니메이션은 전부 SVG path + CSS라, 이미지를 빼고 외곽선만 살려도 동작합니다.

```tsx
interface WhaleTailLogoProps {
  size?: number;
}

const WhaleTailLogo = ({ size = 40 }: WhaleTailLogoProps) => {
  const s = size * 2.3; // 와이어프레임은 살짝 크게 잡고 음수 마진으로 보정

  return (
    <div
      className="wt-logo-wrap relative"
      style={{
        width: s, height: s, overflow: 'visible',
        marginRight: -4, marginTop: -(s - size) / 2, marginBottom: -(s - size) / 2,
      }}
    >
      {/* 배경 글로우 */}
      <div
        className="wt-glow-pro"
        style={{ position: 'absolute', left: '-20%', right: '-20%', top: '-10%', bottom: '15%' }}
      />

      {/* 윤곽선 따라 흐르는 빛 (좌/우 두 갈래) */}
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" style={{ overflow: 'visible', pointerEvents: 'none' }}>
        <path
          d="M50,68 C46,58 35,48 22,38 C17,34 16,28 20,24 C24,20 28,22 33,27 C38,32 43,38 47,42 C49,44 50,42 50,40"
          fill="none" stroke="rgba(56,189,248,0.6)" strokeWidth="1.2" strokeLinecap="round"
          className="wt-trace-left"
        />
        <path
          d="M50,68 C54,58 65,48 78,38 C83,34 84,28 80,24 C76,20 72,22 67,27 C62,32 57,38 53,42 C51,44 50,42 50,40"
          fill="none" stroke="rgba(56,189,248,0.6)" strokeWidth="1.2" strokeLinecap="round"
          className="wt-trace-right"
        />
      </svg>

      {/* 로고 이미지 */}
      <img
        src="/tail-sample-2.png"
        alt=""
        className="absolute inset-0 w-full h-full object-contain"
        style={{ filter: 'brightness(1.5) contrast(1.3) saturate(1.4) drop-shadow(0 0 10px rgba(56,189,248,0.5))' }}
      />
    </div>
  );
};

export default WhaleTailLogo;
```

---

## 3. CSS (애니메이션 전부)

```css
/* ════════ 로고 래퍼: 호버 시 살짝 떠오름 ════════ */
.wt-logo-wrap {
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.wt-logo-wrap:hover {
  transform: translateY(-2px) scale(1.05);
}

/* ════════ 배경 글로우 — 숨쉬듯 발광 ════════ */
.wt-glow-pro {
  border-radius: 50%;
  background: radial-gradient(
    ellipse,
    rgba(56, 189, 248, 0.25) 0%,
    rgba(74, 144, 226, 0.1) 40%,
    transparent 70%
  );
  animation: wt-glow-pro-pulse 3.5s ease-in-out infinite;
  pointer-events: none;
}
@keyframes wt-glow-pro-pulse {
  0%, 100% { opacity: 0.4; transform: scale(0.92); }
  50%      { opacity: 1;   transform: scale(1.12); }
}

/* ════════ 윤곽선 따라 빛이 흐르는 효과 (와이어프레임) ════════ */
/* stroke-dasharray로 짧은 빛 조각을 만들고, dashoffset을 흘려 외곽선을 타고 달리게 함 */
.wt-trace-left {
  stroke-dasharray: 15 120;
  animation: wt-trace-flow 4s ease-in-out infinite;
}
.wt-trace-right {
  stroke-dasharray: 15 120;
  animation: wt-trace-flow 4s ease-in-out 0.5s infinite; /* 오른쪽은 0.5s 늦게 */
}
@keyframes wt-trace-flow {
  0%   { stroke-dashoffset: 135; }
  100% { stroke-dashoffset: 0; }
}

/* ════════ "WHALEARC" 텍스트 — 좌→우 빛 흐름 그라데이션 ════════ */
.whalearc-text {
  letter-spacing: 0.12em;
  font-weight: 800;
  background: linear-gradient(
    90deg,
    #ffffff 0%, #a8d4ff 25%, #4a90e2 50%, #a8d4ff 75%, #ffffff 100%
  );
  background-size: 300% 100%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: whalearc-shine 5s linear infinite;
  filter: drop-shadow(0 0 8px rgba(74, 144, 226, 0.35));
}
@keyframes whalearc-shine {
  0%   { background-position: 100% 50%; }
  100% { background-position: -100% 50%; }
}
```

---

## 정리: 어떤 효과가 어디에

| 요소 | 클래스 | 효과 |
|------|--------|------|
| 로고 래퍼 | `.wt-logo-wrap` | 호버 시 살짝 떠오름 (scale + translateY, 탄성 easing) |
| 배경 글로우 | `.wt-glow-pro` | 청록색 발광이 숨쉬듯 커졌다 작아짐 |
| 와이어프레임 윤곽 | `.wt-trace-left/right` | 외곽선을 따라 빛 조각이 흐름 (좌/우 0.5s 시차) |
| **WHALEARC 글자** | `.whalearc-text` | 좌→우로 빛이 흐르는 그라데이션 셔이머 (5s 루프) |

> 참고: Virt 쪽 로고(고래 꼬리 + 수면 파도 + 물줄기)는 `darkNav` 없이 `tail.png`를 쓰는 별도 변형입니다. 필요하면 그쪽도 따로 뽑아드릴 수 있어요.
