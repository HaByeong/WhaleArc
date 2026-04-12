import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import SplashLoading from './components/SplashLoading';
import VirtSplashLoading from './components/VirtSplashLoading';
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
const FeedbackPage = lazy(() => import('./pages/FeedbackPage'));
const PortfolioDetailPage = lazy(() => import('./pages/PortfolioDetailPage'));
const MyPortfolioPage = lazy(() => import('./pages/MyPortfolioPage'));
const UserPage = lazy(() => import('./pages/UserPage'));
const VirtDashboardPage = lazy(() => import('./pages/VirtDashboardPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const DisclaimerPage = lazy(() => import('./pages/DisclaimerPage'));
const GoldenCrossChart = lazy(() => import('./components/GoldenCrossChart'));

// body에 테마 + virt/novirt 클래스 적용
const THEME_CLASSES = ['whalearc-dark', 'whalearc-virt', 'whalearc-novirt'] as const;
const DarkModeController = () => {
  const location = useLocation();
  const { isDark } = useTheme();
  useEffect(() => {
    const isVirtRoute = location.pathname.startsWith('/virt');
    const isAuthRoute = ['/', '/login', '/signup', '/auth/callback', '/forgot-password', '/reset-password', '/terms', '/privacy', '/disclaimer'].includes(location.pathname);

    // 기존 테마 클래스 제거
    document.body.classList.remove(...THEME_CLASSES);

    // 다크 모드는 모든 페이지에 적용
    if (isDark) document.body.classList.add('whalearc-dark');

    if (!isAuthRoute) {
      if (isVirtRoute) document.body.classList.add('whalearc-virt');
      else document.body.classList.add('whalearc-novirt');
    }

    return () => { document.body.classList.remove(...THEME_CLASSES); };
  }, [location.pathname, isDark]);
  return null;
};

/** Suspense fallback — 현재 URL에 따라 virt/real 로딩 화면 분기 */
const RouteSplashLoading = () => {
  const isVirt = window.location.pathname.startsWith('/virt');
  return isVirt ? <VirtSplashLoading /> : <SplashLoading />;
};

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
      <Router>
        <DarkModeController />

        <AuthProvider>
        <Suspense fallback={<RouteSplashLoading />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/disclaimer" element={<DisclaimerPage />} />
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
            path="/feedback"
            element={
              <ProtectedRoute>
                <FeedbackPage />
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
          <Route path="/virt/feedback" element={<ProtectedRoute><FeedbackPage /></ProtectedRoute>} />
          <Route path="/virt/user" element={<ProtectedRoute><UserPage /></ProtectedRoute>} />
          <Route path="/virt/portfolio/:portfolioId" element={<ProtectedRoute><PortfolioDetailPage /></ProtectedRoute>} />
          <Route path="/golden-cross" element={<GoldenCrossChart />} />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </Suspense>
        </AuthProvider>

      </Router>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
