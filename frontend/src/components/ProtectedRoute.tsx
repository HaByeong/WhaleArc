import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const location = useLocation();
  const { session, loading, onboardingDone } = useAuth();

  // 온보딩 페이지 자체는 체크 대상에서 제외
  const isOnboardingPage = location.pathname === '/user' && new URLSearchParams(location.search).get('onboarding') === 'true';

  if (loading || onboardingDone === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-10 h-10 border-4 border-whale-light border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location.pathname,
          message: '이 바다에 들어가려면 먼저 로그인이 필요합니다.',
        }}
      />
    );
  }

  if (!onboardingDone && !isOnboardingPage) {
    return <Navigate to="/user?onboarding=true" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
