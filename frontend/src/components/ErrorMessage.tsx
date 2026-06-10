import { useMemo } from 'react';

type ErrorVariant = 'error' | 'empty' | 'offline' | 'notfound';

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  variant?: ErrorVariant;
}

const OCEAN_MESSAGES: Record<ErrorVariant, { titles: string[]; whales: string[] }> = {
  error: {
    // 실패 상태는 명확하게(돈 다루는 화면 = 명확성이 신뢰). 분위기는 고래 일러스트로만 유지.
    titles: ['데이터를 불러오지 못했어요', '잠시 문제가 생겼어요'],
    whales: ['/whales/sperm-whale.png', '/whales/humpback.png', '/whales/gray-whale.png'],
  },
  empty: {
    // 빈 상태는 격려 톤 유지(에러 아님 — 브랜드 보이스)
    titles: ['이 바다는 고요하네요', '아직 항해를 시작하지 않았어요', '수면 위로 올라온 게 없어요'],
    whales: ['/whales/beluga.png', '/whales/dolphin.png', '/whales/narwhal.png'],
  },
  offline: {
    titles: ['인터넷 연결이 끊겼어요', '네트워크에 연결할 수 없어요'],
    whales: ['/whales/orca.png', '/whales/blue-whale.png'],
  },
  notfound: {
    titles: ['이 해역에는 아무것도 없어요', '잘못된 항로에요'],
    whales: ['/whales/risso-dolphin.png', '/whales/spotted-dolphin.png'],
  },
};

const VARIANT_STYLES: Record<ErrorVariant, { bg: string; border: string; titleColor: string; wave: string }> = {
  error: { bg: 'from-red-50 to-white', border: 'border-red-100', titleColor: 'text-red-400', wave: 'bg-red-100/50' },
  empty: { bg: 'from-blue-50 to-white', border: 'border-blue-100', titleColor: 'text-blue-400', wave: 'bg-blue-100/50' },
  offline: { bg: 'from-gray-50 to-white', border: 'border-gray-200', titleColor: 'text-gray-400', wave: 'bg-gray-100/50' },
  notfound: { bg: 'from-amber-50 to-white', border: 'border-amber-100', titleColor: 'text-amber-400', wave: 'bg-amber-100/50' },
};

const ErrorMessage = ({
  message,
  onRetry,
  retryLabel = '다시 시도',
  variant = 'error',
}: ErrorMessageProps) => {
  const { title, whale } = useMemo(() => {
    const config = OCEAN_MESSAGES[variant];
    return {
      title: config.titles[Math.floor(Math.random() * config.titles.length)],
      whale: config.whales[Math.floor(Math.random() * config.whales.length)],
    };
  }, [variant]);

  const style = VARIANT_STYLES[variant];

  return (
    <div className={`bg-gradient-to-b ${style.bg} border ${style.border} rounded-2xl p-8 text-center relative overflow-hidden`}>
      {/* 파도 애니메이션 배경 */}
      <div className="absolute bottom-0 left-0 right-0 h-16 overflow-hidden opacity-30">
        <div className={`absolute bottom-0 left-0 right-0 h-8 ${style.wave} rounded-t-[100%] animate-pulse`} />
        <div className={`absolute bottom-0 left-[-10%] right-[-10%] h-6 ${style.wave} rounded-t-[100%] animate-pulse`} style={{ animationDelay: '0.5s' }} />
      </div>

      <div className="relative z-10">
        {/* 고래 이미지 */}
        <div className="w-16 h-16 mx-auto mb-4 opacity-60 flex items-center justify-center text-3xl">
          <img src={whale} alt="" className="w-full h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; e.currentTarget.parentElement!.textContent = '🐋'; }} />
        </div>

        <p className={`${style.titleColor} text-sm font-bold tracking-wide mb-1`}>{title}</p>
        <p className="text-gray-500 text-sm mb-5">{message}</p>

        {onRetry && (
          <button
            onClick={onRetry}
            className="px-5 py-2.5 bg-whale-light text-white rounded-xl hover:bg-whale-accent transition-all text-sm font-semibold shadow-sm hover:shadow-md active:scale-95"
          >
            {retryLabel}
          </button>
        )}
      </div>
    </div>
  );
};

export default ErrorMessage;
