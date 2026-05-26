import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

type Mode = 'light' | 'dark';
export type Section = 'public' | 'virt' | 'novirt';

interface ThemeContextType {
  isDark: boolean;
  section: Section;
  canToggle: boolean;
  toggleTheme: () => void;
}

// 섹션별로 테마를 따로 기억한다 (랜딩 등 public 은 저장하지 않음)
const VIRT_KEY = 'whalearc_theme_virt';
const NOVIRT_KEY = 'whalearc_theme_novirt';

// 섹션 기본값: virt 는 라이트, novirt 는 다크
const DEFAULTS: Record<'virt' | 'novirt', Mode> = {
  virt: 'light',
  novirt: 'dark',
};

// 항상 라이트로 고정되는 공개 페이지 (랜딩 / 인증 / 약관 등)
const PUBLIC_ROUTES = [
  '/', '/login', '/signup', '/auth/callback',
  '/forgot-password', '/reset-password',
  '/terms', '/privacy', '/disclaimer',
];

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function readMode(key: string, fallback: Mode): Mode {
  try {
    const v = localStorage.getItem(key);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    // localStorage unavailable
  }
  return fallback;
}

function resolveSection(pathname: string): Section {
  if (PUBLIC_ROUTES.includes(pathname)) return 'public';
  if (pathname.startsWith('/virt')) return 'virt';
  return 'novirt';
}

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const { pathname } = useLocation();
  const section = resolveSection(pathname);

  const [virtMode, setVirtMode] = useState<Mode>(() => readMode(VIRT_KEY, DEFAULTS.virt));
  const [novirtMode, setNovirtMode] = useState<Mode>(() => readMode(NOVIRT_KEY, DEFAULTS.novirt));

  // 공개 페이지는 항상 라이트, 그 외에는 섹션별 설정을 따른다
  const isDark =
    section === 'public' ? false :
    section === 'virt' ? virtMode === 'dark' :
    novirtMode === 'dark';

  const canToggle = section !== 'public';

  const toggleTheme = useCallback(() => {
    if (section === 'virt') {
      setVirtMode(prev => {
        const next: Mode = prev === 'dark' ? 'light' : 'dark';
        try { localStorage.setItem(VIRT_KEY, next); } catch { /* ignore */ }
        return next;
      });
    } else if (section === 'novirt') {
      setNovirtMode(prev => {
        const next: Mode = prev === 'dark' ? 'light' : 'dark';
        try { localStorage.setItem(NOVIRT_KEY, next); } catch { /* ignore */ }
        return next;
      });
    }
    // public: 토글 무시 (항상 라이트)
  }, [section]);

  // 다른 탭에서 변경된 설정 동기화
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === VIRT_KEY) setVirtMode(readMode(VIRT_KEY, DEFAULTS.virt));
      if (e.key === NOVIRT_KEY) setNovirtMode(readMode(NOVIRT_KEY, DEFAULTS.novirt));
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const value = useMemo(
    () => ({ isDark, section, canToggle, toggleTheme }),
    [isDark, section, canToggle, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextType => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
