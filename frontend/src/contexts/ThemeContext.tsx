import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

type ThemeOption = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: ThemeOption;
  isDark: boolean;
  toggleTheme: () => void;
  /** 페이지에서 사용: isVirt 기본값에 사용자 테마 설정을 오버라이드 */
  resolvePageDark: (isVirt: boolean) => boolean;
}

const STORAGE_KEY = 'whalearc_theme';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getSystemDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolveIsDark(theme: ThemeOption): boolean {
  if (theme === 'system') return getSystemDark();
  return theme === 'dark';
}

const CYCLE: Record<ThemeOption, ThemeOption> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<ThemeOption>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
    } catch {
      // localStorage unavailable
    }
    return 'system';
  });

  const [isDark, setIsDark] = useState(() => resolveIsDark(theme));

  // Update isDark when theme changes or system preference changes
  useEffect(() => {
    setIsDark(resolveIsDark(theme));

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [theme]);

  // Persist to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => CYCLE[prev]);
  }, []);

  /** system이면 isVirt 기반 (기존 동작), light/dark면 사용자 선택 우선 */
  const resolvePageDark = useCallback((isVirt: boolean) => {
    if (theme === 'system') return !isVirt; // 기존 동작: virt=라이트, no-virt=다크
    return theme === 'dark';
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme, resolvePageDark }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
