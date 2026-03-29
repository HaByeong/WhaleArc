import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import SplashLoading from './components/SplashLoading';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignUpPage = lazy(() => import('./pages/SignUpPage'));
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const MarketPage = lazy(() => import('./pages/MarketPage'));
const TradePage = lazy(() => import('./pages/TradePage'));
const StrategyPage = lazy(() => import('./pages/StrategyPage'));
const QuantStorePage = lazy(() => import('./pages/QuantStorePage'));
const RankingPage = lazy(() => import('./pages/RankingPage'));
const PortfolioDetailPage = lazy(() => import('./pages/PortfolioDetailPage'));
const MyPortfolioPage = lazy(() => import('./pages/MyPortfolioPage'));
const UserPage = lazy(() => import('./pages/UserPage'));
const VirtDashboardPage = lazy(() => import('./pages/VirtDashboardPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const GoldenCrossChart = lazy(() => import('./components/GoldenCrossChart'));

// non-Virt 경로에서 body에 다크 모드 클래스 적용
const DarkModeController = () => {
  const location = useLocation();
  useEffect(() => {
    const isVirtRoute = location.pathname.startsWith('/virt');
    const isAuthRoute = ['/', '/login', '/signup', '/auth/callback', '/forgot-password', '/reset-password'].includes(location.pathname);
    if (!isVirtRoute && !isAuthRoute) {
      document.body.classList.add('whalearc-dark');
    } else {
      document.body.classList.remove('whalearc-dark');
    }
    return () => { document.body.classList.remove('whalearc-dark'); };
  }, [location.pathname]);
  return null;
};

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <DarkModeController />

        <AuthProvider>
        <Suspense fallback={<SplashLoading />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/market"
            element={
              <ProtectedRoute>
                <MarketPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/trade"
            element={
              <ProtectedRoute>
                <TradePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/strategy"
            element={
              <ProtectedRoute>
                <StrategyPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/store"
            element={
              <ProtectedRoute>
                <QuantStorePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ranking"
            element={
              <ProtectedRoute>
                <RankingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-portfolio"
            element={
              <ProtectedRoute>
                <MyPortfolioPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/user"
            element={
              <ProtectedRoute>
                <UserPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/portfolio/:portfolioId"
            element={
              <ProtectedRoute>
                <PortfolioDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/api-setting"
            element={
              <ProtectedRoute>
                <VirtDashboardPage />
              </ProtectedRoute>
            }
          />
          {/* Virt 모드 라우트 - 동일한 페이지 컴포넌트 재사용 */}
          <Route path="/virt/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/virt/my-portfolio" element={<ProtectedRoute><MyPortfolioPage /></ProtectedRoute>} />
          <Route path="/virt/market" element={<ProtectedRoute><MarketPage /></ProtectedRoute>} />
          <Route path="/virt/trade" element={<ProtectedRoute><TradePage /></ProtectedRoute>} />
          <Route path="/virt/strategy" element={<ProtectedRoute><StrategyPage /></ProtectedRoute>} />
          <Route path="/virt/store" element={<ProtectedRoute><QuantStorePage /></ProtectedRoute>} />
          <Route path="/virt/ranking" element={<ProtectedRoute><RankingPage /></ProtectedRoute>} />
          <Route path="/virt/user" element={<ProtectedRoute><UserPage /></ProtectedRoute>} />
          <Route path="/virt/portfolio/:portfolioId" element={<ProtectedRoute><PortfolioDetailPage /></ProtectedRoute>} />
          <Route path="/golden-cross" element={<GoldenCrossChart />} />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </Suspense>
        </AuthProvider>

      </Router>
    </ErrorBoundary>
  );
}

export default App;
