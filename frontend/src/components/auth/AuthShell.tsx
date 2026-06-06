import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/* ────────────────────────────────────────────────────────────
   인증 페이지 공용 셸 — 「디자인 개편」 콘솔/랜딩과 동일 토큰
   bg #060b1f / panel rgba(white) / accent #2c6fe6 / glow #5b9dff
   ※ 라이트 모드에서도 다크 유지: wa-force-dark + 인라인 색
   ※ 로직은 각 페이지에 두고, 여기서는 외형(배경·브랜드·폼 요소)만 제공
   ──────────────────────────────────────────────────────────── */

const FONT = "'Pretendard','Noto Sans KR',system-ui,sans-serif";

export const cardStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.015))',
  border: '1px solid rgba(255,255,255,.10)',
};

const panelStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.018))',
  border: '1px solid rgba(255,255,255,.12)',
  boxShadow: '0 50px 110px -50px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.04)',
};

/** 입력 필드 공용 클래스 (글로우 포커스 링) */
export const AUTH_INPUT =
  'w-full rounded-xl px-4 py-3 text-[15px] text-white placeholder-white/30 transition-colors ' +
  'bg-white/[0.04] border border-white/10 focus:outline-none focus:border-[#5b9dff]/70 ' +
  'focus:ring-2 focus:ring-[#5b9dff]/25';

export const AUTH_LABEL = 'block text-sm font-medium mb-2 text-white/70';

/** 전체 다크 배경 셸 — 상단 라디얼 + 글로우 오브 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="wa-force-dark min-h-screen text-white" style={{ background: '#060b1f', fontFamily: FONT }}>
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[560px]"
          style={{ background: 'radial-gradient(120% 90% at 80% 0%, #1d3a7a 0%, #0a1230 46%, #060b1f 100%)' }} />
        <div className="absolute left-1/2 top-[6%] h-[420px] w-[680px] -translate-x-1/2 rounded-full"
          style={{ background: 'radial-gradient(50% 50% at 50% 50%, rgba(91,157,255,.16), transparent 70%)' }} />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/** 큰 히어로 — 고래 + WHALEARC + 카피 (+연동 배지) — 로그인/회원가입용 */
export function AuthHero({
  badge, title, subtitle, note, connectors,
}: {
  badge?: ReactNode;
  title: string;
  subtitle?: string;
  note?: string;
  connectors?: string[];
}) {
  return (
    <div className="relative px-6 pt-14 pb-4 text-center md:pt-20">
      <Link to="/" className="inline-block" aria-label="WhaleArc 홈으로">
        <div className="relative mx-auto mb-1 h-36 w-36 md:h-48 md:w-48">
          <div className="pointer-events-none absolute inset-0"
            style={{ background: 'radial-gradient(45% 45% at 50% 45%, rgba(91,157,255,.28), transparent 70%)' }} />
          <img src="/whale-hero-logo.png" alt="WhaleArc" className="whale-hero-swim relative h-full w-full object-contain"
            style={{ filter: 'drop-shadow(0 0 36px rgba(91,157,255,.4))' }} />
        </div>
      </Link>
      {badge && <div className="mb-3">{badge}</div>}
      <h1 className="whalearc-text text-3xl font-extrabold tracking-tighter md:text-4xl">{title}</h1>
      {subtitle && <p className="mt-2 text-balance break-keep text-[15px] text-white/70">{subtitle}</p>}
      {note && <p className="mx-auto mt-2 max-w-md text-balance break-keep text-sm text-white/45">{note}</p>}
      {connectors && connectors.length > 0 && (
        <div className="mt-5 flex items-center justify-center gap-2">
          {connectors.map((name) => (
            <span key={name} className="rounded-md border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[11px] text-white/45">
              {name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** 컴팩트 브랜드 헤더 — 비밀번호 찾기/재설정용 */
export function AuthBrand() {
  return (
    <div className="relative pt-14 pb-8 text-center">
      <Link to="/" className="inline-flex items-center gap-2.5" aria-label="WhaleArc 홈으로">
        <img src="/brand-whale.png" alt="" className="h-9 w-9 object-contain"
          style={{ filter: 'drop-shadow(0 0 12px rgba(91,157,255,.4))' }} />
        <span className="whalearc-text text-xl tracking-tighter">WHALEARC</span>
      </Link>
    </div>
  );
}

/** 유리질 패널 카드 (폼 컨테이너) */
export function AuthPanel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl p-6 sm:p-7 ${className}`} style={panelStyle}>
      {children}
    </div>
  );
}

/** 일반 정보/기능 카드 (우측 컬럼용) */
export function AuthCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl p-6 ${className}`} style={cardStyle}>
      {children}
    </div>
  );
}

/** 글로우 프라이머리 버튼 (랜딩 PrimaryBtn 동일 톤) */
export function PrimaryButton({
  children, type = 'submit', disabled, onClick, className = '',
}: {
  children: ReactNode;
  type?: 'submit' | 'button';
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[15px] font-semibold text-white transition-transform duration-200 hover:-translate-y-0.5 disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      style={{
        background: 'linear-gradient(180deg,#4d8aff,#2c6fe6 62%,#2257c8)',
        border: '1px solid rgba(140,190,255,.5)',
        boxShadow: '0 14px 30px -12px rgba(44,111,230,.7), inset 0 1px 0 rgba(255,255,255,.4), inset 0 -2px 6px rgba(8,20,50,.3)',
      }}
    >
      {children}
    </button>
  );
}

const GoogleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

/** 구글 OAuth 버튼 */
export function GoogleButton({
  onClick, disabled, label,
}: {
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 font-medium text-white/90 transition-colors hover:bg-white/[0.07] disabled:opacity-50"
    >
      <GoogleIcon />
      <span>{label}</span>
    </button>
  );
}

/** 「또는 …」 구분선 */
export function AuthDivider({ children }: { children: ReactNode }) {
  return (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
      <div className="relative flex justify-center">
        <span className="px-3 text-xs text-white/40" style={{ background: '#0b1126' }}>{children}</span>
      </div>
    </div>
  );
}

type Tone = 'error' | 'info' | 'success';
const TONE: Record<Tone, string> = {
  error: 'bg-red-500/10 border-red-500/25 text-red-300',
  info: 'bg-[#5b9dff]/10 border-[#5b9dff]/25 text-[#bcd6ff]',
  success: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300',
};

/** 알림 박스 (에러/안내/성공) */
export function AuthAlert({
  tone = 'error', children, className = '',
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border p-3.5 text-sm ${TONE[tone]} ${className}`} role="alert" aria-live="polite">
      {children}
    </div>
  );
}
