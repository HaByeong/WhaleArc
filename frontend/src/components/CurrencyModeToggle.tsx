import type { CurrencyMode } from '../utils/currency';

interface Props {
  mode: CurrencyMode;
  onChange: (m: CurrencyMode) => void;
  isDark?: boolean;
}

/**
 * 포트폴리오 통화 표시 전환 토글.
 * 원화 환산(convert) ↔ 통화 분리(separate)
 */
export default function CurrencyModeToggle({ mode, onChange, isDark = false }: Props) {
  const btn = 'px-2.5 py-1 text-[12px] font-semibold rounded-md transition-colors whitespace-nowrap';
  const active = isDark ? 'bg-cyan-500/20 text-cyan-300' : 'bg-white text-whale-dark shadow-sm';
  const inactive = isDark ? 'text-slate-400 hover:text-slate-200' : 'text-gray-500 hover:text-gray-700';

  return (
    <div
      className={`inline-flex items-center gap-0.5 p-0.5 rounded-lg ${isDark ? 'bg-white/[0.06]' : 'bg-gray-100'}`}
      role="group"
      aria-label="통화 표시 방식"
    >
      <button type="button" onClick={() => onChange('convert')} className={`${btn} ${mode === 'convert' ? active : inactive}`}>
        원화 환산
      </button>
      <button type="button" onClick={() => onChange('separate')} className={`${btn} ${mode === 'separate' ? active : inactive}`}>
        통화 분리
      </button>
    </div>
  );
}
