import { Navigate, useLocation } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * 로그인 필요 페이지를 보호하는 컴포넌트
 * 로그인하지 않은 사용자는 로그인 페이지로 리다이렉트
 */
const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const location = useLocation();
  
  // localStorage에서 직접 확인 (더 확실한 방법)
  const accessToken = localStorage.getItem('accessToken');
  const isAuthenticated = !!accessToken;
  
  if (!isAuthenticated) {
    return (
      <Navigate 
        to="/login" 
        replace 
        state={{ 
          from: location.pathname,
          message: '로그인이 필요한 페이지입니다. 로그인해주세요.' 
        }} 
      />
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;

