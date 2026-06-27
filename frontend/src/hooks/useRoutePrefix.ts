import { useLocation, useNavigate, type NavigateOptions } from 'react-router-dom';
import { useCallback } from 'react';

const AUTH_PATHS = ['/login', '/signup', '/forgot-password', '/reset-password', '/auth'];

export function useRoutePrefix() {
  const location = useLocation();
  // 정확한 세그먼트 경계로 비교 — '/virtual' 등이 virt 섹션으로 오인되지 않게.
  const p = location.pathname;
  const isVirt = p === '/virt' || p.startsWith('/virt/');
  const prefix = isVirt ? '/virt' : '';

  return { prefix, isVirt };
}

export function useVirtNavigate() {
  const navigate = useNavigate();
  const { prefix } = useRoutePrefix();

  const virtNavigate = useCallback(
    (path: string, options?: NavigateOptions) => {
      if (!prefix || !path.startsWith('/') || path.startsWith(prefix) || AUTH_PATHS.some(p => path.startsWith(p))) {
        navigate(path, options);
        return;
      }

      // 쿼리스트링 분리 후 prefix 적용
      const qIndex = path.indexOf('?');
      if (qIndex === -1) {
        navigate(`${prefix}${path}`, options);
      } else {
        const pathname = path.slice(0, qIndex);
        const search = path.slice(qIndex);
        navigate(`${prefix}${pathname}${search}`, options);
      }
    },
    [navigate, prefix]
  );

  return virtNavigate;
}
