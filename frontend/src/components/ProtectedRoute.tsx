import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const location = useLocation();
  const { session, loading } = useAuth();

  if (loading) {
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

  return <>{children}</>;
};

export default ProtectedRoute;
